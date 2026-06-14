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
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "../Logo";
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
  openPrice: number;
  status: string;
  profit: number | null;
  expiresAt: string;
}): Position {
  return {
    id: t.id,
    asset: t.assetName,
    type: t.contractType,
    direction: t.direction as "up" | "down",
    stake: t.stake,
    payout: t.payout,
    expiry: new Date(t.expiresAt).getTime(),
    openPrice: t.openPrice,
    status: t.status as Position["status"],
    profit: t.profit ?? undefined,
  };
}

export function TradingPlatform({ forceDemo = false }: TradingPlatformProps) {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = !!session?.user && !forceDemo;

  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [contractType, setContractType] = useState<ContractType>("Rise/Fall");
  const [duration, setDuration] = useState("1 min");
  const [stake, setStake] = useState(1);
  const [balance, setBalance] = useState(10000);
  const [price, setPrice] = useState(1000);
  const [priceHistory, setPriceHistory] = useState<number[]>(Array(60).fill(1000));
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedTab, setClosedTab] = useState(false);
  const [assetDropdown, setAssetDropdown] = useState(false);
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [depositOpen, setDepositOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("trade");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const openCount = positions.filter((p) => p.status === "open").length;

  const syncFromApi = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [tradesRes, userRes] = await Promise.all([
        fetch("/api/trades"),
        fetch("/api/user/me"),
      ]);
      if (tradesRes.ok) {
        const data = await tradesRes.json();
        setPositions(data.trades.map(mapApiTrade));
        setBalance(data.balance);
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setUserPhone(data.user.phone);
        if (!tradesRes.ok) setBalance(data.user.balance);
      }
    } catch {
      /* ignore */
    }
  }, [isAuthenticated]);

  const tickPrice = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const res = await fetch(`/api/prices?assetId=${selectedAsset.id}&tick=true`);
        if (res.ok) {
          const data = await res.json();
          setPrice(data.price);
          setPriceHistory((h) => [...h.slice(-59), data.price]);
        }
      } catch {
        /* fallback */
      }
    } else {
      setPrice((prev) => {
        const volatility = selectedAsset.id.includes("100")
          ? 3
          : selectedAsset.id.includes("75")
            ? 2.5
            : 2;
        const delta = (Math.random() - 0.5) * volatility;
        const next = Math.max(900, Math.min(1100, prev + delta));
        setPriceHistory((h) => [...h.slice(-59), next]);
        return next;
      });
    }
  }, [isAuthenticated, selectedAsset.id]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    ctx.strokeStyle = "rgba(255,255,255,0.03)";
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
    ctx.beginPath();
    ctx.arc(w - padding, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [priceHistory, price, chartType]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isAuthenticated) syncFromApi();
  }, [isAuthenticated, sessionStatus, syncFromApi]);

  useEffect(() => {
    const priceInterval = setInterval(tickPrice, 800);
    return () => clearInterval(priceInterval);
  }, [tickPrice]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const syncInterval = setInterval(syncFromApi, 3000);
    return () => clearInterval(syncInterval);
  }, [isAuthenticated, syncFromApi]);

  useEffect(() => {
    if (isAuthenticated) return;
    const interval = setInterval(() => {
      setPositions((prev) => {
        let balanceDelta = 0;
        const next = prev.map((p) => {
          if (p.status !== "open" || Date.now() < p.expiry) return p;
          const won = p.direction === "up" ? price > p.openPrice : price < p.openPrice;
          const profit = won ? p.stake * (p.payout / 100) : -p.stake;
          if (won) balanceDelta += p.stake + profit;
          return { ...p, status: won ? ("won" as const) : ("lost" as const), profit };
        });
        if (balanceDelta > 0) setBalance((b) => b + balanceDelta);
        return next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [price, isAuthenticated]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => drawChart());
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawChart]);

  useEffect(() => {
    const onResize = () => drawChart();
    window.addEventListener("orientationchange", onResize);
    return () => window.removeEventListener("orientationchange", onResize);
  }, [drawChart]);

  const placeTrade = async (direction: "up" | "down") => {
    setTradeError("");
    if (stake > balance) {
      setTradeError("Insufficient balance");
      return;
    }

    const durationMinutes = parseInt(duration) || 1;

    if (isAuthenticated) {
      try {
        const res = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: selectedAsset.id,
            contractType,
            direction,
            stake,
            durationMinutes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Trade failed");
        setBalance(data.balance);
        setPositions((prev) => [mapApiTrade(data.trade), ...prev]);
        setMobileTab("positions");
      } catch (err) {
        setTradeError(err instanceof Error ? err.message : "Trade failed");
      }
      return;
    }

    setBalance((b) => b - stake);
    setPositions((prev) => [
      {
        id: Date.now().toString(),
        asset: selectedAsset.name,
        type: contractType,
        direction,
        stake,
        payout: selectedAsset.payout,
        expiry: Date.now() + durationMinutes * 60 * 1000,
        openPrice: price,
        status: "open",
      },
      ...prev,
    ]);
    setMobileTab("positions");
  };

  const timeLeft = (expiry: number) => {
    const left = Math.max(0, expiry - Date.now());
    const s = Math.ceil(left / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const orderPanelProps = {
    selectedAsset,
    contractType,
    duration,
    stake,
    balance,
    tradeError,
    onContractTypeChange: setContractType,
    onDurationChange: setDuration,
    onStakeChange: setStake,
    onPlaceTrade: placeTrade,
  };

  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen-safe bg-[#13161e] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen-safe bg-[#13161e] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.07] bg-[#13161e]/95 backdrop-blur safe-top safe-x">
        <div className="flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Logo size="sm" />
            {!isAuthenticated && (
              <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold shrink-0">
                DEMO
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#1c2030] border border-white/[0.07]">
              <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#3B82F6] shrink-0" />
              <span className="text-xs sm:text-sm font-bold tabular-nums">
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setDepositOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg text-white touch-target"
                  style={{ background: "#3B82F6" }}
                >
                  Deposit
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 touch-target"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg text-white touch-target"
                style={{ background: "#3B82F6" }}
              >
                Sign In
              </Link>
            )}
            <Link
              href="/"
              className="p-1.5 sm:px-2 sm:py-1 text-gray-400 hover:text-white transition touch-target"
              title="Exit"
            >
              <X className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline text-xs">Exit</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Desktop / tablet: 3-column layout */}
      <div className="hidden lg:flex flex-1 overflow-hidden min-h-0">
        <aside className="w-56 xl:w-64 border-r border-white/[0.07] flex flex-col shrink-0 bg-[#191c26]">
          <PositionsPanel
            positions={positions}
            closedTab={closedTab}
            onTabChange={setClosedTab}
            timeLeft={timeLeft}
            className="h-full"
          />
        </aside>

        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <ChartToolbar
            selectedAsset={selectedAsset}
            assetDropdown={assetDropdown}
            setAssetDropdown={setAssetDropdown}
            setSelectedAsset={setSelectedAsset}
            price={price}
            chartType={chartType}
            setChartType={setChartType}
          />
          <div ref={chartContainerRef} className="flex-1 relative bg-[#0f1219] min-h-[200px]">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          </div>
        </main>

        <aside className="w-64 xl:w-72 border-l border-white/[0.07] flex flex-col shrink-0 bg-[#191c26] overflow-y-auto">
          <OrderPanel {...orderPanelProps} />
        </aside>
      </div>

      {/* Mobile & small tablet: tabbed layout */}
      <div className="flex lg:hidden flex-1 flex-col overflow-hidden min-h-0">
        {mobileTab === "trade" && (
          <>
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
            <div
              ref={chartContainerRef}
              className="h-[28vh] min-h-[140px] max-h-[200px] relative bg-[#0f1219] shrink-0"
            >
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              {/* Price ladder — right side like TagBinary */}
              <div className="absolute right-0 top-0 bottom-0 w-16 flex flex-col justify-around items-end pr-1 pointer-events-none">
                {[2, 1, 0, -1, -2].map((offset) => {
                  const val = (price + offset * 0.35).toFixed(2);
                  const isCurrent = offset === 0;
                  return (
                    <div
                      key={offset}
                      className={`text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded ${
                        isCurrent
                          ? "bg-[#3B82F6] text-white"
                          : "text-gray-400"
                      }`}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain bg-[#191c26] border-t border-white/[0.07]">
              <OrderPanel {...orderPanelProps} compact />
            </div>
          </>
        )}

        {mobileTab === "positions" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#191c26]">
            <PositionsPanel
              positions={positions}
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
            <button className="px-5 py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-semibold touch-target">
              Coming soon
            </button>
          </div>
        )}

        {/* Bottom navigation */}
        <nav className="shrink-0 flex border-t border-white/[0.07] bg-[#13161e] safe-bottom safe-x">
          <button
            onClick={() => setMobileTab("trade")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 touch-target transition ${
              mobileTab === "trade" ? "text-[#3B82F6]" : "text-gray-500"
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Trade</span>
          </button>
          <button
            onClick={() => setMobileTab("ai")}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 touch-target transition"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                mobileTab === "ai" ? "bg-[#3B82F6]" : "bg-[#1c2030]"
              }`}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className={`text-[10px] font-semibold ${mobileTab === "ai" ? "text-[#3B82F6]" : "text-gray-500"}`}>
              AI
            </span>
          </button>
          <button
            onClick={() => setMobileTab("positions")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 touch-target transition relative ${
              mobileTab === "positions" ? "text-[#3B82F6]" : "text-gray-500"
            }`}
          >
            <LayoutList className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Positions</span>
            {openCount > 0 && (
              <span className="absolute top-1.5 right-1/4 min-w-[16px] h-4 px-1 rounded-full bg-[#3B82F6] text-white text-[9px] font-bold flex items-center justify-center">
                {openCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {isAuthenticated && (
        <DepositModal
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
          onSuccess={(newBalance) => {
            setBalance(newBalance);
            setDepositOpen(false);
          }}
          userPhone={userPhone}
        />
      )}
    </div>
  );
}

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
    <div
      className={`flex items-center justify-between border-b border-white/[0.07] bg-[#1c2030] shrink-0 ${
        compact ? "px-3 py-2" : "px-4 py-2"
      }`}
    >
      <div className="relative min-w-0 flex-1 mr-2">
        <button
          onClick={() => setAssetDropdown(!assetDropdown)}
          className="flex items-center gap-2 max-w-full px-2 py-1.5 rounded-lg hover:bg-white/5 transition touch-target"
        >
          <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-[#3B82F6]" />
          </div>
          <div className="text-left min-w-0">
            <div className="text-xs font-bold truncate">
              {compact ? selectedAsset.name.replace(" Index", "") : selectedAsset.name}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              {price.toFixed(2)}
              <span className="text-emerald-500">+0.41 (0.00%)</span>
              <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        </button>
        {assetDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAssetDropdown(false)} />
            <div className="absolute top-full left-0 mt-1 w-[min(100vw-2rem,16rem)] max-h-56 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#1c2030] shadow-2xl z-50">
              {ASSETS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedAsset(a);
                    setAssetDropdown(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-xs hover:bg-white/5 transition touch-target ${
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
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right">
          <div className={`font-bold tabular-nums ${compact ? "text-base" : "text-lg"}`}>
            {price.toFixed(2)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-emerald-500 flex items-center gap-1 justify-end">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </div>
        </div>
        <div className="flex gap-0.5 sm:gap-1">
          <button
            onClick={() => setChartType("line")}
            className={`p-1.5 rounded-md transition touch-target ${
              chartType === "line" ? "bg-[#3B82F6]/20 text-[#3B82F6]" : "text-gray-500 hover:bg-white/5"
            }`}
          >
            <LineChart className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType("candle")}
            className={`p-1.5 rounded-md transition touch-target ${
              chartType === "candle" ? "bg-[#3B82F6]/20 text-[#3B82F6]" : "text-gray-500 hover:bg-white/5"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}