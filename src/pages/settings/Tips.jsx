import { useState } from "react";
import { resetTours, setToursEnabled, toursEnabled } from "../../utils/tours";

export default function TipsTab() {
    const [enabled, setEnabled] = useState(toursEnabled);
    const [reset, setReset] = useState(false);

    return (
        <div className="flex flex-col gap-4 max-w-md">
            <p className="text-sm text-ink-muted">
                Each screen (and the Add transaction form) shows a few tips the first time you open it - what the tabs do, what &ldquo;Paid
                from&rdquo; and &ldquo;Travel&rdquo; mean, and so on.
            </p>
            <label className="flex items-center gap-2 text-sm text-ink">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                        setToursEnabled(e.target.checked);
                        setEnabled(e.target.checked);
                    }}
                    className="h-4 w-4 accent-ledger"
                />
                Show tips on screens I haven&apos;t seen yet
            </label>
            <div>
                <button
                    type="button"
                    onClick={() => {
                        resetTours();
                        setEnabled(true);
                        setReset(true);
                    }}
                    className="bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    Show all tips again
                </button>
                {reset && (
                    <p role="status" className="text-sm text-ledger-dark mt-2">
                        Done - tips will show again as you open each screen.
                    </p>
                )}
            </div>
        </div>
    );
}
