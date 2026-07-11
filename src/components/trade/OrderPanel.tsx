"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Square, Zap, XCircle, CheckCircle2, ChevronRight } from "lucide-react";
import type { Asset } from "@/lib/assets";

const CONTRACT_TYPES = [
  "Even/Odd",
  "Match/Differ",
  "Over/Under",
  "Rise/Fall",
  "Higher/Lower",
  "Touch/No Touch",
  "Multipliers",
] as const;
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
  price?: number;
  priceHistory?: number[];
}

// ── Reusable adjustable number field ──
function AdjustField({
  label,
  value,
  onChange,
  color,
  enabled,
  onToggle,
  light = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: "text-emerald-400" | "text-red-400";
  enabled?: boolean;
  onToggle?: () => void;
  light?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const step = value >= 1000 ? 100 : value >= 100 ? 10 : 1;
  const adjust = (delta: number) => onChange(Math.max(1, value + delta * step));
  
  // Responsive/conditional theme styling
  const dotColor = enabled
    ? (color === "text-emerald-400" ? "bg-emerald-500" : "bg-red-500")
    : (light ? "bg-slate-300" : "bg-white/20");
    
  const borderColor = color === "text-emerald-400" ? "border-emerald-500" : "border-red-500";

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 1) onChange(Math.round(n * 100) / 100);
    setEditing(false);
  };

  const labelColor = light
    ? (color === "text-emerald-400" ? "text-emerald-600/80" : "text-red-600/80")
    : (color === "text-emerald-400" ? "text-emerald-500/80" : "text-red-500/80");

  const valueColor = light
    ? (color === "text-emerald-400" ? "text-emerald-600" : "text-red-600")
    : color;

  const bgClass = light
    ? "bg-white border border-slate-200"
    : "bg-[#0d1713] border border-white/[0.06]";

  const buttonBg = light
    ? "bg-slate-100 hover:bg-slate-200 active:scale-95"
    : "bg-white/[0.07] hover:bg-white/[0.15] active:scale-95";

  const buttonIconColor = light ? "text-slate-600" : "text-gray-300";

  return (
    <div className={`rounded-xl p-1.5 ${bgClass}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[8px] font-bold uppercase tracking-wide ${labelColor}`}>{label}</span>
        {onToggle !== undefined && (
          <button
            onClick={onToggle}
            className={`w-6 h-3 rounded-full relative transition-colors ${dotColor}`}
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
          className={`w-full bg-transparent ${valueColor} text-sm font-bold tabular-nums outline-none border-b-2 ${borderColor} pb-0.5 mb-1`}
        />
      ) : (
        <button
          onClick={() => { setRaw(String(value)); setEditing(true); }}
          className={`w-full text-left ${valueColor} text-sm font-bold tabular-nums mb-1 ${enabled === false ? "opacity-30" : ""}`}
        >
          ${value.toLocaleString()}
        </button>
      )}
      <div className="flex gap-1">
        <button onClick={() => adjust(-1)} className={`flex-1 h-6 rounded-lg flex items-center justify-center transition ${buttonBg}`}>
          <Minus className={`w-3 h-3 ${buttonIconColor}`} />
        </button>
        <button onClick={() => adjust(1)} className={`flex-1 h-6 rounded-lg flex items-center justify-center transition ${buttonBg}`}>
          <Plus className={`w-3 h-3 ${buttonIconColor}`} />
        </button>
      </div>
    </div>
  );
}

