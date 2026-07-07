// src/utils/transactionClassification.js
// Native classification layer for transactions.
// Treats travel-tagged transactions as belonging to a synthetic "Travel" bucket,
// excluding them from their category's normal bucket assignment.

import { TRAVEL_FILTER_ID } from "./travelHelpers";

/**
 * Classify a single transaction into its effective bucket scope.
 *
 * @param {Object} tx - Transaction with at least { category, travelId }
 * @param {Array} buckets - Array of { id, name, categories: string[] }
 * @param {Object} options
 * @param {boolean} options.ignoreTravelOverride - If true, classify by category bucket
 *   even if transaction is travel-tagged. Useful for TravelDetailPage where you want
 *   bucket breakdown within a travel context.
 * @returns {Object} Classification result:
 *   - scope: "travel" | "standard"
 *   - effectiveBucketId: TRAVEL_FILTER_ID | bucket.id | null (unassigned)
 *   - effectiveBucketLabel: "Travel" | bucket.name | "Unassigned"
 *   - category: original category (unchanged)
 */
export function classifyTransaction(tx, buckets = [], { ignoreTravelOverride = false } = {}) {
    const isTravel = !ignoreTravelOverride && tx.travelId != null;

    if (isTravel) {
        return {
            scope: "travel",
            effectiveBucketId: TRAVEL_FILTER_ID,
            effectiveBucketLabel: "Travel",
            category: tx.category,
        };
    }

    // Find which bucket owns this category
    const owningBucket = buckets.find((b) => b.categories?.includes(tx.category));

    if (owningBucket) {
        return {
            scope: "standard",
            effectiveBucketId: owningBucket.id,
            effectiveBucketLabel: owningBucket.name,
            category: tx.category,
        };
    }

    // Unassigned: category not mapped to any bucket
    return {
        scope: "standard",
        effectiveBucketId: null,
        effectiveBucketLabel: "Unassigned",
        category: tx.category,
    };
}

/**
 * Classify all transactions and attach classification fields.
 * Returns new array with enriched objects (does not mutate originals).
 *
 * @param {Array} transactions
 * @param {Array} buckets
 * @param {Object} options - Passed to classifyTransaction
 * @returns {Array} Transactions with added: scope, effectiveBucketId, effectiveBucketLabel
 */
export function classifyTransactions(transactions, buckets = [], options = {}) {
    return transactions.map((tx) => ({
        ...tx,
        ...classifyTransaction(tx, buckets, options),
    }));
}

/**
 * Group classified transactions by their effective bucket.
 * Returns Map<effectiveBucketId, { bucketId, bucketLabel, transactions, total }>
 *
 * @param {Array} classifiedTx - Transactions with classification fields attached
 * @returns {Map}
 */
export function groupByEffectiveBucket(classifiedTx) {
    const groups = new Map();

    for (const tx of classifiedTx) {
        const key = tx.effectiveBucketId ?? "__unassigned__";

        if (!groups.has(key)) {
            groups.set(key, {
                bucketId: tx.effectiveBucketId,
                bucketLabel: tx.effectiveBucketLabel,
                transactions: [],
                total: 0,
            });
        }

        const group = groups.get(key);
        group.transactions.push(tx);
        group.total += Number(tx.amount ?? 0);
    }

    return groups;
}

/**
 * Group classified transactions by category (within current scope).
 * Returns Map<category, { category, transactions, total }>
 *
 * @param {Array} classifiedTx
 * @returns {Map}
 */
export function groupByCategory(classifiedTx) {
    const groups = new Map();

    for (const tx of classifiedTx) {
        const key = tx.category || "__uncategorized__";

        if (!groups.has(key)) {
            groups.set(key, {
                category: tx.category,
                transactions: [],
                total: 0,
            });
        }

        const group = groups.get(key);
        group.transactions.push(tx);
        group.total += Number(tx.amount ?? 0);
    }

    return groups;
}

/**
 * Check if a classified transaction matches the selected bucket filter.
 * Handles multi-select as union of scopes.
 *
 * @param {Object} classifiedTx - Transaction with effectiveBucketId
 * @param {Array} selectedBucketIds - Array of bucket ids (may include TRAVEL_FILTER_ID)
 * @returns {boolean}
 */
export function matchesBucketFilter(classifiedTx, selectedBucketIds) {
    if (selectedBucketIds.length === 0) return true;

    // Transaction's effective bucket must be in the selected set
    return selectedBucketIds.includes(classifiedTx.effectiveBucketId);
}

/**
 * Check if a classified transaction matches category filter.
 *
 * @param {Object} classifiedTx
 * @param {Array} selectedCategories
 * @returns {boolean}
 */
export function matchesCategoryFilter(classifiedTx, selectedCategories) {
    if (selectedCategories.length === 0) return true;
    return selectedCategories.includes(classifiedTx.category);
}

/**
 * Full filter: bucket scope (union) + category (intersection).
 *
 * @param {Object} classifiedTx
 * @param {Object} filterState - { selectedBucketIds, selectedCategoryFilters }
 * @returns {boolean}
 */
export function matchesBucketAndCategoryFilter(classifiedTx, { selectedBucketIds = [], selectedCategoryFilters = [] }) {
    return (
        matchesBucketFilter(classifiedTx, selectedBucketIds) &&
        matchesCategoryFilter(classifiedTx, selectedCategoryFilters)
    );
}

/**
 * Get all unique categories present in a set of classified transactions,
 * optionally scoped to selected buckets.
 *
 * @param {Array} classifiedTx
 * @param {Array} selectedBucketIds - If non-empty, only categories from these buckets
 * @returns {Array<string>}
 */
export function getAvailableCategories(classifiedTx, selectedBucketIds = []) {
    let scoped = classifiedTx;

    if (selectedBucketIds.length > 0) {
        scoped = classifiedTx.filter((tx) => matchesBucketFilter(tx, selectedBucketIds));
    }

    return [...new Set(scoped.map((tx) => tx.category).filter(Boolean))].sort();
}
