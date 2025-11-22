import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CategoryBucketing from "./settings/CategoryBucketing";

const SettingsPage = () => {
  const [tab, setTab] = useState("bucketing");
  const navigate = useNavigate();

  const tabs = [
    { id: "bucketing", label: "Category Bucketing" },
    { id: "presets", label: "Presets" },
    { id: "others", label: "Others" },
  ];

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left section: Back button + Sidebar */}
      <div className="flex flex-col w-60">
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 mb-4"
        >
          ← Back
        </button>

        {/* Sidebar */}
        <div className="bg-gray-100 p-4 rounded-xl shadow-sm flex-1 flex flex-col">
          {tabs.map((t) => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`p-2 rounded cursor-pointer mb-2 ${
                tab === t.id ? "bg-indigo-500 text-white" : "hover:bg-gray-200"
              }`}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm">
        {tab === "bucketing" && <CategoryBucketing />}
        {tab === "presets" && <div>Presets settings here…</div>}
        {tab === "others" && <div>Other settings here…</div>}
      </div>
    </div>
  );
};

export default SettingsPage;
