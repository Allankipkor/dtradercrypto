"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LiveChartPreview() {
  const [price, setPrice] = useState(43256.78);
  const [change, setChange] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrice((p) => {
        const delta = (Math.random() - 0.48) * 20;
        const next = Math.max(42000, Math.min(45000, p + delta));
        setChange(((next - 43256.78) / 43256.78) * 100);
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const isUp = change >= 0;
  const color = isUp ? "#22c55e" : "#ef4444";

  return (
    <section className="px-0 md:px-5 pt-0 pb-16 md:py-24 max-w-6xl md:mx-auto">
      <div className="w-full relative">
        <div
          className="hidden md:block absolute -inset-6 rounded-[2rem] blur-[50px] opacity-25"
          style={{ background: "linear-gradient(135deg, #3B82F6, #00d4aa)" }}
        />
        <div className="relative rounded-none md:rounded-2xl overflow-hidden border-y md:border border-white/[0.07] bg-[#09100d] shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between px-4 md:px-5 py-2.5 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f7931a]/15 flex items-center justify-center">
                <span className="text-sm font-bold text-[#f7931a]">B</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">BTC/USD</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 rounded">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-emerald-500">LIVE</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500">Bitcoin / US Dollar</span>
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-lg md:text-xl font-bold tabular-nums transition-colors duration-300"
                style={{ color }}
              >
                ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] font-bold" style={{ color }}>
                {isUp ? "+" : ""}
                {change.toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row">
            <div className="flex-1 relative">
              <div className="h-48 sm:h-56 mx-0 my-0 md:m-4 rounded-none md:rounded-xl overflow-hidden relative bg-[#0f1219]">
                <div className="absolute inset-0 flex flex-col justify-between py-3 pointer-events-none">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-full border-t border-white/[0.03]" />
                  ))}
                </div>
                <svg className="w-full h-full relative z-10" viewBox="0 0 500 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="liveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,80 L500,80 L500,160 L0,160 Z" fill="url(#liveGrad)" />
                  <path
                    d="M0,80 L500,80"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="500" cy="80" r="4" fill={color} />
                  <circle cx="500" cy="80" r="8" fill={color} opacity="0.2">
                    <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
                  </circle>
                </svg>
                <div
                  className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold tabular-nums bg-black/40 backdrop-blur"
                  style={{ color }}
                >
                  ${price.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="w-full md:w-52 flex-shrink-0 border-t md:border-t-0 md:border-l border-white/[0.07]">
              <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Live Trades
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="p-3 border-t border-white/[0.07]">
                <Link
                  href="/trade"
                  className="block w-full py-2.5 rounded-xl text-white font-semibold text-sm text-center transition-all"
                  style={{ background: "#3B82F6", boxShadow: "0 4px 16px #3B82F633" }}
                >
                  Start Trading
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
