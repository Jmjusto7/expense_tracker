import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";

export default function HierarchyGuard({ children }) {
  const navigate = useNavigate();
  const { year: yearParam, month: monthParam } = useParams();
  const { years } = useExpenseContext();

  useEffect(() => {
    if (!years || years.length === 0) {
      // No years at all → go to dashboard (SummaryPage)
      navigate("/", { replace: true });
      return;
    }

    if (yearParam) {
      const yearObj = years.find((y) => y.year === parseInt(yearParam, 10));
      if (!yearObj) {
        // Year param doesn't exist → go to /expenses (year list)
        navigate("/expenses", { replace: true });
        return;
      }

      if (monthParam) {
        const monthObj = yearObj.months.find((m) => m.name === monthParam);
        if (!monthObj) {
          // Month param doesn't exist → go to year page
          navigate(`/expenses/${yearObj.year}`, { replace: true });
          return;
        }
      }
    }
  }, [years, yearParam, monthParam, navigate]);

  return children;
}
