"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Square, Zap, XCircle, CheckCircle2 } from "lucide-react";
import type { Asset } from "@/lib/assets";

const CONTRACT_TYPES = ["Over/Under"] as const;
const STAKE_PRESETS = [1, 5, 10, 25, 50, 100];

const OVER_UNDER_PAYOUTS: Record<number, { over: number; under: number }> = {
  0: { over: 5.5, under: 0 },
  1: { over: 17.6, under: 566.6 },
  2: { over: 34.2, under: 233.3 },
  3: { over: 56.6, under: 122.2 },
  4: { over: 88.0, under: 66.6 },
  5: { over: 66.6, under: 88.0 },
  6: { over: 122.2, under: 56.6 },
  7: { over: 233.3, under: 34.2 },
  8: { over: 566.6, under: 17.6 },
  9: { over: 0, under: 5.5 },
};

type ContractType = (typeof CONTRACT_TYPES)[number];

interface OrderPanelProps {
  selectedAsset: Asset;
  contractType: ContractType;
  stake: number;
  balance: number;
  tradeError: string;
  onContractTypeChange: (t: ContractType) => void;
  onStakeChange: (s: number) => void;
  onPlaceTrade: (
    direction: "up" | "down",
    meta?: { digit?: number; contractType?: string; digitDirection?: string }
  ) => Promise<boolean>;
  /** Queue of every settled trade since mount, so same-tick settlements
   *  (e.g. two trades expiring on the same price update) are never dropped —
   *  each one is processed individually for session P&L and target/stop checks. */
  settledQueue?: { id: string; profit: number }[];
  /** Set when the AI scanner applies a recommended digit; bumping the nonce
   *  re-triggers the effect even if the digit value repeats. */
  appliedSignal?: { digit: number; nonce: number } | null;
  compact?: boolean;
}

