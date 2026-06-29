"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, Clock, DollarSign, PauseCircle, LifeBuoy } from "lucide-react";

export default function ResponsibleTradingPage() {
  const router = useRouter();

  const sections = [
    {
      icon: DollarSign,
      title: "Set deposit limits",
      body: "Only trade with money you can afford to lose. Decide on a budget before you start and stick to it — never chase losses by depositing more than planned.",
    },
    {
      icon: Clock,
      title: "Take regular breaks",
      body: "Trading for long stretches without a break can affect judgment. Step away regularly, especially after a string of losses.",
    },
    {
      icon: PauseCircle,
      title: "Self-exclusion",
      body: "If you feel you need a break from trading entirely, contact support to request a temporary or permanent self-exclusion on your account.",
    },
    {
      icon: ShieldCheck,
      title: "Know the risks",
      body: "Binary options carry a high risk of losing money rapidly. Most retail clients lose money trading these products — never trade with funds needed for essential expenses.",
    },
    {
      icon: LifeBuoy,
      title: "Get support",
      body: "If trading is affecting your life negatively, organizations like GamCare and BeGambleAware offer free, confidential support.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050a08] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#050a08]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Responsible Trading</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          We want trading to stay enjoyable and within your control. Here are some practices we encourage every trader to follow.
        </p>

        {sections.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4 flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center shrink-0">
              <Icon className="w-4.5 h-4.5 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1">{title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}

        <div className="pt-2 text-center">
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Need to talk to someone? Reach out via Live Chat or contact support directly.
          </p>
        </div>
      </div>
    </div>
  );
}