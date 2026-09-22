import { IpcMainInvokeEvent } from "electron";
import { request } from "https";

const ALLOWED_ORIGIN = "https://local-profile-editor.esclavedelargent.workers.dev";

function validateProfileUrl(rawUrl: string) {
    const url = new URL(rawUrl);
    if (url.origin !== ALLOWED_ORIGIN || !/^\/profile\/\d{17,20}$/.test(url.pathname))
        throw new Error("Blocked LocalProfileEditor URL");
    return url;
}

function doRequest(url: URL, method: "GET" | "PUT", headers: Record<string, string>, body?: string): Promise<{ status: number; body: string; }> {
    return new Promise((resolve, reject) => {
        const req = request(url, { method, headers }, res => {
            const chunks: Buffer[] = [];
            res.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on("end", () => resolve({
                status: res.statusCode ?? 0,
                body: Buffer.concat(chunks).toString("utf8")
            }));
        });
        req.on("error", reject);
        req.setTimeout(10000, () => req.destroy(new Error("LocalProfileEditor request timed out")));
        if (body) req.write(body);
        req.end();
    });
}

export async function getSharedProfile(_: IpcMainInvokeEvent, rawUrl: string) {
    return doRequest(validateProfileUrl(rawUrl), "GET", {
        Accept: "application/json",
        "User-Agent": "LocalProfileEditor/1.0"
    });
}

export async function putSharedProfile(_: IpcMainInvokeEvent, rawUrl: string, token: string, body: string) {
    const url = validateProfileUrl(rawUrl);
    if (typeof token !== "string" || token.length < 20 || token.length > 4096)
        throw new Error("Invalid auth token");
    if (typeof body !== "string" || body.length > 16384)
        throw new Error("Invalid profile payload");

    return doRequest(url, "PUT", {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body).toString(),
        "User-Agent": "LocalProfileEditor/1.0"
    }, body);
}
