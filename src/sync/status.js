// src/sync/status.js
export function deriveSyncStatus({ configured, online, syncing, needsInput, signInNeeded, pending, tokenValid }) {
    if (!configured) return "off";
    if (!online) return "offline";
    if (syncing) return "syncing";
    if (needsInput) return "needs-input";
    if (pending && (signInNeeded || !tokenValid)) return "tap-to-sync";
    if (pending) return "pending";
    return "synced";
}

export const SYNC_STATUS_LABELS = {
    off: "Sync off",
    offline: "Offline",
    syncing: "Syncing…",
    "needs-input": "Needs input",
    "tap-to-sync": "Tap to sync",
    pending: "Unsynced",
    synced: "Synced",
};
