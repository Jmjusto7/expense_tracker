// src/utils/formatCurrency.js

const CURRENCY_SYMBOL = "₱";

// Centralized currency formatter. Every page/component was previously
// hand-rolling `₱${x.toLocaleString()}` with inconsistent decimal handling
// (some places showed cents, some didn't, for the same underlying number).
export const formatCurrency = (amount, { decimals = 0 } = {}) => {
  const n = Number(amount || 0);
  return `${CURRENCY_SYMBOL}${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

// Convenience variant for the totals/breakdowns that want 2 decimal places
// (previously written inline as `.toLocaleString(undefined, { minimumFractionDigits: 2 })`)
export const formatCurrencyPrecise = (amount) => formatCurrency(amount, { decimals: 2 });
