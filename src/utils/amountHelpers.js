// src/utils/amountHelpers.js

// Parses a comma-separated amount expression like "150, 200.50, -30" into
// a summed total plus the individual line items (the "amount breakdown"
// feature). Was previously duplicated with slightly different regexes in
// AddTransactionModal and EditTransactionModal - now a single source of truth.
export const parseAmountExpression = (expr) => {
  if (!expr) return { total: NaN, breakdown: [] };

  const cleaned = expr.replace(/\s+/g, "");
  if (!/^[-\d.,]+$/.test(cleaned)) {
    return { total: NaN, breakdown: [] };
  }

  const breakdown = cleaned
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((v) => !Number.isNaN(v));

  return {
    total: breakdown.reduce((a, b) => a + b, 0),
    breakdown,
  };
};

// Display string for a transaction's amount breakdown column, e.g.
// "150 + 200.5 + -30" for multiple items, or just "150" for a single one.
export const formatBreakdownDisplay = (transaction) => {
  const hasMultiple = transaction.amountBreakdown?.length > 1;
  if (hasMultiple) return transaction.amountBreakdown.join(" + ");
  return transaction.amountBreakdown?.[0] ?? transaction.amount;
};
