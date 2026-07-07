// src/utils/importValidation.js

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
};

// Throws a descriptive Error if the parsed JSON doesn't match the expected
// export structure. Returns a normalized object (missing arrays default to
// empty) on success.
export function validateImportShape(parsed) {
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
    });

    normalized[key] = value;
  }

  return normalized;
}