// ── Reusable adjustable number field ──
function AdjustField({
  label,
  value,
  onChange,
  color,
  enabled,
  onToggle,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: "text-emerald-400" | "text-red-400";
  enabled?: boolean;
  onToggle?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const step = value >= 1000 ? 100 : value >= 100 ? 10 : 1;
  const adjust = (delta: number) => onChange(Math.max(1, value + delta * step));
  const dotColor = color === "text-emerald-400" ? "bg-emerald-500" : "bg-red-500";
  const borderColor = color === "text-emerald-400" ? "border-emerald-500" : "border-red-500";

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 1) onChange(Math.round(n * 100) / 100);
    setEditing(false);
  };

  const labelColor = color === "text-emerald-400" ? "text-emerald-500/80" : "text-red-500/80";

  return (
    <div className="bg-[#0d1713] rounded-xl p-1.5 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[8px] font-bold uppercase tracking-wide ${labelColor}`}>{label}</span>
        {onToggle !== undefined && (
          <button
            onClick={onToggle}
            className={`w-6 h-3 rounded-full relative transition-colors ${enabled ? dotColor : "bg-white/20"}`}
          >
            <span className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${enabled ? "left-3" : "left-0.5"}`} />
          </button>
        )}
      </div>
      {editing ? (
        <input
          autoFocus
          type="number"
          step="0.01"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className={`w-full bg-transparent ${color} text-sm font-bold tabular-nums outline-none border-b-2 ${borderColor} pb-0.5 mb-1`}
        />
      ) : (
        <button
          onClick={() => { setRaw(String(value)); setEditing(true); }}
          className={`w-full text-left ${color} text-sm font-bold tabular-nums mb-1 ${enabled === false ? "opacity-30" : ""}`}
        >
          ${value.toLocaleString()}
        </button>
      )}
      <div className="flex gap-1">
        <button onClick={() => adjust(-1)} className="flex-1 h-6 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
          <Minus className="w-3 h-3 text-gray-300" />
        </button>
        <button onClick={() => adjust(1)} className="flex-1 h-6 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
          <Plus className="w-3 h-3 text-gray-300" />
        </button>
      </div>
    </div>
  );
}

export function OrderPanel({
  selectedAsset,
  contractType,
  stake,
  balance,
  tradeError,
  onContractTypeChange,
  onStakeChange,
  onPlaceTrade,
  settledQueue,
  appliedSignal,
  compact = false,
}: OrderPanelProps) {
  const [tradeMode, setTradeMode] = useState<"auto" | "manual">("auto");
  const [selectedDigit, setSelectedDigit] = useState(5);

  // Apply a digit recommended by the AI Entry Scanner whenever a new signal arrives
  useEffect(() => {
    if (appliedSignal) setSelectedDigit(appliedSignal.digit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSignal?.nonce]);

  // Risk controls (Auto mode only)
  const [targetProfit, setTargetProfit] = useState(200);
  const [stopLoss, setStopLoss] = useState(100);
  const [targetEnabled, setTargetEnabled] = useState(true);
  const [stopEnabled, setStopEnabled] = useState(true);

  // Session tracking
  const [sessionPnl, setSessionPnl] = useState(0);
  const [sessionTrades, setSessionTrades] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const [sessionResult, setSessionResult] = useState<"target" | "stop" | null>(null);

  // Auto-mode state. There is intentionally no loop and no "stop requested"
  // flag here: auto mode places exactly one trade per click and reports its
  // result, so there's nothing ongoing to ask to stop mid-flight.
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoDirection, setAutoDirection] = useState<"up" | "down" | null>(null);
  const [autoMeta, setAutoMeta] = useState<{ digit?: number; contractType?: string; digitDirection?: string } | undefined>();
  const [liveTrades, setLiveTrades] = useState(0); // 1 while the single auto trade is pending, else 0
  // Mirrors autoRunning synchronously. `autoRunning` state only updates on
  // the next render, so a rapid double-click/tap on the trade button can
  // pass `if (autoRunningRef.current) return` twice before React ever
  // re-renders the disabled button. This ref is set the instant the trade
  // is accepted, closing that gap and guaranteeing only one trade fires.
  const autoRunningRef = useRef(false);
  // Resolves the moment the placed trade's settlement arrives, so the
  // single-trade flow can wait on real settlement instead of guessing with
  // a fixed timer — this is what makes target profit / stop loss strict.
  const settlementWaiterRef = useRef<(() => void) | null>(null);

  // Insufficient balance popup
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);
  useEffect(() => {
    if (!showInsufficientPopup) return;
    const t = setTimeout(() => setShowInsufficientPopup(false), 2500);
    return () => clearTimeout(t);
  }, [showInsufficientPopup]);

  // Tap-to-edit stake amount (mirrors the AdjustField pattern used for
  // target profit / stop loss below)
  const [editingStake, setEditingStake] = useState(false);
  const [rawStake, setRawStake] = useState("");

  // Mirrors sessionPnl into a ref the instant it commits, so the settlement
  // effect below can read the *true current* P&L synchronously without
  // depending on when React chooses to run a setState updater callback.
  const sessionPnlRef = useRef(sessionPnl);
  useEffect(() => {
    sessionPnlRef.current = sessionPnl;
  }, [sessionPnl]);

  // Applies settled trades to session P&L and reports auto-mode result.
  // Still processes EVERY new entry in settledQueue defensively (not just
  // the latest) in case more than one ever lands in a single update — but
  // with auto mode placing exactly one trade at a time, this is normally
  // exactly one entry, so target/stop reflects that single trade's own
  // profit/loss rather than an accumulated total across multiple trades.
  useEffect(() => {
    if (!settledQueue || settledQueue.length === 0) return;
    const unprocessed = settledQueue.filter((s) => !processedIdsRef.current.has(s.id));
    if (unprocessed.length === 0) return;

    for (const settlement of unprocessed) processedIdsRef.current.add(settlement.id);

    // Walk the batch against sessionPnlRef — which always holds the latest
    // *committed* value — instead of the sessionPnl this effect's own
    // closure captured. That closure value can be stale: if several
    // settledQueue updates land before OrderPanel re-renders, or if a
    // previous setSessionPnl from an earlier batch hasn't flushed yet,
    // `sessionPnl` here would still be whatever it was when this effect
    // function was created, not the true running total.
    let runningPnl = sessionPnlRef.current;
    let hitTarget = false;
    let hitStop = false;

    for (const settlement of unprocessed) {
      runningPnl += settlement.profit;
      if (tradeMode === "auto" && !hitTarget && !hitStop) {
        // Target/stop are evaluated against THIS trade's own profit, not the
        // accumulated session total — one trade, one result. sessionPnl below
        // still accumulates across trades purely for the display ("Session
        // P&L") and is reset by resetSession(); it no longer feeds the
        // target/stop decision.
        if (targetEnabled && settlement.profit >= targetProfit) hitTarget = true;
        else if (stopEnabled && settlement.profit <= -stopLoss) hitStop = true;
      }
    }
    runningPnl = +(runningPnl.toFixed(2));

    // Update the ref immediately (synchronously, before this effect returns)
    // so a second settledQueue change arriving before the next render still
    // sees the up-to-date baseline. setSessionPnl is also called so the UI
    // re-renders with the new value — but the ref, not this call, is now the
    // single source of truth the *logic* relies on.
    sessionPnlRef.current = runningPnl;
    setSessionPnl(runningPnl);

    // Functional updates for the other two counters, for the same reason —
    // always derive from React's latest state, never a closed-over variable.
    setSessionTrades((prev) => prev + unprocessed.length);
    setSessionWins((prev) => prev + unprocessed.filter((s) => s.profit > 0).length);
    setLiveTrades((n) => Math.max(0, n - unprocessed.length));

    if (hitTarget) {
      autoRunningRef.current = false;
      setAutoRunning(false);
      setSessionResult("target");
    } else if (hitStop) {
      autoRunningRef.current = false;
      setAutoRunning(false);
      setSessionResult("stop");
    }

    // Wake up runSingleAutoTrade's await now that this trade's settlement —
    // and the resulting target/stop result, if any — is fully accounted for.
    if (settlementWaiterRef.current) {
      const resolve = settlementWaiterRef.current;
      settlementWaiterRef.current = null;
      resolve();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledQueue]);

  // Resolves once the placed trade's settlement event fires (see effect
  // above). runSingleAutoTrade awaits this instead of a fixed setTimeout, so
  // it reports the real settled result rather than guessing when it's ready.
  const waitForNextSettlement = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      settlementWaiterRef.current = resolve;
    });
  }, []);

  // Auto-mode engine: places exactly ONE trade, waits for it to settle, then
  // stops. Auto mode no longer means "keep trading until target/stop" — it
  // means "place this one trade and tell me clearly whether it hit target,
  // hit stop, or neither." There is intentionally no loop here: one click
  // can never result in more than one trade being placed.
  const runSingleAutoTrade = useCallback(async (
    direction: "up" | "down",
    meta: { digit?: number; contractType?: string; digitDirection?: string } | undefined,
    currentBalance: number,
    currentStake: number,
  ) => {
    autoRunningRef.current = true;
    setAutoRunning(true);
    setLiveTrades(0);

    if (currentStake > currentBalance) {
      autoRunningRef.current = false;
      setAutoRunning(false);
      return;
    }

    const ok = await onPlaceTrade(direction, meta);
    if (!ok) {
      // Failed to place (balance check failed server-side, auth issue, etc.)
      autoRunningRef.current = false;
      setAutoRunning(false);
      return;
    }

    setLiveTrades(1);

    // Wait for this exact trade to settle (price tick resolves it) before
    // reporting target/stop — the settlement effect above applies this
    // trade's own profit/loss to sessionPnl and checks it there.
    await waitForNextSettlement();

    autoRunningRef.current = false;
    setAutoRunning(false);
    setLiveTrades(0);
  }, [onPlaceTrade, waitForNextSettlement]);

  const handleTrade = (direction: "up" | "down") => {
    if (stake > balance) {
      setShowInsufficientPopup(true);
      return;
    }
    const [upLabel, downLabel] = getLabels();
    const meta = {
      digit: selectedDigit,
      contractType,
      digitDirection: direction === "up" ? upLabel : downLabel,
    };

    if (tradeMode === "auto") {
      if (autoRunningRef.current) return; // already running — checked synchronously, can't race
      autoRunningRef.current = true;
      setAutoDirection(direction);
      setAutoMeta(meta);
      runSingleAutoTrade(direction, meta, balance, stake);
    } else {
      // Manual: single trade
      onPlaceTrade(direction, meta);
    }
  };

  const handleStop = () => {
    autoRunningRef.current = false;
    setAutoRunning(false);
    setLiveTrades(0);
  };

  const resetSession = () => {
    setSessionPnl(0);
    setSessionTrades(0);
    setSessionWins(0);
    setSessionResult(null);
  };

  const getLabels = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd" as unknown as ContractType:     return ["Even", "Odd"];
      case "Over/Under":   return ["Over", "Under"];
      case "Match/Differ" as unknown as ContractType: return ["Match", "Differ"];
      default: return ["Over", "Under"];
    }
  };

  const getColors = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd" as unknown as ContractType:     return ["bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 shadow-lg shadow-blue-500/20", "bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:from-purple-500 hover:to-fuchsia-400 shadow-lg shadow-purple-500/20"];
      case "Over/Under":   return ["bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20", "bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-500/20"];
      case "Match/Differ" as unknown as ContractType: return ["bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-500/20", "bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 shadow-lg shadow-rose-500/20"];
      default: return ["bg-emerald-600 hover:bg-emerald-500", "bg-rose-600 hover:bg-rose-500"];
    }
  };

  const getPayoutSplit = (): { upPct: number; downPct: number } => {
    switch (contractType) {
      case "Match/Differ" as unknown as ContractType: return { upPct: 850, downPct: 5 };
      case "Even/Odd" as unknown as ContractType:     return { upPct: 95, downPct: 95 };
      case "Over/Under": {
        const payouts = OVER_UNDER_PAYOUTS[selectedDigit] || { over: 0, under: 0 };
        return {
          upPct: payouts.over,
          downPct: payouts.under,
        };
      }
      default: return { upPct: 0, downPct: 0 };
    }
  };

  const adjustStake = (delta: number) => {
    // Flat $1 steps — no more jumping 1 -> 5 -> 10 -> 25 via the preset tiers.
    const next = Math.round((stake + delta) * 100) / 100; // avoid float drift
    onStakeChange(Math.max(1, next));
  };

  const commitStake = () => {
    const n = parseFloat(rawStake);
    if (!isNaN(n) && n >= 1) onStakeChange(Math.round(n * 100) / 100);
    setEditingStake(false);
  };

  const [upLabel, downLabel] = getLabels();
  const [upColor, downColor] = getColors();
  const { upPct, downPct } = getPayoutSplit();
  const upPayout = stake * (1 + upPct / 100);
  const downPayout = stake * (1 + downPct / 100);
  const winRate = sessionTrades > 0 ? (sessionWins / sessionTrades) * 100 : 0;
  const sessionBlocked = sessionResult !== null;
  const btnBase = "rounded-2xl font-bold text-white text-sm flex items-center justify-center transition-all duration-200 active:scale-95 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none";

  return (
    <div className="flex flex-col gap-0 relative">

      {/* ── Auto / Manual ── */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-white/[0.06]">
        <div className="flex bg-white/[0.04] rounded-xl p-0.5 gap-0.5">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { if (!autoRunningRef.current) setTradeMode(m); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                tradeMode === m ? "bg-[#3B82F6] text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stake ── */}
      <div className="px-2.5 pt-1.5 pb-1.5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-3 py-1.5 mb-1.5">
          <button onClick={() => adjustStake(-1)} className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 flex items-center justify-center transition">
            <Minus className="w-3.5 h-3.5 text-gray-200" />
          </button>
          {editingStake ? (
            <div className="flex items-baseline gap-1">
              <span className="text-gray-400 text-sm">$</span>
              <input
                autoFocus
                type="number"
                min={1}
                step={1}
                value={rawStake}
                onChange={(e) => setRawStake(e.target.value)}
                onBlur={commitStake}
                onKeyDown={(e) => { if (e.key === "Enter") commitStake(); if (e.key === "Escape") setEditingStake(false); }}
                className="w-20 bg-transparent text-white text-xl font-bold tabular-nums outline-none border-b-2 border-[#3B82F6] text-center"
              />
            </div>
          ) : (
            <button
              onClick={() => { setRawStake(String(stake)); setEditingStake(true); }}
              className="flex items-baseline gap-1"
            >
              <span className="text-gray-400 text-sm">$</span>
              <span className="text-white text-xl font-bold tabular-nums">{stake}</span>
            </button>
          )}
          <button onClick={() => adjustStake(1)} className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 flex items-center justify-center transition">
            <Plus className="w-3.5 h-3.5 text-gray-200" />
          </button>
        </div>
        <div className="flex gap-1.5">
          {STAKE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => onStakeChange(s)}
              className={`flex-1 py-1 rounded-full text-[11px] font-bold border transition-all duration-200 ${
                stake === s ? "bg-[#3B82F6] border-[#3B82F6] text-white shadow-[0_2px_10px_rgba(59,130,246,0.35)]" : "border-white/[0.08] bg-white/[0.02] text-gray-400 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              ${s}
            </button>
          ))}
        </div>
      </div>


      {/* ── Risk controls (Auto mode only) ── */}
      {tradeMode === "auto" && (
        <div className="px-2.5 pt-1.5 pb-1.5 border-b border-white/[0.06]">
          <div className="grid grid-cols-2 gap-1.5">
            <AdjustField label="Target profit" value={targetProfit} onChange={setTargetProfit} color="text-emerald-400" enabled={targetEnabled} onToggle={() => setTargetEnabled((v) => !v)} />
            <AdjustField label="Stop loss" value={stopLoss} onChange={setStopLoss} color="text-red-400" enabled={stopEnabled} onToggle={() => setStopEnabled((v) => !v)} />
          </div>
        </div>
      )}

      {/* ── LIVE status bar (shown while auto-loop is running) ── */}
      {autoRunning && (
        <div className="mx-2.5 mt-1.5 mb-1 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
              Live {liveTrades}T
            </span>
          </div>
          <span className={`text-xs font-bold tabular-nums ${sessionPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
          </span>
        </div>
      )}

      {/* ── Digit selector (plain, selectable) ── */}
      <div className="px-2.5 pt-1.5 pb-1.5 border-b border-white/[0.06]">
        <div className="flex justify-between gap-1">
          {Array.from({ length: 10 }, (_, d) => d).map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDigit(d)}
              className={`flex-1 h-7 rounded-lg text-[12px] font-bold transition-all duration-200 min-w-0 ${
                d === selectedDigit
                  ? "bg-[#3B82F6] text-white border border-white/20 shadow-[0_0_12px_rgba(59,130,246,0.6)] scale-110"
                  : "bg-[#0d1713] text-gray-400 border border-white/[0.07] hover:bg-white/[0.06] hover:text-white hover:border-white/20"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* ── Session stats ── */}
      <div className="px-2.5 py-1.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500">
            Last {sessionTrades}T · {sessionWins}W · {sessionTrades - sessionWins}L
          </span>
        </div>
        <span className={`text-[11px] font-bold ${sessionPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
        </span>
      </div>

      {/* ── Error ── */}
      {tradeError && (
        <div className="mx-2.5 mt-1.5 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5 text-center font-medium">
          {tradeError}
        </div>
      )}

      {/* ── Bottom block: payout info + CTA buttons — scrolls inline with everything else ── */}
      <div>
        {/* ── Payout info ── */}
        <div className="px-2.5 pt-1.5 pb-0.5 flex justify-between text-[11px] text-gray-500">
          <span>{selectedAsset.name.replace(" Index", "")}</span>
          <span className="text-[#3B82F6] font-bold">{selectedAsset.payout}% payout</span>
        </div>

        {/* ── CTA buttons or STOP button ── */}
        <div className="px-2.5 pb-2 pt-1.5 grid grid-cols-2 gap-2">
          {autoRunning ? (
            <>
            {/* Left: greyed-out original button showing what's running */}
            <button disabled className={`${btnBase} ${upColor} flex-col gap-0.5 h-14 opacity-40`}>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>
                <span>{autoDirection === "up" ? upLabel : downLabel}</span>
              </div>
              <div className="text-[10px] font-semibold opacity-80">Running…</div>
            </button>
            {/* Right: STOP button */}
            <button
              onClick={handleStop}
              className="h-14 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 transition"
            >
              <Square className="w-4 h-4 fill-white" />
              STOP
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleTrade("up")}
              disabled={sessionBlocked || upPct === 0}
              className={`${btnBase} ${upColor} flex-col gap-0.5 h-14`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>
                <span>{upLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-90">
                <span>Payout ${upPayout.toFixed(2)}</span>
                <span>{upPct.toFixed(1)}%</span>
              </div>
            </button>
            <button
              onClick={() => handleTrade("down")}
              disabled={sessionBlocked || downPct === 0}
              className={`${btnBase} ${downColor} flex-col gap-0.5 h-14`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>
                <span>{downLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-90">
                <span>Payout ${downPayout.toFixed(2)}</span>
                <span>{downPct.toFixed(1)}%</span>
              </div>
            </button>
          </>
        )}
        </div>
      </div>
      {/* ── end pinned bottom block ── */}

      {/* ── Insufficient balance popup ── */}
      {showInsufficientPopup && (
        <div className="sticky bottom-3 left-3 right-3 z-50 mx-2.5">
          <div className="bg-rose-500/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2.5">
            <XCircle className="w-5 h-5 text-white shrink-0" />
            <div className="flex-1">
              <p className="text-white text-sm font-bold">Insufficient balance</p>
              <p className="text-white/80 text-[11px]">
                Need ${stake.toFixed(2)} but only ${balance.toFixed(2)} available
              </p>
            </div>
            <button onClick={() => setShowInsufficientPopup(false)} className="text-white/70 hover:text-white">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Target/Stop session result modal ── */}
      {sessionResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0d1713] border border-white/10 rounded-3xl p-6 w-[88%] max-w-sm text-center shadow-2xl">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              sessionResult === "target" ? "bg-emerald-500/15" : "bg-rose-500/15"
            }`}>
              {sessionResult === "target"
                ? <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                : <XCircle className="w-9 h-9 text-rose-400" />}
            </div>
            <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${
              sessionResult === "target" ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sessionResult === "target" ? "Target Profit Reached" : "Target Loss Reached"}
            </p>
            <p className={`text-3xl font-extrabold tabular-nums mb-5 ${
              sessionResult === "target" ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sessionPnl >= 0 ? "+" : ""}{sessionPnl.toFixed(2)}
              <span className="text-base font-semibold text-gray-400 ml-1">USD</span>
            </p>
            <div className="flex flex-col gap-2.5 mb-5 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Trades</span>
                <span className="text-white font-bold">{sessionTrades}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">W / L</span>
                <span className="text-white font-bold">{sessionWins} / {sessionTrades - sessionWins}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Win Rate</span>
                <span className="text-white font-bold">{winRate.toFixed(1)}%</span>
              </div>
            </div>
            <button
              onClick={resetSession}
              className={`w-full h-12 rounded-2xl font-bold text-white text-sm transition active:scale-95 ${
                sessionResult === "target" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
              }`}
            >
              Continue Trading
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CONTRACT_TYPES };
export type { ContractType };