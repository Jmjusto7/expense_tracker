export const useSummary = (expenses) => {
  const totalsByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  const total = Object.values(totalsByCategory).reduce((a, b) => a + b, 0);
  return { totalsByCategory, total };
};
