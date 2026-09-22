const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extraHeaders } });

const REDIRECT_URI = "https://local-profile-editor.esclavedelargent.workers.dev/auth/callback";
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

function randomToken() {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function base64Url(bytes) {
  let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlText(text) { return base64Url(new TextEncoder().encode(text)); }
async function sign(env, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SYNC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
async function createSessionToken(env, userId) {
  const payload = base64UrlText(JSON.stringify({ sub: userId, exp: Math.floor(Date.now()/1000) + TOKEN_LIFETIME_SECONDS }));
  return `${payload}.${await sign(env, payload)}`;
}
function decodeBase64UrlText(value) {
  const b = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b + "=".repeat((4 - b.length % 4) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)));
}
async function verifySessionToken(env, token) {
  if (typeof token !== "string") return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || signature !== await sign(env, payload)) return null;
  try {
    const data = JSON.parse(decodeBase64UrlText(payload));
    if (!/^\d{17,20}$/.test(data.sub) || !Number.isFinite(data.exp) || data.exp <= Math.floor(Date.now()/1000)) return null;
    return data;
  } catch { return null; }
}
function validColor(v) { return v === null || (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)); }
function validBanner(v) {
  if (v === null) return true;
  if (typeof v !== "string" || v.length > 2048) return false;
  try { return new URL(v).protocol === "https:"; } catch { return false; }
}
function validBadges(v) {
  return Array.isArray(v) && v.length <= 64 && v.every(x => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/")
      return json({ name: "LocalProfileEditor API", version: "1.0", status: "online" });

    if (request.method === "GET" && url.pathname === "/auth/login") {
      const state = randomToken();
      const params = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, response_type: "code", redirect_uri: REDIRECT_URI, scope: "identify", state });
      return new Response(null, { status: 302, headers: {
        Location: `https://discord.com/oauth2/authorize?${params}`,
        "Set-Cookie": `lpe_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
      }});
    }

    if (request.method === "GET" && url.pathname === "/auth/callback") {
      const code = url.searchParams.get("code"), returnedState = url.searchParams.get("state");
      const storedState = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)lpe_oauth_state=([^;]+)/)?.[1];
      if (!code || !returnedState || !storedState || returnedState !== storedState) return json({ error: "Invalid OAuth state" }, 400);

      const tr = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }) });
      if (!tr.ok) return json({ error: "Discord token exchange failed" }, 502);
      const td = await tr.json();

      const ur = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${td.access_token}` } });
      if (!ur.ok) return json({ error: "Could not verify Discord user" }, 502);
      const user = await ur.json();
      if (!user?.id || !/^\d{17,20}$/.test(user.id)) return json({ error: "Invalid Discord user" }, 502);

      const sessionToken = await createSessionToken(env, user.id);
      await env.DB.prepare(`INSERT INTO profiles (user_id,badges,banner_url,primary_color,accent_color,updated_at)
        VALUES (?, '[]', NULL, NULL, NULL, unixepoch()) ON CONFLICT(user_id) DO NOTHING`).bind(user.id).run();

      return new Response(`<!doctype html><meta charset="utf-8"><title>LocalProfileEditor</title>
<style>body{font:16px system-ui;max-width:760px;margin:60px auto;padding:0 20px;background:#111;color:#eee}code{display:block;word-break:break-all;background:#222;padding:16px;border-radius:8px;margin:16px 0}button{padding:10px 16px}</style>
<h1>LocalProfileEditor authenticated</h1><p>Discord account verified: <b>${user.id}</b></p>
<p>Copy this private token into LocalProfileEditor → <b>Sync Token</b>.</p><code id="t">${sessionToken}</code>
<button onclick="navigator.clipboard.writeText(document.getElementById('t').textContent)">Copy token</button>
<p>Keep it private. It expires in 30 days.</p>`, { status: 200, headers: { "Content-Type":"text/html; charset=utf-8",
        "Set-Cookie":"lpe_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" }});
    }

    const match = url.pathname.match(/^\/profile\/(\d{17,20})$/);

    if (request.method === "GET" && match) {
      const userId = match[1];
      const p = await env.DB.prepare(`SELECT user_id,badges,banner_url,primary_color,accent_color,updated_at FROM profiles WHERE user_id=?`).bind(userId).first();
      if (!p) return json({ found:false, userId },404);
      let badges=[]; try { badges=JSON.parse(p.badges||"[]"); } catch {}
      return json({ found:true,userId:p.user_id,badges,bannerUrl:p.banner_url,primaryColor:p.primary_color,accentColor:p.accent_color,updatedAt:p.updated_at });
    }

    if (request.method === "PUT" && match) {
      const userId=match[1], auth=request.headers.get("Authorization")||"";
      const session=await verifySessionToken(env, auth.startsWith("Bearer ")?auth.slice(7):"");
      if (!session) return json({error:"Unauthorized"},401);
      if (session.sub!==userId) return json({error:"Forbidden"},403);

      let body; try { body=await request.json(); } catch { return json({error:"Invalid JSON"},400); }
      if (body.userId!==userId) return json({error:"User ID mismatch"},400);
      if (!validBadges(body.badges)||!validBanner(body.bannerUrl)||!validColor(body.primaryColor)||!validColor(body.accentColor))
        return json({error:"Invalid profile data"},400);

      await env.DB.prepare(`INSERT INTO profiles (user_id,badges,banner_url,primary_color,accent_color,updated_at)
        VALUES (?,?,?,?,?,unixepoch()) ON CONFLICT(user_id) DO UPDATE SET badges=excluded.badges,banner_url=excluded.banner_url,
        primary_color=excluded.primary_color,accent_color=excluded.accent_color,updated_at=unixepoch()`)
        .bind(userId,JSON.stringify([...new Set(body.badges)]),body.bannerUrl,body.primaryColor,body.accentColor).run();

      return json({success:true,userId});
    }

    return json({error:"Not found"},404);
  }
};
