import { NavLink, useNavigate } from "react-router-dom";
import { Home, Receipt, Plane, Settings, Download, Upload, Plus } from "lucide-react";
import { useState } from "react";
import { useExpenseContext } from "../context/ExpenseContext";
import { ALL_MONTHS } from "../utils/dateHelpers";
import AddTransactionModal from "./AddTransactionModal";
import ImportPreviewModal from "./ImportPreviewModal";

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? "bg-ledger-soft text-ledger-dark"
      : "text-ink-muted hover:text-ink hover:bg-surface-sunken"
  }`;

export default function Navbar() {
  const navigate = useNavigate();
  const { years, addYear, addMonth, exportExpenses, parseImportFile, commitImport } =
    useExpenseContext();
  const [quickAddTarget, setQuickAddTarget] = useState(null); // { year, monthName, existingDays }

  const [importPreview, setImportPreview] = useState(null); // { data, counts }
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [justImported, setJustImported] = useState(false);

  // Step 1: parse the file and show what it contains - no DB writes yet.
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;

    setImportError("");
    try {
      const { data, counts } = await parseImportFile(file);
      setImportPreview({ data, counts });
    } catch (err) {
      setImportError("Couldn't read that file - make sure it's a valid export JSON.");
      setTimeout(() => setImportError(""), 5000);
    }
  };

  // Step 2: only now does anything get written to the DB.
  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      await commitImport(importPreview.data);
      setImportPreview(null);
      setJustImported(true);
      setTimeout(() => setJustImported(false), 4000);
    } catch (err) {
      setImportError("Import failed - your existing data was not changed.");
      setTimeout(() => setImportError(""), 5000);
    } finally {
      setImporting(false);
    }
  };

  // "Add Transaction" from anywhere: resolves today's year/month, silently
  // creating either if they don't exist yet, then opens the modal directly
  // - skips the Year -> Month -> Add Transaction drill entirely for the
  // most common case (logging something from today).
  const handleQuickAdd = async () => {
    const today = new Date();
    const year = today.getFullYear();
    const monthName = ALL_MONTHS[today.getMonth()];

    // Read existingDays from the current snapshot before any creation -
    // if the month already exists this is accurate; if it doesn't, it's
    // correctly empty either way, so there's no race with reloadHierarchy.
    const existingYearObj = years.find((y) => y.year === year);
    const existingMonthObj = existingYearObj?.months?.find((m) => m.name === monthName);
    const existingDays = existingMonthObj?.days?.map((d) => d.day) || [];

    let yearId = existingYearObj?.id;
    if (!yearId) yearId = await addYear(year);

    let monthId = existingMonthObj?.id;
    if (!monthId) monthId = await addMonth(yearId, monthName);

    setQuickAddTarget({ year, monthName, existingDays });
  };

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
            <span className="hidden sm:inline">{justImported ? "Imported!" : "Import"}</span>
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

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center p-1.5 rounded-md transition-colors ${
                isActive
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

      {quickAddTarget && (
        <AddTransactionModal
          year={quickAddTarget.year}
          month={quickAddTarget.monthName}
          existingDays={quickAddTarget.existingDays}
          onClose={() => setQuickAddTarget(null)}
          onSaved={() => navigate(`/expenses/${quickAddTarget.year}/${quickAddTarget.monthName}`)}
        />
      )}

      {importPreview && (
        <ImportPreviewModal
          counts={importPreview.counts}
          importing={importing}
          onCancel={() => setImportPreview(null)}
          onConfirm={handleConfirmImport}
        />
      )}
    </header>
  );
}
