"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CloudOff, Plus, RefreshCw } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { CloudProvider, CostBreakdownItem, ProviderCost } from "@/lib/costs/types";

const ALL_PROVIDERS: { id: CloudProvider; label: string; color: string }[] = [
  { id: "aws", label: "AWS", color: "#f97316" },
  { id: "gcp", label: "GCP", color: "#eab308" },
  { id: "azure", label: "Azure", color: "#0ea5e9" },
  { id: "scaleway", label: "Scaleway", color: "#8b5cf6" },
];

const STORAGE_KEY = "observex.costProviders.v1";

function loadSelected(): CloudProvider[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CloudProvider[]) : [];
  } catch {
    return [];
  }
}

function saveSelected(providers: CloudProvider[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  } catch {
    // localStorage unavailable (private browsing etc.) -- selection just won't persist.
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

interface FlatItem extends CostBreakdownItem {
  provider: CloudProvider;
  color: string;
}

function BreakdownList({ title, items, currency }: { title: string; items: FlatItem[]; currency: string }) {
  const max = Math.max(...items.map((i) => i.amount), 1);
  return (
    <div>
      <div className="mb-2 text-xs text-text-muted">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.provider}-${item.name}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-text-secondary">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-text-primary">
                {formatMoney(item.amount, currency)}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full"
                style={{ width: `${(item.amount / max) * 100}%`, background: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InfraCost() {
  // null = "haven't read localStorage yet" (avoids a flash of the empty
  // state before we know what the user previously picked).
  const [selected, setSelected] = useState<CloudProvider[] | null>(null);
  const [costs, setCosts] = useState<Partial<Record<CloudProvider, ProviderCost>>>({});
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(loadSelected());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/costs");
      const data = (await res.json()) as { costs: ProviderCost[] };
      const map: Partial<Record<CloudProvider, ProviderCost>> = {};
      data.costs.forEach((c) => {
        map[c.provider] = c;
      });
      setCosts(map);
    } catch {
      setCosts({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleProvider(id: CloudProvider) {
    const current = selected ?? [];
    const next = current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
    setSelected(next);
    saveSelected(next);
  }

  const visible = ALL_PROVIDERS.filter((p) => selected?.includes(p.id));
  const withCost = visible.map((p) => ({ ...p, cost: costs[p.id] }));
  const connected = withCost.filter((p) => p.cost?.status === "connected" && (p.cost?.amount ?? 0) > 0);
  const total = connected.reduce((sum, p) => sum + (p.cost?.amount ?? 0), 0);
  const currency = connected[0]?.cost?.currency ?? "USD";

  const pieData =
    connected.length > 0
      ? connected.map((p) => ({ name: p.label, value: p.cost?.amount ?? 0, color: p.color }))
      : [{ name: "No data", value: 1, color: "#1a2029" }];

  const topServices: FlatItem[] = connected
    .flatMap((p) => (p.cost?.services ?? []).map((s) => ({ ...s, provider: p.id, color: p.color })))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const topProjects: FlatItem[] = connected
    .flatMap((p) => (p.cost?.projects ?? []).map((proj) => ({ ...proj, provider: p.id, color: p.color })))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  // Combined monthly trend across whichever connected providers report
  // history -- providers without it (e.g. an unverified Scaleway response
  // shape) just contribute 0 for their months rather than breaking the chart.
  const historyMonths = Array.from(
    new Set(connected.flatMap((p) => (p.cost?.history ?? []).map((h) => h.month)))
  ).sort();
  const trendData = historyMonths.map((month) => ({
    month,
    amount: connected.reduce(
      (sum, p) => sum + (p.cost?.history?.find((h) => h.month === month)?.amount ?? 0),
      0
    ),
  }));
  const hasTrend = trendData.some((d) => d.amount > 0);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Infra Cost (MTD)</h3>
          <p className="text-xs text-text-muted">
            {connected.length > 0
              ? `${formatMoney(total, currency)} across ${connected.length} connected provider${connected.length === 1 ? "" : "s"}`
              : "Real spend from your cloud billing accounts"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add provider
            </button>
            {pickerOpen && (
              <div className="absolute right-0 top-7 z-20 w-44 rounded-md border border-border bg-surface-raised py-1 shadow-lg">
                {ALL_PROVIDERS.map((p) => {
                  const checked = selected?.includes(p.id) ?? false;
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProvider(p.id)}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                        {p.label}
                      </span>
                      {checked && <Check className="h-3.5 w-3.5 text-accent-blue" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={load}
            className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
            aria-label="Refresh infra cost"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex h-28 flex-col items-center justify-center gap-1 text-center">
          <span className="text-sm text-text-secondary">No providers added yet</span>
          <span className="text-xs text-text-muted">
            Click &ldquo;Add provider&rdquo; to track AWS, GCP, Azure or Scaleway spend.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cn("grid grid-cols-1 gap-4", hasTrend && "lg:grid-cols-2")}>
            <div>
              <div className="mb-2 text-xs text-text-muted">Current consumption</div>
              <div className="flex items-center gap-4">
                <div className="relative h-32 w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={58}
                        paddingAngle={connected.length > 1 ? 2 : 0}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      {connected.length > 0 && (
                        <Tooltip
                          content={({ active, payload }) =>
                            active && payload?.[0] ? (
                              <div className="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs shadow-lg">
                                <span className="text-text-secondary">{payload[0].name}</span>{" "}
                                <span className="font-medium text-text-primary">
                                  {formatMoney(Number(payload[0].value), currency)}
                                </span>
                              </div>
                            ) : null
                          }
                        />
                      )}
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-semibold text-text-primary">{formatMoney(total, currency)}</span>
                    <span className="text-[10px] text-text-muted">this month</span>
                  </div>
                </div>

                <div className="w-48 shrink-0 space-y-1.5">
                  {visible.map((p) => {
                    const cost = costs[p.id];
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                          {p.label}
                        </span>
                        {cost?.status === "connected" ? (
                          <span className="font-medium tabular-nums text-text-primary">
                            {formatMoney(cost.amount ?? 0, cost.currency ?? "USD")}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "flex shrink-0 items-center gap-1",
                              cost?.status === "error" ? "text-status-warning" : "text-text-muted"
                            )}
                            title={cost?.detail}
                          >
                            {cost?.status === "error" ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <CloudOff className="h-3 w-3" />
                            )}
                            {loading ? "…" : cost?.status === "error" ? "Error" : "Not connected"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {hasTrend && (
              <div>
                <div className="mb-2 text-xs text-text-muted">6 months consumption overview</div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                      <XAxis
                        dataKey="month"
                        tickFormatter={formatMonthLabel}
                        stroke="#6b7280"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "#232a35" }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.[0] ? (
                            <div className="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs shadow-lg">
                              <span className="text-text-secondary">{formatMonthLabel(String(label))}</span>{" "}
                              <span className="font-medium text-text-primary">
                                {formatMoney(Number(payload[0].value), currency)}
                              </span>
                            </div>
                          ) : null
                        }
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {(topServices.length > 0 || topProjects.length > 0) && (
            <div className="grid grid-cols-1 gap-4 border-t border-border pt-3 sm:grid-cols-2">
              {topServices.length > 0 && (
                <BreakdownList title="Top services by cost" items={topServices} currency={currency} />
              )}
              {topProjects.length > 0 && (
                <BreakdownList title="By project" items={topProjects} currency={currency} />
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
