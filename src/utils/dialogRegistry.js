// src/utils/dialogRegistry.js
// Counts open dialogs so background work (auto-sync) can wait until the user finishes editing.
let openCount = 0;

export const registerOpenDialog = () => {
    openCount += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        openCount = Math.max(0, openCount - 1);
    };
};

export const isAnyDialogOpen = () => openCount > 0;
