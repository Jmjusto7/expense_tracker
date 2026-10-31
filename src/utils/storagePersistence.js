// src/utils/storagePersistence.js
// Asks the browser not to evict IndexedDB under storage pressure.
export async function requestPersistentStorage() {
    try {
        if (await navigator.storage?.persisted?.()) return true;
        return (await navigator.storage?.persist?.()) ?? false;
    } catch {
        return false;
    }
}

export async function isStoragePersisted() {
    try {
        return (await navigator.storage?.persisted?.()) ?? null;
    } catch {
        return null;
    }
}
