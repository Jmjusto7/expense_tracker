import { useState } from "react";
import CategoryBucketing from "./settings/CategoryBucketing";
import ClearDBTab from "./settings/ClearDB";

const SettingsPage = () => {
  const [tab, setTab] = useState("bucketing");

  const tabs = [
    { id: "bucketing", label: "Category Bucketing" },
    { id: "presets", label: "Presets" },
    { id: "others", label: "Others" },
    { id: "clearDB", label: "Clear DB" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl text-ink mb-6">Settings</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <div className="bg-surface border border-border rounded-lg p-2 flex flex-col gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-ledger-soft text-ledger-dark"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-surface border border-border rounded-lg p-6">
          {tab === "bucketing" && <CategoryBucketing />}
          {tab === "presets" && <div className="text-ink-muted">Presets settings here…</div>}
          {tab === "others" && <div className="text-ink-muted">Other settings here…</div>}
          {tab === "clearDB" && <ClearDBTab />}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
