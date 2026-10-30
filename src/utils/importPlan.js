// src/utils/importPlan.js
// Pure planning for imports: computes the final state of every table
// (existing + incoming), deduplicated, with FKs remapped onto survivors,
// before anything is written.
import {
    findDuplicateGroups,
    accountTypeFingerprint,
    accountFingerprint,
    travelFingerprint,
    bucketFingerprint,
    bucketAssignmentFingerprint,
    yearFingerprint,
    monthFingerprint,
    dayFingerprint,
    balanceEntryFingerprint,
} from "./importDedup";
import { findTagConflict, mergeTransactionRows } from "./transactionMerge";

export const IMPORT_TABLES = [
    "accountTypes",
    "accounts",
    "travels",
    "buckets",
    "bucketAssignments",
    "years",
    "months",
    "days",
    "transactions",
    "balanceEntries",
];

export const RESOLUTIONS = ["existing", "incoming", "merge"];

const DATE_FIELDS = ["createdAt", "date", "startDate", "endDate"];

const reviveDates = (row) => {
    const out = { ...row };
    for (const field of DATE_FIELDS) {
        if (typeof out[field] === "string") out[field] = new Date(out[field]);
    }
    return out;
};

const createdAtMs = (row) => (row.createdAt ? new Date(row.createdAt).getTime() : 0);

// Same outcome as bulkPut: incoming rows overwrite existing rows by id.
const overlay = (existingRows = [], incomingRows = []) => {
    const byId = new Map(existingRows.map((r) => [r.id, r]));
    for (const r of incomingRows) byId.set(r.id, reviveDates(r));
    return [...byId.values()];
};

const dedupe = (rows, fingerprint) => {
    const remap = new Map();
    for (const { keep, remove } of findDuplicateGroups(rows, fingerprint)) {
        for (const r of remove) remap.set(String(r.id), keep.id);
    }
    return { rows: rows.filter((r) => !remap.has(String(r.id))), remap };
};

const remapField = (rows, field, remap, toValue = (v) => v) => {
    if (remap.size === 0) return rows;
    return rows.map((r) => {
        if (r[field] == null || !remap.has(String(r[field]))) return r;
        return { ...r, [field]: toValue(remap.get(String(r[field]))) };
    });
};

const transactionKey = (t) => `${t.yearId}:${t.monthId}:${t.dayId}:${t.category}`;

// Rows landing on the same day+category: equal amounts collapse to the
// newest; different amounts become conflicts for the user to resolve.
const planTransactions = (rows, incomingIds) => {
    const groups = new Map();
    for (const row of rows) {
        const key = transactionKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }

    const kept = [];
    const removedIds = [];
    const conflicts = [];

    for (const [key, group] of groups) {
        if (group.length === 1) {
            kept.push(group[0]);
            continue;
        }

        const byAmount = new Map();
        for (const row of [...group].sort((a, b) => createdAtMs(b) - createdAtMs(a))) {
            const amount = Number(row.amount);
            if (byAmount.has(amount)) removedIds.push(row.id);
            else byAmount.set(amount, row);
        }

        const survivors = [...byAmount.values()].sort((a, b) => createdAtMs(a) - createdAtMs(b));
        const base = survivors.find((r) => !incomingIds.has(r.id)) ?? survivors[0];
        kept.push(base);
        for (const other of survivors) {
            if (other !== base) conflicts.push({ id: `${key}#${other.id}`, key, existing: base, incoming: other });
        }
    }

    return { kept, removedIds, conflicts };
};

