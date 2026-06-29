"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface HistoryItem {
  kind: "trade" | "transaction";
  id: string;
  label: string;
  amount: number;
  status: string;
  date: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<"all" | "trades" | "transactions">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/history?type=${filter}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  const getIcon = (item: HistoryItem) => {
    if (item.kind === "trade") {
      return item.amount >= 0
        ? <TrendingUp className="w-4 h-4 text-emerald-400" />
        : <TrendingDown className="w-4 h-4 text-rose-400" />;
    }
    return item.amount >= 0
      ? <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
      : <ArrowUpFromLine className="w-4 h-4 text-rose-400" />;
  };

  const statusColor = (status: string) => {
    if (status === "won" || status === "completed" || status === "approved") return "text-emerald-400";
    if (status === "lost" || status === "failed" || status === "rejected") return "text-rose-400";
    return "text-amber-400";
  };

  return (
    <div className="min-h-screen bg-[#050a08] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#050a08]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">History</h1>
      </header>

      <div className="px-4 pt-3 pb-1">
        <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1">
          {(["all", "trades", "transactions"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition ${
                filter === f ? "bg-[#3B82F6] text-white" : "text-gray-400"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-12">No history yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-center gap-3 bg-[#09100d] border border-white/[0.06] rounded-xl px-3.5 py-3"
              >
                <div className="w-9 h-9 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                  {getIcon(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.label}</p>
                  <p className="text-[11px] text-gray-500">
                    {new Date(item.date).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${item.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {item.amount >= 0 ? "+" : ""}${Math.abs(item.amount).toFixed(2)}
                  </p>
                  <p className={`text-[10px] font-semibold capitalize ${statusColor(item.status)}`}>{item.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}