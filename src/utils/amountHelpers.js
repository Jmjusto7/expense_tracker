// src/utils/amountHelpers.js

// Parses a comma-separated amount expression like "150, 200.50, -30" into
// a summed total plus the individual line items (the "amount breakdown"
// feature). Was previously duplicated with slightly different regexes in
// AddTransactionModal and EditTransactionModal - now a single source of truth.
// Commas always separate amounts, so "1,000" is rejected rather than read as 1 + 0.
// Zero is valid (something free / paid by someone else), as are parts that net to zero.
const AMOUNT_TOKEN = /^-?(\d+(\.\d+)?|\.\d+)$/;
const THOUSANDS_GROUP = /^000$/;

const invalid = (error) => ({ total: NaN, breakdown: [], error });

export const parseAmountExpression = (expr) => {
  const cleaned = (expr ?? "").toString().replace(/\s+/g, "");
  if (!cleaned) return invalid("Enter an amount.");

  const tokens = cleaned.split(",");
  if (tokens.some((t) => t === "")) return invalid("Remove the empty amount between commas.");

  const badToken = tokens.find((t) => !AMOUNT_TOKEN.test(t));
  if (badToken !== undefined) return invalid(`"${badToken}" isn't a valid number.`);

  const groupIdx = tokens.findIndex((t, i) => i > 0 && THOUSANDS_GROUP.test(t));
  if (groupIdx !== -1) {
    let end = groupIdx;
    while (end + 1 < tokens.length && THOUSANDS_GROUP.test(tokens[end + 1])) end++;
    const suggestion = tokens.slice(groupIdx - 1, end + 1).join("");
    return invalid(`Did you mean ${suggestion}? Commas separate amounts.`);
  }

  const breakdown = tokens.map(Number);
  const total = breakdown.reduce((a, b) => a + b, 0);

  return { total, breakdown, error: null };
};

// Live preview text for an amount input, e.g. "= 150 + 200.5 → 350.5".
export const describeAmountExpression = (expr) => {
  const { total, breakdown, error } = parseAmountExpression(expr);
  if (error) return { text: error, error: true };
  return { text: `= ${breakdown.join(" + ")} → ${total}`, error: false };
};

// Display string for a transaction's amount breakdown column, e.g.
// "150 + 200.5 + -30" for multiple items, or just "150" for a single one.
export const formatBreakdownDisplay = (transaction) => {
  const hasMultiple = transaction.amountBreakdown?.length > 1;
  if (hasMultiple) return transaction.amountBreakdown.join(" + ");
  return transaction.amountBreakdown?.[0] ?? transaction.amount;
};
