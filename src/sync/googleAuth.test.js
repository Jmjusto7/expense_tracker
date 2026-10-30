import { getAccessToken, hasValidToken, revokeAccess, DRIVE_SCOPE } from "./googleAuth";

function mockGoogle(response) {
    const oauth2 = {
        initTokenClient: vi.fn(({ callback }) => ({ requestAccessToken: () => callback(response) })),
        hasGrantedAllScopes: vi.fn(() => true),
        revoke: vi.fn((_token, done) => done()),
    };
    window.google = { accounts: { oauth2 } };
    return oauth2;
}

describe("googleAuth", () => {
    beforeEach(() => vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-123"));
    afterEach(async () => {
        await revokeAccess();
        delete window.google;
        vi.unstubAllEnvs();
    });

    it("requests only the appdata scope and caches the token", async () => {
        const oauth2 = mockGoogle({ access_token: "tok", expires_in: 3600 });

        expect(await getAccessToken()).toBe("tok");
        expect(await getAccessToken()).toBe("tok");
        expect(oauth2.initTokenClient).toHaveBeenCalledTimes(1);
        expect(oauth2.initTokenClient.mock.calls[0][0]).toMatchObject({ client_id: "client-123", scope: DRIVE_SCOPE });
        expect(hasValidToken()).toBe(true);
    });

    it("rejects when the user doesn't grant Drive access", async () => {
        const oauth2 = mockGoogle({ access_token: "tok", expires_in: 3600 });
        oauth2.hasGrantedAllScopes.mockReturnValue(false);

        await expect(getAccessToken()).rejects.toThrow(/Allow access/);
        expect(hasValidToken()).toBe(false);
    });

    it("revokes and forgets the token", async () => {
        const oauth2 = mockGoogle({ access_token: "tok", expires_in: 3600 });
        await getAccessToken();

        await revokeAccess();

        expect(oauth2.revoke).toHaveBeenCalledWith("tok", expect.any(Function));
        expect(hasValidToken()).toBe(false);
    });

    it("refuses to start without a client id", async () => {
        vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
        await expect(getAccessToken()).rejects.toThrow(/isn't configured/);
    });
});
