import {
  BadgeDollarSign,
  Earth,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Blazing Fast",
    desc: "Trades execute in under 1 second. Zero lag, zero requotes.",
    color: "#f59e0b",
  },
  {
    icon: ShieldCheck,
    title: "Fully Secured",
    desc: "256-bit SSL encryption and segregated client accounts.",
    color: "#22c55e",
  },
  {
    icon: Earth,
    title: "100+ Markets",
    desc: "Forex, crypto, stocks, indices, commodities — all in one place.",
    color: "#3B82F6",
  },
  {
    icon: BadgeDollarSign,
    title: "No Hidden Fees",
    desc: "Zero fees on deposits and withdrawals. What you see is what you get.",
    color: "#ef4444",
  },
  {
    icon: Smartphone,
    title: "Trade Anywhere",
    desc: "Responsive web app works perfectly on any device, any screen.",
    color: "#06b6d4",
  },
  {
    icon: MessageCircle,
    title: "24/7 Support",
    desc: "Real human support around the clock via live chat and email.",
    color: "#a855f7",
  },
];

export function Features() {
  return (
    <section id="features" className="border-y border-white/[0.07] bg-[#070f0c]">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-12 sm:py-16 md:py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#3B82F6" }}>
            Platform
          </p>
          <h2 className="text-3xl md:text-[2.75rem] font-bold text-white">
            Built for serious traders
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="rounded-2xl p-6 border border-white/[0.07] bg-[#09100d] hover:bg-[#14241e] transition-all"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${color}12` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="font-semibold mb-1.5 text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
