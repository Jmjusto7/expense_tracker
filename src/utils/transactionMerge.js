// src/utils/transactionMerge.js
import { normalizeTravelId } from "./travelHelpers";

const normalizeAccountId = (value) => (value === undefined || value === null || value === "" ? null : value);

// Two rows landing on the same day+category merge into one, so they must
// not carry different travel/account tags - merging would silently drop one.
export function findTagConflict(existing, incoming) {
    const existingTravel = normalizeTravelId(existing.travelId);
    const incomingTravel = normalizeTravelId(incoming.travelId);
    if (existingTravel !== null && incomingTravel !== null && existingTravel !== incomingTravel) {
        return { kind: "travel", id: existingTravel };
    }

    const existingAccount = normalizeAccountId(existing.accountId);
    const incomingAccount = normalizeAccountId(incoming.accountId);
    if (existingAccount !== null && incomingAccount !== null && String(existingAccount) !== String(incomingAccount)) {
        return { kind: "account", id: existingAccount };
    }

    return null;
}

export function tagConflictMessage({ category, dateLabel, conflict, travels = [], accounts = [] }) {
    const label =
        conflict.kind === "travel"
            ? `trip '${travels.find((t) => String(t.id) === String(conflict.id))?.title ?? conflict.id}'`
            : `account '${accounts.find((a) => String(a.id) === String(conflict.id))?.name ?? conflict.id}'`;
    return `${category} on ${dateLabel} is already tagged to ${label}. Use a different category or edit the existing entry.`;
}

// Checks rows from a single modal session, which get merged per category on save.
export function findRowsTagConflict(rows) {
    const byCategory = new Map();
    for (const row of rows) {
        const previous = byCategory.get(row.category);
        if (!previous) {
            byCategory.set(row.category, row);
            continue;
        }
        const conflict = findTagConflict(previous, row);
        if (conflict) return { category: row.category, conflict };
        byCategory.set(row.category, {
            travelId: normalizeTravelId(previous.travelId) ?? normalizeTravelId(row.travelId),
            accountId: normalizeAccountId(previous.accountId) ?? normalizeAccountId(row.accountId),
        });
    }
    return null;
}

const breakdownOf = (t) => (t.amountBreakdown?.length ? t.amountBreakdown : [t.amount]);

// Fields to write onto `existing` when `incoming` is merged into it. Callers
// must check findTagConflict first.
export function mergeTransactionRows(existing, incoming) {
    const existingBreakdown = breakdownOf(existing);
    const incomingBreakdown = breakdownOf(incoming);
    const amountBreakdown = [...existingBreakdown, ...incomingBreakdown];

    const merged = {
        amount: amountBreakdown.reduce((sum, v) => sum + Number(v || 0), 0),
        amountBreakdown,
        comments: [existing.comments, incoming.comments].filter((c) => c && c.trim()).join("; "),
        travelId: normalizeTravelId(existing.travelId) ?? normalizeTravelId(incoming.travelId),
        accountId: normalizeAccountId(existing.accountId) ?? normalizeAccountId(incoming.accountId),
    };

    // sourceBalanceEntryIds is index-aligned with amountBreakdown.
    if (existing.sourceBalanceEntryIds || incoming.sourceBalanceEntryIds) {
        merged.sourceBalanceEntryIds = [
            ...(existing.sourceBalanceEntryIds ?? existingBreakdown.map(() => null)),
            ...(incoming.sourceBalanceEntryIds ?? incomingBreakdown.map(() => null)),
        ];
    }

    return merged;
}
