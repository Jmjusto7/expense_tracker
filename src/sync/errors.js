// src/sync/errors.js
// Sync stopped because something changed mid-way; nothing is lost and retrying later is safe.
export class SyncRetryError extends Error { }
