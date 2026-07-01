"use client";

import { useState } from "react";
import { X, Bitcoin, CreditCard, Copy, Check } from "lucide-react";
import {
  PayPalScriptProvider,
  PayPalButtons,
} from "@paypal/react-paypal-js";

type Tab = "crypto" | "card";

// Maps a PayPal orderId -> our own transactionId, bridging createOrder and
// onApprove (PayPalOneTimePaymentButton only hands the orderId back to
// onApprove, not anything else we passed into createOrder). Module-level
// rather than component state since it's short-lived internal plumbing,
// not something that should trigger a re-render.
const paypalTransactionByOrderId: Record<string, string> = {};

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (balance: number) => void;
  userPhone?: string | null;
}

interface CryptoResult {
  address: string;
  amount: number;
  reference: string;
  transactionId: string;
  status: string;
  message?: string;
}

export function DepositModal({ open, onClose, onSuccess }: DepositModalProps) {
  const [tab, setTab] = useState<Tab>("crypto");
  const [amount, setAmount] = useState(10);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cryptoResult, setCryptoResult] = useState<CryptoResult | null>(null);
  const [copied, setCopied] = useState(false);

  const MIN_DEPOSIT = 10;

  if (!open) return null;

  const reset = () => {
    setError("");
    setMessage("");
    setCryptoResult(null);
    setTxHash("");
  };

  const handleDeposit = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: tab,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const raw = data.error ?? data.message ?? data;
        throw new Error(
          typeof raw === "string" ? raw : JSON.stringify(raw)
        );
      }

      if (tab === "crypto") {
        setCryptoResult(data);
        if (data.status === "completed" && data.balance != null) {
          onSuccess(data.balance);
          setMessage(data.message);
        }
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmCrypto = async () => {
    if (!cryptoResult) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/crypto/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: cryptoResult.transactionId,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirmation failed");
      onSuccess(data.balance);
      setMessage(data.message);
      setCryptoResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaypalCreateOrder = async (): Promise<string> => {
    const res = await fetch("/api/payments/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
    // Stash the transactionId on the orderId's own response so the capture
    // step below can find it again — simplest way to thread this through
    // without extra component state, since PayPalButtons' onApprove only
    // gets handed back the orderID, not anything else we passed in here.
    paypalTransactionByOrderId[data.orderId] = data.transactionId;
    // The classic SDK's createOrder expects the bare order ID string to be
    // returned directly — not wrapped in an object, unlike the v6 SDK.
    return data.orderId;
  };

  const handlePaypalApprove = async (data: { orderID: string }) => {
    setLoading(true);
    setError("");
    try {
      const transactionId = paypalTransactionByOrderId[data.orderID];
      const res = await fetch("/api/payments/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, orderId: data.orderID }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Capture failed");
      onSuccess(result.balance);
      setMessage(`Deposit of $${result.amount.toFixed(2)} confirmed!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card payment failed to complete");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Bitcoin | typeof CreditCard }[] = [
    { id: "crypto", label: "USDT", icon: Bitcoin },
    { id: "card", label: "Card", icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm safe-x">
      <div className="w-full sm:max-w-md max-h-[92dvh] sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/[0.07] bg-[#1c2030] shadow-2xl safe-bottom">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-lg font-bold text-white">Deposit Funds</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-white/[0.07]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); reset(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition ${tab === id
                  ? "text-[#3B82F6] border-b-2 border-[#3B82F6]"
                  : "text-gray-500 hover:text-gray-300"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Amount (USD) <span className="text-gray-600">· min ${MIN_DEPOSIT}</span>
            </label>
            <input
              type="number"
              min={MIN_DEPOSIT}
              max={10000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-[#13161e] border border-white/[0.07] text-white text-sm focus:outline-none focus:border-[#3B82F6]/50"
            />
            <div className="flex gap-1.5 mt-2">
              {[10, 25, 50, 100, 200].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`flex-1 py-1 rounded text-[10px] font-medium border transition ${amount === v
                      ? "bg-[#1e3a5f] border-[#3B82F6] text-[#60a5fa]"
                      : "bg-[#13161e] text-gray-400 border-white/[0.07] hover:bg-white/5"
                    }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>



          {tab === "crypto" && cryptoResult && cryptoResult.status === "pending" && (
            <div className="rounded-xl bg-[#13161e] border border-white/[0.07] p-4 space-y-3">
              <p className="text-xs text-gray-400">
                Send <span className="text-white font-bold">${cryptoResult.amount} USDT</span> via
                TRC20 to:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] text-emerald-400 break-all">
                  {cryptoResult.address}
                </code>
                <button
                  onClick={() => copyAddress(cryptoResult.address)}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">Ref: {cryptoResult.reference}</p>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Paste transaction hash"
                className="w-full px-3 py-2 rounded-lg bg-[#1c2030] border border-white/[0.07] text-white text-xs"
              />
              <button
                onClick={confirmCrypto}
                disabled={loading || txHash.length < 10}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: "#3B82F6" }}
              >
                Confirm Payment
              </button>
            </div>
          )}

          {tab === "card" && (
            <div>
              {process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? (
                <PayPalScriptProvider
                  options={{
                    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
                    currency: "USD",
                    intent: "capture",
                  }}
                >
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    createOrder={handlePaypalCreateOrder}
                    onApprove={handlePaypalApprove}
                    onCancel={() => { setError(""); setMessage("Card payment cancelled"); }}
                    onError={(err) => {
                      console.error("PayPal onError:", err);
                      setError(`Card payment error: ${err instanceof Error ? err.message : String(err)}`);
                    }}
                  />
                </PayPalScriptProvider>
              ) : (
                <p className="text-xs text-rose-400">Card payments are not configured</p>
              )}
              <p className="text-[10px] text-gray-500 mt-2 text-center">
                Securely processed by PayPal
              </p>
            </div>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}
          {message && <p className="text-xs text-emerald-400">{message}</p>}

          {!cryptoResult && tab !== "card" && (
            <button
              onClick={handleDeposit}
              disabled={loading || amount < MIN_DEPOSIT}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
              style={{ background: "#3B82F6" }}
            >
              {loading ? "Processing..." : `Deposit $${amount}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}