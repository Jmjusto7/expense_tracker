import { useExpenseContext } from "../../context/ExpenseContext";
import { useDriveSync } from "../../hooks/useDriveSync";

export default function SyncTab() {
    const { syncStatus, disconnectSync } = useExpenseContext();
    const { startSync, busy, message, syncModal, configured } = useDriveSync();

    if (!configured) {
        return (
            <div className="text-sm text-ink-muted">
                <h2 className="text-lg font-semibold text-ink mb-2">Google Drive sync</h2>
                <p>
                    Sync isn't set up. Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env.local</code> and restart the dev
                    server - see the README for the one-time Google Cloud setup.
                </p>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-ink mb-2">Google Drive sync</h2>
            <p className="text-sm text-ink-muted mb-4">
                Keeps a copy of your data in a hidden app folder in your Google Drive. Sync on each device to exchange changes;
                anything changed on both sides since the last sync is shown for you to decide.
            </p>

            <p className="text-sm text-ink mb-4">
                Last synced on this device:{" "}
                <span className="font-medium">{syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : "never"}</span>
            </p>

            <div className="flex gap-3 mb-4">
                <button
                    onClick={startSync}
                    disabled={busy}
                    className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors disabled:opacity-60"
                >
                    {busy ? "Syncing…" : "Sync now"}
                </button>
                <button
                    onClick={() => disconnectSync()}
                    disabled={busy}
                    className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-60"
                >
                    Disconnect Google account
                </button>
            </div>

            {message && (
                <p className={`text-sm rounded-md px-3 py-2 ${message.error ? "text-alert bg-alert-soft" : "text-ledger-dark bg-ledger-soft"}`}>
                    {message.text}
                </p>
            )}

            {syncModal}
        </div>
    );
}
