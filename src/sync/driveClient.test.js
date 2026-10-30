import { findSyncFile, downloadFile, createSyncFile, updateSyncFile, getFileVersion, DriveAuthError } from "./driveClient";

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });

describe("driveClient", () => {
    let fetchMock;
    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("searches only the app data folder and sends the token", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ files: [{ id: "f1", version: "3" }] }));

        expect(await findSyncFile("tok")).toEqual({ id: "f1", version: "3" });
        const [url, options] = fetchMock.mock.calls[0];
        const params = new URL(url).searchParams;
        expect(params.get("spaces")).toBe("appDataFolder");
        expect(params.get("q")).toBe("name = 'tracker-sync.json' and trashed = false");
        expect(options.headers.Authorization).toBe("Bearer tok");
    });

    it("returns null when there is no sync file yet", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ files: [] }));
        expect(await findSyncFile("tok")).toBeNull();
    });

    it("downloads file contents and reads the version", async () => {
        fetchMock.mockResolvedValueOnce(new Response("{\"a\":1}")).mockResolvedValueOnce(jsonResponse({ version: "7" }));

        expect(await downloadFile("tok", "f/1")).toBe("{\"a\":1}");
        expect(fetchMock.mock.calls[0][0]).toContain("/files/f%2F1?alt=media");
        expect(await getFileVersion("tok", "f1")).toBe("7");
    });

    it("creates the file inside appDataFolder with a multipart upload", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ id: "f1", version: "1" }));

        expect(await createSyncFile("tok", "{\"x\":1}")).toEqual({ id: "f1", version: "1" });
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain("/upload/drive/v3/files?uploadType=multipart");
        expect(options.method).toBe("POST");
        expect(options.headers["Content-Type"]).toMatch(/^multipart\/related; boundary=/);
        expect(options.body).toContain("\"parents\":[\"appDataFolder\"]");
        expect(options.body).toContain("{\"x\":1}");
    });

    it("updates the file contents in place", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ id: "f1", version: "2" }));

        await updateSyncFile("tok", "f1", "{}");
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain("/upload/drive/v3/files/f1?uploadType=media");
        expect(options).toMatchObject({ method: "PATCH", body: "{}" });
    });

    it("reports an expired token separately from other failures", async () => {
        fetchMock.mockResolvedValueOnce(new Response("", { status: 401 })).mockResolvedValueOnce(new Response("", { status: 500 }));

        await expect(findSyncFile("tok")).rejects.toBeInstanceOf(DriveAuthError);
        await expect(findSyncFile("tok")).rejects.toThrow("Google Drive request failed (500).");
    });
});
