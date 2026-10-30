// src/sync/googleAuth.js
// Google Identity Services token flow. The access token lives in memory only.
const GIS_SRC = "https://accounts.google.com/gsi/client";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export const googleClientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const isSyncConfigured = () => Boolean(googleClientId());

let scriptPromise = null;
let token = null;

export function preloadGoogleSignIn() {
    if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
    scriptPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = GIS_SRC;
        script.async = true;
        script.onload = () => resolve(window.google);
        script.onerror = () => {
            scriptPromise = null;
            script.remove();
            reject(new Error("Couldn't load Google sign-in. Check your connection."));
        };
        document.head.appendChild(script);
    });
    return scriptPromise;
}

export const hasValidToken = () => Boolean(token && token.expiresAt - 60_000 > Date.now());

export const clearAccessToken = () => {
    token = null;
};

// Call from a click handler, otherwise the browser may block the consent popup.
export async function getAccessToken() {
    if (hasValidToken()) return token.accessToken;
    if (!isSyncConfigured()) throw new Error("Google sync isn't configured (VITE_GOOGLE_CLIENT_ID is missing).");
    const google = await preloadGoogleSignIn();

    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: googleClientId(),
            scope: DRIVE_SCOPE,
            callback: (response) => {
                if (response.error) {
                    reject(new Error("Google sign-in was not completed."));
                    return;
                }
                if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
                    reject(new Error("Allow access to the app's Google Drive data to sync."));
                    return;
                }
                token = { accessToken: response.access_token, expiresAt: Date.now() + Number(response.expires_in) * 1000 };
                resolve(token.accessToken);
            },
            error_callback: (err) =>
                reject(new Error(err?.type === "popup_closed" ? "Google sign-in was closed." : "Google sign-in failed.")),
        });
        client.requestAccessToken({ prompt: "" });
    });
}

export async function revokeAccess() {
    const current = token;
    token = null;
    if (current && window.google?.accounts?.oauth2) {
        await new Promise((resolve) => window.google.accounts.oauth2.revoke(current.accessToken, resolve));
    }
}
