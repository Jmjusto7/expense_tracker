// src/context/SyncContext.jsx
// One Google Drive sync controller for the whole app: manual "Sync now",
// automatic background runs while a sign-in token is still valid, and the
// status shown in the Navbar and Settings.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExpenseContext } from "./ExpenseContext";
import { isSyncConfigured, preloadGoogleSignIn, hasValidToken } from "../sync/googleAuth";
import { DriveAuthError } from "../sync/driveClient";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { isAnyDialogOpen } from "../utils/dialogRegistry";
import { deriveSyncStatus } from "../sync/status";
import SyncModal from "../components/SyncModal";

export const AUTO_SYNC_DEBOUNCE_MS = 30_000;
const PULL_AFTER_MS = 15 * 60 * 1000;

const SyncContext = createContext(null);

const describeResult = (summary = {}) => {
    const merged = Object.values(summary).reduce((sum, n) => sum + n, 0);
    return merged > 0
        ? `Synced with Google Drive. Merged ${merged} duplicate${merged === 1 ? "" : "s"}.`
        : "Synced with Google Drive.";
};

// Holds a cross-tab lock when available so two tabs never sync at once.
const withSyncLock = (fn) =>
    navigator.locks?.request
        ? navigator.locks.request("drive-sync", { ifAvailable: true }, (lock) => (lock ? fn() : undefined))
        : fn();

export function SyncProvider({ children }) {
    const { isLoaded, dataVersion, syncStatus, hasPendingChanges, prepareSync, planSync, commitSync } =
        useExpenseContext();
    const online = useOnlineStatus();
    const configured = isSyncConfigured();

    const [syncing, setSyncing] = useState(false);
    const [pending, setPending] = useState(false);
    const [needsInput, setNeedsInput] = useState(false);
    const [signInNeeded, setSignInNeeded] = useState(false);
    const [prepared, setPrepared] = useState(null);
    const [message, setMessage] = useState(null);
    const running = useRef(false);

    const run = async (mode) => {
        if (running.current) return;
        running.current = true;
        setSyncing(true);
        if (mode === "manual") setMessage(null);
        try {
            await withSyncLock(async () => {
                const next = await prepareSync();
                if (next.merge.recordConflicts.length > 0 || planSync(next).conflicts.length > 0) {
                    setNeedsInput(true);
                    if (mode === "manual") setPrepared(next);
                    return;
                }
                const { summary } = await commitSync(next);
                setNeedsInput(false);
                setSignInNeeded(false);
                if (mode === "manual") setMessage({ text: describeResult(summary), error: false });
            });
        } catch (err) {
            if (err instanceof DriveAuthError) setSignInNeeded(true);
            // Background runs stay quiet; the status badge tells the story.
            if (mode === "manual") setMessage({ text: err.message || "Sync failed.", error: true });
        } finally {
            running.current = false;
            setSyncing(false);
            setPending(await hasPendingChanges());
        }
    };

    // Never opens Google's popup: only runs while a token is already in memory.
    const maybeAutoSync = async (reason) => {
        if (!configured || !online || !hasValidToken() || running.current || prepared || needsInput) return;
        if (isAnyDialogOpen()) return "retry";
        const hasChanges = await hasPendingChanges();
        const lastSynced = syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).getTime() : 0;
        const due = reason !== "change" && Date.now() - lastSynced > PULL_AFTER_MS;
        if (hasChanges || due) await run("auto");
    };
    const maybeAutoSyncRef = useRef(maybeAutoSync);
    useEffect(() => {
        maybeAutoSyncRef.current = maybeAutoSync;
    });

    useEffect(() => {
        if (!isLoaded || !configured) return;
        let active = true;
        hasPendingChanges().then((value) => active && setPending(value));
        const timer = setTimeout(async function tick() {
            if ((await maybeAutoSyncRef.current("change")) === "retry") setTimeout(tick, AUTO_SYNC_DEBOUNCE_MS);
        }, AUTO_SYNC_DEBOUNCE_MS);
        return () => {
            active = false;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataVersion, isLoaded, configured]);

    useEffect(() => {
        if (!configured) return;
        const onOnline = () => {
            preloadGoogleSignIn().catch(() => { });
            maybeAutoSyncRef.current("online");
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") maybeAutoSyncRef.current("visible");
        };
        if (navigator.onLine) preloadGoogleSignIn().catch(() => { });
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("online", onOnline);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [configured]);

    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 6000);
        return () => clearTimeout(timer);
    }, [message]);

    const startSync = () => {
        if (!online) {
            setMessage({ text: "You're offline - changes will sync when you're back online.", error: false });
            return;
        }
        run("manual");
    };

    const status = deriveSyncStatus({
        configured,
        online,
        syncing,
        needsInput,
        signInNeeded,
        pending,
        tokenValid: hasValidToken(),
    });

    const value = {
        configured,
        online,
        status,
        busy: syncing || Boolean(prepared),
        lastSyncedAt: syncStatus?.lastSyncedAt ?? null,
        message,
        startSync,
    };

    return (
        <SyncContext.Provider value={value}>
            {children}
            {prepared &&
                createPortal(
                    <SyncModal
                        prepared={prepared}
                        onCancel={() => setPrepared(null)}
                        onDone={async (summary) => {
                            setPrepared(null);
                            setNeedsInput(false);
                            setMessage({ text: describeResult(summary), error: false });
                            setPending(await hasPendingChanges());
                        }}
                    />,
                    document.body
                )}
        </SyncContext.Provider>
    );
}

export const useSync = () => {
    const ctx = useContext(SyncContext);
    if (!ctx) throw new Error("useSync must be used within a SyncProvider");
    return ctx;
};
