import {
  useListExpenses, getListExpensesQueryKey,
  useGetExpensesByCategory, getGetExpensesByCategoryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, ResponsiveContainer,
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ── Candlestick bar shape ─────────────────────────────────────────────────────
function CandleShape(props: any) {
  const { x, y, width, height, value, payload } = props;
  if (!value || value === 0 || height === 0) return <g />;

  const scale = height / value;
  const chartBottom = y + height;
  const color = payload.aboveAvg ? "#ef4444" : "#10b981";
  const centerX = x + width / 2;
  const bodyW = Math.max(width - 6, 4);
  const bodyX = x + (width - bodyW) / 2;

  // Wick: from top of body up to the max single expense
  const maxY = payload.max > value ? chartBottom - payload.max * scale : y;

  return (
    <g>
      {/* Wick */}
      {payload.max > value && (
        <line
          x1={centerX} y1={maxY}
          x2={centerX} y2={y}
          stroke={color} strokeWidth={1.5} opacity={0.7}
        />
      )}
      {/* Body */}
      <rect
        x={bodyX} y={y}
        width={bodyW} height={Math.max(height, 2)}
        fill={color} rx={2} opacity={0.9}
      />
      {/* Bottom cap */}
      <line x1={centerX - 3} y1={chartBottom} x2={centerX + 3} y2={chartBottom} stroke={color} strokeWidth={1.5} />
    </g>
  );
}

// ── CSS conic-gradient donut ───────────────────────────────────────────────────
function CssDonut({ data, total }: { data: { color: string; total: number; categoryName: string }[]; total: number }) {
  let angle = 0;
  const segments = data.map(d => {
    const pct = total > 0 ? (d.total / total) * 360 : 0;
    const from = angle;
    angle += pct;
    return { ...d, from, to: angle };
  });
  const gradient = segments.map(s => `${s.color} ${s.from}deg ${s.to}deg`).join(", ");

  return (
    <div className="flex items-center justify-center py-2">
      <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
            WebkitMask: "radial-gradient(circle, transparent 48%, black 49%)",
            mask: "radial-gradient(circle, transparent 48%, black 49%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">Total</span>
          <span className="text-lg font-serif text-foreground">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const now = new Date();
  const last30Start = subDays(now, 29);
  const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");

  const { data: expenses, isLoading: l1 } = useListExpenses(
    { startDate: fmtDate(last30Start), endDate: fmtDate(now), limit: 500 },
    { query: { enabled: true, queryKey: getListExpensesQueryKey({ startDate: fmtDate(last30Start), endDate: fmtDate(now), limit: 500 }) } }
  );

  const { data: byCategory, isLoading: l2 } = useGetExpensesByCategory(
    {},
    { query: { enabled: true, queryKey: getGetExpensesByCategoryQueryKey({}) } }
  );

  const isLoading = l1 || l2;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-3" data-testid="analytics-loading">
        <Skeleton className="h-7 w-40 flex-shrink-0" />
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="rounded-xl" />
          <Skeleton className="rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Donut data ────────────────────────────────────────────────────────────
  const donutData = (byCategory ?? []).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const donutTotal = donutData.reduce((s, c) => s + c.total, 0);

  // ── Candlestick data ──────────────────────────────────────────────────────
  const days = eachDayOfInterval({ start: last30Start, end: now });

  // Build day buckets
  const buckets: Record<string, { totals: number[]; max: number }> = {};
  for (const e of expenses ?? []) {
    const k = e.date.slice(0, 10);
    if (!buckets[k]) buckets[k] = { totals: [], max: 0 };
    buckets[k].totals.push(Number(e.amount));
    buckets[k].max = Math.max(buckets[k].max, Number(e.amount));
  }

  // 7-day rolling average
  const dailyTotals = days.map(d => {
    const k = format(d, "yyyy-MM-dd");
    const b = buckets[k];
    return b ? b.totals.reduce((s, v) => s + v, 0) : 0;
  });

  const rollingAvg = (i: number) => {
    const start = Math.max(0, i - 6);
    const slice = dailyTotals.slice(start, i + 1).filter(v => v > 0);
    return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : 0;
  };

  const overallAvg = dailyTotals.filter(v => v > 0).reduce((s, v) => s + v, 0) /
    (dailyTotals.filter(v => v > 0).length || 1);

  // Only show last 14 days for readability
  const last14 = days.slice(-14);
  const candleData = last14.map((d, i) => {
    const k = format(d, "yyyy-MM-dd");
    const b = buckets[k];
    const total = b ? b.totals.reduce((s, v) => s + v, 0) : 0;
    const max = b ? b.max : 0;
    const avg = rollingAvg(days.indexOf(d));
    return {
      date: format(d, "d MMM"),
      total,
      max,
      avg: Math.round(avg * 100) / 100,
      aboveAvg: total > overallAvg,
    };
  });

  const candleMax = Math.max(...candleData.map(d => Math.max(d.total, d.max)), 10);

  return (
    <div className="h-full flex flex-col gap-3 md:gap-5" data-testid="analytics-page">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-xl md:text-3xl font-serif text-foreground leading-tight">Analytics</h1>
        <p className="text-xs text-muted-foreground">Gráficos de tus gastos · últimos 30 días</p>
      </div>

      {/* Charts grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 overflow-y-auto md:overflow-hidden">

        {/* ── Donut chart ── */}
        <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm h-[360px] md:h-auto" data-testid="chart-donut">
          <CardHeader className="py-2.5 px-4 flex-shrink-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Distribución por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4 pb-4 flex flex-col gap-3">
            {donutData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
            ) : (
              <>
                {/* CSS Donut */}
                <CssDonut data={donutData} total={donutTotal} />

                {/* Legend list */}
                <div className="space-y-2 flex-shrink-0">
                  {donutData.slice(0, 5).map(cat => (
                    <div key={cat.categoryId} className="flex items-center justify-between text-xs" data-testid={`donut-legend-${cat.categoryId}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="text-foreground font-medium truncate">{cat.categoryName}</span>
                        <span className="text-muted-foreground flex-shrink-0">{cat.count}x</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, background: cat.color }} />
                        </div>
                        <span className="font-semibold text-foreground tabular-nums w-14 text-right">{fmt(cat.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Candlestick / Forex chart ── */}
        <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm h-[300px] md:h-auto" data-testid="chart-candlestick">
          <CardHeader className="py-2.5 px-4 flex-shrink-0">
            <div className="flex items-start justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Gasto diario
              </CardTitle>
              <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground flex-shrink-0">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> bajo avg</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> sobre avg</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={candleData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v}`}
                  domain={[0, Math.ceil(candleMax * 1.15)]}
                />
                <ReferenceLine
                  y={overallAvg}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{
                    value: `avg ${fmt(overallAvg)}`,
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "hsl(var(--muted-foreground))",
                    dy: -4,
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                        <p className="font-semibold text-foreground">{label}</p>
                        <p className="text-foreground">Total: <span className="font-medium">{fmtFull(d.total)}</span></p>
                        {d.max > 0 && <p className="text-muted-foreground">Mayor gasto: {fmtFull(d.max)}</p>}
                        <p className="text-muted-foreground">Avg (7d): {fmtFull(d.avg)}</p>
                      </div>
                    );
                  }}
                  cursor={false}
                />
                <Bar
                  dataKey="total"
                  shape={<CandleShape />}
                  isAnimationActive={true}
                  background={{ fill: "transparent" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
