"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  LayoutList,
  LineChart,
  LogOut,
  Menu,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { DepositModal } from "../payments/DepositModal";
import { ASSETS, type Asset } from "@/lib/assets";
import { PositionsPanel, type Position } from "./PositionsPanel";
import { OrderPanel, type ContractType } from "./OrderPanel";

interface TradingPlatformProps {
  forceDemo?: boolean;
}

type MobileTab = "trade" | "positions" | "ai";

function mapApiTrade(t: {
  id: string;
  assetName: string;
  contractType: string;
  direction: string;
  stake: number;
  payout: number;
  expiry: number;
  openPrice: number;
  status: string;
  profit?: number | null;
}): Position {
  return {
    id: t.id,
    asset: t.assetName,
    type: t.contractType,
    direction: t.direction as "up" | "down",
    stake: t.stake,
    payout: t.payout,
    expiry: t.expiry,
    openPrice: t.openPrice,
    status: t.status as "open" | "won" | "lost",
    profit: t.profit ?? undefined,
  };
}

export function TradingPlatform({ forceDemo = false }: TradingPlatformProps) {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = !forceDemo && !!session?.user;

  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [contractType, setContractType] = useState<ContractType>("Rise/Fall");
  const [duration, setDuration] = useState("1 min");
  const [stake, setStake] = useState(10);
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeError, setTradeError] = useState("");
  const [price, setPrice] = useState(1000);
  const [priceHistory, setPriceHistory] = useState<number[]>(Array(60).fill(1000));
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [mobileTab, setMobileTab] = useState<MobileTab>("trade");
  const [assetDropdown, setAssetDropdown] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [closedTab, setClosedTab] = useState<"won" | "lost">("won");
  const [accountMode, setAccountMode] = useState<"real" | "demo">("real");
  const [accountDropdown, setAccountDropdown] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  const [demoBalance, setDemoBalance] = useState(10000);
  const displayBalance = accountMode === "real" ? balance : demoBalance;
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const syncFromApi = useCallback(async () => {
    try {
      const [balRes, demoRes, posRes] = await Promise.all([
        fetch("/api/balance"),
        fetch("/api/demo-balance"),
        fetch("/api/trades?status=open"),
      ]);
      if (balRes.ok) {
        const b = await balRes.json();
        setBalance(b.balance ?? 0);
      }
      if (demoRes.ok) {
        const d = await demoRes.json();
        if (typeof d.demoBalance === "number") setDemoBalance(d.demoBalance);
      }
      if (posRes.ok) {
        const p = await posRes.json();
        setPositions((p.trades ?? []).map(mapApiTrade));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const tickPrice = () => {
      fetch(`/api/prices?assetId=${selectedAsset.id}&tick=true`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.price) {
            setPrice(data.price);
            setPriceHistory((h) => [...h.slice(-59), data.price]);
          }
        })
        .catch(() => {
          const volatility = selectedAsset.id.includes("100")
            ? 2.5
            : selectedAsset.id.includes("75")
              ? 1.5
              : 0.5;
          setPrice((p) => {
            const next = p + (Math.random() - 0.5) * volatility;
            setPriceHistory((h) => [...h.slice(-59), next]);
            return next;
          });
        });
    };
    tickPrice();
    const priceInterval = setInterval(tickPrice, 800);
    return () => clearInterval(priceInterval);
  }, [isAuthenticated, selectedAsset.id]);

  // Redraw chart on container resize
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      setPriceHistory((h) => [...h]);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = chartContainerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = Math.min(20, w * 0.04);
    const min = Math.min(...priceHistory) - 5;
    const max = Math.max(...priceHistory) + 5;
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f1219";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = padding + ((h - padding * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const isUp = priceHistory[priceHistory.length - 1] >= priceHistory[priceHistory.length - 2];
    const color = isUp ? "#22c55e" : "#ef4444";

    if (chartType === "line") {
      ctx.beginPath();
      priceHistory.forEach((p, i) => {
        const x = padding + (i / (priceHistory.length - 1)) * (w - padding * 2);
        const y = h - padding - ((p - min) / range) * (h - padding * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, isUp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.lineTo(w - padding, h - padding);
      ctx.lineTo(padding, h - padding);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    } else {
      const barW = (w - padding * 2) / priceHistory.length;
      priceHistory.forEach((p, i) => {
        const prev = priceHistory[i - 1] ?? p;
        const up = p >= prev;
        const x = padding + i * barW;
        const bodyH = (Math.abs(p - prev) / range) * (h - padding * 2) || 2;
        const y = h - padding - ((Math.max(p, prev) - min) / range) * (h - padding * 2);
        ctx.fillStyle = up ? "#22c55e" : "#ef4444";
        ctx.fillRect(x, y, Math.max(barW - 1, 1), Math.max(bodyH, 2));
      });
    }

    const lastY = h - padding - ((price - min) / range) * (h - padding * 2);

    // Dashed horizontal price line
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(59,130,246,0.6)";
    ctx.lineWidth = 1;
    ctx.moveTo(padding, lastY);
    ctx.lineTo(w - 64, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dot at tip
    ctx.beginPath();
    ctx.arc(w - padding, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }, [priceHistory, price, chartType]);

  // Persist demo balance changes to the server (authenticated users only)
  const demoBalanceRef = useRef(demoBalance);
  useEffect(() => {
    demoBalanceRef.current = demoBalance;
  }, [demoBalance]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timeout = setTimeout(() => {
      fetch("/api/demo-balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoBalance: demoBalanceRef.current }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timeout);
  }, [demoBalance, isAuthenticated]);

  // Resolve positions
  useEffect(() => {
    const now = Date.now();
    setPositions((prev) =>
      prev.map((p) => {
        if (p.status !== "open" || p.expiry > now) return p;
        const won = p.direction === "up" ? price > p.openPrice : price < p.openPrice;
        const profit = won ? p.payout - p.stake : -p.stake;
        if (isAuthenticated && !p.isDemo) {
          fetch("/api/trades", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: p.id, status: won ? "won" : "lost", profit, closePrice: price }),
          }).then(() => syncFromApi());
        } else {
          setDemoBalance((b) => b + (won ? p.payout : 0));
        }
        return { ...p, status: won ? "won" : "lost", profit };
      })
    );
  }, [price, isAuthenticated, syncFromApi]);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const tl: Record<string, number> = {};
      positions.forEach((p) => {
        if (p.status === "open") tl[p.id] = Math.max(0, Math.ceil((p.expiry - now) / 1000));
      });
      setTimeLeft(tl);
    }, 500);
    return () => clearInterval(interval);
  }, [positions]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isAuthenticated) syncFromApi();
  }, [isAuthenticated, sessionStatus, syncFromApi]);

  const placeTrade = async (
    direction: "up" | "down",
    meta?: { digit?: number; contractType?: string; digitDirection?: string }
  ) => {
    setTradeError("");
    const isDemo = accountMode === "demo" || !isAuthenticated;
    const activeBalance = isDemo ? demoBalance : balance;

    if (stake > activeBalance) {
      setTradeError("Insufficient balance");
      return;
    }
    const durationMs = parseInt(duration) * 60 * 1000;
    const payout = +(stake * (1 + selectedAsset.payout / 100)).toFixed(2);
    const resolvedContractType = meta?.contractType ?? contractType;
    const newPosition: Position = {
      id: crypto.randomUUID(),
      asset: selectedAsset.name,
      type: resolvedContractType,
      direction,
      stake,
      payout,
      expiry: Date.now() + durationMs,
      openPrice: price,
      status: "open",
      isDemo,
    };

    if (isDemo) {
      // Demo trades always run locally, even when signed in
      setPositions((prev) => [...prev, newPosition]);
      setDemoBalance((b) => b - stake);
      return;
    }

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          contractType: resolvedContractType,
          direction,
          stake,
          durationMinutes: parseInt(duration, 10),
          digit: meta?.digit,
          digitDirection: meta?.digitDirection,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message =
          typeof errData?.error === "string"
            ? errData.error
            : errData?.error?.fieldErrors
              ? Object.values(errData.error.fieldErrors).flat().join(", ") || "Failed to place trade"
              : "Failed to place trade";
        setTradeError(message);
        return;
      }
      const data = await res.json();
      setPositions((prev) => [...prev, { ...newPosition, id: data.trade?.id ?? newPosition.id }]);
      setBalance((b) => (data.balance !== undefined ? data.balance : b - stake));
    } catch (e) {
      console.error("Trade network error:", e);
      setTradeError("Network error — please try again");
    }
  };

  const visiblePositions = positions.filter((p) => Boolean(p.isDemo) === (accountMode === "demo"));
  const openCount = visiblePositions.filter((p) => p.status === "open").length;

  const orderPanelProps = {
    selectedAsset,
    contractType,
    duration,
    stake,
    balance: displayBalance,
    tradeError,
    onContractTypeChange: setContractType,
    onDurationChange: setDuration,
    onStakeChange: setStake,
    onPlaceTrade: (direction: "up" | "down", meta?: { digit?: number; contractType?: string; digitDirection?: string }) => placeTrade(direction, meta),
  };

  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#13161e] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#13161e] text-white flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-white/[0.07] bg-[#13161e]/95 backdrop-blur z-30">
        <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 sm:h-16 gap-2 max-w-screen-2xl mx-auto w-full">

          {/* Left: hamburger + wordmark */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setNavMenuOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-base sm:text-lg font-extrabold tracking-tight select-none">
              <span className="text-[#3B82F6]">OPEN</span><span className="text-white">MARKET</span>
            </span>
          </div>

          {/* Right: account switcher + deposit */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Account balance + switcher */}
            <div className="relative">
              <button
                onClick={() => setAccountDropdown((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl bg-[#1c2030] border border-white/[0.07] hover:border-white/20 transition min-h-[40px] max-w-[160px] sm:max-w-[200px]"
              >
                {/* Flag - circular, smaller */}
                <span className="w-6 h-6 rounded-full bg-[#1a1f35] border border-white/10 flex items-center justify-center text-xs leading-none shrink-0">🇺🇸</span>
                <div className="text-left min-w-0">
                  <div className="text-[11px] sm:text-xs font-bold tabular-nums leading-tight truncate">
                    ${displayBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] text-gray-500 leading-tight">
                    {accountMode === "real" ? "Real" : "Demo"}
                  </div>
                </div>
                <ChevronDown className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${accountDropdown ? "rotate-180" : ""}`} />
              </button>

              {/* Account switcher dropdown */}
              {accountDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountDropdown(false)} />
                  <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-white/[0.07] bg-[#1c2030] shadow-2xl z-50 overflow-hidden">
                    {/* Real account */}
                    <button
                      onClick={() => { setAccountMode("real"); setAccountDropdown(false); }}
                      className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        R
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Real Account</div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="w-4 h-4 rounded-full bg-[#1a1f35] flex items-center justify-center text-[10px] leading-none">🇺🇸</span>
                          <span className="tabular-nums">
                            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      {accountMode === "real" && (
                        <div className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                      )}
                    </button>

                    <div className="h-px bg-white/[0.06] mx-4" />

                    {/* Demo account */}
                    <button
                      onClick={() => { setAccountMode("demo"); setAccountDropdown(false); }}
                      className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        D
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Demo Account</div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="w-4 h-4 rounded-full bg-[#1a1f35] flex items-center justify-center text-[10px] leading-none">🇺🇸</span>
                          <span className="tabular-nums">
                            ${demoBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      {accountMode === "demo" && (
                        <div className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                      )}
                    </button>

                    {/* Sign out row */}
                    {isAuthenticated && (
                      <>
                        <div className="h-px bg-white/[0.06] mx-4" />
                        <button
                          onClick={() => signOut({ callbackUrl: "/" })}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-rose-400 hover:bg-white/5 transition"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm font-medium">Sign out</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Deposit button */}
            <button
              onClick={() => setDepositOpen(true)}
              className="px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl text-white bg-[#3B82F6] hover:bg-blue-500 transition min-h-[44px]"
            >
              DEPOSIT
            </button>
          </div>
        </div>
      </header>

      {/* ── Side nav drawer ── */}
      {navMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setNavMenuOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#13161e] border-r border-white/[0.07] z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.07]">
              <span className="text-base font-extrabold tracking-tight select-none">
                <span className="text-[#3B82F6]">OPEN</span><span className="text-white">MARKET</span>
              </span>
              <button
                onClick={() => setNavMenuOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              <Link
                href="/"
                onClick={() => setNavMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition text-sm font-medium"
              >
                <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
                Trade
              </Link>
              <Link
                href="/history"
                onClick={() => setNavMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition text-sm font-medium"
              >
                <LayoutList className="w-5 h-5 text-[#3B82F6]" />
                Trade History
              </Link>
              <Link
                href="/ai"
                onClick={() => setNavMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition text-sm font-medium"
              >
                <Sparkles className="w-5 h-5 text-[#3B82F6]" />
                AI Assistant
              </Link>
            </nav>
            {isAuthenticated && (
              <div className="p-4 border-t border-white/[0.07]">
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-rose-400 hover:bg-white/5 transition text-sm font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* ── Desktop / large tablet (md+) ── */}
      <div className="hidden md:flex flex-1 overflow-hidden min-h-0 max-w-screen-2xl mx-auto w-full">

        {/* Left: Positions — only visible on lg+ */}
        <aside className="hidden lg:flex w-52 xl:w-64 2xl:w-72 border-r border-white/[0.07] flex-col shrink-0 bg-[#191c26]">
          <PositionsPanel
            positions={visiblePositions}
            closedTab={closedTab}
            onTabChange={setClosedTab}
            timeLeft={timeLeft}
            className="h-full"
          />
        </aside>

        {/* Center: Chart */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Contract tabs */}
          <div className="flex border-b border-white/[0.07] bg-[#13161e] shrink-0 overflow-x-auto scrollbar-hide">
            {(["Matches/Differs", "Even/Odd", "Over/Under", "Rise/Fall"] as const).map((t) => {
              const mapped = t === "Matches/Differs" ? "Match/Differ" : t;
              const isActive = contractType === mapped;
              return (
                <button
                  key={t}
                  onClick={() => setContractType(mapped as ContractType)}
                  className={`flex-1 min-w-[90px] px-3 xl:px-6 py-3 text-[11px] xl:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                    isActive ? "border-[#3B82F6] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <ChartToolbar
            selectedAsset={selectedAsset}
            assetDropdown={assetDropdown}
            setAssetDropdown={setAssetDropdown}
            setSelectedAsset={setSelectedAsset}
            price={price}
            chartType={chartType}
            setChartType={setChartType}
          />
          <div
            ref={chartContainerRef}
            className="flex-1 relative bg-[#0f1219] min-h-[180px] m-3 rounded-xl border border-white/[0.08] overflow-hidden"
          >
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            {/* Desktop price ladder */}
            <div className="absolute right-0 top-0 bottom-0 w-16 xl:w-20 flex flex-col justify-around items-end pr-2 pointer-events-none">
              {[2, 1, 0, -1, -2].map((offset) => {
                const val = (price + offset * 0.35).toFixed(2);
                const isCurrent = offset === 0;
                return (
                  <div
                    key={offset}
                    className={`text-[10px] xl:text-[11px] tabular-nums font-semibold px-1.5 xl:px-2 py-0.5 rounded ${
                      isCurrent ? "bg-[#3B82F6] text-white" : "text-gray-400"
                    }`}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Positions strip — md only (tablet, no sidebar) */}
          <div className="lg:hidden border-t border-white/[0.07] h-40 shrink-0 overflow-hidden bg-[#191c26]">
            <PositionsPanel
              positions={visiblePositions}
              closedTab={closedTab}
              onTabChange={setClosedTab}
              timeLeft={timeLeft}
              className="h-full"
            />
          </div>
        </main>

        {/* Right: Order panel */}
        <aside className="w-60 xl:w-72 2xl:w-80 border-l border-white/[0.07] flex flex-col shrink-0 bg-[#191c26] overflow-y-auto">
          <OrderPanel {...orderPanelProps} />
        </aside>
      </div>

      {/* ── Mobile (< md): tabbed layout ── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden min-h-0">
        {mobileTab === "trade" && (
          <>
            {/* Contract tabs */}
            <div className="flex border-b border-white/[0.07] bg-[#13161e] shrink-0 overflow-x-auto scrollbar-hide snap-x">
              {(["Matches/Differs", "Even/Odd", "Over/Under", "Rise/Fall"] as const).map((t) => {
                const mapped = t === "Matches/Differs" ? "Match/Differ" : t;
                const isActive = contractType === mapped;
                return (
                  <button
                    key={t}
                    onClick={() => setContractType(mapped as ContractType)}
                    className={`flex-1 min-w-[76px] py-2.5 text-[10px] xs:text-[11px] sm:text-xs font-semibold border-b-2 transition whitespace-nowrap snap-start min-h-[44px] ${
                      isActive ? "border-[#3B82F6] text-white" : "border-transparent text-gray-500"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Chart toolbar */}
            <ChartToolbar
              selectedAsset={selectedAsset}
              assetDropdown={assetDropdown}
              setAssetDropdown={setAssetDropdown}
              setSelectedAsset={setSelectedAsset}
              price={price}
              chartType={chartType}
              setChartType={setChartType}
              compact
            />

            {/* Chart card */}
            <div className="px-2 sm:px-3 py-2 bg-[#13161e] shrink-0">
              <div className="h-[22vh] sm:h-[28vh] min-h-[130px] max-h-[240px] relative bg-[#0f1219] rounded-xl border border-white/[0.08] overflow-hidden">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                {/* Price ladder */}
                <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-20 flex flex-col justify-around items-end pr-1.5 sm:pr-2 pointer-events-none">
                  {[2, 1, 0, -1, -2].map((offset) => {
                    const val = (price + offset * 0.35).toFixed(2);
                    const isCurrent = offset === 0;
                    return (
                      <div
                        key={offset}
                        className={`text-[10px] sm:text-[11px] tabular-nums font-semibold px-1.5 py-0.5 rounded ${
                          isCurrent ? "bg-[#3B82F6] text-white" : "text-gray-400"
                        }`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Scrollable order panel */}
            <div className="flex-1 overflow-y-auto overscroll-contain bg-[#191c26] border-t border-white/[0.07]">
              <OrderPanel {...orderPanelProps} compact />
            </div>
          </>
        )}

        {mobileTab === "positions" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#191c26]">
            <PositionsPanel
              positions={visiblePositions}
              closedTab={closedTab}
              onTabChange={setClosedTab}
              timeLeft={timeLeft}
              className="h-full"
            />
          </div>
        )}

        {mobileTab === "ai" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#191c26] px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-white font-semibold text-base mb-1">AI Trading Assistant</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Get real-time trade signals, market analysis, and risk insights powered by AI.
              </p>
            </div>
            <button className="px-5 py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-semibold min-h-[44px]">
              Coming soon
            </button>
          </div>
        )}

        {/* Bottom nav */}
        <nav
          className="shrink-0 flex border-t border-white/[0.07] bg-[#13161e]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <button
            onClick={() => setMobileTab("trade")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 sm:py-3 min-h-[56px] transition ${
              mobileTab === "trade" ? "text-[#3B82F6]" : "text-gray-500"
            }`}
          >
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs font-semibold">Trade</span>
          </button>
          <button
            onClick={() => setMobileTab("ai")}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition"
          >
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
              mobileTab === "ai" ? "bg-[#3B82F6]" : "bg-[#1c2030]"
            }`}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold ${mobileTab === "ai" ? "text-[#3B82F6]" : "text-gray-500"}`}>
              AI
            </span>
          </button>
          <button
            onClick={() => setMobileTab("positions")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 sm:py-3 min-h-[56px] transition relative ${
              mobileTab === "positions" ? "text-[#3B82F6]" : "text-gray-500"
            }`}
          >
            <LayoutList className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs font-semibold">Positions</span>
            {openCount > 0 && (
              <span className="absolute top-1.5 right-[22%] min-w-[16px] h-4 px-1 rounded-full bg-[#3B82F6] text-white text-[9px] font-bold flex items-center justify-center">
                {openCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} onSuccess={syncFromApi} />
    </div>
  );
}

// ── ChartToolbar ──
function ChartToolbar({
  selectedAsset,
  assetDropdown,
  setAssetDropdown,
  setSelectedAsset,
  price,
  chartType,
  setChartType,
  compact = false,
}: {
  selectedAsset: Asset;
  assetDropdown: boolean;
  setAssetDropdown: (v: boolean) => void;
  setSelectedAsset: (a: Asset) => void;
  price: number;
  chartType: "line" | "candle";
  setChartType: (t: "line" | "candle") => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between border-b border-white/[0.07] bg-[#1c2030] shrink-0 ${
      compact ? "px-3 py-2" : "px-4 py-2.5 lg:px-6"
    }`}>
      <div className="relative min-w-0 flex-1 mr-2">
        <button
          onClick={() => setAssetDropdown(!assetDropdown)}
          className="flex items-center gap-2 max-w-full px-2 py-1.5 rounded-lg hover:bg-white/5 transition min-h-[44px]"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3B82F6]" />
          </div>
          <div className="text-left min-w-0">
            <div className="text-xs sm:text-sm font-bold truncate">
              {compact ? selectedAsset.name.replace(" Index", "") : selectedAsset.name}
            </div>
            <div className="text-[10px] sm:text-xs text-emerald-400 flex items-center gap-1 flex-wrap">
              <span className="tabular-nums">{price.toFixed(2)}</span>
              <span className="text-emerald-500">+0.41 (0.00%)</span>
              <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        </button>
        {assetDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAssetDropdown(false)} />
            <div className="absolute top-full left-0 mt-1 w-[min(100vw-2rem,20rem)] max-h-64 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#1c2030] shadow-2xl z-50">
              {ASSETS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAsset(a); setAssetDropdown(false); }}
                  className={`w-full px-4 py-3 text-left text-xs hover:bg-white/5 transition min-h-[44px] ${
                    a.id === selectedAsset.id ? "text-[#3B82F6]" : "text-gray-300"
                  }`}
                >
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-[10px] text-gray-500">{a.payout}% payout</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => setChartType("line")}
          className={`p-1.5 sm:p-2 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center ${
            chartType === "line" ? "bg-[#3B82F6]/20 text-[#3B82F6]" : "text-gray-400 hover:bg-white/5"
          }`}
        >
          <LineChart className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => setChartType("candle")}
          className={`p-1.5 sm:p-2 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center ${
            chartType === "candle" ? "bg-[#3B82F6]/20 text-[#3B82F6]" : "text-gray-400 hover:bg-white/5"
          }`}
        >
          <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
}