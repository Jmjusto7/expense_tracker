// src/sync/driveClient.js
// Minimal Drive v3 REST calls for one JSON file in the hidden appDataFolder.
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const SYNC_FILE_NAME = "tracker-sync.json";

export class DriveAuthError extends Error { }

async function request(accessToken, url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { Authorization: `Bearer ${accessToken}`, ...options.headers },
    });
    if (res.status === 401) throw new DriveAuthError("Google sign-in expired. Sync again to reconnect.");
    if (!res.ok) throw new Error(`Google Drive request failed (${res.status}).`);
    return res;
}

const fileUrl = (base, fileId, query) => `${base}/files/${encodeURIComponent(fileId)}?${new URLSearchParams(query)}`;

export async function findSyncFile(accessToken) {
    const query = new URLSearchParams({
        spaces: "appDataFolder",
        q: `name = '${SYNC_FILE_NAME}' and trashed = false`,
        fields: "files(id,version,modifiedTime)",
        orderBy: "modifiedTime desc",
        pageSize: "1",
    });
    const res = await request(accessToken, `${API}/files?${query}`);
    const { files = [] } = await res.json();
    return files[0] ?? null;
}

export async function downloadFile(accessToken, fileId) {
    const res = await request(accessToken, fileUrl(API, fileId, { alt: "media" }));
    return res.text();
}

export async function getFileVersion(accessToken, fileId) {
    const res = await request(accessToken, fileUrl(API, fileId, { fields: "version" }));
    return (await res.json()).version;
}

export async function createSyncFile(accessToken, content) {
    const boundary = `tracker-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name: SYNC_FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" });
    const body = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        metadata,
        `--${boundary}`,
        "Content-Type: application/json",
        "",
        content,
        `--${boundary}--`,
    ].join("\r\n");

    const res = await request(accessToken, `${UPLOAD_API}/files?uploadType=multipart&fields=id,version`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
    });
    return res.json();
}

export async function updateSyncFile(accessToken, fileId, content) {
    const res = await request(accessToken, fileUrl(UPLOAD_API, fileId, { uploadType: "media", fields: "id,version" }), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: content,
    });
    return res.json();
}
