import { RefreshCw, CloudOff, AlertTriangle, Check, UploadCloud } from "lucide-react";
import { useSync } from "../context/SyncContext";
import { SYNC_STATUS_LABELS } from "../sync/status";

const ICONS = {
    offline: CloudOff,
    syncing: RefreshCw,
    "needs-input": AlertTriangle,
    "tap-to-sync": RefreshCw,
    pending: UploadCloud,
    synced: Check,
};

const TONES = {
    offline: "text-ink-muted",
    "needs-input": "text-warning",
    "tap-to-sync": "text-warning",
    pending: "text-warning",
    synced: "text-ledger-dark",
};

// Tapping always runs the manual sync (which may open Google's sign-in and the conflict dialog).
export default function SyncIndicator({ showLabel = true, labelClassName = "", className = "" }) {
    const { configured, status, busy, startSync, lastSyncedAt } = useSync();
    if (!configured) return null;

    const Icon = ICONS[status] ?? RefreshCw;
    const label = SYNC_STATUS_LABELS[status];
    const title =
        status === "synced" && lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleString()}` : `Google Drive: ${label}`;

    return (
        <button
            type="button"
            onClick={startSync}
            disabled={busy}
            title={title}
            aria-label={title}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-surface-sunken transition-colors disabled:opacity-60 ${TONES[status] ?? "text-ink-muted hover:text-ink"
                } ${className}`}
        >
            <Icon size={15} className={status === "syncing" ? "animate-spin" : undefined} aria-hidden="true" />
            {showLabel && <span className={labelClassName}>{label}</span>}
        </button>
    );
}
