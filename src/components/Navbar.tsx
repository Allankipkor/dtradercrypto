"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ChevronDown, Download } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#steps", label: "How It Works" },
  { href: "#reviews", label: "Reviews" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#030706]/85 border-b border-white/[0.07] safe-top">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-5 h-14">
        <Logo />

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="px-3 py-1.5 text-[13px] font-medium rounded-md transition text-gray-400 hover:text-white hover:bg-white/5"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:inline px-3 sm:px-3.5 py-1.5 text-[13px] font-medium rounded-md transition text-gray-300 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] sm:text-[13px] font-semibold text-white rounded-lg transition shadow-lg shadow-[#8B5CF6]/25 hover:shadow-[#8B5CF6]/40 bg-[#8B5CF6] hover:bg-[#7c3aed] whitespace-nowrap"
          >
            Get Started
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 touch-target flex items-center justify-center min-h-[40px] min-w-[40px]"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="w-5 h-5 text-white" /> : <Menu className="w-6 h-6 text-white" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 bg-[#030706] flex flex-col px-6 py-8 overflow-y-auto safe-x safe-bottom border-t border-white/[0.05]">
          <div className="flex-1 flex flex-col justify-between">
            {/* Nav links styled like Elirox menu */}
            <div className="space-y-5">
              {[
                { label: "Solutions", hasSub: true },
                { label: "Partners", hasSub: true },
                { label: "Pricing", hasSub: false },
                { label: "Help", hasSub: true },
                { label: "Affiliate Program", hasSub: false },
              ].map(({ label, hasSub }) => (
                <div
                  key={label}
                  className="flex items-center justify-between group cursor-pointer border-b border-white/[0.03] pb-3"
                >
                  <span className="text-[17px] font-bold text-white group-hover:text-[#8B5CF6] transition-colors">
                    {label}
                  </span>
                  {hasSub && <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />}
                </div>
              ))}
            </div>

            {/* Action buttons at the bottom of the drawer */}
            <div className="mt-12 space-y-3 shrink-0">
              <a
                href="#download"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl border border-[#8B5CF6]/50 text-white font-bold text-sm hover:bg-[#8B5CF6]/10 transition"
              >
                <span>Download the app</span>
                <Download className="w-4 h-4" />
              </a>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-full py-3.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7c3aed] text-white font-bold text-sm shadow-lg shadow-[#8B5CF6]/20 transition"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-full py-3.5 rounded-xl bg-[#09100d] hover:bg-[#14241e] border border-white/5 text-white font-bold text-sm transition"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
