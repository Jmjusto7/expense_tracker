import { BrowserRouter, Routes, Route } from "react-router-dom";
import SummaryPage from "./pages/SummaryPage";
import YearExpensesPage from "./pages/YearExpensesPage";
import MonthExpensesPage from "./pages/MonthExpensesPage";
import ExpensesPage from "./pages/ExpensesPage";
import SettingsPage from "./pages/SettingsPage";
import HierarchyGuard from "./components/HierarchyGuard";

export default function AppRoutes() {1 
  return (
    <BrowserRouter>
      <Routes>
        {/* Summary chart page */}
        <Route path="/" element={<SummaryPage />} />

        {/* Settings page */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* Year list page */}
        <Route path="/expenses" element={<YearExpensesPage />} />

        {/* Month list for a specific year */}
        <Route
          path="/expenses/:year"
          element={
            <HierarchyGuard>
              <MonthExpensesPage />
            </HierarchyGuard>
          }
        />

        {/* Transactions for a specific month */}
        <Route
          path="/expenses/:year/:month"
          element={
            <HierarchyGuard>
              <ExpensesPage />
            </HierarchyGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
