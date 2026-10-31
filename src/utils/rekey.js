// src/utils/rekey.js
import { IMPORT_TABLES } from "./importPlan";

// Foreign-key field -> the table its id points into.
export const FOREIGN_KEYS = {
    months: { yearId: "years" },
    days: { yearId: "years", monthId: "months" },
    transactions: { yearId: "years", monthId: "months", dayId: "days", travelId: "travels", accountId: "accounts" },
    bucketAssignments: { bucketId: "buckets" },
    accounts: { typeId: "accountTypes", costCurrencyAccountId: "accounts" },
    balanceEntries: { accountId: "accounts", counterpartAccountId: "accounts", sourceTransactionId: "transactions" },
};

// crypto.randomUUID only exists on https:// and localhost; getRandomValues works everywhere.
export const newId = () => {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const needsRekey = (tables) =>
    IMPORT_TABLES.some((name) => (tables[name] ?? []).some((row) => typeof row.id !== "string"));

// Gives every non-string id a UUID and rewrites references to it, so data
// from devices with overlapping autoincrement counters can be merged safely.
export function rekeyTables(tables, makeId = newId) {
    const remap = new Map();
    const key = (table, id) => `${table}:${String(id)}`;

    for (const name of IMPORT_TABLES) {
        for (const row of tables[name] ?? []) {
            if (typeof row.id !== "string") remap.set(key(name, row.id), makeId());
        }
    }

    const mapRef = (table, value) => (value == null ? value : remap.get(key(table, value)) ?? value);

    return Object.fromEntries(
        IMPORT_TABLES.map((name) => [
            name,
            (tables[name] ?? []).map((row) => {
                const out = { ...row, id: mapRef(name, row.id) };
                for (const [field, target] of Object.entries(FOREIGN_KEYS[name] ?? {})) {
                    if (field in out) out[field] = mapRef(target, out[field]);
                }
                if (name === "transactions" && Array.isArray(out.sourceBalanceEntryIds)) {
                    out.sourceBalanceEntryIds = out.sourceBalanceEntryIds.map((id) => mapRef("balanceEntries", id));
                }
                // Autoincrement ids used to break same-day ties; keep that order for legacy rows.
                if (out.createdAt == null && typeof row.id === "number") out.createdAt = new Date(row.id);
                return out;
            }),
        ])
    );
}
