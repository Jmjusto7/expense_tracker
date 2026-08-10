// src/utils/accountHierarchy.js

// Groups a flat accounts list into a display tree, purely by reusing the
// relationship costCurrencyAccountId already encodes ("this account is
// priced in / funded through that one" - set once at creation via Add
// Account's "Priced In" field, see AddAccountModal). This is a pure
// rendering grouping - it doesn't change what's stored, and none of the
// balance-walk math (getCurrentValuePhp, getAverageCost, addConvertEntry,
// addTransfer) needs to know this grouping exists.
//
// A root is any account priced directly in PHP (costCurrencyAccountId ==
// null), or one whose reference account isn't present in the given list
// (e.g. filtered out, or removed) - never silently dropped for a missing
// parent. Chains can be more than one level deep in practice - e.g. a
// broker (IBKR) priced in a USD wallet, with a stock (VOO) priced in the
// broker - so this builds a full tree, not just one level of nesting.
export function buildAccountTree(accounts) {
  const byId = new Map(accounts.map((a) => [a.id, { ...a, children: [] }]));
  const roots = [];

  for (const account of byId.values()) {
    const parent =
      account.costCurrencyAccountId != null ? byId.get(account.costCurrencyAccountId) : null;

    if (parent) {
      parent.children.push(account);
    } else {
      roots.push(account);
    }
  }

  return roots;
}

// Flattens a root's descendant tree into a single depth-ordered list -
// useful for rendering nested rows without recursive JSX, and for
// anything that just needs "every account under this root" regardless of
// how deep (e.g. summing values, or checking whether a root has any
// descendants at all).
export function flattenDescendants(rootAccount, depth = 1) {
  const result = [];
  for (const child of rootAccount.children || []) {
    result.push({ account: child, depth });
    result.push(...flattenDescendants(child, depth + 1));
  }
  return result;
}
