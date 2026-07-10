import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";

export default function HierarchyGuard({ children }) {
  const navigate = useNavigate();
  const { year: yearParam, month: monthParam, travelId, accountId } = useParams();

  const { years, travels, accounts } = useExpenseContext();

  useEffect(() => {
    // =============================
    // ACCOUNT DETAIL VALIDATION
    // =============================
    if (accountId) {
      if (!accounts) return; // wait for load

      const numericAccountId = Number(accountId);

      const exists = accounts.some((a) => a.id === numericAccountId);

      if (!exists) {
        navigate("/assets", { replace: true });
      }

      return;
    }

    // =============================
    // TRAVEL DETAIL VALIDATION
    // =============================
    if (travelId) {
      if (!travels) return; // wait for load

      const numericTravelId = Number(travelId);

      const exists = travels.some(
        (t) => t.id === numericTravelId
      );

      if (!exists) {
        navigate("/travels", { replace: true });
      }

      return;
    }

    // =============================
    // EXPENSE HIERARCHY VALIDATION
    // =============================
    if (!years || years.length === 0) {
      navigate("/", { replace: true });
      return;
    }

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
  }, [years, travels, accounts, yearParam, monthParam, travelId, accountId, navigate]);

  return children;
}
