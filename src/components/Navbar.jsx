import { NavLink, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Home, Receipt, Plane, Settings, Download, Upload, Plus, Wallet, CreditCard, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useDriveSync } from "../hooks/useDriveSync";
import AddTransactionModal from "./AddTransactionModal";
import ImportPreviewModal from "./ImportPreviewModal";

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
    ? "bg-ledger-soft text-ledger-dark"
    : "text-ink-muted hover:text-ink hover:bg-surface-sunken"
  }`;

export default function Navbar() {
  const navigate = useNavigate();
  const { exportExpenses, parseImportFile, commitImport } = useExpenseContext();
  const driveSync = useDriveSync();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Wordmark + primary nav */}
        <div className="flex items-center gap-6">
          <NavLink to="/" className="font-display text-lg text-ink tracking-tight shrink-0">
            Ledger
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <Home size={15} />
              <span className="hidden sm:inline">Home</span>
            </NavLink>
            <NavLink to="/expenses" className={navLinkClass}>
              <Receipt size={15} />
              <span className="hidden sm:inline">Expenses</span>
            </NavLink>
            <NavLink to="/travels" className={navLinkClass}>
              <Plane size={15} />
              <span className="hidden sm:inline">Travels</span>
            </NavLink>
            <NavLink to="/assets" className={navLinkClass}>
              <Wallet size={15} />
              <span className="hidden sm:inline">Assets</span>
            </NavLink>
            <NavLink to="/liabilities" className={navLinkClass}>
              <CreditCard size={15} />
              <span className="hidden sm:inline">Liabilities</span>
            </NavLink>
          </nav>
        </div>

        {/* Global data actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleQuickAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-ledger text-white hover:bg-ledger-dark transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Transaction</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer transition-colors">
            <Upload size={15} />
            <span className="hidden sm:inline">Import</span>
            <input
              type="file"
              accept="application/json"
              onChange={handleFileSelected}
              className="hidden"
            />
          </label>

          <button
            onClick={exportExpenses}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {driveSync.configured && (
            <button
              onClick={driveSync.startSync}
              disabled={driveSync.busy}
              title="Sync with Google Drive"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors disabled:opacity-60"
            >
              <RefreshCw size={15} className={driveSync.busy ? "animate-spin" : undefined} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center p-1.5 rounded-md transition-colors ${isActive
                ? "bg-ledger-soft text-ledger-dark"
                : "text-ink-muted hover:text-ink hover:bg-surface-sunken"
              }`
            }
            title="Settings"
          >
            <Settings size={17} />
          </NavLink>
        </div>
      </div>

      {importError && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-2">
          <p className="text-sm text-alert bg-alert-soft rounded-md px-3 py-2">{importError}</p>
        </div>
      )}

      {importSuccessMessage && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-2">
          <p className="text-sm text-ledger-dark bg-ledger-soft rounded-md px-3 py-2">
            {importSuccessMessage}
          </p>
        </div>
      )}

      {driveSync.message && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-2">
          <p
            className={`text-sm rounded-md px-3 py-2 ${driveSync.message.error ? "text-alert bg-alert-soft" : "text-ledger-dark bg-ledger-soft"
              }`}
          >
            {driveSync.message.text}
          </p>
        </div>
      )}

      {driveSync.syncModal}

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
  );
}
