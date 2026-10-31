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

export const UNCLASSIFIED = "__unclassified__";

// Groups root accounts (each keeping its nested Holdings) by the root's
// account type. A root's total includes its holdings; unknown values are
// counted rather than treated as zero. Groups are ordered by subtotal,
// Unclassified last.
export function groupRootsByType(roots, accountTypes, valueOf) {
  const groups = new Map();
  for (const root of roots) {
    const typeKey = root.typeId ?? UNCLASSIFIED;
    if (!groups.has(typeKey)) {
      const type = accountTypes.find((t) => t.id === root.typeId);
      groups.set(typeKey, {
        key: String(typeKey),
        name: type?.name ?? "Unclassified",
        roots: [],
        subtotal: 0,
        count: 0,
        unvalued: 0,
      });
    }
    const group = groups.get(typeKey);
    group.roots.push(root);
    for (const account of [root, ...flattenDescendants(root).map((d) => d.account)]) {
      const value = valueOf(account);
      group.count += 1;
      if (value == null) group.unvalued += 1;
      else group.subtotal += value;
    }
  }
  return [...groups.values()].sort((a, b) => {
    if ((a.key === UNCLASSIFIED) !== (b.key === UNCLASSIFIED)) return a.key === UNCLASSIFIED ? 1 : -1;
    return Math.abs(b.subtotal) - Math.abs(a.subtotal);
  });
}

// Root plus everything nested under it.
export const rootTotal = (root, valueOf) =>
  [root, ...flattenDescendants(root).map((d) => d.account)].reduce((sum, a) => sum + (valueOf(a) ?? 0), 0);

export const SORT_OPTIONS = [
  { value: "value", label: "Value" },
  { value: "name", label: "Name" },
  { value: "reconciled", label: "Least recently reconciled" },
];

// staleDaysOf returns null for never reconciled (sorted first).
export function sortRoots(roots, sortBy, { valueOf, staleDaysOf }) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const sorted = [...roots];
  if (sortBy === "name") return sorted.sort(byName);
  if (sortBy === "reconciled") {
    const stale = (a) => staleDaysOf(a) ?? Infinity;
    return sorted.sort((a, b) => stale(b) - stale(a) || byName(a, b));
  }
  return sorted.sort((a, b) => Math.abs(rootTotal(b, valueOf)) - Math.abs(rootTotal(a, valueOf)) || byName(a, b));
}
