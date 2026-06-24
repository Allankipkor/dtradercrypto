"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Smartphone, Building2, CheckCircle2, Clock, X } from "lucide-react";

type Tab = "mpesa" | "bank";

interface WithdrawSuccess {
  amount: number;
  amountKes?: number;
  phone?: string;
  method: "mpesa" | "crypto";
}

// Masks a phone number to show only the first 3 and last 3 digits, e.g.
// "0712345678" -> "071****678" (matches the pattern on the success screen).
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

export default function WithdrawPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("mpesa");
  const [balance, setBalance] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<WithdrawSuccess | null>(null);

  const MIN = 100;
  const MAX = 150000;

  useEffect(() => {
    fetch("/api/payments/withdraw")
      .then((r) => r.json())
      .then((data) => {
        setBalance(data.balance ?? 0);
        if (data.phone) setPhone(data.phone);
      })
      .catch(() => setBalance(0));
  }, []);

  const handleWithdraw = async () => {
    setError("");
    const amt = parseFloat(amount);

    if (!amt || amt < MIN) {
      setError(`Minimum withdrawal is $${MIN.toFixed(2)}`);
      return;
    }
    if (amt > MAX) {
      setError(`Maximum withdrawal is $${MAX.toFixed(2)}`);
      return;
    }
    if (balance !== null && amt > balance) {
      setError("Amount exceeds your available balance");
      return;
    }
    if (tab === "mpesa" && !phone) {
      setError("M-Pesa phone number is required");
      return;
    }
    if (tab === "bank" && !walletAddress) {
      setError("Bank account details are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: tab === "mpesa" ? "mpesa" : "crypto", // bank not yet supported server-side; reuse crypto's free-text field for now
          amount: amt,
          phone: tab === "mpesa" ? phone : undefined,
          walletAddress: tab === "bank" ? walletAddress : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");

      setBalance(data.balance ?? balance);
      setAmount("");
      setSuccess({
        amount: amt,
        amountKes: data.amountKes,
        phone: data.phone,
        method: tab === "mpesa" ? "mpesa" : "crypto",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c12] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#0a0c12]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Withdraw Funds</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <p className="text-sm text-gray-400">Withdraw to M-Pesa or your linked bank account</p>

        {/* Available balance */}
        <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <span className="text-emerald-400 text-sm font-bold">$</span>
            </div>
            <span className="text-sm text-gray-400">Available for Withdrawal</span>
          </div>
          <span className="text-xl font-bold text-white tabular-nums">
            {balance === null ? "…" : `$${balance.toFixed(2)}`}
          </span>
        </div>

        {/* Method tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("mpesa")}
            className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition ${
              tab === "mpesa" ? "bg-rose-500 text-white" : "bg-[#0d0f17] border border-white/[0.08] text-gray-300"
            }`}
          >
            <Smartphone className="w-4 h-4" /> M-Pesa
          </button>
          <button
            onClick={() => setTab("bank")}
            className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition ${
              tab === "bank" ? "bg-rose-500 text-white" : "bg-[#0d0f17] border border-white/[0.08] text-gray-300"
            }`}
          >
            <Building2 className="w-4 h-4" /> Bank Withdraw
          </button>
        </div>

        {/* Form */}
        <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-4 space-y-4">
          {tab === "mpesa" ? (
            <div>
              <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                M-Pesa Phone Number
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-rose-500/50"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Payment goes to the number on your account.{" "}
                <button onClick={() => router.push("/account/settings")} className="text-rose-400 hover:underline">
                  Update phone number
                </button>{" "}
                if it&apos;s wrong.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                Bank Account Details
              </label>
              <input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Account number / IBAN"
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-rose-500/50"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
              Withdrawal Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl pl-8 pr-3.5 py-3 text-lg text-white outline-none focus:border-rose-500/50"
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-gray-500">
              <span>Min: ${MIN.toFixed(2)}</span>
              <span>Max: ${MAX.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleWithdraw}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-sm transition"
          >
            {loading ? "Processing…" : `Withdraw to ${tab === "mpesa" ? "M-Pesa" : "Bank"}`}
          </button>
        </div>
      </div>

      {/* Withdrawal requested — success screen */}
      {success && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0d0f17] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setSuccess(null)}
              className="absolute top-4 right-4 z-10 text-white/70 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Green header band */}
            <div className="bg-emerald-500/15 px-6 pt-8 pb-7 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 mx-auto mb-4 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/25 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
              </div>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">
                Withdrawal Requested
              </p>
              <p className="text-4xl font-extrabold text-white tabular-nums">
                ${success.amount.toFixed(2)}
              </p>
              {success.amountKes !== undefined && (
                <p className="text-sm text-gray-400 mt-1.5 tabular-nums">
                  ≈ KES {success.amountKes.toLocaleString("en-US")}
                </p>
              )}
            </div>

            {/* Detail rows */}
            <div className="px-5 py-5 space-y-3">
              {success.method === "mpesa" && success.phone && (
                <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#3B82F6]/15 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-[#3B82F6]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">M-Pesa Phone Number</p>
                    <p className="text-sm font-bold text-white tabular-nums">{maskPhone(success.phone)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3.5">
                <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Average Processing Time</p>
                  <p className="text-sm font-bold text-white">Instant to 2 mins</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-gray-300">Your withdrawal is being processed.</p>
              </div>

              <button
                onClick={() => { setSuccess(null); router.push("/"); }}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition flex items-center justify-center gap-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}