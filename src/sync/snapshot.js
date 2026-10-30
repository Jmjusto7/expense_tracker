// src/sync/snapshot.js
import { IMPORT_TABLES } from "../utils/importPlan";

export const SYNC_FORMAT = "expense-tracker-sync";
export const SYNC_VERSION = 1;

// Shadow "expense" entries are derived from linked transactions; each device rebuilds its own.
export const isSyncedRow = (table, row) => !(table === "balanceEntries" && row.type === "expense");

export const syncedTables = (tables) =>
    Object.fromEntries(IMPORT_TABLES.map((name) => [name, (tables[name] ?? []).filter((row) => isSyncedRow(name, row))]));

export function buildSnapshot(tables) {
    return {
        format: SYNC_FORMAT,
        version: SYNC_VERSION,
        exportedAt: new Date().toISOString(),
        tables: syncedTables(tables),
    };
}

export function parseSnapshot(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("The sync file in Google Drive isn't valid JSON.");
    }
    if (parsed?.format !== SYNC_FORMAT || typeof parsed.tables !== "object" || parsed.tables === null) {
        throw new Error("The sync file in Google Drive isn't an expense tracker sync file.");
    }
    if (parsed.version > SYNC_VERSION) {
        throw new Error("The sync file was written by a newer version of the app. Update this device first.");
    }
    return parsed;
}

// Dates and Date-like ISO strings hash the same; undefined fields are ignored like JSON does.
const normalize = (value) => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .filter((key) => value[key] !== undefined)
                .sort()
                .map((key) => [key, normalize(value[key])])
        );
    }
    return value;
};

// cyrb53: small, fast, non-cryptographic - only used to detect changes.
const cyrb53 = (str) => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export const hashRecord = (row) => cyrb53(JSON.stringify(normalize(row)));

export const hashTables = (tables) =>
    Object.fromEntries(
        IMPORT_TABLES.map((name) => [
            name,
            Object.fromEntries(
                (tables[name] ?? []).filter((row) => isSyncedRow(name, row)).map((row) => [String(row.id), hashRecord(row)])
            ),
        ])
    );
