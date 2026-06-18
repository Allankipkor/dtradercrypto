"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Zap, XCircle, CheckCircle2 } from "lucide-react";
import type { Asset } from "@/lib/assets";

const CONTRACT_TYPES = ["Rise/Fall", "Even/Odd", "Over/Under", "Match/Differ"] as const;
const DURATIONS = ["1 min", "2 min", "5 min", "10 min", "15 min"];
const STAKE_PRESETS = [1, 5, 10, 25, 50, 100];
const MULTIPLIER_OPTIONS = [2, 3, 5, 10, 20, 50, 100];

type ContractType = (typeof CONTRACT_TYPES)[number];

interface OrderPanelProps {
  selectedAsset: Asset;
  contractType: ContractType;
  duration: string;
  stake: number;
  balance: number;
  tradeError: string;
  onContractTypeChange: (t: ContractType) => void;
  onDurationChange: (d: string) => void;
  onStakeChange: (s: number) => void;
  onPlaceTrade: (
    direction: "up" | "down",
    meta?: { digit?: number; contractType?: string; digitDirection?: string }
  ) => void;
  /** Net profit/loss of the most recently settled trade, so OrderPanel can track session P&L */
  lastSettledProfit?: { id: string; profit: number } | null;
  compact?: boolean;
}

// Reusable adjustable number field (Target profit / Stop loss)
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

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 1) onChange(Math.round(n));
    setEditing(false);
  };

  const borderColor = color === "text-emerald-400" ? "border-emerald-500" : "border-red-500";
  const dotColor = color === "text-emerald-400" ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="bg-[#141822] rounded-xl p-2 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[9px] font-bold uppercase tracking-wide ${color === "text-emerald-400" ? "text-emerald-500/80" : "text-red-500/80"}`}>{label}</span>
        {onToggle !== undefined && (
          <button
            onClick={onToggle}
            className={`w-7 h-3.5 rounded-full relative transition-colors ${enabled ? dotColor : "bg-white/20"}`}
          >
            <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${enabled ? "left-3.5" : "left-0.5"}`} />
          </button>
        )}
      </div>

      {editing ? (
        <input
          autoFocus
          type="number"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className={`w-full bg-transparent ${color} text-base font-bold tabular-nums outline-none border-b-2 ${borderColor} pb-0.5 mb-1.5`}
        />
      ) : (
        <button
          onClick={() => { setRaw(String(value)); setEditing(true); }}
          className={`w-full text-left ${color} text-base font-bold tabular-nums mb-1.5 ${enabled === false ? "opacity-30" : ""}`}
        >
          ${value.toLocaleString()}
        </button>
      )}

      <div className="flex gap-1">
        <button onClick={() => adjust(-1)} className="flex-1 h-7 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
          <Minus className="w-3.5 h-3.5 text-gray-300" />
        </button>
        <button onClick={() => adjust(1)} className="flex-1 h-7 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
          <Plus className="w-3.5 h-3.5 text-gray-300" />
        </button>
      </div>
    </div>
  );
}

export function OrderPanel({
  selectedAsset,
  contractType,
  duration,
  stake,
  balance,
  tradeError,
  onContractTypeChange,
  onDurationChange,
  onStakeChange,
  onPlaceTrade,
  lastSettledProfit,
  compact = false,
}: OrderPanelProps) {
  const [tradeMode, setTradeMode] = useState<"auto" | "manual">("auto");
  const [selectedDigit, setSelectedDigit] = useState(5);

  const [targetProfit, setTargetProfit] = useState(200);
  const [stopLoss, setStopLoss] = useState(100);
  const [multiplierIdx, setMultiplierIdx] = useState(0);
  const [targetEnabled, setTargetEnabled] = useState(true);
  const [stopEnabled, setStopEnabled] = useState(true);

  // Session tracking
  const [sessionPnl, setSessionPnl] = useState(0);
  const [sessionTrades, setSessionTrades] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const [lastProcessedId, setLastProcessedId] = useState<string | null>(null);
  const [sessionResult, setSessionResult] = useState<"target" | "stop" | null>(null);
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);

  useEffect(() => {
    if (!showInsufficientPopup) return;
    const t = setTimeout(() => setShowInsufficientPopup(false), 2500);
    return () => clearTimeout(t);
  }, [showInsufficientPopup]);

  const multiplier = MULTIPLIER_OPTIONS[multiplierIdx];

  // Track settled trades into the running session P&L, and detect target/stop hits
  useEffect(() => {
    if (!lastSettledProfit || lastSettledProfit.id === lastProcessedId) return;
    setLastProcessedId(lastSettledProfit.id);

    const newPnl = sessionPnl + lastSettledProfit.profit;
    const newTrades = sessionTrades + 1;
    const newWins = sessionWins + (lastSettledProfit.profit > 0 ? 1 : 0);

    setSessionPnl(newPnl);
    setSessionTrades(newTrades);
    setSessionWins(newWins);

    if (tradeMode === "auto" && targetEnabled && newPnl >= targetProfit) {
      setSessionResult("target");
    } else if (tradeMode === "auto" && stopEnabled && newPnl <= -stopLoss) {
      setSessionResult("stop");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSettledProfit]);

  const resetSession = () => {
    setSessionPnl(0);
    setSessionTrades(0);
    setSessionWins(0);
    setSessionResult(null);
  };

  const showDigits = contractType !== "Rise/Fall";
  const sessionBlocked = sessionResult !== null;

  const adjustStake = (delta: number) => {
    const steps = [1, 5, 10, 25, 50, 100, 200, 500];
    const idx = steps.findIndex((s) => s >= stake);
    const cur = idx === -1 ? steps.length - 1 : idx;
    onStakeChange(steps[Math.max(0, Math.min(steps.length - 1, cur + delta))]);
  };

  const getLabels = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd":    return ["Even", "Odd"];
      case "Over/Under":  return ["Over", "Under"];
      case "Match/Differ": return ["Match", "Differ"];
      default:            return ["Rise", "Fall"];
    }
  };

  const getColors = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd":    return ["bg-blue-500 hover:bg-blue-400", "bg-purple-500 hover:bg-purple-400"];
      case "Over/Under":  return ["bg-cyan-500 hover:bg-cyan-400", "bg-orange-500 hover:bg-orange-400"];
      case "Match/Differ": return ["bg-emerald-500 hover:bg-emerald-400", "bg-rose-500 hover:bg-rose-400"];
      default:            return ["bg-emerald-500 hover:bg-emerald-400", "bg-rose-500 hover:bg-rose-400"];
    }
  };

  const handleTrade = (direction: "up" | "down") => {
    if (sessionBlocked) return;
    if (stake > balance) {
      setShowInsufficientPopup(true);
      return;
    }
    const [upLabel, downLabel] = getLabels();
    onPlaceTrade(direction, {
      digit: showDigits ? selectedDigit : undefined,
      contractType,
      digitDirection: direction === "up" ? upLabel : downLabel,
    });
  };

  const [upLabel, downLabel] = getLabels();
  const [upColor, downColor] = getColors();
  const btnBase = "rounded-xl font-bold text-white text-sm flex items-center justify-center transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";
  const winRate = sessionTrades > 0 ? (sessionWins / sessionTrades) * 100 : 0;

  // Probability-weighted payout per direction, like TagBinary's Match/Differ split
  // (rare outcome pays much more, common outcome pays close to break-even)
  const getPayoutSplit = (): { upPct: number; downPct: number } => {
    switch (contractType) {
      case "Match/Differ": return { upPct: 850, downPct: 5 };   // Match = 1/10 chance, Differ = 9/10
      case "Even/Odd":     return { upPct: 95, downPct: 95 };    // ~50/50, flat payout
      case "Over/Under": {
        // Over/Under odds shift depending on which digit is selected (0-9 split point)
        const overChance = (9 - selectedDigit) / 9 || 0.01;
        const underChance = (selectedDigit + 1) / 9 || 0.01;
        return {
          upPct: Math.min(950, Math.round((1 / overChance) * 95 * 10) / 10),
          downPct: Math.min(950, Math.round((1 / underChance) * 95 * 10) / 10),
        };
      }
      default: return { upPct: selectedAsset.payout, downPct: selectedAsset.payout }; // Rise/Fall
    }
  };

  const { upPct, downPct } = getPayoutSplit();
  const upPayout = stake * (1 + upPct / 100);
  const downPayout = stake * (1 + downPct / 100);

  return (
    <div className={`flex flex-col gap-0 relative ${compact ? "" : "h-full"}`}>

      {/* ── Auto / Manual ── */}
      <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.06]">
        <div className="flex bg-white/[0.04] rounded-xl p-0.5 gap-0.5">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTradeMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition ${
                tradeMode === m ? "bg-[#3B82F6] text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stake ── */}
      <div className="px-3 pt-2 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-3 py-2 mb-2">
          <button onClick={() => adjustStake(-1)} className="w-8 h-8 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 flex items-center justify-center transition">
            <Minus className="w-4 h-4 text-gray-200" />
          </button>
          <div className="flex items-baseline gap-1">
            <span className="text-gray-400 text-sm">$</span>
            <span className="text-white text-2xl font-bold tabular-nums">{stake}</span>
          </div>
          <button onClick={() => adjustStake(1)} className="w-8 h-8 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 flex items-center justify-center transition">
            <Plus className="w-4 h-4 text-gray-200" />
          </button>
        </div>
        <div className="flex gap-1.5">
          {STAKE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => onStakeChange(s)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                stake === s ? "bg-[#1e3a5f] border-[#3B82F6] text-[#60a5fa]" : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.08]"
              }`}
            >
              ${s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Risk controls (Auto mode only) ── */}
      {tradeMode === "auto" && (
        <div className="px-3 pt-2 pb-2 border-b border-white/[0.06]">
          <div className="grid grid-cols-3 gap-1.5">
            <AdjustField label="Target profit" value={targetProfit} onChange={setTargetProfit} color="text-emerald-400" enabled={targetEnabled} onToggle={() => setTargetEnabled((v) => !v)} />
            <AdjustField label="Stop loss" value={stopLoss} onChange={setStopLoss} color="text-red-400" enabled={stopEnabled} onToggle={() => setStopEnabled((v) => !v)} />
            <div className="bg-[#141822] rounded-xl p-2 border border-white/[0.06]">
              <span className="text-[9px] text-amber-500/80 font-bold uppercase tracking-wide block mb-1">Multiplier</span>
              <p className="text-amber-400 text-base font-bold mb-1.5">×{multiplier}</p>
              <div className="flex gap-1">
                <button onClick={() => setMultiplierIdx((i) => Math.max(0, i - 1))} className="flex-1 h-7 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
                  <Minus className="w-3.5 h-3.5 text-gray-300" />
                </button>
                <button onClick={() => setMultiplierIdx((i) => Math.min(MULTIPLIER_OPTIONS.length - 1, i + 1))} className="flex-1 h-7 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
                  <Plus className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Simple digit target selector (plain, no %, tap to choose) ── */}
      {showDigits && (
        <div className="px-3 pt-2 pb-2 border-b border-white/[0.06]">
          <div className="flex justify-between gap-1">
            {Array.from({ length: 10 }, (_, d) => d).map((d) => {
              const isSelected = d === selectedDigit;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDigit(d)}
                  className={`flex-1 h-8 rounded-lg text-[13px] font-bold transition min-w-0 ${
                    isSelected
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#141822] text-gray-400 border border-white/[0.07] hover:bg-white/[0.06]"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Session stats ── */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
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

      {/* ── Duration ── */}
      <div className="px-3 pt-2 pb-2 border-b border-white/[0.06]">
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                duration === d ? "bg-[#3B82F6] text-white" : "bg-[#141822] text-gray-400 border border-white/[0.07] hover:bg-white/[0.08]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {tradeError && (
        <div className="mx-3 mt-2 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 text-center font-medium">
          {tradeError}
        </div>
      )}

      {/* ── Payout ── */}
      <div className="px-3 pt-2 pb-1 flex justify-between text-[11px] text-gray-500">
        <span>{selectedAsset.name.replace(" Index", "")}</span>
        <span className="text-[#3B82F6] font-bold">{selectedAsset.payout}% payout</span>
      </div>

      {/* ── CTA buttons ── */}
      <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-2.5">
        <button onClick={() => handleTrade("up")} disabled={sessionBlocked} className={`${btnBase} ${upColor} flex-col gap-0.5 h-16`}>
          <div className="flex items-center gap-1.5">
            {showDigits && <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>}
            <span>{upLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-90">
            <span>Payout ${upPayout.toFixed(2)}</span>
            <span>{upPct.toFixed(1)}%</span>
          </div>
        </button>
        <button onClick={() => handleTrade("down")} disabled={sessionBlocked} className={`${btnBase} ${downColor} flex-col gap-0.5 h-16`}>
          <div className="flex items-center gap-1.5">
            {showDigits && <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>}
            <span>{downLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-90">
            <span>Payout ${downPayout.toFixed(2)}</span>
            <span>{downPct.toFixed(1)}%</span>
          </div>
        </button>
      </div>

      {/* ── Insufficient balance popup ── */}
      {showInsufficientPopup && (
        <div className="absolute bottom-20 left-3 right-3 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-rose-500/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2.5">
            <XCircle className="w-5 h-5 text-white shrink-0" />
            <div className="flex-1">
              <p className="text-white text-sm font-bold">Insufficient balance</p>
              <p className="text-white/80 text-[11px]">
                You need ${stake.toFixed(2)} but only have ${balance.toFixed(2)} available
              </p>
            </div>
            <button onClick={() => setShowInsufficientPopup(false)} className="text-white/70 hover:text-white text-xs font-bold px-1">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Target/Stop reached modal ── */}
      {sessionResult && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
          <div className="bg-[#141822] border border-white/10 rounded-3xl p-6 w-[88%] max-w-sm text-center shadow-2xl">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              sessionResult === "target" ? "bg-emerald-500/15" : "bg-rose-500/15"
            }`}>
              {sessionResult === "target" ? (
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              ) : (
                <XCircle className="w-9 h-9 text-rose-400" />
              )}
            </div>
            <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${
              sessionResult === "target" ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sessionResult === "target" ? "Target Profit Reached" : "Target Loss Reached"}
            </p>
            <p className={`text-3xl font-extrabold tabular-nums mb-5 ${
              sessionResult === "target" ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sessionPnl >= 0 ? "+" : ""}{sessionPnl.toFixed(2)} <span className="text-base font-semibold text-gray-400">USD</span>
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

export { CONTRACT_TYPES, DURATIONS };
export type { ContractType };