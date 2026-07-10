import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatCurrency, formatCurrencyPrecise } from "../utils/formatCurrency";
import { formatMonthYear } from "../utils/dateHelpers";
import { getTotalBalance, buildMonthlyNetWorth } from "../utils/balanceHelpers";

const PERIOD_OPTIONS = [
  { label: "Past 3 Months", value: 3 },
  { label: "Past 6 Months", value: 6 },
  { label: "Past 12 Months", value: 12 },
];

export default function NetWorthHeroCard({ accounts, balanceEntries }) {
  const [months, setMonths] = useState(12);

  const currentNetWorth = useMemo(
    () => getTotalBalance(accounts, balanceEntries),
    [accounts, balanceEntries]
  );

  // MoM change is always a fixed 1-month lookback, independent of the
  // chart's own period dropdown (which only controls how much history the
  // chart displays).
  const oneMonthAgo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  }, []);

  const priorNetWorth = useMemo(
    () => getTotalBalance(accounts, balanceEntries, oneMonthAgo),
    [accounts, balanceEntries, oneMonthAgo]
  );

  const changeAmount = currentNetWorth - priorNetWorth;
  const changePct = priorNetWorth !== 0 ? (changeAmount / Math.abs(priorNetWorth)) * 100 : null;

  const trendData = useMemo(
    () => buildMonthlyNetWorth(accounts, balanceEntries, months),
    [accounts, balanceEntries, months]
  );

  const changeColor =
    changeAmount > 0 ? "text-ledger-dark" : changeAmount < 0 ? "text-alert" : "text-ink-muted";
  const ChangeIcon = changeAmount > 0 ? ArrowUpRight : changeAmount < 0 ? ArrowDownRight : Minus;

  return (
    <div className="h-full bg-surface border border-border rounded-xl p-6 flex gap-8">
      {/* LEFT */}
      <div className="flex flex-col justify-center shrink-0 w-[260px]">
        <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">Net Worth</div>
        <div className="money font-display text-5xl font-bold text-ink leading-none mb-3">
          {formatCurrency(currentNetWorth)}
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${changeColor}`}>
          <ChangeIcon size={16} />
          <span className="money">{formatCurrency(Math.abs(changeAmount))}</span>
          {changePct !== null && (
            <span className="money">
              {" "}
              ({changeAmount >= 0 ? "+" : "-"}
              {Math.abs(changePct).toFixed(1)}%)
            </span>
          )}
        </div>
        <div className="text-xs text-ink-muted mt-1">vs last month</div>
      </div>

      {/* RIGHT: TREND CHART */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-end mb-1 shrink-0">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="text-xs border border-border rounded-md px-2 py-1 bg-surface text-ink-muted focus:ring-2 focus:ring-ledger focus:outline-none"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-h-0 money">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1f6f5c" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#1f6f5c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatMonthYear}
                stroke="#6b7570"
                tick={{ fontSize: 11 }}
              />
              <YAxis hide />
              <Tooltip
                labelFormatter={(label) => formatMonthYear(label)}
                formatter={(value) => [formatCurrencyPrecise(value), "Net Worth"]}
                contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#1f6f5c"
                strokeWidth={2.5}
                fill="url(#netWorthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