export function OrderPanel({
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
  priceHistory,
}: OrderPanelProps) {
  const [tradeMode, setTradeMode] = useState<"auto" | "manual">("auto");
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  // Auto-mode state
  const [autoRunning, setAutoRunning] = useState(false);
  const [liveTrades, setLiveTrades] = useState(0); // 1 while the single auto trade is pending, else 0
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
      case "Even/Odd":     return ["Even", "Odd"];
      case "Over/Under":   return ["Over", "Under"];
      case "Match/Differ": return ["Match", "Differ"];
      case "Higher/Lower": return ["Higher", "Lower"];
      case "Touch/No Touch": return ["Touch", "No Touch"];
      default:             return ["Buy", "Sell"];
    }
  };


  const getPayoutSplit = (): { upPct: number; downPct: number } => {
    switch (contractType) {
      case "Match/Differ": return { upPct: 850, downPct: 5 };
      case "Even/Odd":     return { upPct: 95, downPct: 95 };
      case "Over/Under": {
        const payouts = OVER_UNDER_PAYOUTS[selectedDigit] || { over: 0, under: 0 };
        return {
          upPct: payouts.over,
          downPct: payouts.under,
        };
      }
      default: return { upPct: 95, downPct: 95 };
    }
  };

  const commitStake = () => {
    const n = parseFloat(rawStake);
    if (!isNaN(n) && n >= 1) onStakeChange(Math.round(n * 100) / 100);
    setEditingStake(false);
  };

  const [upLabel] = getLabels();
  const { upPct, downPct } = getPayoutSplit();
  const upPayout = stake * (1 + upPct / 100);
  const downPayout = stake * (1 + downPct / 100);
  const winRate = sessionTrades > 0 ? (sessionWins / sessionTrades) * 100 : 0;
  const sessionBlocked = sessionResult !== null;

  const getLastDigit = (val: number) => {
    const cents = Math.round(val * 100);
    return cents % 10;
  };

  const secondLatestDigit = (priceHistory && priceHistory.length >= 2)
    ? getLastDigit(priceHistory[priceHistory.length - 2])
    : null;

  const counts = Array(10).fill(0);
  if (priceHistory && priceHistory.length > 0) {
    priceHistory.forEach((p) => {
      counts[getLastDigit(p)]++;
    });
  }
  const total = (priceHistory && priceHistory.length) || 1;
  const percentages = counts.map((c) => (c / total) * 100);
  const maxPct = Math.max(...percentages);
  const minPct = Math.min(...percentages);

  const renderCircularDigit = (d: number) => {
    const pct = percentages[d] || 0;
    const isSelected = d === selectedDigit;
    const isCold = pct === minPct;
    const isHot = pct === maxPct && maxPct > 0;
    
    // SVG ring calculations
    const strokeWidth = 2;
    const radius = 17;
    const circumference = 2 * Math.PI * radius; // ~106.8
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    let ringColor = "#cbd5e1"; // default track grey
    if (isSelected) ringColor = "#3b82f6";
    else if (isCold) ringColor = "#ef4444"; // red for cold
    else if (isHot) ringColor = "#10b981"; // green for hot

    let circleBg = "bg-white";
    let digitColor = "text-slate-900";
    let pctColor = "text-slate-400 font-medium";
    
    if (isSelected) {
      circleBg = "bg-[#0e244d]"; // filled dark navy
      digitColor = "text-white";
      pctColor = "text-[#00cbd6] font-bold";
    }

    return (
      <div key={d} className="flex flex-col items-center flex-1 min-w-0 relative">
        <button
          onClick={() => setSelectedDigit(d)}
          className={`w-11 h-11 rounded-full relative flex flex-col items-center justify-center transition-all ${circleBg} shadow-sm border border-slate-100 hover:scale-105 active:scale-95`}
        >
          {/* Circular Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.05]">
            <circle
              cx="22"
              cy="22"
              r={radius}
              stroke={isSelected ? "#00cbd6" : ringColor}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Text content inside circle */}
          <span className={`text-[11px] font-extrabold z-10 leading-none ${digitColor}`}>{d}</span>
          <span className={`text-[7px] font-bold z-10 mt-0.5 leading-none tabular-nums ${pctColor}`}>
            {pct.toFixed(1)}%
          </span>
        </button>
        
        {/* Red triangle pointer below circle */}
        {secondLatestDigit === d && (
          <div className="absolute -bottom-1 flex flex-col items-center z-10">
            <div className="w-0 h-0 border-l-[3.5px] border-r-[3.5px] border-b-[4.5px] border-l-transparent border-r-transparent border-b-rose-500 animate-bounce" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-3.5 relative text-slate-800 ${compact ? "" : "p-4 bg-white h-full"}`}>
      
      {/* ── Auto / Manual switcher (light theme) ── */}
      <div className="bg-slate-200/85 rounded-xl p-0.5 flex gap-0.5 shadow-sm shrink-0">
        {(["auto", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { if (!autoRunningRef.current) setTradeMode(m); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all duration-150 ${
              tradeMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Risk controls (if auto mode, light theme) ── */}
      {tradeMode === "auto" && (
        <div className="grid grid-cols-2 gap-1.5 animate-fadeIn shrink-0">
          <AdjustField label="Target profit" value={targetProfit} onChange={setTargetProfit} color="text-emerald-400" enabled={targetEnabled} onToggle={() => setTargetEnabled((v) => !v)} light />
          <AdjustField label="Stop loss" value={stopLoss} onChange={setStopLoss} color="text-red-400" enabled={stopEnabled} onToggle={() => setStopEnabled((v) => !v)} light />
        </div>
      )}

      {/* ── LIVE status bar (shown while auto-loop is running) ── */}
      {autoRunning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center justify-between mt-0.5 animate-pulse shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#107c80] animate-pulse" />
            <span className="text-amber-800 text-[10px] font-bold uppercase tracking-wider">
              Live {liveTrades}T
            </span>
          </div>
          <span className={`text-xs font-bold tabular-nums ${sessionPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
          </span>
        </div>
      )}

      {/* ── 1. Digit selector circular progress rings stats grid (2x5) ── */}
      {(contractType === "Over/Under" || contractType === "Match/Differ") && (
        <div className="space-y-2.5 shrink-0">
          {/* Row 1: 0 - 4 */}
          <div className="flex justify-between items-center gap-1.5 px-2">
            {Array.from({ length: 5 }, (_, i) => i).map((d) => renderCircularDigit(d))}
          </div>
          {/* Row 2: 5 - 9 with side chevrons */}
          <div className="flex items-center gap-1 px-1">
            <button className="text-slate-400 hover:text-slate-600 font-extrabold text-[11px] px-1 active:scale-90 transition shrink-0 select-none">
              «
            </button>
            <div className="flex-1 flex justify-between items-center gap-1.5">
              {Array.from({ length: 5 }, (_, i) => i + 5).map((d) => renderCircularDigit(d))}
            </div>
            <button className="text-slate-400 hover:text-slate-600 font-extrabold text-[11px] px-1 active:scale-90 transition shrink-0 select-none">
              »
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Drag handle & Learn link ── */}
      <div className="flex flex-col items-center py-0.5 shrink-0 select-none">
        <div className="w-10 h-1 bg-slate-300 rounded-full mb-1.5" />
        <button className="text-[11px] font-semibold text-slate-700 underline decoration-dashed decoration-slate-400 underline-offset-4 hover:text-slate-900 active:scale-95 transition">
          Learn about this trade type
        </button>
      </div>

      {/* ── 3. Market type dropdown ── */}
      <div className="relative shrink-0">
        <div
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-100/70 transition shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 select-none shrink-0">
              <div className="w-5.5 h-5.5 bg-rose-50 border border-rose-100 rounded flex items-center justify-center text-rose-500 shadow-sm">
                <svg viewBox="0 0 12 12" className="w-3 h-3 stroke-rose-600" fill="none" strokeWidth="1.8">
                  <line x1="2" y1="10" x2="10" y2="10" />
                  <path d="M4 2h6v6M10 2L3 9" />
                </svg>
              </div>
              <div className="w-5.5 h-5.5 bg-rose-50 border border-rose-100 rounded flex items-center justify-center text-rose-500 shadow-sm">
                <svg viewBox="0 0 12 12" className="w-3 h-3 stroke-rose-600" fill="none" strokeWidth="1.8">
                  <line x1="2" y1="2" x2="10" y2="2" />
                  <path d="M8 10H2V4M2 10l7-7" />
                </svg>
              </div>
            </div>
            <span className="text-sm font-bold text-slate-800">{contractType}</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? "rotate-90" : ""}`} />
        </div>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 py-1.5 max-h-60 overflow-y-auto">
              {CONTRACT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onContractTypeChange(t);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-xs font-bold transition hover:bg-slate-50 flex items-center justify-between ${
                    t === contractType ? "text-[#3B82F6] bg-blue-50/50" : "text-slate-700"
                  }`}
                >
                  <span>{t}</span>
                  {t === contractType && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── 4. Digit tabs row (2x5 flat selector) ── */}
      {(contractType === "Over/Under" || contractType === "Match/Differ") && (
        <div className="bg-[#f1f5f9] border border-slate-200 rounded-xl p-1 shadow-inner shrink-0">
          <div className="grid grid-cols-5 gap-1 rounded-lg overflow-hidden bg-slate-200/40 p-0.5">
            {Array.from({ length: 10 }, (_, d) => d).map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDigit(d)}
                className={`h-10 rounded-lg text-sm font-bold transition-all duration-150 ${
                  d === selectedDigit
                    ? "bg-[#cbd5e1] text-slate-900 shadow-sm border border-slate-300"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Stake Row ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col shrink-0">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-slate-500 font-bold select-none">1 tick</span>
          <div className="flex items-center justify-center font-extrabold text-slate-900 text-base">
            {editingStake ? (
              <div className="flex items-baseline justify-center">
                <input
                  autoFocus
                  type="number"
                  min={1}
                  step={1}
                  value={rawStake}
                  onChange={(e) => setRawStake(e.target.value)}
                  onBlur={commitStake}
                  onKeyDown={(e) => { if (e.key === "Enter") commitStake(); if (e.key === "Escape") setEditingStake(false); }}
                  className="w-16 text-center bg-transparent border-none outline-none font-extrabold text-slate-950 text-base"
                />
              </div>
            ) : (
              <button
                onClick={() => { setRawStake(String(stake)); setEditingStake(true); }}
                className="font-extrabold text-slate-955 cursor-text hover:text-blue-600 transition"
              >
                {stake.toFixed(2)}
              </button>
            )}
            <span className="ml-1 text-slate-700 font-bold">USD</span>
          </div>
          <span className="text-slate-400 font-bold select-none">Stake</span>
        </div>

        {/* Presets shown when editing stake */}
        {editingStake && (
          <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex gap-1.5 overflow-x-auto">
            {STAKE_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => { onStakeChange(s); setEditingStake(false); }}
                className="px-3 py-1 rounded-full text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition active:scale-95"
              >
                ${s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Session stats ── */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-500 font-medium shrink-0">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Last {sessionTrades}T · {sessionWins}W · {sessionTrades - sessionWins}L
          </span>
        </div>
        <span className={`font-bold ${sessionPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
        </span>
      </div>

      {/* ── Error ── */}
      {tradeError && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3.5 py-2 text-center font-semibold shrink-0">
          {tradeError}
        </div>
      )}

      {/* ── CTA buttons or STOP button ── */}
      <div className="grid grid-cols-2 gap-2 mt-1 relative shrink-0">
        {autoRunning ? (
          <>
            {/* Left: Disabled button representing running trade */}
            <button disabled className="h-14 rounded-2xl bg-[#008891]/40 text-white font-bold text-sm flex flex-col items-center justify-center opacity-50">
              <span className="text-[10px] uppercase font-bold opacity-80">Running {upLabel}</span>
              <span className="text-xs font-semibold">Payout ${upPayout.toFixed(2)}</span>
            </button>
            {/* Right: STOP button */}
            <button
              onClick={handleStop}
              className="h-14 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-amber-505 hover:bg-amber-400 active:scale-95 transition"
            >
              <Square className="w-4 h-4 fill-white" />
              STOP
            </button>
          </>
        ) : (
          <>
            {/* Left: Over Button (Teal) */}
            <div className="relative">
              {/* Yellow absolute Risk Disclaimer badge overlapping top-left of the Over button */}
              <div className="absolute -top-2 left-2 z-10 bg-[#e5b51a] text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm select-none border border-yellow-400 uppercase tracking-wide">
                Risk Disclaimer
              </div>
              
              <button
                onClick={() => handleTrade("up")}
                disabled={sessionBlocked || upPct === 0}
                className="w-full h-15 rounded-2xl bg-[#008891] hover:bg-[#00767c] disabled:opacity-40 text-white font-bold text-sm flex flex-col items-center justify-center transition-all duration-200 active:scale-95"
              >
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 stroke-white" fill="none" strokeWidth="2">
                    <line x1="2" y1="10" x2="10" y2="10" />
                    <path d="M4 2h6v6M10 2L3 9" />
                  </svg>
                  <span>Over</span>
                </div>
                <div className="text-[10px] font-semibold opacity-90 mt-0.5">
                  Payout {upPayout.toFixed(2)} USD
                </div>
              </button>
            </div>

            {/* Right: Under Button (Red) */}
            <button
              onClick={() => handleTrade("down")}
              disabled={sessionBlocked || downPct === 0}
              className="h-15 rounded-2xl bg-[#ec3f47] hover:bg-[#d8353d] disabled:opacity-40 text-white font-bold text-sm flex flex-col items-center justify-center transition-all duration-200 active:scale-95"
            >
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 stroke-white" fill="none" strokeWidth="2">
                  <line x1="2" y1="2" x2="10" y2="2" />
                  <path d="M8 10H2V4M2 10l7-7" />
                </svg>
                <span>Under</span>
              </div>
              <div className="text-[10px] font-semibold opacity-90 mt-0.5">
                Payout {downPayout.toFixed(2)} USD
              </div>
            </button>
          </>
        )}
      </div>

      {/* ── Insufficient balance popup ── */}
      {showInsufficientPopup && (
        <div className="sticky bottom-3 left-3 right-3 z-50 mx-2.5">
          <div className="bg-rose-500/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2.5 text-white">
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
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-[88%] max-w-sm text-center shadow-2xl">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              sessionResult === "target" ? "bg-emerald-500/15" : "bg-rose-500/15"
            }`}>
              {sessionResult === "target"
                ? <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                : <XCircle className="w-9 h-9 text-rose-500" />}
            </div>
            <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${
              sessionResult === "target" ? "text-emerald-600" : "text-rose-600"
            }`}>
              {sessionResult === "target" ? "Target Profit Reached" : "Target Loss Reached"}
            </p>
            <p className={`text-3xl font-extrabold tabular-nums mb-5 ${
              sessionResult === "target" ? "text-emerald-600" : "text-rose-600"
            }`}>
              {sessionPnl >= 0 ? "+" : ""}{sessionPnl.toFixed(2)}
              <span className="text-base font-semibold text-slate-500 ml-1">USD</span>
            </p>
            <div className="flex flex-col gap-2.5 mb-5 text-left text-slate-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Trades</span>
                <span className="font-bold">{sessionTrades}</span>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">W / L</span>
                <span className="font-bold">{sessionWins} / {sessionTrades - sessionWins}</span>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Win Rate</span>
                <span className="font-bold">{winRate.toFixed(1)}%</span>
              </div>
            </div>
            <button
              onClick={resetSession}
              className={`w-full h-12 rounded-2xl font-bold text-white text-sm transition active:scale-95 ${
                sessionResult === "target" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
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