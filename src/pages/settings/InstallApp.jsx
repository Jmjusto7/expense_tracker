import { useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { useInstallApp } from "../../hooks/useInstallApp";

const REASONS = {
    insecure: (
        <>
            This page was opened over plain <code>http://</code> (for example the dev server on your local network). Phones only
            install apps from <strong>https://</strong> sites - open the deployed address, e.g.{" "}
            <code>https://expense-tracker.pages.dev</code>.
        </>
    ),
    ios: (
        <>
            On iPhone/iPad, open this site in <strong>Safari</strong>, tap <strong>Share</strong>, then{" "}
            <strong>Add to Home Screen</strong>.
        </>
    ),
    unsupported: <>This browser can&apos;t install web apps. On Android, open the site in Chrome.</>,
    "browser-menu": (
        <>
            No install button from the browser yet. In Chrome, open the menu <strong>⋮</strong> and choose{" "}
            <strong>Install app</strong> (or <strong>Add to Home screen</strong>). If neither appears, reload the page once - the
            app has to finish loading its offline files first. The dev server (<code>npm run dev</code>) can&apos;t be installed;
            use the deployed site.
        </>
    ),
};

export default function InstallAppTab() {
    const { status, reason, promptInstall } = useInstallApp();
    const [outcome, setOutcome] = useState("");

    return (
        <div>
            <p className="text-sm text-ink-muted mb-4">
                Installing adds an icon to your home screen and opens the tracker full-screen. It works offline; your data stays on
                this device.
            </p>

            {status === "installed" && (
                <p role="status" className="flex items-center gap-2 text-sm text-ledger-dark bg-ledger-soft rounded-md px-3 py-2">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    You&apos;re using the installed app.
                </p>
            )}

            {status === "available" && (
                <button
                    type="button"
                    onClick={async () => setOutcome(await promptInstall())}
                    className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    <Download size={16} aria-hidden="true" />
                    Install on this device
                </button>
            )}

            {status === "unavailable" && (
                <p className="text-sm text-ink bg-surface-sunken rounded-md px-3 py-2 leading-relaxed">{REASONS[reason] ?? REASONS["browser-menu"]}</p>
            )}

            {outcome === "dismissed" && (
                <p className="text-xs text-ink-muted mt-2">Not installed. You can still use the browser menu ⋮ → Install app later.</p>
            )}
        </div>
    );
}
