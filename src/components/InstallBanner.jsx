import { Download, X } from "lucide-react";
import { useInstallApp } from "../hooks/useInstallApp";
import { useStoredState } from "../hooks/useStoredState";

export default function InstallBanner() {
    const { status, promptInstall } = useInstallApp();
    const [dismissed, setDismissed] = useStoredState("tracker.installBannerDismissed", false);

    if (status !== "available" || dismissed) return null;

    return (
        <div role="region" aria-label="Install app" className="flex items-center gap-3 bg-ledger-soft border border-ledger/30 rounded-xl px-4 py-3">
            <Download size={18} className="text-ledger-dark shrink-0" aria-hidden="true" />
            <p className="flex-1 min-w-0 text-sm text-ink">Install the tracker on this device for full-screen, offline use.</p>
            <button
                type="button"
                onClick={promptInstall}
                className="shrink-0 bg-ledger hover:bg-ledger-dark text-white text-sm font-medium px-3 py-1.5 rounded-lg"
            >
                Install
            </button>
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss install suggestion"
                className="shrink-0 p-1 rounded-md text-ink-muted hover:text-ink"
            >
                <X size={16} aria-hidden="true" />
            </button>
        </div>
    );
}