export function planImport(existing, incoming) {
    const incomingTxIds = new Set((incoming.transactions ?? []).map((t) => t.id));
    const t = Object.fromEntries(IMPORT_TABLES.map((name) => [name, overlay(existing[name], incoming[name])]));
    const overlaid = Object.fromEntries(IMPORT_TABLES.map((name) => [name, t[name].length]));

    let step = dedupe(t.accountTypes, accountTypeFingerprint);
    t.accountTypes = step.rows;
    t.accounts = remapField(t.accounts, "typeId", step.remap);

    step = dedupe(t.accounts, accountFingerprint);
    t.accounts = remapField(step.rows, "costCurrencyAccountId", step.remap);
    t.balanceEntries = remapField(t.balanceEntries, "accountId", step.remap);
    t.balanceEntries = remapField(t.balanceEntries, "counterpartAccountId", step.remap);
    t.transactions = remapField(t.transactions, "accountId", step.remap);

    step = dedupe(t.travels, travelFingerprint);
    t.travels = step.rows;
    t.transactions = remapField(t.transactions, "travelId", step.remap, String);

    step = dedupe(t.buckets, bucketFingerprint);
    t.buckets = step.rows;
    t.bucketAssignments = remapField(t.bucketAssignments, "bucketId", step.remap);
    t.bucketAssignments = dedupe(t.bucketAssignments, bucketAssignmentFingerprint).rows;

    step = dedupe(t.years, yearFingerprint);
    t.years = step.rows;
    t.months = remapField(t.months, "yearId", step.remap);
    t.days = remapField(t.days, "yearId", step.remap);
    t.transactions = remapField(t.transactions, "yearId", step.remap);

    step = dedupe(t.months, monthFingerprint);
    t.months = step.rows;
    t.days = remapField(t.days, "monthId", step.remap);
    t.transactions = remapField(t.transactions, "monthId", step.remap);

    step = dedupe(t.days, dayFingerprint);
    t.days = step.rows;
    t.transactions = remapField(t.transactions, "dayId", step.remap);

    const planned = planTransactions(t.transactions, incomingTxIds);
    const pendingConflictRows = planned.conflicts.map((c) => c.incoming);
    t.transactions = planned.kept;

    const removedTxIds = new Set(planned.removedIds.map(String));
    t.balanceEntries = t.balanceEntries.filter(
        (e) => !(e.type === "expense" && e.sourceTransactionId != null && removedTxIds.has(String(e.sourceTransactionId)))
    );

    step = dedupe(t.balanceEntries, balanceEntryFingerprint);
    t.balanceEntries = step.rows;
    const remapSourceIds = (tx) =>
        tx.sourceBalanceEntryIds && step.remap.size
            ? {
                ...tx,
                sourceBalanceEntryIds: tx.sourceBalanceEntryIds.map((id) =>
                    id != null && step.remap.has(String(id)) ? step.remap.get(String(id)) : id
                ),
            }
            : tx;
    t.transactions = t.transactions.map(remapSourceIds);
    const conflicts = planned.conflicts.map((c) => ({
        ...c,
        existing: remapSourceIds(c.existing),
        incoming: remapSourceIds(c.incoming),
    }));

    // Conflict rows stay out of `result` until resolved, so don't count them as removed.
    const summary = Object.fromEntries(
        IMPORT_TABLES.map((name) => [
            name,
            overlaid[name] - t[name].length - (name === "transactions" ? pendingConflictRows.length : 0),
        ])
    );

    const deletes = Object.fromEntries(
        IMPORT_TABLES.map((name) => {
            const kept = new Set(t[name].map((r) => String(r.id)));
            return [name, (existing[name] ?? []).map((r) => r.id).filter((id) => !kept.has(String(id)))];
        })
    );

    return { incoming, result: t, deletes, summary, conflicts };
}

// Applies the user's per-conflict choices. Conflicts on the same key are
// applied in order, each against the outcome of the previous one.
export function applyImportResolutions(plan, resolutions = {}) {
    const outcomeByKey = new Map();
    const removedTxIds = new Set();
    const mergedIds = new Set();

    for (const conflict of plan.conflicts) {
        const choice = resolutions[conflict.id];
        if (!RESOLUTIONS.includes(choice)) throw new Error("Resolve every conflict before importing.");

        const current = outcomeByKey.get(conflict.key) ?? conflict.existing;
        if (choice === "existing") {
            removedTxIds.add(conflict.incoming.id);
            outcomeByKey.set(conflict.key, current);
        } else if (choice === "incoming") {
            removedTxIds.add(current.id);
            mergedIds.delete(current.id);
            outcomeByKey.set(conflict.key, conflict.incoming);
        } else {
            if (findTagConflict(current, conflict.incoming)) {
                throw new Error(`Can't merge ${current.category}: the two entries are tagged differently.`);
            }
            removedTxIds.add(conflict.incoming.id);
            mergedIds.add(current.id);
            outcomeByKey.set(conflict.key, { ...current, ...mergeTransactionRows(current, conflict.incoming) });
        }
    }

    const byId = new Map(plan.result.transactions.map((tx) => [tx.id, tx]));
    for (const outcome of outcomeByKey.values()) byId.set(outcome.id, outcome);
    for (const id of removedTxIds) byId.delete(id);

    const removedKeys = new Set([...removedTxIds].map(String));
    const balanceEntries = plan.result.balanceEntries.filter(
        (e) => !(e.type === "expense" && e.sourceTransactionId != null && removedKeys.has(String(e.sourceTransactionId)))
    );

    return {
        tables: { ...plan.result, transactions: [...byId.values()], balanceEntries },
        mergedTransactionIds: [...mergedIds],
    };
}

// Same plan computed again later (e.g. at commit time) yields the same conflict ids.
export const sameConflicts = (a, b) =>
    a.conflicts.length === b.conflicts.length && a.conflicts.every((c, i) => c.id === b.conflicts[i].id);
