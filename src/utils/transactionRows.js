import { parseAmountExpression } from "./amountHelpers";
import { findRowsTagConflict, tagConflictMessage } from "./transactionMerge";

const LAST_PAID_FROM_KEY = "tracker.lastPaidFrom";

let nextRowId = 0;
export const newRowId = () => `row-${Date.now()}-${nextRowId++}`;

export const blankRow = (overrides = {}) => ({
    id: newRowId(),
    category: "",
    amount: "",
    comments: "",
    travelId: "",
    travelAuto: false,
    accountId: null,
    isNew: true,
    ...overrides,
});

// Rows missing a category or amount are skipped. Returns { upserts } or { error }.
export function buildRowUpserts(rows, { dateLabel, travels, accounts }) {
    const upserts = [];
    for (const r of rows) {
        if (!r.category.trim() || !String(r.amount).trim()) continue;
        const { total, breakdown, error } = parseAmountExpression(r.amount);
        if (error) return { error: `Invalid amount for "${r.category.trim()}": ${error}` };
        upserts.push({
            ...(r.isNew ? {} : { id: r.id }),
            category: r.category.trim(),
            amount: total,
            amountBreakdown: breakdown,
            comments: r.comments?.trim() || "",
            travelId: r.travelId || null,
            accountId: r.accountId || null,
        });
    }

    const rowConflict = findRowsTagConflict(upserts);
    if (rowConflict) {
        return {
            error: tagConflictMessage({ category: rowConflict.category, dateLabel, conflict: rowConflict.conflict, travels, accounts }),
        };
    }
    return { upserts };
}

// "Paid From" is remembered for the browser session so repeat entries need one less tap.
export function getLastPaidFrom(accounts) {
    const id = sessionStorage.getItem(LAST_PAID_FROM_KEY);
    return accounts.some((a) => String(a.id) === id && a.unit == null) ? id : null;
}

export function rememberPaidFrom(upserts) {
    const last = [...upserts].reverse().find((u) => u.accountId);
    if (last) sessionStorage.setItem(LAST_PAID_FROM_KEY, String(last.accountId));
}
