// Captures Chrome's install prompt as early as possible (it can fire before React mounts)
// and exposes whether this device can install the app, has it installed, or neither and why.
const listeners = new Set();
let deferredPrompt = null;
let state = computeState();

function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function computeState() {
    if (typeof window === "undefined") return { status: "unavailable", reason: "unsupported" };
    if (isStandalone()) return { status: "installed" };
    if (deferredPrompt) return { status: "available" };
    if (!window.isSecureContext) return { status: "unavailable", reason: "insecure" };
    if (/iphone|ipad|ipod/i.test(window.navigator.userAgent)) return { status: "unavailable", reason: "ios" };
    if (!("serviceWorker" in window.navigator)) return { status: "unavailable", reason: "unsupported" };
    return { status: "unavailable", reason: "browser-menu" };
}

function update() {
    state = computeState();
    listeners.forEach((notify) => notify());
}

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        update();
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        update();
    });
    window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", update);
}

export const getInstallState = () => state;

export function subscribeInstallState(notify) {
    listeners.add(notify);
    return () => listeners.delete(notify);
}

// Returns "accepted" or "dismissed"; the browser only allows using a captured prompt once.
export async function promptInstall() {
    if (!deferredPrompt) return "dismissed";
    const prompt = deferredPrompt;
    deferredPrompt = null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    update();
    return outcome;
}
