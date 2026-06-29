import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background glow animations */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-250px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,.08) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-[200px] right-[-150px] w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(6,182,212,.05) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-5 pt-16 sm:pt-20 md:pt-32 pb-16 text-center">
        {/* Sub-label badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 border"
          style={{
            color: "#a78bfa",
            borderColor: "rgba(139,92,246,.25)",
            background: "rgba(139,92,246,.06)",
          }}
        >
          ✨ DTraderCrypto Automation Platform
        </div>

        {/* Main Heading styled like Elirox */}
        <h1 className="text-4xl sm:text-5xl md:text-[4rem] lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6 text-white max-w-4xl mx-auto">
          Trade & automate. <br />
          <span className="text-[#a78bfa]">Smart and simple.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-[15px] md:text-lg leading-relaxed max-w-xl mx-auto mb-10 text-gray-400">
          Fully automated trading and binary options on synthetic indices, launched in minutes.
          Trade 100+ assets with lightning execution.
        </p>

        {/* Action Button */}
        <div className="flex justify-center mb-10">
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-white font-bold rounded-xl bg-[#8B5CF6] hover:bg-[#7c3aed] transition-all shadow-xl shadow-[#8B5CF6]/25 hover:shadow-[#8B5CF6]/40 text-[15px]"
          >
            Get started for free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* App Store and Google Play Download Badges like Elirox */}
        <div className="flex flex-wrap gap-3.5 justify-center items-center mb-16">
          <a
            href="#appstore"
            className="flex items-center gap-3 px-4.5 py-2 bg-[#09100d] hover:bg-[#14241e] border border-white/5 rounded-xl transition text-left shrink-0 min-w-[155px]"
          >
            <svg className="w-5.5 h-5.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,22C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z"/>
            </svg>
            <div>
              <div className="text-[8px] text-gray-500 font-medium uppercase tracking-wider leading-none mb-0.5">Download on the</div>
              <div className="text-[11px] text-white font-bold leading-none">App Store</div>
            </div>
          </a>
          <a
            href="#playstore"
            className="flex items-center gap-3 px-4.5 py-2 bg-[#09100d] hover:bg-[#14241e] border border-white/5 rounded-xl transition text-left shrink-0 min-w-[155px]"
          >
            <svg className="w-5.5 h-5.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5,3.23C5.3,3.05 5.72,3.06 6,3.25L17.75,10.37L20.25,11.87C20.72,12.15 20.72,12.85 20.25,13.13L17.75,14.63L6,21.75C5.72,21.94 5.3,21.95 5,21.77L5,3.23M17,12L7,6.2L7,17.8L17,12Z"/>
            </svg>
            <div>
              <div className="text-[8px] text-gray-500 font-medium uppercase tracking-wider leading-none mb-0.5">Get it on</div>
              <div className="text-[11px] text-white font-bold leading-none">Google Play</div>
            </div>
          </a>
        </div>

        {/* Triple mobile phone mockups displaying trading previews */}
        <div className="relative mt-8 max-w-lg mx-auto flex items-center justify-center gap-4 sm:gap-6 px-4">
          {/* Left phone frame (angled) */}
          <div className="hidden sm:block w-40 h-80 rounded-[28px] border-4 border-white/10 bg-black/40 shadow-2xl relative overflow-hidden transform -rotate-6 translate-x-6 shrink-0 backdrop-blur-sm">
            <div className="w-14 h-3.5 bg-black rounded-b-lg absolute top-0 left-1/2 -translate-x-1/2 z-20" />
            <div className="p-3 pt-6 h-full flex flex-col justify-between text-left">
              <div className="text-[9px] text-[#a78bfa] font-bold">dtradercrypto</div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-xl font-bold text-white mb-0.5">$5,141.51</div>
                <div className="text-[8px] text-[#00D4AA] font-semibold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-[#00D4AA] animate-pulse" />
                  LIVE BALANCE
                </div>
                {/* Simulated chart bars */}
                <div className="h-14 w-full mt-4 flex items-end gap-0.5">
                  {[4, 6, 3, 8, 5, 10, 7, 9, 12, 8, 11, 14, 12, 16].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-[#8B5CF6]/30 to-[#8B5CF6]" style={{ height: `${h * 5}%` }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 py-1 rounded bg-[#8B5CF6] text-center text-[8px] font-bold text-white">Deposit</div>
                <div className="flex-1 py-1 rounded bg-white/5 text-center text-[8px] font-bold text-white">Withdraw</div>
              </div>
            </div>
          </div>

          {/* Center phone frame (Main view) */}
          <div className="w-48 h-[390px] rounded-[32px] border-4 border-white/15 bg-[#09100d] shadow-2xl relative overflow-hidden z-10">
            <div className="w-16 h-3.5 bg-black rounded-b-lg absolute top-0 left-1/2 -translate-x-1/2 z-20" />
            <div className="p-3.5 pt-6 h-full flex flex-col justify-between text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40 font-bold">Accounts</span>
                <span className="w-3.5 h-3.5 rounded-full bg-white/5 flex items-center justify-center text-[8px]">🇺🇸</span>
              </div>
              
              <div className="flex-1 flex flex-col justify-center gap-0.5 mt-2">
                <span className="text-[8px] text-gray-500 font-bold tracking-wider uppercase">DTrader Bot</span>
                <div className="text-xl font-black text-white">$5,141.51</div>
                <div className="text-[9px] text-gray-400">Free margin: $5,108.30</div>
                
                <div className="flex gap-1.5 mt-3">
                  <button className="flex-1 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-center text-[9px] font-bold text-white hover:bg-white/[0.08]">Deposit</button>
                  <button className="flex-1 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-center text-[9px] font-bold text-white hover:bg-white/[0.08]">Withdraw</button>
                </div>
                
                {/* Position strip */}
                <div className="mt-4 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                  <div className="flex justify-between text-[7px] text-gray-500 font-bold uppercase">
                    <span>Open 3</span>
                    <span>Pending</span>
                    <span>Closed</span>
                  </div>
                  <div className="h-px bg-white/[0.05]" />
                  <div className="flex items-center justify-between text-[9px] pt-1">
                    <span className="font-semibold text-white">Volatility 100</span>
                    <span className="font-bold text-[#00D4AA]">+$12.40</span>
                  </div>
                </div>
              </div>

              <div className="text-[7px] text-gray-600 text-center">dtradercrypto v1.0</div>
            </div>
          </div>

          {/* Right phone frame (angled) */}
          <div className="hidden sm:block w-40 h-80 rounded-[28px] border-4 border-white/10 bg-black/40 shadow-2xl relative overflow-hidden transform rotate-6 -translate-x-6 shrink-0 backdrop-blur-sm">
            <div className="w-14 h-3.5 bg-black rounded-b-lg absolute top-0 left-1/2 -translate-x-1/2 z-20" />
            <div className="p-3 pt-6 h-full flex flex-col justify-between text-left">
              <div className="text-[9px] text-gray-400 font-bold">Active scan</div>
              <div className="flex-1 flex flex-col justify-center gap-2">
                <div className="p-2 rounded-xl bg-white/[0.03] space-y-1">
                  <div className="flex justify-between text-[8px]">
                    <span className="text-white font-semibold">AI Scanner #1</span>
                    <span className="text-emerald-400 font-bold">Active</span>
                  </div>
                  <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                    <div className="bg-[#8B5CF6] h-full w-[70%]" />
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.03] space-y-1">
                  <div className="flex justify-between text-[8px]">
                    <span className="text-white font-semibold">RSI Bot</span>
                    <span className="text-rose-400 font-bold">Stopped</span>
                  </div>
                  <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full w-0" />
                  </div>
                </div>
              </div>
              <div className="text-[7px] text-gray-500 text-center">Active scan</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
