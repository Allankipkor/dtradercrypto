"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Users, ExternalLink, Link2, AlertTriangle } from "lucide-react";

type StakeMode = "exact" | "percentage" | "fixed";

const MIN_BALANCE_REQUIRED = 300;

export default function CopyTradingPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [copyKey, setCopyKey] = useState("");
  const [stakeMode, setStakeMode] = useState<StakeMode>("exact");
  const [percentage, setPercentage] = useState(10);
  const [fixedAmount, setFixedAmount] = useState(10);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/balance")
      .then((r) => r.json())
      .then((data) => setBalance(data.balance ?? 0))
      .catch(() => setBalance(0));
  }, []);

  const meetsMinimum = balance !== null && balance >= MIN_BALANCE_REQUIRED;
  const amountKes = (MIN_BALANCE_REQUIRED * 130).toLocaleString();

  const handleConnect = () => {
    setError("");
    if (!copyKey.trim()) {
      setError("Enter a copy trading key to continue");
      return;
    }
    if (!meetsMinimum) {
      setError(`You need at least $${MIN_BALANCE_REQUIRED.toFixed(2)} balance to start copy trading`);
      return;
    }
    // No real Marketer system exists yet — there's nothing to actually
    // connect to. Surface an honest message instead of pretending to succeed.
    setError("Copy Trading isn't open yet. We're still onboarding Marketers — check back soon.");
  };

  const stakeModes: { id: StakeMode; label: string; desc: string }[] = [
    { id: "exact", label: "Exact Copy", desc: "Same amount as Marketer" },
    { id: "percentage", label: "Percentage", desc: "% of Marketer stake" },
    { id: "fixed", label: "Fixed Amount", desc: "Fixed USD amount" },
  ];

  return (
    <div className="min-h-screen bg-[#050a08] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#050a08]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Copy Trading</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-white mb-1">Copy Trading</h2>
            <p className="text-sm text-gray-400">Mirror trades from a Marketer account automatically.</p>
          </div>
          <button
            disabled
            title="Coming soon"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-gray-500 text-xs font-semibold cursor-not-allowed"
          >
            <Users className="w-3.5 h-3.5" />
            Browse Traders
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4 space-y-4">
          {/* Balance requirement banner */}
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            meetsMinimum ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}>
            Minimum balance required: ${MIN_BALANCE_REQUIRED.toFixed(2)} (KES {amountKes}). Your balance: ${balance === null ? "…" : balance.toFixed(2)}
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-2">
              Enter the copy trading key provided by a Marketer to start copying their trades.
            </p>
            <div className="relative">
              <Link2 className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={copyKey}
                onChange={(e) => setCopyKey(e.target.value.toUpperCase())}
                placeholder="e.g. ABCD-EFGH-IJKL"
                className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-3 text-sm text-white outline-none focus:border-[#3B82F6]/50 tracking-wider"
              />
            </div>
          </div>

          {/* Stake mode */}
          <div>
            <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-2">
              Stake Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {stakeModes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setStakeMode(m.id)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    stakeMode === m.id
                      ? "border-[#3B82F6] bg-[#3B82F6]/10"
                      : "border-white/[0.08] bg-[#0d1713]"
                  }`}
                >
                  <p className={`text-xs font-bold mb-0.5 ${stakeMode === m.id ? "text-[#60a5fa]" : "text-gray-300"}`}>
                    {m.label}
                  </p>
                  <p className="text-[10px] text-gray-500 leading-snug">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Stake mode detail */}
          {stakeMode === "exact" && (
            <p className="text-xs text-gray-500 leading-relaxed">
              Your account will stake the exact same USD amount as the Marketer on every trade. Capped at your available balance.
            </p>
          )}
          {stakeMode === "percentage" && (
            <div>
              <p className="text-xs text-gray-500 leading-relaxed mb-2">
                Your account stakes a percentage of the Marketer&apos;s stake on every trade.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={percentage}
                  onChange={(e) => setPercentage(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-bold text-[#60a5fa] w-12 text-right">{percentage}%</span>
              </div>
            </div>
          )}
          {stakeMode === "fixed" && (
            <div>
              <p className="text-xs text-gray-500 leading-relaxed mb-2">
                Your account stakes this fixed amount on every copied trade, regardless of the Marketer&apos;s stake.
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(Number(e.target.value))}
                  className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]/50"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          <button
            onClick={handleConnect}
            className="w-full h-12 rounded-xl bg-[#3B82F6] hover:bg-blue-500 text-white font-bold text-sm transition flex items-center justify-center gap-2"
          >
            <Link2 className="w-4 h-4" />
            Connect
          </button>
        </div>

        {/* Active copies placeholder */}
        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">Active Copy Relationships</p>
          <div className="flex flex-col items-center py-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-xs text-gray-500">You&apos;re not copying any Marketer yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}