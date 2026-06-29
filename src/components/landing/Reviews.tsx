import { Star } from "lucide-react";

const REVIEWS = [
  {
    quote:
      "Switched from three other platforms. DTraderCrypto is the fastest and most reliable by far.",
    name: "Alex M.",
    country: "USA",
    initials: "AM",
  },
  {
    quote: "From crypto to forex, everything in one place. The interface is buttery smooth.",
    name: "Sarah K.",
    country: "UK",
    initials: "SK",
  },
  {
    quote: "10 years of trading experience and this is the best platform I've ever used.",
    name: "James W.",
    country: "Germany",
    initials: "JW",
  },
  {
    quote: "Started with demo and now trade real money. Withdrawals are super fast!",
    name: "Maria G.",
    country: "Brazil",
    initials: "MG",
  },
  {
    quote: "Sub-second execution. Perfect for my scalping strategy. Highly recommended.",
    name: "David H.",
    country: "Japan",
    initials: "DH",
  },
  {
    quote: "I trade part-time and the mobile experience is flawless. Love the simplicity.",
    name: "Lisa T.",
    country: "France",
    initials: "LT",
  },
];

export function Reviews() {
  return (
    <section id="reviews" className="max-w-6xl mx-auto px-4 sm:px-5 py-12 sm:py-16 md:py-24">
      <div className="text-center mb-14">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#3B82F6" }}>
          Wall of love
        </p>
        <h2 className="text-3xl md:text-[2.75rem] font-bold text-white">What traders say</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REVIEWS.map(({ quote, name, country, initials }) => (
          <div
            key={name}
            className="rounded-2xl p-5 border border-white/[0.07] bg-[#09100d]"
          >
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm leading-relaxed mb-4 text-gray-400">&quot;{quote}&quot;</p>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: "linear-gradient(135deg, #3B82F6, #00d4aa)" }}
              >
                {initials}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{name}</div>
                <div className="text-[11px] text-gray-500">{country}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
