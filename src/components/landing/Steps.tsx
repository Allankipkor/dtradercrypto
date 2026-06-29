import { MousePointerClick, Trophy, Wallet } from "lucide-react";

const STEPS = [
  {
    num: 1,
    icon: MousePointerClick,
    title: "Sign Up",
    desc: "Create your free account in 30 seconds. No documents needed to start.",
  },
  {
    num: 2,
    icon: Wallet,
    title: "Deposit",
    desc: "Fund with M-Pesa, crypto, or cards. Start from just $10.",
  },
  {
    num: 3,
    icon: Trophy,
    title: "Trade & Earn",
    desc: "Choose an asset, predict the direction, and earn up to 95% profit.",
  },
];

export function Steps() {
  return (
    <section id="steps" className="max-w-6xl mx-auto px-4 sm:px-5 py-12 sm:py-16 md:py-24">
      <div className="text-center mb-14">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#3B82F6" }}>
          Get started
        </p>
        <h2 className="text-3xl md:text-[2.75rem] font-bold text-white">
          Three steps to your first trade
        </h2>
      </div>
      <div className="relative grid md:grid-cols-3 gap-6">
        <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-px bg-white/[0.06]" />
        {STEPS.map(({ num, icon: Icon, title, desc }) => (
          <div key={num} className="relative text-center">
            <div
              className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-5 shadow-lg"
              style={{
                background: "linear-gradient(135deg, #3B82F6, #00d4aa)",
                boxShadow: "0 4px 20px #3B82F633",
              }}
            >
              {num}
            </div>
            <div className="rounded-2xl p-6 pt-5 border border-white/[0.07] bg-[#09100d]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4 bg-white/[0.04]">
                <Icon className="w-5 h-5" style={{ color: "#3B82F6" }} />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
