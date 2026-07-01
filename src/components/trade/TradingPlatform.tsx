"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpFromLine,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Gift,
  HelpCircle,
  LayoutList,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  XCircle,
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
  const router = useRouter();
  const isAuthenticated = !forceDemo && !!session?.user;

  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [contractType, setContractType] = useState<ContractType>("Over/Under");
  const [stake, setStake] = useState(10);
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeError, setTradeError] = useState("");
  const [price, setPrice] = useState(1000);
  const [priceHistory, setPriceHistory] = useState<number[]>(Array(60).fill(1000));
  const [mobileTab, setMobileTab] = useState<MobileTab>("trade");
  const [assetDropdown, setAssetDropdown] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [closedTab, setClosedTab] = useState<"won" | "lost">("won");
  const [settledQueue, setSettledQueue] = useState<{ id: string; profit: number }[]>([]);

  // Floating toast notifications (executed / closed)
  type Toast = {
    id: string;
    kind: "executed" | "closed-profit" | "closed-loss";
    asset: string;
    direction?: "up" | "down";
    amount: number;
    price?: number;
  };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3200);
  }, []);
  const [accountMode, setAccountMode] = useState<"real" | "demo">("real");
  const [accountDropdown, setAccountDropdown] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ name: string | null; email: string; phone: string | null } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [appliedSignal, setAppliedSignal] = useState<{ digit: number; nonce: number } | null>(null);

  const handleUseSignal = (
    market: "Even/Odd" | "Over/Under" | "Match/Differ",
    direction: string,
    digit: number | undefined,
    assetId: string
  ) => {
    setContractType(market as ContractType);
    const asset = ASSETS.find((a) => a.id === assetId);
    if (asset) setSelectedAsset(asset);
    if (digit !== undefined) {
      setAppliedSignal({ digit, nonce: Date.now() });
    }
    setMobileTab("trade");
  };

  const [demoBalance, setDemoBalance] = useState(10000);
  const displayBalance = accountMode === "real" ? balance : demoBalance;
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>({});

  const desktopCanvasRef = useRef<HTMLCanvasElement>(null);
  const mobileCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const mobileChartContainerRef = useRef<HTMLDivElement>(null);

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

  // Redraw chart on container resize — observe both desktop and mobile containers
  useEffect(() => {
    const desktopContainer = chartContainerRef.current;
    const mobileContainer = mobileChartContainerRef.current;
    const ro = new ResizeObserver(() => {
      setPriceHistory((h) => [...h]);
    });
    if (desktopContainer) ro.observe(desktopContainer);
    if (mobileContainer) ro.observe(mobileContainer);
    return () => ro.disconnect();
  }, []);

  // Reusable draw routine — called once per visible canvas so desktop and
  // mobile both render the live line independently (they don't share a canvas).
  const drawChartOnCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
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
    ctx.fillStyle = "#070809";
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

    const points = priceHistory.map((p, i) => ({
      x: padding + (i / (priceHistory.length - 1)) * (w - padding * 2),
      y: h - padding - ((p - min) / range) * (h - padding * 2),
    }));

    // Soft glow behind the line (cloudy effect)
    ctx.save();
    ctx.shadowColor = isUp ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else {
        const prev = points[i - 1];
        const midX = (prev.x + pt.x) / 2;
        const midY = (prev.y + pt.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
    });
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Cloudy gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)");
    grad.addColorStop(0.35, isUp ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)");
    grad.addColorStop(0.7, isUp ? "rgba(34,197,94,0.03)" : "rgba(239,68,68,0.03)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else {
        const prev = points[i - 1];
        const midX = (prev.x + pt.x) / 2;
        const midY = (prev.y + pt.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
    });
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(w - padding, h - padding);
    ctx.lineTo(padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

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

    // Glowing dot at tip
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(w - padding, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }, [priceHistory, price]);

  // Draw to both canvases (whichever is actually mounted/visible) whenever
  // data changes. (Theme-based redraw removed — theme toggle is paused for now.)
  useEffect(() => {
    drawChartOnCanvas(desktopCanvasRef.current);
    drawChartOnCanvas(mobileCanvasRef.current);
  }, [drawChartOnCanvas]);

  // Persist demo balance changes to the server (authenticated users only)
  const demoBalanceRef = useRef(demoBalance);
  useEffect(() => {
    demoBalanceRef.current = demoBalance;
  }, [demoBalance]);

  // Mirrors `positions` for synchronous reads inside placeTrade. placeTrade
  // is called repeatedly across renders by the auto-loop in OrderPanel, so a
  // closed-over `positions` value there could be stale by the time the call
  // actually runs — this ref is always the latest committed state.
  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

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
    const getLastDigit = (val: number) => {
      const cents = Math.round(val * 100);
      return cents % 10;
    };
    setPositions((prev) =>
      prev.map((p) => {
        if (p.status !== "open" || p.expiry > now) return p;
        
        let won = false;
        if (p.type.startsWith("Over/Under")) {
          const parts = p.type.split("|");
          const digitDirection = parts[1] || (p.direction === "up" ? "Over" : "Under");
          const predictedDigit = parts[2] !== undefined ? parseInt(parts[2], 10) : 0;
          const finalDigit = getLastDigit(price);
          
          if (digitDirection === "Over") {
            won = finalDigit > predictedDigit;
          } else if (digitDirection === "Under") {
            won = finalDigit < predictedDigit;
          }
        } else {
          won = p.direction === "up" ? price > p.openPrice : price < p.openPrice;
        }

        const profit = won ? p.payout - p.stake : -p.stake;

        if (p.isDemo) {
          // Demo: stake was already deducted at placement.
          // On win, credit back the full payout (stake + profit).
          // On loss, nothing more to deduct — stake already gone.
          setDemoBalance((b) => +(b + (won ? p.payout : 0)).toFixed(2));
        } else if (isAuthenticated) {
          // Real money: let the server be the source of truth, but also
          // optimistically reflect the result locally so the UI doesn't
          // lag behind while the PATCH round-trip completes.
          setBalance((b) => +(b + (won ? p.payout : 0)).toFixed(2));
          fetch("/api/trades", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: p.id, status: won ? "won" : "lost", profit, closePrice: price }),
          })
            .then(() => syncFromApi())
            .catch(() => {});
        } else {
          // Guest, non-demo fallback (shouldn't normally happen, but stay safe)
          setBalance((b) => +(b + (won ? p.payout : 0)).toFixed(2));
        }

        setSettledQueue((q) => [...q, { id: p.id, profit }]);
        pushToast({
          kind: profit >= 0 ? "closed-profit" : "closed-loss",
          asset: p.asset,
          amount: profit,
        });
        return { ...p, status: won ? "won" : "lost", profit };
      })
    );
  }, [price, isAuthenticated, syncFromApi, pushToast]);

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

  // Fetch profile details (name/email/phone) for the nav drawer identity card
  useEffect(() => {
    if (!navMenuOpen || !isAuthenticated || profile) return;
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setProfile(data.user);
      })
      .catch(() => {});
  }, [navMenuOpen, isAuthenticated, profile]);

  const placeTrade = async (
    direction: "up" | "down",
    meta?: { digit?: number; contractType?: string; digitDirection?: string }
  ): Promise<boolean> => {
    setTradeError("");
    const isDemo = accountMode === "demo" || !isAuthenticated;
    const activeBalance = isDemo ? demoBalance : balance;

    // Hard invariant: never more than one open position at a time. This is
    // what makes target profit / stop loss strict — each trade settles fully
    // (and is checked against the limits) before the next one can open, so
    // the resolve-positions effect below can never close two trades in the
    // same price tick and overshoot the stop/target by more than one trade.
    const hasOpenPosition = positionsRef.current.some(
      (p) => p.status === "open" && Boolean(p.isDemo) === isDemo
    );
    if (hasOpenPosition) {
      setTradeError("Wait for the current trade to settle before placing another.");
      return false;
    }

    if (stake > activeBalance) {
      setTradeError("Insufficient balance");
      return false;
    }
    const durationMs = 10; // fixed 1-tick resolution (10ms check)
    const payout = +(stake * (1 + selectedAsset.payout / 100)).toFixed(2);
    const resolvedContractType = meta?.contractType ?? contractType;
    const enrichedContractType =
      meta?.digit !== undefined && meta?.digitDirection
        ? `${resolvedContractType}|${meta.digitDirection}|${meta.digit}`
        : resolvedContractType;

    const newPosition: Position = {
      id: crypto.randomUUID(),
      asset: selectedAsset.name,
      type: enrichedContractType,
      direction,
      stake,
      payout,
      expiry: Date.now() + durationMs,
      openPrice: price,
      status: "open",
      isDemo,
    };

    pushToast({
      kind: "executed",
      asset: selectedAsset.name,
      direction,
      amount: stake,
      price,
    });

    if (isDemo) {
      // Demo trades always run locally, even when signed in
      setPositions((prev) => [...prev, newPosition]);
      setDemoBalance((b) => b - stake);
      return true;
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
          durationSeconds: 1,
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
        return false;
      }
      const data = await res.json();
      setPositions((prev) => [...prev, { ...newPosition, id: data.trade?.id ?? newPosition.id }]);
      setBalance((b) => (data.balance !== undefined ? data.balance : b - stake));
      return true;
    } catch (e) {
      console.error("Trade network error:", e);
      setTradeError("Network error — please try again");
      return false;
    }
  };

  const visiblePositions = positions.filter((p) => Boolean(p.isDemo) === (accountMode === "demo"));
  const openCount = visiblePositions.filter((p) => p.status === "open").length;

  const orderPanelProps = {
    selectedAsset,
    contractType,
    stake,
    balance: displayBalance,
    tradeError,
    onContractTypeChange: setContractType,
    onStakeChange: setStake,
    onPlaceTrade: (direction: "up" | "down", meta?: { digit?: number; contractType?: string; digitDirection?: string }) => placeTrade(direction, meta),
    settledQueue,
    appliedSignal,
  };

  if (sessionStatus === "loading") {
    return (
      <div className="min-h-[100dvh] bg-[#050a08] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#050a08] text-white flex flex-col overflow-hidden">

      {/* ── Toast notifications ── */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-[#09100d]/95 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 shadow-2xl animate-[slideDown_0.25s_ease-out] flex items-start gap-3"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              t.kind === "executed" ? "bg-[#3B82F6]/15" : t.kind === "closed-profit" ? "bg-emerald-500/15" : "bg-rose-500/15"
            }`}>
              {t.kind === "executed" ? (
                <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
              ) : t.kind === "closed-profit" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">
                {t.kind === "executed" ? "Market Order Executed" : t.kind === "closed-profit" ? "Trade Closed — Profit" : "Trade Closed — Loss"}
              </p>
              <p className="text-sm font-bold text-white truncate">{t.asset}</p>
              {t.kind === "executed" ? (
                <p className="text-xs font-semibold text-[#60a5fa] mt-0.5">
                  {t.direction === "up" ? "Buy" : "Sell"} ${t.amount.toFixed(2)} at {t.price?.toFixed(2)}
                </p>
              ) : (
                <p className={`text-xs font-bold mt-0.5 ${t.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.amount >= 0 ? "+" : ""}${t.amount.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <header
        className="shrink-0 border-b border-white/[0.07] bg-[#050a08]/80 backdrop-blur-md z-30"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 sm:h-16 gap-2 max-w-screen-2xl mx-auto w-full">

          {/* Left: hamburger + wordmark */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
            <button
              onClick={() => setNavMenuOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-[13px] xs:text-sm sm:text-lg font-extrabold tracking-tight select-none whitespace-nowrap">
              <span className="text-[#3B82F6]">DTRADER</span><span className="text-white">CRYPTO</span>
            </span>
          </div>

          {/* Right: account switcher + deposit */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Account balance + switcher */}
            <div className="relative">
              <button
                onClick={() => setAccountDropdown((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl bg-[#0d1713] border border-white/[0.07] hover:border-white/20 transition min-h-[40px] max-w-[110px] xs:max-w-[140px] sm:max-w-[200px]"
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
                  <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-white/[0.07] bg-[#0d1713] shadow-2xl z-50 overflow-hidden">
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
              className="px-2.5 xs:px-4 sm:px-5 py-2.5 text-[11px] xs:text-xs sm:text-sm font-bold rounded-xl text-white bg-gradient-to-r from-[#3B82F6] to-[#6366F1] hover:from-[#60a5fa] hover:to-[#818cf8] shadow-lg shadow-[#3B82F6]/20 active:scale-95 transition-all duration-200 min-h-[40px] sm:min-h-[44px] shrink-0"
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
          <aside className="fixed left-0 top-0 bottom-0 w-[85%] max-w-[340px] bg-[#050a08] border-r border-white/[0.07] z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.07] shrink-0">
              <button
                onClick={() => setNavMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-white">Menu</h2>
              <button className="flex items-center gap-1 text-gray-400 hover:text-white px-1.5 py-1 rounded-lg hover:bg-white/5">
                <Globe className="w-4 h-4" />
                <span className="text-xs font-semibold">EN</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* User identity */}
              {isAuthenticated ? (
                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/account/settings"); }}
                  className="w-full flex items-center gap-3 px-4 py-4 border-b border-white/[0.07] hover:bg-white/[0.03] transition"
                >
                  <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center text-lg font-bold shrink-0">
                    {(profile?.name || profile?.email || session?.user?.email || "U")[0]?.toUpperCase()}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {profile?.phone || profile?.name || "Set up your profile"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {profile?.email ?? session?.user?.email ?? ""}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="px-4 py-4 border-b border-white/[0.07]">
                  <Link
                    href="/login"
                    onClick={() => setNavMenuOpen(false)}
                    className="w-full flex items-center justify-center h-11 rounded-xl bg-[#3B82F6] hover:bg-blue-500 text-white text-sm font-bold transition"
                  >
                    Sign In
                  </Link>
                </div>
              )}

              {/* Menu items */}
              <nav className="flex flex-col">
                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/account/settings"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <Settings className="w-5 h-5 text-gray-400" />
                    Account settings
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                <button
                  onClick={() => { setNavMenuOpen(false); setDepositOpen(true); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <Wallet className="w-5 h-5 text-gray-400" />
                    Deposit
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/withdraw"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <ArrowUpFromLine className="w-5 h-5 text-gray-400" />
                    Withdraw
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/history"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <LayoutList className="w-5 h-5 text-gray-400" />
                    History
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/copy-trading"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <Copy className="w-5 h-5 text-gray-400" />
                    Copy Trading
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/refer"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-purple-500/10 transition text-left bg-purple-500/5"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-purple-300">
                    <Gift className="w-5 h-5 text-purple-400" />
                    Refer & Earn
                  </span>
                  <ChevronRight className="w-4 h-4 text-purple-400/60" />
                </button>

                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <Moon className="w-5 h-5 text-gray-400" />
                    Dark theme
                  </span>
                  <div className="w-11 h-6 rounded-full bg-[#3B82F6] relative cursor-not-allowed opacity-80" title="Always on">
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white" />
                  </div>
                </div>

                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/support"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <HelpCircle className="w-5 h-5 text-gray-400" />
                    Help Centre
                  </span>
                </button>

                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/responsible-trading"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <ShieldCheck className="w-5 h-5 text-gray-400" />
                    Responsible Trading
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                <button
                  onClick={() => { setNavMenuOpen(false); router.push("/support"); }}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.03] transition text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-white">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    Live Chat
                  </span>
                </button>

                {isAuthenticated && (
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06] hover:bg-rose-500/5 transition text-left"
                  >
                    <LogOut className="w-5 h-5 text-rose-400" />
                    <span className="text-sm font-semibold text-rose-400">Log out</span>
                  </button>
                )}
              </nav>
            </div>

            <div className="px-4 py-2.5 text-[10px] text-gray-500 border-t border-white/[0.07]">
              {new Date().toISOString().replace("T", " ").slice(0, 19)} GMT
            </div>
          </aside>
        </>
      )}

      {/* ── Desktop / large tablet (md+) ── */}
      <div className="hidden md:flex flex-1 overflow-hidden min-h-0 max-w-screen-2xl mx-auto w-full">

        {/* Left: Positions — only visible on lg+ */}
        <aside className="hidden lg:flex w-52 xl:w-64 2xl:w-72 border-r border-white/[0.07] flex-col shrink-0 bg-[#09100d]/75 backdrop-blur-lg">
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
          {/* Decorative trade type label */}
          <div className="flex border-b border-white/[0.07] bg-[#050a08] shrink-0 items-center px-4 py-3 justify-between">
            <span className="text-[11px] xl:text-xs font-bold uppercase tracking-wider text-gray-400">Trade Type</span>
            <span className="text-[11px] xl:text-xs font-bold text-white bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-md">Over/Under</span>
          </div>
          <div
            ref={chartContainerRef}
            className="flex-1 relative bg-[#070809] min-h-[180px] m-3 rounded-xl border border-white/[0.07] overflow-hidden"
          >
            <canvas ref={desktopCanvasRef} className="absolute inset-0 w-full h-full" />

            {/* Asset name + live price/change — overlaid top-left */}
            <div className="absolute top-3 left-3 z-10">
              <button
                onClick={() => setAssetDropdown((v) => !v)}
                className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-xl px-3 py-2 hover:bg-black/40 transition"
              >
                <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/25 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-3.5 h-3.5 text-[#3B82F6]" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-sm font-bold text-white truncate">{selectedAsset.name}</div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <span className="tabular-nums">{price.toFixed(2)}</span>
                    <span>+0.41 (0.00%)</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
              {assetDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAssetDropdown(false)} />
                  <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0d1713] shadow-2xl z-50">
                    {ASSETS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAsset(a); setAssetDropdown(false); }}
                        className={`w-full px-4 py-3 text-left text-xs hover:bg-white/5 transition min-h-[44px] ${
                          a.id === selectedAsset.id ? "text-[#3B82F6]" : "text-gray-400"
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

            {/* PRICE box — overlaid top-right */}
            <div className="absolute top-3 right-3 z-10 bg-black/30 backdrop-blur-sm rounded-xl px-4 py-2 text-right">
              <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Price</div>
              <div className="text-lg font-bold text-white tabular-nums leading-tight">{price.toFixed(2)}</div>
            </div>

            {/* Desktop price ladder */}
            <div className="absolute right-0 top-0 bottom-0 w-16 xl:w-20 flex flex-col justify-around items-end pr-2 pointer-events-none pt-16">
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

          {/* Live last-digit tracker */}
          <LiveDigitTracker price={price} priceHistory={priceHistory} />

          {/* Positions strip — md only (tablet, no sidebar) */}
          <div className="lg:hidden border-t border-white/[0.07] h-40 shrink-0 overflow-hidden bg-[#09100d]">
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
        <aside className="w-60 xl:w-72 2xl:w-80 border-l border-white/[0.07] flex flex-col shrink-0 bg-[#09100d]/75 backdrop-blur-lg overflow-y-auto">
          <OrderPanel {...orderPanelProps} />
        </aside>
      </div>

      {/* ── Mobile (< md): tabbed layout ── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden min-h-0">
        {mobileTab === "trade" && (
          <>
            {/* Scrollable content: contract tabs, chart, digit tracker, and
                order panel (including Match/Differ) all scroll together as
                one continuous list. Only the bottom nav stays fixed. */}
            <div className="flex-1 overflow-y-auto overscroll-contain bg-[#09100d]" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
              {/* Decorative trade type label */}
              <div className="flex border-b border-white/[0.07] bg-[#050a08] shrink-0 items-center px-4 py-2.5 justify-between min-h-[40px]">
                <span className="text-[10px] xs:text-[11px] font-bold uppercase tracking-wider text-gray-400">Trade Type</span>
                <span className="text-[10px] xs:text-[11px] font-bold text-white bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-md">Over/Under</span>
              </div>

              {/* Chart card — asset info and price overlaid, TagBinary style */}
              <div className="px-2 py-1.5 bg-[#050a08] shrink-0">
                <div ref={mobileChartContainerRef} className="h-[22vh] min-h-[150px] max-h-[230px] relative bg-[#070809] rounded-xl border border-white/[0.07] overflow-hidden">
                  <canvas ref={mobileCanvasRef} className="absolute inset-0 w-full h-full" />

                  {/* Asset name + live price/change — overlaid top-left */}
                  <div className="absolute top-2 left-2 z-10">
                    <button
                      onClick={() => setAssetDropdown((v) => !v)}
                      className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-xl px-2.5 py-1.5 max-w-[78%]"
                    >
                      <div className="w-6 h-6 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/25 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-3 h-3 text-[#3B82F6]" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="text-[11px] sm:text-xs font-bold text-white truncate leading-tight">
                          {selectedAsset.name}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-emerald-400 flex items-center gap-1 leading-tight">
                          <span className="tabular-nums">{price.toFixed(2)}</span>
                          <span>+0.41 (0.00%)</span>
                        </div>
                      </div>
                      <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                    </button>
                    {assetDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setAssetDropdown(false)} />
                        <div className="absolute top-full left-0 mt-1 w-[min(80vw,18rem)] max-h-64 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0d1713] shadow-2xl z-50">
                          {ASSETS.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => { setSelectedAsset(a); setAssetDropdown(false); }}
                              className={`w-full px-4 py-3 text-left text-xs hover:bg-white/5 transition min-h-[44px] ${
                                a.id === selectedAsset.id ? "text-[#3B82F6]" : "text-gray-400"
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

                  {/* PRICE box — overlaid top-right */}
                  <div className="absolute top-2 right-2 z-10 bg-black/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-right">
                    <div className="text-[8px] sm:text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Price</div>
                    <div className="text-sm sm:text-base font-bold text-white tabular-nums leading-tight">
                      {price.toFixed(2)}
                    </div>
                  </div>

                  {/* Price ladder */}
                  <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-20 flex flex-col justify-around items-end pr-1.5 sm:pr-2 pointer-events-none pt-12">
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

              {/* Live last-digit tracker — sits right under the chart, scrolls with it */}
              <LiveDigitTracker price={price} priceHistory={priceHistory} />

              {/* Order panel */}
              <div className="border-t border-white/[0.07]">
                <OrderPanel {...orderPanelProps} compact />
              </div>
            </div>
          </>
        )}

        {mobileTab === "positions" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#09100d]" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
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
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#09100d] px-6 text-center" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="w-16 h-16 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-white font-semibold text-base mb-1">AI</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Scan live tick patterns to find the statistically strongest entry across markets.
              </p>
            </div>
            <button
              onClick={() => setScannerOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-semibold min-h-[44px]"
            >
              AI
            </button>
          </div>
        )}

        {/* Bottom nav — floats fixed over scrolling content, never part of document flow */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/[0.07] bg-[#050a08] shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
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
              mobileTab === "ai" ? "bg-[#3B82F6]" : "bg-[#0d1713]"
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

      {scannerOpen && (
        <EntryScannerModal
          onClose={() => setScannerOpen(false)}
          onUseSignal={handleUseSignal}
        />
      )}
    </div>
  );
}

// ── LiveDigitTracker ──
// Shows the last-digit frequency distribution from real price history,
// with a moving cursor pointing at whichever digit the current price tick landed on.
function LiveDigitTracker({ price, priceHistory }: { price: number; priceHistory: number[] }) {
  const getLastDigit = (val: number) => {
    // Use 2 decimal places, take the last digit of the cents value
    const cents = Math.round(val * 100);
    return cents % 10;
  };

  const currentDigit = getLastDigit(price);

  // Compute real frequency % from the visible price history window
  const counts = Array(10).fill(0);
  priceHistory.forEach((p) => {
    counts[getLastDigit(p)]++;
  });
  const total = priceHistory.length || 1;
  const percentages = counts.map((c) => (c / total) * 100);
  const maxPct = Math.max(...percentages);

  return (
    <div className="px-2.5 pt-2.5 pb-2 bg-[#050a08] border-b border-white/[0.06] shrink-0">
      <div className="relative">
        {/* Moving cursor arrow */}
        <div
          className="absolute -top-0.5 flex flex-col items-center transition-all duration-300 ease-out"
          style={{ left: `calc(${(currentDigit / 9) * 100}% - 5px)` }}
        >
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-[#3B82F6]" />
        </div>

        <div className="flex justify-between gap-1 pt-2.5">
          {percentages.map((pct, d) => {
            const isCurrent = d === currentDigit;
            const isHot = pct === maxPct && maxPct > 0;
            return (
              <div key={d} className="flex flex-col items-center gap-0.5 flex-1">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold border-2 transition-all ${
                    isCurrent
                      ? "bg-[#3B82F6] border-[#3B82F6] text-white scale-110 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                      : isHot
                        ? "bg-transparent border-emerald-500 text-emerald-400"
                        : "bg-transparent border-white/15 text-gray-400"
                  }`}
                >
                  {d}
                </div>
                <span className={`text-[8px] sm:text-[9px] font-bold tabular-nums ${
                  d === 0 ? "text-rose-400" : isCurrent ? "text-[#60a5fa]" : "text-gray-500"
                }`}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── EntryScannerModal ──
// Walks every asset with a few real live ticks each, scores them for the
// selected market type, and surfaces the single best asset + direction —
// mirroring TagBinary's "Deep Scan for Best Market" tool with real data.
type ScanMarket = "Even/Odd" | "Over/Under" | "Match/Differ";

interface AssetScanResult {
  assetId: string;
  assetName: string;
  direction: string;
  digit?: number;
  confidence: number; // 0-100
}

function getLastDigit(val: number): number {
  return Math.round(val * 100) % 10;
}

function scoreDigits(market: ScanMarket, digits: number[]): { direction: string; digit?: number; confidence: number } {
  const total = digits.length || 1;

  if (market === "Even/Odd") {
    const evenCount = digits.filter((d) => d % 2 === 0).length;
    const oddCount = total - evenCount;
    const evenPct = (evenCount / total) * 100;
    const oddPct = (oddCount / total) * 100;
    const direction = evenPct >= oddPct ? "Even" : "Odd";
    return { direction, confidence: Math.max(evenPct, oddPct) };
  }

  if (market === "Over/Under") {
    let best = { digit: 4, skew: 0, overPct: 50, underPct: 50 };
    for (let d = 0; d <= 8; d++) {
      const overCount = digits.filter((x) => x > d).length;
      const underCount = total - overCount;
      const overPct = (overCount / total) * 100;
      const underPct = (underCount / total) * 100;
      const skew = Math.abs(overPct - underPct);
      if (skew > best.skew) best = { digit: d, skew, overPct, underPct };
    }
    const direction = best.overPct >= best.underPct ? "Over" : "Under";
    return { direction, digit: best.digit, confidence: Math.max(best.overPct, best.underPct) };
  }

  // Match/Differ — least-frequent digit gets the Match call (best edge, since
  // Match pays far more than Differ).
  const counts = Array(10).fill(0);
  digits.forEach((d) => counts[d]++);
  const minCount = Math.min(...counts);
  const chosenDigit = counts.findIndex((c) => c === minCount);
  const confidence = 100 - (minCount / total) * 100;
  return { direction: "Match", digit: chosenDigit, confidence };
}

async function fetchAssetTicks(assetId: string, count: number): Promise<number[]> {
  const requests = Array.from({ length: count }, () =>
    fetch(`/api/prices?assetId=${assetId}&tick=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (typeof data?.price === "number" ? data.price : null))
      .catch(() => null)
  );
  const results = await Promise.all(requests);
  return results.filter((p): p is number => p !== null);
}

function EntryScannerModal({
  onClose,
  onUseSignal,
}: {
  onClose: () => void;
  onUseSignal: (market: ScanMarket, direction: string, digit: number | undefined, assetId: string) => void;
}) {
  const [selectedMarket, setSelectedMarket] = useState<ScanMarket>("Over/Under");
  const [scanning, setScanning] = useState(false);
  const [pass, setPass] = useState(0);
  const [currentAssetName, setCurrentAssetName] = useState("");
  const [result, setResult] = useState<AssetScanResult | null>(null);

  const TOTAL_PASSES = 3;
  const TICKS_PER_ASSET = 5;

  const handleScan = async () => {
    setScanning(true);
    setResult(null);
    setPass(0);

    let best: AssetScanResult | null = null;

    for (let p = 1; p <= TOTAL_PASSES; p++) {
      setCurrentAssetName(`Pass ${p} — checking all ${ASSETS.length} assets…`);

      // Fire every asset's tick batch in parallel — this is the main speedup,
      // turning 12 sequential round-trips per pass into 1 concurrent batch.
      const passResults = await Promise.all(
        ASSETS.map(async (asset) => {
          const ticks = await fetchAssetTicks(asset.id, TICKS_PER_ASSET);
          if (ticks.length < 3) return null;
          const digits = ticks.map(getLastDigit);
          const scored = scoreDigits(selectedMarket, digits);
          return {
            assetId: asset.id,
            assetName: asset.name,
            direction: scored.direction,
            digit: scored.digit,
            confidence: Math.round(scored.confidence),
          } as AssetScanResult;
        })
      );

      for (const r of passResults) {
        if (r && (!best || r.confidence > best.confidence)) best = r;
      }

      setPass(p);
    }

    setResult(best);
    setScanning(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#09100d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] sticky top-0 bg-[#09100d] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/25 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-[#3B82F6]" />
            </div>
            <h2 className="text-base font-bold text-white">AI Scanner</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            Pick the market category you want to scan. The deep scanner walks every asset and surfaces the best entry point based on live tick patterns.
          </p>

          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1.5">Market</label>
            <select
              value={selectedMarket}
              onChange={(e) => { setSelectedMarket(e.target.value as ScanMarket); setResult(null); }}
              disabled={scanning}
              className="w-full bg-[#0d1713] border border-white/[0.07] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[#3B82F6]/50 appearance-none disabled:opacity-50"
            >
              <option value="Over/Under">Over / Under</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 truncate pr-2">
                {scanning ? currentAssetName : result ? result.assetName : "Ready to scan"}
              </span>
              <span className="text-xs text-gray-400 font-semibold shrink-0">{pass}/{TOTAL_PASSES}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${result ? "bg-emerald-500" : "bg-[#3B82F6]"}`}
                style={{ width: `${(pass / TOTAL_PASSES) * 100}%` }}
              />
            </div>
          </div>

          {result && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white leading-snug">
                  <span className="font-bold">Best market:</span> {result.assetName} | {selectedMarket} {result.direction}
                  {" "}| <span className="text-emerald-400 font-bold">Quality {result.confidence}%</span>
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Selected Market</p>
                  <div className="bg-[#0d1713] rounded-lg px-3 py-2 text-sm text-white font-semibold">{result.assetName}</div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Trade Type</p>
                  <div className="bg-[#0d1713] rounded-lg px-3 py-2 text-sm text-white font-semibold">{selectedMarket}</div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Prediction (Auto)</p>
                  <div className="bg-[#0d1713] rounded-lg px-3 py-2 text-sm text-white font-semibold">
                    {result.direction}
                    {result.digit !== undefined && ` · digit ${result.digit}`}
                  </div>
                </div>
              </div>

              <button
                onClick={() => { onUseSignal(selectedMarket, result.direction, result.digit, result.assetId); onClose(); }}
                className="w-full mt-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition active:scale-95"
              >
                Use This Signal
              </button>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning}
            className="w-full h-12 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            {scanning ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Scanning {currentAssetName || "…"}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {result ? "Re-scan for Best Market" : "Deep Scan for Best Market"}
              </>
            )}
          </button>

          <p className="text-[10px] text-gray-500 text-center leading-relaxed">
            Scans {ASSETS.length} assets with live ticks per pass. Past tick patterns don&apos;t guarantee future outcomes.
          </p>
        </div>
      </div>
    </div>
  );
}