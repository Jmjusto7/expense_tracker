import { Routes, Route } from "react-router-dom";
import SummaryPage from "./pages/SummaryPage";
import YearExpensesPage from "./pages/YearExpensesPage";
import MonthExpensesPage from "./pages/MonthExpensesPage";
import TravelsPage from "./pages/TravelsPage";
import TravelDetailPage from "./pages/TravelDetailPage";
import ExpensesPage, { CurrentMonthRedirect } from "./pages/ExpensesPage";
import SettingsPage from "./pages/SettingsPage";
import AccountsPage from "./pages/AccountsPage";
import AccountDetailPage from "./pages/AccountDetailPage";
import LiabilitiesPage from "./pages/LiabilitiesPage";
import LiabilityDetailPage from "./pages/LiabilityDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import HierarchyGuard from "./components/HierarchyGuard";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Summary chart page */}
      <Route path="/" element={<SummaryPage />} />

      {/* Settings page */}
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/:section" element={<SettingsPage />} />

      {/* /expenses opens the current month; analytics + years live at /expenses/overview */}
      <Route path="/expenses" element={<CurrentMonthRedirect />} />
      <Route path="/expenses/overview" element={<YearExpensesPage />} />

      {/* Month list for a specific year */}
      <Route
        path="/expenses/:year"
        element={
          <HierarchyGuard>
            <MonthExpensesPage />
          </HierarchyGuard>
        }
      />

      {/* Month statement (list or ?view=calendar); empty months render too */}
      <Route path="/expenses/:year/:month" element={<ExpensesPage />} />

      {/* Year list page */}
      <Route path="/travels" element={<TravelsPage />} />

      {/* Travel detail */}
      <Route
        path="/travels/:travelId"
        element={
          <HierarchyGuard>
            <TravelDetailPage />
          </HierarchyGuard>
        }
      />

      {/* Accounts list page */}
      <Route path="/assets" element={<AccountsPage />} />

      {/* Account detail */}
      <Route
        path="/assets/:accountId"
        element={
          <HierarchyGuard>
            <AccountDetailPage />
          </HierarchyGuard>
        }
      />

      {/* Liabilities list page */}
      <Route path="/liabilities" element={<LiabilitiesPage />} />

      {/* Liability detail */}
      <Route
        path="/liabilities/:liabilityId"
        element={
          <HierarchyGuard>
            <LiabilityDetailPage />
          </HierarchyGuard>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
