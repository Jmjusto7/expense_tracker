import { useParams, Link } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
];

const formatDate = (date) => {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString();
};


export default function TravelDetailPage() {
  const { travelId } = useParams();
  const { travels, years } = useExpenseContext();

  const travelInt = parseInt(travelId, 10);
  const travel = travels?.find((t) => t.id === travelInt);

  // Get all transactions linked to this travel
  const transactions = [];
  let total = 0;

  years.forEach((year) => {
    year.months?.forEach((month) => {
      month.days?.forEach((day) => {
        day.transactions?.forEach((t) => {
          if (t.travelId === travelId) {
            transactions.push({
              ...t,
              day: day.day,
              month: month.name,
              year: year.year,
            });

            total += Number(t.amount || 0);
          }
        });
      });
    });
  });

  // Group by category for chart
  const categoryMap = {};

  transactions.forEach((t) => {
    categoryMap[t.category] =
      (categoryMap[t.category] || 0) + Number(t.amount || 0);
  });

  const chartData = Object.entries(categoryMap).map(
    ([category, value]) => ({
      name: category,
      value,
    })
  );

  if (!travel) {
    return (
      <div className="p-6">
        <p className="text-red-500">Travel not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Link
        to="/travels"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to Travels
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-indigo-700">
          {travel.title}
        </h1>

        <div className="text-gray-500 mt-1">
          {formatDate(travel.startDate)} – {formatDate(travel.endDate)}
        </div>

        <div className="text-2xl font-bold text-indigo-600 mt-3">
          ₱{total.toLocaleString()}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-8">
        <h2 className="text-md font-semibold mb-3">
          Transactions
        </h2>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-3 py-2">Date</th>
              <th className="border px-3 py-2">Category</th>
              <th className="border px-3 py-2">Comments</th>
              <th className="border px-3 py-2 text-right">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="border px-3 py-2 text-sm text-gray-600">
                  {t.month} {t.day}, {t.year}
                </td>
                <td className="border px-3 py-2">
                  {t.category}
                </td>
                <td className="border px-3 py-2 text-gray-500">
                  {t.comments}
                </td>
                <td className="border px-3 py-2 text-right font-semibold text-indigo-600">
                  ₱{Number(t.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Category Distribution Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-md font-semibold mb-4">
            Category Distribution
          </h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  label
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
