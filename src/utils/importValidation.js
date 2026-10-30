// src/utils/importValidation.js
import { ALL_MONTHS } from "./dateHelpers";

// Minimum fields each record type must have to be mappable into this app's
// schema. Not a full schema validator - just enough to catch "this isn't
// actually one of our exports" before it reaches the preview or the DB.
const REQUIRED_FIELDS = {
  years: ["id", "year"],
  months: ["id", "yearId", "name"],
  days: ["id", "yearId", "monthId", "day"],
  transactions: ["id", "yearId", "monthId", "dayId", "category", "amount"],
  travels: ["id", "title"],
  buckets: ["id", "name"],
  bucketAssignments: ["id", "bucketId", "category"],
  accounts: ["id", "name"],
  balanceEntries: ["id", "accountId", "date", "type"],
  accountTypes: ["id", "name"],
};

// Throws a descriptive Error if the parsed JSON doesn't match the expected
// export structure. Returns a normalized object (missing arrays default to
// empty) on success. `existing` (current DB tables) satisfies references
// the file itself doesn't contain.
export function validateImportShape(parsed, existing = {}) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("This file doesn't look like an expense export - expected a JSON object.");
  }

  const normalized = {};

  for (const [key, requiredFields] of Object.entries(REQUIRED_FIELDS)) {
    const value = parsed[key];

    if (value === undefined) {
      normalized[key] = [];
      continue;
    }

    if (!Array.isArray(value)) {
      throw new Error(`"${key}" should be a list of records - this file doesn't match the expected export structure.`);
    }

    value.forEach((item, i) => {
      if (typeof item !== "object" || item === null) {
        throw new Error(`"${key}[${i}]" isn't a valid record.`);
      }
      for (const field of requiredFields) {
        if (!(field in item)) {
          throw new Error(`"${key}[${i}]" is missing required field "${field}" - can't be mapped to this app's data.`);
        }
      }
      validateFieldTypes(key, i, item);
    });

    normalized[key] = value;
  }

  validateReferences(normalized, existing);

  return normalized;
}

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

const NUMBER_FIELDS = ["amount", "balance", "costBasis", "fee", "pricePerUnit", "year", "day"];
const DATE_FIELDS = ["date", "startDate", "endDate"];
const STRING_FIELDS = ["name", "category", "title"];
const BALANCE_ENTRY_TYPES = ["income", "reconciliation", "convert", "markPrice", "transfer", "expense", "statementClose"];

function validateFieldTypes(key, i, item) {
  const where = `"${key}[${i}]"`;
  for (const field of NUMBER_FIELDS) {
    if (item[field] != null && !(typeof item[field] === "number" && Number.isFinite(item[field]))) {
      throw new Error(`${where} has a non-numeric "${field}".`);
    }
  }
  for (const field of DATE_FIELDS) {
    if (item[field] != null && Number.isNaN(new Date(item[field]).getTime())) {
      throw new Error(`${where} has an invalid date in "${field}".`);
    }
  }
  for (const field of STRING_FIELDS) {
    if (item[field] != null && typeof item[field] !== "string") {
      throw new Error(`${where} has a non-text "${field}".`);
    }
  }
  if (key === "months" && !ALL_MONTHS.includes(item.name)) {
    throw new Error(`${where} has an unknown month name "${item.name}".`);
  }
  if (key === "balanceEntries" && !BALANCE_ENTRY_TYPES.includes(item.type)) {
    throw new Error(`${where} has an unknown entry type "${item.type}".`);
  }
}

const REFERENCES = [
  ["months", "yearId", "years"],
  ["days", "yearId", "years"],
  ["days", "monthId", "months"],
  ["transactions", "dayId", "days"],
  ["bucketAssignments", "bucketId", "buckets"],
  ["balanceEntries", "accountId", "accounts"],
];

function validateReferences(data, existing) {
  const idsOf = (table) =>
    new Set([...(data[table] ?? []), ...(existing[table] ?? [])].map((r) => String(r.id)));
  const cache = {};

  for (const [key, field, target] of REFERENCES) {
    cache[target] ??= idsOf(target);
    data[key].forEach((item, i) => {
      if (!cache[target].has(String(item[field]))) {
        throw new Error(
          `"${key}[${i}]" points to ${field} ${item[field]}, which isn't in this file or your current data.`
        );
      }
    });
  }
}
