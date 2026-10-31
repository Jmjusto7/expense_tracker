import { NavLink, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Home, Receipt, Plane, Settings, Download, Upload, Plus, Wallet, CreditCard, MoreHorizontal, CloudOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useSync } from "../context/SyncContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import SyncIndicator from "./SyncIndicator";
import AddTransactionModal from "./AddTransactionModal";
import ImportPreviewModal from "./ImportPreviewModal";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/travels", label: "Travels", icon: Plane },
  { to: "/assets", label: "Assets", icon: Wallet },
  { to: "/liabilities", label: "Liabilities", icon: CreditCard },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
    ? "bg-ledger-soft text-ledger-dark"
    : "text-ink-muted hover:text-ink hover:bg-surface-sunken"
  }`;

const tabLinkClass = ({ isActive }) =>
  `flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? "text-ledger-dark" : "text-ink-muted"
  }`;

const actionClass =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors";

export default function Navbar() {
  const navigate = useNavigate();
  const { exportExpenses, parseImportFile, commitImport } = useExpenseContext();
  const { message: syncMessage } = useSync();
  const online = useOnlineStatus();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !moreRef.current?.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [moreOpen]);

  const [importPreview, setImportPreview] = useState(null); // { counts, plan }
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState("");

  // Step 1: parse the file and show what it contains - no DB writes yet.
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;

    setImportError("");
    try {
      const { counts, plan } = await parseImportFile(file);
      setImportPreview({ counts, plan });
    } catch (err) {
      // parseImportFile throws descriptive errors for both bad JSON and
      // structural mismatches - surface the real message rather than a
      // generic one.
      setImportError(err.message || "Couldn't read that file.");
      setTimeout(() => setImportError(""), 6000);
    }
  };

  // Step 2: only now does anything get written to the DB.
  const handleConfirmImport = async (resolutions) => {
    setImporting(true);
    try {
      const { summary } = await commitImport(importPreview.plan, resolutions);
      setImportPreview(null);

      // Build a "N duplicate Xs" clause for every category that had
      // something to clean up, in hierarchy order, then join into one
      // sentence. Falls back to a plain success message when nothing
      // needed deduping.
      const parts = [
        [summary.years, "year"],
        [summary.months, "month"],
        [summary.days, "day"],
        [summary.transactions, "transaction"],
        [summary.travels, "trip"],
        [summary.buckets, "bucket"],
        [summary.bucketAssignments, "bucket assignment"],
        [summary.accounts, "account"],
        [summary.balanceEntries, "balance entry"],
        [summary.accountTypes, "account type"],
      ]
        .filter(([count]) => count > 0)
        .map(([count, label]) =>
          label === "balance entry"
            ? `${count} duplicate balance ${count === 1 ? "entry" : "entries"}`
            : `${count} duplicate ${label}${count === 1 ? "" : "s"}`
        );

      setImportSuccessMessage(
        parts.length > 0 ? `Imported. Cleaned up ${parts.join(", ")}.` : "Imported successfully."
      );
      setTimeout(() => setImportSuccessMessage(""), 5000);
    } catch (err) {
      setImportError(`Import failed - your existing data was not changed. ${err.message || ""}`.trim());
      setTimeout(() => setImportError(""), 5000);
    } finally {
      setImporting(false);
    }
  };

  // "Add Transaction" from anywhere: opens the modal in its free-date
  // "quick add" mode (no year/month props), which resolves and creates
  // whatever year/month/day the picked date needs at save time - so this
  // isn't locked to today's month the way the old pre-resolved version was.
  const handleQuickAdd = () => setShowQuickAdd(true);

  const banners = [
    importError && { text: importError, error: true },
    importSuccessMessage && { text: importSuccessMessage, error: false },
    syncMessage,
  ].filter(Boolean);

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Wordmark + primary nav (phones use the bottom tab bar instead) */}
          <div className="flex items-center gap-6 min-w-0">
            <NavLink to="/" className="font-display text-lg text-ink tracking-tight shrink-0">
              Ledger
            </NavLink>

            <nav aria-label="Main" className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map(({ to, label, icon, end }) => {
                const Icon = icon;
                return (
                  <NavLink key={to} to={to} end={end} className={navLinkClass} aria-label={label} title={label}>
                    <Icon size={15} aria-hidden="true" />
                    <span className="hidden lg:inline">{label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            {!online && (
              <span role="status" className="flex items-center gap-1 text-xs font-medium text-ink-muted bg-surface-sunken rounded-full px-2 py-1">
                <CloudOff size={13} aria-hidden="true" />
                Offline
              </span>
            )}

            {/* Desktop actions */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={handleQuickAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-ledger text-white hover:bg-ledger-dark transition-colors"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Add Transaction</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className={actionClass} aria-label="Import" title="Import">
                <Upload size={15} aria-hidden="true" />
                <span className="hidden md:inline">Import</span>
              </button>
              <button onClick={exportExpenses} className={actionClass} aria-label="Export" title="Export">
                <Download size={15} aria-hidden="true" />
                <span className="hidden md:inline">Export</span>
              </button>
              <SyncIndicator />
              <NavLink
                to="/settings"
                aria-label="Settings"
                title="Settings"
                className={({ isActive }) =>
                  `flex items-center p-1.5 rounded-md transition-colors ${isActive
                    ? "bg-ledger-soft text-ledger-dark"
                    : "text-ink-muted hover:text-ink hover:bg-surface-sunken"
                  }`
                }
              >
                <Settings size={17} aria-hidden="true" />
              </NavLink>
            </div>

            {/* Phone actions */}
            <div className="flex sm:hidden items-center gap-1">
              <SyncIndicator showLabel={false} />
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-label="More"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className="p-2 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
                >
                  <MoreHorizontal size={18} aria-hidden="true" />
                </button>
                {moreOpen && (
                  <div role="menu" className="absolute right-0 mt-1 w-44 bg-surface border border-border rounded-lg shadow-lg py-1">
                    <button role="menuitem" className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-sunken" onClick={() => { setMoreOpen(false); fileInputRef.current?.click(); }}>
                      <Upload size={15} aria-hidden="true" /> Import
                    </button>
                    <button role="menuitem" className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-sunken" onClick={() => { setMoreOpen(false); exportExpenses(); }}>
                      <Download size={15} aria-hidden="true" /> Export
                    </button>
                    <button role="menuitem" className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-sunken" onClick={() => { setMoreOpen(false); navigate("/settings"); }}>
                      <Settings size={15} aria-hidden="true" /> Settings
                    </button>
                  </div>
                )}
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileSelected} className="hidden" aria-hidden="true" tabIndex={-1} />
          </div>
        </div>

        {banners.map((banner) => (
          <div key={banner.text} className="max-w-6xl mx-auto px-4 sm:px-6 pb-2">
            <p role="status" className={`text-sm rounded-md px-3 py-2 ${banner.error ? "text-alert bg-alert-soft" : "text-ledger-dark bg-ledger-soft"}`}>
              {banner.text}
            </p>
          </div>
        ))}

        {showQuickAdd &&
          createPortal(
            <AddTransactionModal
              onClose={() => setShowQuickAdd(false)}
              onSaved={({ year, monthName }) => navigate(`/expenses/${year}/${monthName}`)}
            />,
            document.body
          )}

        {importPreview &&
          createPortal(
            <ImportPreviewModal
              counts={importPreview.counts}
              plan={importPreview.plan}
              importing={importing}
              onCancel={() => setImportPreview(null)}
              onConfirm={handleConfirmImport}
            />,
            document.body
          )}
      </header>

      {/* Phone: bottom tab bar + floating Add button */}
      <nav
        aria-label="Main"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
      >
        {NAV_ITEMS.map(({ to, label, icon, end }) => {
          const Icon = icon;
          return (
            <NavLink key={to} to={to} end={end} className={tabLinkClass}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
      <button
        onClick={handleQuickAdd}
        aria-label="Add transaction"
        className="sm:hidden fixed z-40 right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-ledger text-white shadow-lg flex items-center justify-center hover:bg-ledger-dark"
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </>
  );
}
