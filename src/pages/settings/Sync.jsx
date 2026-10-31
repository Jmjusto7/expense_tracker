import { useEffect, useState } from "react";
import { useExpenseContext } from "../../context/ExpenseContext";
import { useSync } from "../../context/SyncContext";
import { SYNC_STATUS_LABELS } from "../../sync/status";
import { isStoragePersisted } from "../../utils/storagePersistence";
import ConfirmButton from "../../components/ConfirmButton";

export default function SyncTab() {
    const { disconnectSync } = useExpenseContext();
    const { configured, status, busy, startSync, message, lastSyncedAt } = useSync();
    const [persisted, setPersisted] = useState(null);
    const [disconnected, setDisconnected] = useState(false);

    useEffect(() => {
        isStoragePersisted().then(setPersisted);
    }, []);

    const storageLine = (
        <p className="text-sm text-ink mb-4">
            Storage on this device:{" "}
            <span className="font-medium">
                {persisted == null ? "unknown" : persisted ? "persistent" : "may be cleared by the browser when space runs low"}
            </span>
        </p>
    );

    if (!configured) {
        return (
            <div className="text-sm text-ink-muted">
                <p className="mb-4">
                    Sync isn't set up. Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env.local</code> and restart the dev
                    server - see the README for the one-time Google Cloud setup.
                </p>
                {storageLine}
            </div>
        );
    }

    return (
        <div>
            <p className="text-sm text-ink-muted mb-4">
                Keeps a copy of your data in a hidden app folder in your Google Drive. After you tap Sync once, the app keeps
                syncing on its own while the Google sign-in is valid (about an hour). Anything changed on both devices shows
                &quot;Needs input&quot; - tap Sync to decide.
            </p>

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm mb-4">
                <dt className="text-ink-muted">Status</dt>
                <dd className="font-medium text-ink">{SYNC_STATUS_LABELS[status]}</dd>
                <dt className="text-ink-muted">Last synced</dt>
                <dd className="font-medium text-ink">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "never"}</dd>
            </dl>
            {storageLine}

            <div className="flex flex-wrap gap-3 mb-4">
                <button
                    onClick={startSync}
                    disabled={busy}
                    className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors disabled:opacity-60"
                >
                    {busy ? "Syncing…" : "Sync now"}
                </button>
                <ConfirmButton
                    onConfirm={async () => {
                        await disconnectSync();
                        setDisconnected(true);
                    }}
                    disabled={busy}
                    confirmLabel="Confirm disconnect?"
                    className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-60"
                    confirmClassName="border border-alert bg-alert text-white px-4 py-2 rounded-lg"
                >
                    Disconnect Google account
                </ConfirmButton>
            </div>

            {disconnected && (
                <p role="status" className="text-sm rounded-md px-3 py-2 mb-2 text-ledger-dark bg-ledger-soft">
                    Disconnected. Your data stays on this device; tap Sync now to reconnect.
                </p>
            )}
            {message && (
                <p role="status" className={`text-sm rounded-md px-3 py-2 ${message.error ? "text-alert bg-alert-soft" : "text-ledger-dark bg-ledger-soft"}`}>
                    {message.text}
                </p>
            )}
        </div>
    );
}
