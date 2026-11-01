import { Link, Navigate, NavLink, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Shapes, Landmark, RefreshCw, MonitorDown, Database, Lightbulb } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useSync } from "../context/SyncContext";
import { SYNC_STATUS_LABELS } from "../sync/status";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import { useInstallApp } from "../hooks/useInstallApp";
import { useMediaQuery } from "../hooks/useMediaQuery";
import CategoryBucketing from "./settings/CategoryBucketing";
import AccountTypes from "./settings/AccountTypes";
import ClearDBTab from "./settings/ClearDB";
import SyncTab from "./settings/Sync";
import InstallAppTab from "./settings/InstallApp";
import TipsTab from "./settings/Tips";

const INSTALL_LABELS = { installed: "Installed on this device", available: "Ready to install" };

function useSections() {
  const { categories = [] } = useExpenseContext();
  const buckets = useBucketsWithCategories();
  const { status } = useSync();
  const install = useInstallApp();

  const assigned = new Set(buckets.flatMap((b) => b.categories || []));
  const unassigned = categories.filter((c) => !assigned.has(c)).length;

  return [
    {
      id: "buckets",
      title: "Buckets",
      desc: unassigned ? `${unassigned} categor${unassigned === 1 ? "y" : "ies"} not in a bucket` : "Group categories for analytics",
      badge: unassigned || null,
      icon: Shapes,
      Component: CategoryBucketing,
    },
    { id: "account-types", title: "Account types", desc: "Bank, cash, cards, investments", icon: Landmark, Component: AccountTypes },
    {
      id: "sync",
      title: "Sync",
      desc: `Google Drive · ${SYNC_STATUS_LABELS[status] ?? "Sync off"}`,
      badge: status === "needs-input" ? "!" : null,
      icon: RefreshCw,
      Component: SyncTab,
    },
    {
      id: "install",
      title: "Install app",
      desc: INSTALL_LABELS[install.status] ?? "Home-screen icon, works offline",
      icon: MonitorDown,
      Component: InstallAppTab,
    },
    { id: "data", title: "Data", desc: "Clear everything on this device", icon: Database, Component: ClearDBTab },
    { id: "tips", title: "Tips", desc: "Replay the guided tips for each screen", icon: Lightbulb, Component: TipsTab },
  ];
}

function SectionLink({ section, compact = false }) {
  const Icon = section.icon;
  return (
    <NavLink
      to={`/settings/${section.id}`}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl border px-3 transition-colors ${compact ? "py-2" : "py-3"} ${isActive && compact ? "bg-ledger-soft border-ledger/40" : "bg-surface border-border hover:border-ledger"
        }`
      }
    >
      <span className="h-8 w-8 rounded-full bg-ledger-soft text-ledger-dark grid place-items-center shrink-0" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {section.title}
          {section.badge != null && (
            <span className="text-[10px] font-bold text-white bg-warning rounded-full px-1.5 py-px" aria-label={`${section.badge} to review`}>
              {section.badge}
            </span>
          )}
        </span>
        <span className="block text-xs text-ink-muted truncate">{section.desc}</span>
      </span>
      {!compact && <ChevronRight size={16} className="text-ink-muted shrink-0" aria-hidden="true" />}
    </NavLink>
  );
}

const SettingsPage = () => {
  const { section: sectionId } = useParams();
  const wide = useMediaQuery("(min-width: 768px)");
  const sections = useSections();
  const active = sections.find((s) => s.id === sectionId);

  if (sectionId && !active) return <Navigate to="/settings" replace />;
  if (wide && !active) return <Navigate to={`/settings/${sections[0].id}`} replace />;

  // Phone: a list of sections; each opens as its own page.
  if (!wide) {
    if (!active) {
      return (
        <div className="max-w-xl mx-auto px-4 py-6">
          <h1 className="font-display text-2xl text-ink mb-4">Settings</h1>
          <nav aria-label="Settings sections" className="flex flex-col gap-2">
            {sections.map((s) => (
              <SectionLink key={s.id} section={s} />
            ))}
          </nav>
        </div>
      );
    }
    const { Component } = active;
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-2">
          <ChevronLeft size={16} aria-hidden="true" />
          Settings
        </Link>
        <h1 className="font-display text-2xl text-ink mb-4">{active.title}</h1>
        <Component />
      </div>
    );
  }

  // Desktop: the same list as a sidebar, with the chosen section beside it.
  const { Component } = active;
  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl text-ink mb-6">Settings</h1>
      <div className="flex gap-6 items-start">
        <nav aria-label="Settings sections" className="w-64 shrink-0 flex flex-col gap-2 sticky top-20">
          {sections.map((s) => (
            <SectionLink key={s.id} section={s} compact />
          ))}
        </nav>
        <section aria-labelledby="settings-section-title" className="flex-1 min-w-0 bg-surface border border-border rounded-xl shadow-card p-6">
          <h2 id="settings-section-title" className="text-lg font-semibold text-ink mb-4">
            {active.title}
          </h2>
          <Component />
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
