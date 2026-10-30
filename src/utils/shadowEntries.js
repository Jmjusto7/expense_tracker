// src/utils/shadowEntries.js
// A transaction linked to an account ("Paid From") is mirrored as an
// "expense" balance entry so the account's balance walk sees the spend.
import { ALL_MONTHS } from "./dateHelpers";
import { newId } from "./rekey";

export const shadowEntryFor = (transaction, date) => ({
    id: newId(),
    accountId: transaction.accountId,
    date,
    type: "expense",
    amount: -Number(transaction.amount || 0),
    balance: null,
    costBasis: null,
    fee: null,
    pricePerUnit: null,
    category: transaction.category || null,
    comments: transaction.comments || "",
    sourceTransactionId: transaction.id,
    createdAt: new Date(),
});

export function buildShadowEntries({ years = [], months = [], days = [], transactions = [] }) {
    const index = (rows) => new Map(rows.map((r) => [String(r.id), r]));
    const yearById = index(years);
    const monthById = index(months);
    const dayById = index(days);

    return transactions.flatMap((t) => {
        if (t.accountId == null) return [];
        const year = yearById.get(String(t.yearId));
        const month = monthById.get(String(t.monthId));
        const day = dayById.get(String(t.dayId));
        if (!year || !month || !day) return [];
        return [shadowEntryFor(t, new Date(year.year, ALL_MONTHS.indexOf(month.name), day.day))];
    });
}
