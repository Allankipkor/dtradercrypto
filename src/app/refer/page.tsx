"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Users, DollarSign, TrendingUp, UserPlus, Copy, Check } from "lucide-react";

export default function ReferPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    // Derive a stable, user-specific looking code from their session id.
    // Cosmetic only for now — no backend tracking exists yet.
    const seed = session?.user?.id ?? session?.user?.email ?? "guest";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    setReferralCode(hash.toString(36).toUpperCase().slice(0, 8).padEnd(8, "X"));
  }, [session]);

  const referralLink = `https://dtradercrypto.com/ref/${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { icon: Users, label: "Total Referred", value: "0", color: "text-emerald-400" },
    { icon: DollarSign, label: "Total Earned", value: "$0.00", color: "text-emerald-400" },
    { icon: TrendingUp, label: "Pending", value: "$0.00", color: "text-emerald-400" },
    { icon: UserPlus, label: "Paid Out", value: "$0.00", color: "text-emerald-400" },
  ];

  return (
    <div className="min-h-screen bg-[#050a08] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#050a08]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Refer & Earn</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-1">Referral Program</h2>
          <p className="text-sm text-gray-400">
            Invite friends and earn 10% commission on every trade they make
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-1">Your Referral Link</p>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            Share this link — you earn 10% of every trade your referrals make
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-gray-300 truncate">
              {referralLink}
            </div>
            <button
              onClick={handleCopy}
              className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>

        {/* Recent referrals */}
        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">Recent Referrals</p>
          <div className="flex flex-col items-center py-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-xs text-gray-500">No referrals yet</p>
            <p className="text-[11px] text-gray-600 mt-1">Share your link to start earning</p>
          </div>
        </div>
      </div>
    </div>
  );
}