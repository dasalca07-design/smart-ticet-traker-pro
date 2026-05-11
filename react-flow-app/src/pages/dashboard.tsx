import {
  useGetExpenseSummary, getGetExpenseSummaryQueryKey,
  useGetExpensesByCategory, getGetExpensesByCategoryQueryKey,
  useListExpenses, getListExpensesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  format, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, subDays, parseISO,
} from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "wouter";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function TrendBadge({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.5)
    return <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Minus className="w-3 h-3" /> —</span>;
  if (pct > 0)
    return <span className="flex items-center gap-1 text-[11px] text-red-500 dark:text-red-400"><TrendingUp className="w-3 h-3" /> +{pct.toFixed(0)}%</span>;
  return <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><TrendingDown className="w-3 h-3" /> {pct.toFixed(0)}%</span>;
}

export default function Dashboard() {
  const now = new Date();
  const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
  const thisStart = startOfMonth(now);
  const thisEnd = endOfMonth(now);
  const lastStart = startOfMonth(subMonths(now, 1));
  const lastEnd = endOfMonth(subMonths(now, 1));
  const last30Start = subDays(now, 29);

  const { data: summary, isLoading: l1 } = useGetExpenseSummary({}, { query: { enabled: true, queryKey: getGetExpenseSummaryQueryKey({}) } });
  const { data: byCategory, isLoading: l2 } = useGetExpensesByCategory({}, { query: { enabled: true, queryKey: getGetExpensesByCategoryQueryKey({}) } });
  const { data: thisMonth, isLoading: l3 } = useListExpenses(
    { startDate: fmtDate(thisStart), endDate: fmtDate(thisEnd), limit: 500 },
    { query: { enabled: true, queryKey: getListExpensesQueryKey({ startDate: fmtDate(thisStart), endDate: fmtDate(thisEnd), limit: 500 }) } }
  );
  const { data: lastMonth, isLoading: l4 } = useListExpenses(
    { startDate: fmtDate(lastStart), endDate: fmtDate(lastEnd), limit: 500 },
    { query: { enabled: true, queryKey: getListExpensesQueryKey({ startDate: fmtDate(lastStart), endDate: fmtDate(lastEnd), limit: 500 }) } }
  );
  const { data: last30, isLoading: l5 } = useListExpenses(
    { startDate: fmtDate(last30Start), endDate: fmtDate(now), limit: 500 },
    { query: { enabled: true, queryKey: getListExpensesQueryKey({ startDate: fmtDate(last30Start), endDate: fmtDate(now), limit: 500 }) } }
  );

  const isLoading = l1 || l2 || l3 || l4 || l5;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-3" data-testid="dashboard-loading">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="flex-1 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  // KPIs
  const thisTotal = (thisMonth ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = (lastMonth ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const monthTrend = lastTotal === 0 ? 0 : ((thisTotal - lastTotal) / lastTotal) * 100;
  const thisCount = (thisMonth ?? []).length;
  const lastCount = (lastMonth ?? []).length;
  const countTrend = lastCount === 0 ? 0 : ((thisCount - lastCount) / lastCount) * 100;
  const thisAvg = thisCount === 0 ? 0 : thisTotal / thisCount;
  const lastAvg = lastCount === 0 ? 0 : lastTotal / lastCount;
  const avgTrend = lastAvg === 0 ? 0 : ((thisAvg - lastAvg) / lastAvg) * 100;
  const biggest = (thisMonth ?? []).reduce((m, e) => Math.max(m, Number(e.amount)), 0);
  const biggestLast = (lastMonth ?? []).reduce((m, e) => Math.max(m, Number(e.amount)), 0);
  const biggestTrend = biggestLast === 0 ? 0 : ((biggest - biggestLast) / biggestLast) * 100;

  // Daily chart
  const days = eachDayOfInterval({ start: last30Start, end: now });
  const dailyMap: Record<string, number> = {};
  for (const e of last30 ?? []) {
    const k = e.date.slice(0, 10);
    dailyMap[k] = (dailyMap[k] ?? 0) + Number(e.amount);
  }
  const dailyData = days.map(d => ({
    date: format(d, "d MMM"),
    amount: dailyMap[format(d, "yyyy-MM-dd")] ?? 0,
  }));

  // Categories
  const topCats = (byCategory ?? []).filter(c => c.total > 0).sort((a,b) => b.total - a.total).slice(0, 5);
  const catTotal = topCats.reduce((s, c) => s + c.total, 0);

  const recent = (summary?.recentExpenses ?? []).slice(0, 5);

  return (
    <div className="h-full flex flex-col gap-3 md:gap-5" data-testid="dashboard">
      {/* Header */}
      <div className="flex-shrink-0 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-serif text-foreground leading-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">{format(now, "MMMM yyyy")}</p>
        </div>
        <Link href="/expenses" className="text-xs font-medium text-primary hover:underline" data-testid="link-view-all">
          See all →
        </Link>
      </div>

      {/* KPI row */}
      <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
        <KpiCard label="This month" value={fmt(thisTotal)} trend={<TrendBadge pct={monthTrend} />} accent testId="kpi-month" />
        <KpiCard label="Transactions" value={String(thisCount)} trend={<TrendBadge pct={countTrend} />} testId="kpi-count" />
        <KpiCard label="Avg expense" value={fmt(thisAvg)} trend={<TrendBadge pct={avgTrend} />} testId="kpi-avg" />
        <KpiCard label="Largest" value={fmt(biggest)} trend={<TrendBadge pct={biggestTrend} />} testId="kpi-largest" />
      </div>

      {/* Area chart */}
      <Card className="flex-shrink-0 border-border/50 shadow-sm" data-testid="chart-area">
        <CardHeader className="py-2.5 px-4">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Daily spending — last 30 days
          </CardTitle>
        </CardHeader>
        <CardContent className="h-32 md:h-44 px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                formatter={(v: number) => [fmt(v), "Spent"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                cursor={{ stroke: "hsl(var(--border))" }}
              />
              <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--primary))" }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom two-column row */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-4">
        {/* Category breakdown */}
        <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm" data-testid="card-categories">
          <CardHeader className="py-2.5 px-4 flex-shrink-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By category</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4 pb-3 overflow-y-auto">
            {topCats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-3">
                {topCats.map(cat => (
                  <div key={cat.categoryId} className="space-y-1" data-testid={`cat-row-${cat.categoryId}`}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="font-medium text-foreground">{cat.categoryName}</span>
                        <span className="text-muted-foreground">{cat.count}x</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{cat.percentage.toFixed(0)}%</span>
                        <span className="font-semibold text-foreground tabular-nums">{fmt(cat.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, background: cat.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm" data-testid="card-recent">
          <CardHeader className="py-2.5 px-4 flex-shrink-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</CardTitle>
            <Link href="/expenses" className="text-[11px] text-muted-foreground hover:text-primary transition-colors">See all</Link>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4 pb-3 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No expenses yet</p>
            ) : (
              <div className="divide-y divide-border/60">
                {recent.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0" data-testid={`tx-${e.id}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.category?.color ?? "hsl(var(--muted-foreground))" }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.description}</p>
                        <p className="text-[11px] text-muted-foreground">{e.category?.name} · {format(parseISO(e.date), "MMM d")}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-foreground tabular-nums ml-2 flex-shrink-0">{fmt(Number(e.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, trend, accent = false, testId }: {
  label: string; value: string; trend: React.ReactNode; accent?: boolean; testId?: string;
}) {
  return (
    <Card className={`border-border/50 shadow-sm ${accent ? "bg-primary text-primary-foreground" : ""}`} data-testid={testId}>
      <CardContent className="px-3.5 pt-3.5 pb-3">
        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
        <p className={`text-lg md:text-xl font-serif truncate mb-1 ${accent ? "text-primary-foreground" : "text-foreground"}`}>{value}</p>
        <div className={accent ? "[&_span]:text-primary-foreground/80 [&_svg]:text-primary-foreground/80" : ""}>{trend}</div>
      </CardContent>
    </Card>
  );
}
