"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  "Deposit",
  "Withdrawal",
  "Trading",
  "Account",
  "KYC / Verification",
  "Other",
];

export default function SupportPage() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const MAX_LEN = 2000;

  const handleSubmit = () => {
    setError("");
    if (!category) {
      setError("Please select a category");
      return;
    }
    if (!subject.trim()) {
      setError("Please add a brief subject");
      return;
    }
    if (!message.trim()) {
      setError("Please describe your issue");
      return;
    }

    // No backend ticket system yet — this is intentionally a client-side
    // acknowledgement only. Nothing is persisted or sent anywhere.
    setSubmitted(true);
  };

  const resetForm = () => {
    setSubmitted(false);
    setCategory("");
    setSubject("");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-[#050a08] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#050a08]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Support</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-1">Support</h2>
          <p className="text-sm text-gray-400">Need help? Open a ticket and our team will respond shortly</p>
        </div>

        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4 space-y-4">
          {!submitted ? (
            <>
              <p className="text-sm font-bold text-white">Open a New Ticket</p>

              <div>
                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[#3B82F6]/50 appearance-none"
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[#3B82F6]/50"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                  placeholder="Describe your issue in detail. Include any relevant transaction IDs or amounts."
                  rows={5}
                  className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[#3B82F6]/50 resize-none"
                />
                <p className="text-[10px] text-gray-600 text-right mt-1">{message.length}/{MAX_LEN}</p>
              </div>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                className="w-full h-12 rounded-xl bg-[#3B82F6] hover:bg-blue-500 text-white font-bold text-sm transition"
              >
                Submit Ticket
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 mx-auto mb-4 flex items-center justify-center">
                <Clock className="w-7 h-7 text-amber-400" />
              </div>
              <p className="text-base font-bold text-white mb-2">Ticket received</p>
              <p className="text-sm text-gray-400 leading-relaxed mb-5">
                Our support queue is busy right now. Please try again in about an hour, or reach out via Live Chat in the meantime.
              </p>
              <button
                onClick={resetForm}
                className="w-full h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm font-semibold transition"
              >
                Submit another ticket
              </button>
            </div>
          )}
        </div>

        {/* My Tickets placeholder */}
        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">My Tickets</p>
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-xs text-gray-500">You have no open tickets</p>
          </div>
        </div>
      </div>
    </div>
  );
}