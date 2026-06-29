import { ArrowRight, Bell, Download, ShieldCheck, TrendingUp, Zap } from "lucide-react";

export function AppDownload() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-5 pb-12 sm:pb-16 md:pb-24">
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563EB 40%, #0ea5e9 100%)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/[0.06] blur-3xl translate-x-20 -translate-y-20" />
          <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-[#06b6d4]/20 blur-3xl -translate-x-10 translate-y-10" />
        </div>
        <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-12 px-6 py-10 md:px-12 md:py-14">
          <div className="shrink-0 relative">
            <div className="w-[72px] h-[140px] md:w-24 md:h-[180px] rounded-[18px] md:rounded-[22px] border-[3px] border-white/20 bg-gradient-to-b from-white/10 to-white/[0.03] backdrop-blur-sm flex flex-col items-center justify-center gap-2 shadow-2xl">
              <div className="w-8 h-1 md:w-10 md:h-1.5 rounded-full bg-white/20 absolute top-2" />
              <div className="w-8 h-8 md:w-11 md:h-11 rounded-xl bg-white/15 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <span className="text-[8px] md:text-[10px] font-bold text-white/70">DTraderCrypto</span>
            </div>
            <div className="absolute -bottom-2 -right-2 w-7 h-7 md:w-9 md:h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 border-2 border-white/20">
              <Download className="w-3 h-3 md:w-4 md:h-4 text-white" />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/80 text-[10px] md:text-xs font-semibold mb-3 backdrop-blur-sm border border-white/10">
              <Zap className="w-3 h-3" />
              Android App Available
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">
              Trade on the go
            </h3>
            <p className="text-white/60 text-sm md:text-[15px] max-w-md mb-5 leading-relaxed">
              Download the DTraderCrypto app. Get a better trading experience on your mobile device.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
              <button className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-[15px] bg-white text-[#1e40af] shadow-xl shadow-black/15 hover:shadow-2xl active:scale-[0.97] transition-all">
                <Download className="w-4 h-4" />
                Download App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <div className="flex items-center gap-3 text-white/40 text-xs">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Lightweight
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5" /> Push Alerts
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
