import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { isSyncConfigured, preloadGoogleSignIn } from "../sync/googleAuth";
import SyncModal from "../components/SyncModal";

const describeResult = (summary = {}) => {
    const merged = Object.values(summary).reduce((sum, n) => sum + n, 0);
    return merged > 0 ? `Synced with Google Drive. Merged ${merged} duplicate${merged === 1 ? "" : "s"}.` : "Synced with Google Drive.";
};

// Starts a sync from a click (needed for Google's sign-in popup) and opens
// SyncModal only when something needs a decision.
export function useDriveSync() {
    const { prepareSync, planSync, commitSync } = useExpenseContext();
    const [busy, setBusy] = useState(false);
    const [prepared, setPrepared] = useState(null);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (isSyncConfigured()) preloadGoogleSignIn().catch(() => { });
    }, []);

    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 6000);
        return () => clearTimeout(timer);
    }, [message]);

    const startSync = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const next = await prepareSync();
            if (next.merge.recordConflicts.length > 0 || planSync(next).conflicts.length > 0) {
                setPrepared(next);
                return;
            }
            const { summary } = await commitSync(next);
            setMessage({ text: describeResult(summary), error: false });
        } catch (err) {
            setMessage({ text: err.message || "Sync failed.", error: true });
        } finally {
            setBusy(false);
        }
    };

    const syncModal =
        prepared &&
        createPortal(
            <SyncModal
                prepared={prepared}
                onCancel={() => setPrepared(null)}
                onDone={(summary) => {
                    setPrepared(null);
                    setMessage({ text: describeResult(summary), error: false });
                }}
            />,
            document.body
        );

    return { startSync, busy: busy || Boolean(prepared), message, syncModal, configured: isSyncConfigured() };
}
