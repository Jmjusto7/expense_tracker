// src/components/AccountBalanceChart.jsx
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatDate } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { getReconciliations, getIncomeEntries, getImpliedSpendPeriods } from "../utils/balanceHelpers";

// Builds the chart's data points directly from the already-tested
// balanceHelpers functions (getImpliedSpendPeriods in particular) rather
// than re-deriving the reconciliation math here - the chart is purely a
// rendering of numbers computed elsewhere, never its own source of truth.
function buildChartData(entries, accountId) {
  const reconciliations = getReconciliations(entries, accountId);
  const incomes = getIncomeEntries(entries, accountId);
  const periods = getImpliedSpendPeriods(entries, accountId);

  if (reconciliations.length === 0) return [];

  const points = [];
  const push = (date, book, actual = null) =>
    points.push({ label: formatDate(date), book, actual });

  // Start: book and actual coincide at the very first reconciliation.
  push(reconciliations[0].date, reconciliations[0].balance, reconciliations[0].balance);

  periods.forEach((period, i) => {
    const from = reconciliations[i];
    const to = reconciliations[i + 1];
    const fromTs = new Date(from.date).getTime();
    const toTs = new Date(to.date).getTime();

    // Rising segment: one point per income entry within this period.
    let running = from.balance;
    incomes
      .filter((e) => {
        const eTs = new Date(e.date).getTime();
        return eTs > fromTs && eTs <= toTs;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((e) => {
        running += Number(e.amount || 0);
        push(e.date, running);
      });

    // The peak "book" value reached right before reconciling (what the
    // model expected), immediately followed by the reset to what was
    // actually observed - the gap between these two is the implied spend.
    push(to.date, period.expected);
    push(to.date, to.balance, to.balance);
  });

  // Trailing income logged after the last reconciliation - the current,
  // not-yet-verified projection.
  const last = reconciliations[reconciliations.length - 1];
  const lastTs = new Date(last.date).getTime();
  let running = last.balance;
  incomes
    .filter((e) => new Date(e.date).getTime() > lastTs)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((e) => {
      running += Number(e.amount || 0);
      push(e.date, running);
    });

  return points;
}

export default function AccountBalanceChart({ entries, accountId }) {
  const data = buildChartData(entries, accountId);

  if (data.length < 2) {
    return (
      <p className="text-ink-muted text-sm text-center py-10">
        Add at least one income entry or a second reconciliation to see a trend.
      </p>
    );
  }

  return (
    <div className="money w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" />
          <XAxis
            dataKey="label"
            stroke="#6b7570"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis stroke="#6b7570" tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value, name) => [formatCurrency(value), name === "book" ? "Book" : "Reconciled"]}
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />

          {/* Book: rises with income, resets at each reconciliation. */}
          <Line
            type="linear"
            dataKey="book"
            stroke="#1f6f5c"
            strokeWidth={2}
            dot={{ r: 2 }}
            name="Book"
            connectNulls
          />

          {/* Reconciled: discrete markers only, no connecting line - the
              vertical distance from the book line right before each marker
              is the implied spend for that period. */}
          <Line
            type="linear"
            dataKey="actual"
            stroke="none"
            dot={{ r: 5, fill: "#b8622e" }}
            name="Reconciled"
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
