// src/utils/categoryHelpers.js

// Finds the first known category that starts with the user's partial input,
// used to render inline "ghost text" autocomplete in the transaction row inputs.
// Was previously duplicated identically in AddTransactionModal and EditTransactionModal.
export const getCategorySuggestion = (categories, input) => {
  if (!input?.trim()) return null;

  return categories.find(
    (cat) =>
      cat.toLowerCase().startsWith(input.toLowerCase()) &&
      cat.toLowerCase() !== input.toLowerCase()
  );
};

// The remaining characters to render as greyed-out ghost text after the
// text the user has actually typed so far.
export const getGhostText = (categories, input) => {
  const suggestion = getCategorySuggestion(categories, input);
  return suggestion ? suggestion.slice(input.length) : "";
};
