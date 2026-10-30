// src/sync/mergeSnapshots.js
// Three-way merge of this device's data with the Drive copy, using the hashes
// recorded at the last successful sync ("base") to tell who changed what.
import { IMPORT_TABLES } from "../utils/importPlan";
import { FOREIGN_KEYS } from "../utils/rekey";
import { hashRecord, syncedTables } from "./snapshot";

export const RECORD_CHOICES = ["local", "remote"];

const byId = (rows) => new Map(rows.map((row) => [String(row.id), row]));

export function mergeSnapshots({ base = {}, local, remote }) {
    const localTables = syncedTables(local);
    const remoteTables = syncedTables(remote);
    const localSide = {};
    const remoteSide = {};
    const recordConflicts = [];
    const deleted = {};

    for (const name of IMPORT_TABLES) {
        const baseHashes = base[name] ?? {};
        const localRows = byId(localTables[name]);
        const remoteRows = byId(remoteTables[name]);
        localSide[name] = [];
        remoteSide[name] = [];
        deleted[name] = 0;

        for (const id of new Set([...localRows.keys(), ...remoteRows.keys()])) {
            const l = localRows.get(id);
            const r = remoteRows.get(id);
            const baseHash = baseHashes[id];
            const lHash = l && hashRecord(l);
            const rHash = r && hashRecord(r);
            const conflict = (kind) => recordConflicts.push({ id: `${name}:${id}`, table: name, kind, local: l ?? null, remote: r ?? null });

            if (l && r) {
                if (lHash === rHash || rHash === baseHash) localSide[name].push(l);
                else if (lHash === baseHash) remoteSide[name].push(r);
                else conflict("edit");
            } else if (l) {
                if (baseHash === undefined) localSide[name].push(l);
                else if (lHash === baseHash) deleted[name]++;
                else conflict("deletedRemotely");
            } else if (baseHash === undefined) {
                remoteSide[name].push(r);
            } else if (rHash === baseHash) {
                deleted[name]++;
            } else {
                conflict("deletedLocally");
            }
        }
    }

    return { localSide, remoteSide, recordConflicts, deleted, local: localTables, remote: remoteTables };
}

// Rows still referenced by a surviving row come back, so e.g. a transaction
// added here isn't orphaned by its day being deleted on the other device.
function restoreReferencedParents(sides, local, remote) {
    const present = Object.fromEntries(
        IMPORT_TABLES.map((name) => [name, new Set([...sides.localSide[name], ...sides.remoteSide[name]].map((r) => String(r.id)))])
    );
    const sources = { local: Object.fromEntries(IMPORT_TABLES.map((n) => [n, byId(local[n])])), remote: Object.fromEntries(IMPORT_TABLES.map((n) => [n, byId(remote[n])])) };

    let restored = true;
    while (restored) {
        restored = false;
        for (const name of IMPORT_TABLES) {
            for (const row of [...sides.localSide[name], ...sides.remoteSide[name]]) {
                for (const [field, target] of Object.entries(FOREIGN_KEYS[name] ?? {})) {
                    const ref = row[field];
                    if (ref == null || present[target].has(String(ref))) continue;
                    const fromLocal = sources.local[target].get(String(ref));
                    const parent = fromLocal ?? sources.remote[target].get(String(ref));
                    if (!parent) continue;
                    (fromLocal ? sides.localSide : sides.remoteSide)[target].push(parent);
                    present[target].add(String(ref));
                    restored = true;
                }
            }
        }
    }
    return sides;
}

// Applies "local"/"remote" choices and returns the two sides to feed into planImport.
export function applyRecordResolutions(merge, resolutions = {}) {
    const localSide = Object.fromEntries(IMPORT_TABLES.map((n) => [n, [...merge.localSide[n]]]));
    const remoteSide = Object.fromEntries(IMPORT_TABLES.map((n) => [n, [...merge.remoteSide[n]]]));

    for (const conflict of merge.recordConflicts) {
        const choice = resolutions[conflict.id];
        if (!RECORD_CHOICES.includes(choice)) throw new Error("Choose which version to keep for every changed entry.");
        if (choice === "local" && conflict.local) localSide[conflict.table].push(conflict.local);
        if (choice === "remote" && conflict.remote) remoteSide[conflict.table].push(conflict.remote);
    }

    return restoreReferencedParents({ localSide, remoteSide }, merge.local, merge.remote);
}
