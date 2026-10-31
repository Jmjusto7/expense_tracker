import { useEffect, useState } from "react";

// useState persisted to localStorage (device-only UI preferences, never synced).
export function useStoredState(key, initialValue) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw == null ? initialValue : JSON.parse(raw);
        } catch {
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Storage full or blocked: keep working with in-memory state.
        }
    }, [key, value]);

    return [value, setValue];
}
