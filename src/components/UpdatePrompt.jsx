import { useRegisterSW } from "virtual:pwa-register/react";

export default function UpdatePrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();

    if (!needRefresh) return null;

    return (
        <div
            role="status"
            className="fixed z-50 inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm flex items-center gap-3 bg-ink text-white rounded-lg shadow-lg px-4 py-3 text-sm"
        >
            <span className="flex-1">A new version is available.</span>
            <button onClick={() => setNeedRefresh(false)} className="text-white/70 hover:text-white">
                Later
            </button>
            <button
                onClick={() => updateServiceWorker(true)}
                className="bg-ledger hover:bg-ledger-dark text-white font-medium rounded-md px-3 py-1.5"
            >
                Reload
            </button>
        </div>
    );
}
