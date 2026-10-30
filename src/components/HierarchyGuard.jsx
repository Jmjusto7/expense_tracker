import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";

export default function HierarchyGuard({ children }) {
  const navigate = useNavigate();
  const { year: yearParam, month: monthParam, travelId, accountId, liabilityId } = useParams();

  const { isLoaded, years, travels, accounts } = useExpenseContext();

  useEffect(() => {
    if (!isLoaded) return;

    // =============================
    // ACCOUNT DETAIL VALIDATION
    // =============================
    if (accountId) {
      const match = accounts.find((a) => String(a.id) === accountId);

      // A liability opened via /assets/:id (e.g. a stale bookmark from
      // before it was marked a liability) belongs on its own page instead
      // of silently rendering here.
      if (!match) {
        navigate("/assets", { replace: true });
      } else if (match.isLiability) {
        navigate(`/liabilities/${accountId}`, { replace: true });
      }

      return;
    }

    // =============================
    // LIABILITY DETAIL VALIDATION
    // =============================
    if (liabilityId) {
      const match = accounts.find((a) => String(a.id) === liabilityId);

      if (!match) {
        navigate("/liabilities", { replace: true });
      } else if (!match.isLiability) {
        navigate(`/assets/${liabilityId}`, { replace: true });
      }

      return;
    }

    // =============================
    // TRAVEL DETAIL VALIDATION
    // =============================
    if (travelId) {
      const exists = travels.some(
        (t) => String(t.id) === travelId
      );

      if (!exists) {
        navigate("/travels", { replace: true });
      }

      return;
    }

    // =============================
    // EXPENSE HIERARCHY VALIDATION
    // =============================
    if (yearParam) {
      const yearObj = years.find(
        (y) => y.year === parseInt(yearParam, 10)
      );

      if (!yearObj) {
        navigate("/expenses", { replace: true });
        return;
      }

      if (monthParam) {
        const monthObj = yearObj.months.find(
          (m) => m.name === monthParam
        );

        if (!monthObj) {
          navigate(`/expenses/${yearObj.year}`, {
            replace: true,
          });
        }
      }
    }
  }, [isLoaded, years, travels, accounts, yearParam, monthParam, travelId, accountId, liabilityId, navigate]);

  if (!isLoaded) return <div role="status">Loading...</div>;
  return children;
}
