import { fetchPoster } from "./poster-source";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BUCKET = "subnexa-library";
const MAX = 2 * 1024 * 1024;
type Context = { params: Promise<{ path: string[] }> };
type Item = { content_sha256?: string | null; genre?: string | null; id: string; title: string; year: string; language: string; format: "srt" | "ass"; poster_type: string; downloads: number; translated_by?: string | null; kind?: "movie" | "season"; season_key?: string | null; season_slug?: string | null; series_title?: string | null; season_number?: number | null; episode_number?: number | null; episode_count?: number; file_count?: number };
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, "Subtitle library is not configured yet.");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new HttpError(503, "Invalid library server configuration.");
  return { url, key };
}
async function sb(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  const response = await fetch(url + path, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    console.error("Library storage/database request failed", response.status);
    throw new HttpError(503, "Library storage is temporarily unavailable. Please retry.");
  }
  return response;
}
async function rpc(name: string, data: object) {
  return sb(`/rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
function publicItem(item: Item) {
  return { id: item.id, title: item.title, year: item.year, language: item.language,
    season_slug: item.season_slug || null, kind: item.kind || "movie", season_key: item.season_key || null, series_title: item.series_title || null,
    season_number: item.season_number ?? null, episode_number: item.episode_number ?? null,
    episode_count: item.episode_count, file_count: item.file_count, genre: item.genre || null,
    format: item.format, downloads: item.downloads, translated_by: item.translated_by || null,
    poster_url: item.poster_type ? `/library/items/${item.id}/poster` : null,
    download_url: `/library/items/${item.id}/download` };
}
function verifyAdminProof(request: Request) {
  const token = request.headers.get("x-subnexa-admin-proof") || "";
  const secret = process.env.SUBNEXA_ADMIN_BRIDGE_SECRET || "";
  if (secret.length < 32 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    throw new HttpError(401, "Verify Google admin login first.");
  const [body, signature] = token.split(".");
  const actual = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try { provided = Buffer.from(signature, "base64url"); } catch { throw new HttpError(401, "Invalid admin proof."); }
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual))
    throw new HttpError(401, "Invalid admin proof.");
  let payload: { sub?: string; email?: string; verified?: boolean; iat?: number; aud?: string };
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); }
  catch { throw new HttpError(401, "Invalid admin proof."); }
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== "subnexa-vercel-admin-v1" || payload.verified !== true ||
      !payload.sub || !payload.email || !Number.isInteger(payload.iat) ||
      payload.iat! > now + 10 || now - payload.iat! > 90)
    throw new HttpError(401, "Expired or invalid admin proof.");
  const allowed = (process.env.SUBNEXA_ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(payload.email.toLowerCase())) throw new HttpError(403, "Admin access denied.");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test((payload as {state?:string}).state || "")) throw new HttpError(401, "Invalid admin proof state.");
  return payload as typeof payload & { state: string };
}
// Phase 3: short-lived, server-only session; the browser cannot read it.
const ADMIN_COOKIE = "subnexa_admin_v3";
const ADMIN_SESSION_SECONDS = 15 * 60;
function sessionSignature(body: string) {
  const secret = process.env.SUBNEXA_ADMIN_BRIDGE_SECRET || "";
  if (secret.length < 32) throw new HttpError(503, "Admin bridge not configured.");
  return createHmac("sha256", secret).update("admin-session-v3." + body).digest("base64url");
}
async function sessionCookie(request: Request) {
  const all = request.headers.get("cookie") || "";
  const raw = all.split(";").map(x => x.trim()).find(x => x.startsWith(ADMIN_COOKIE + "="))?.slice(ADMIN_COOKIE.length + 1) || "";
  const parts = raw.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1]))
    throw new HttpError(401, "Admin session expired. Unlock again.");
  const expected = Buffer.from(sessionSignature(parts[0]), "base64url");
  const supplied = Buffer.from(parts[1], "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
    throw new HttpError(401, "Invalid admin session.");
  let data: { sub?: string; email?: string; exp?: number; aud?: string; jti?: string };
  try { data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { throw new HttpError(401, "Invalid admin session."); }
  const now = Math.floor(Date.now() / 1000);
  const allowed = (process.env.SUBNEXA_ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (data.aud !== "subnexa-admin-session-v3" || !data.sub || !data.email || !/^[0-9a-f-]{36}$/.test(data.jti || "") ||
      !Number.isSafeInteger(data.exp) || data.exp! <= now || data.exp! > now + ADMIN_SESSION_SECONDS ||
      !allowed.includes(data.email.toLowerCase())) throw new HttpError(401, "Admin session expired. Unlock again.");
  // Revocation is checked from Supabase on every privileged request, across all Vercel instances.
  const hash = createHash("sha256").update("subnexa-admin-session-revoke-v1:" + data.jti).digest("hex");
  const rows = await (await sb(`/rest/v1/subnexa_admin_session_revocations?session_hash=eq.${hash}&select=session_hash&limit=1`)).json() as Array<{session_hash:string}>;
  if (rows.length) throw new HttpError(401, "Admin session revoked. Unlock again.");
  return data;
}
function issueSession(sub: string, email: string) {
  const body = Buffer.from(JSON.stringify({sub,email,jti:randomUUID(),aud:"subnexa-admin-session-v3",
    exp:Math.floor(Date.now()/1000) + ADMIN_SESSION_SECONDS})).toString("base64url");
  return `${ADMIN_COOKIE}=${body}.${sessionSignature(body)}; Path=/api/library; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_SESSION_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
async function consumeAdminProof(state: string) {
  // Unique hashed nonce in Supabase gives atomic at-most-once redemption across instances.
  // Database table and permissions are installed using PHASE3_SETUP.sql.
  const {url,key} = config();
  const nonceHash = createHash("sha256").update("subnexa-admin-proof-v3:" + state).digest("hex");
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/subnexa_admin_proof_consumptions`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: {apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json","Prefer":"return=minimal"},
      body: JSON.stringify({nonce_hash:nonceHash})
    });
  } catch { throw new HttpError(503, "Admin replay store unavailable. Retry verification."); }
  if (response.status === 409) throw new HttpError(401, "Admin proof already used. Verify again.");
  if (!response.ok) {
    console.error("Admin replay store unavailable",response.status);
    throw new HttpError(503, "Admin replay store unavailable. Apply Phase 3 SQL configuration.");
  }
}
async function admin(request: Request, exchange = false) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Untrusted origin.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Untrusted site.");
  const identity = exchange ? verifyAdminProof(request) : await sessionCookie(request);
  const expected = process.env.SUBNEXA_LIBRARY_ADMIN_KEY || "";
  if (expected.length < 12) throw new HttpError(503, "Library uploads are disabled. Configure the owner password on the server.");
  const supplied = request.headers.get("x-library-admin-key") || "";
  const digest = (s: string) => createHash("sha256").update(s).digest();
  const correct = supplied.length > 0 && timingSafeEqual(digest(supplied), digest(expected));
  // Vercel supplies this header. Local development shares a single throttle bucket.
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "unknown" : "local";
  const ipHash = createHmac("sha256", expected).update(ip).digest("hex");
  const allowed = await (await rpc("subnexa_library_admin_attempt", { ip_hash_arg: ipHash, correct })).json();
  if (allowed !== true) throw new HttpError(429, "Too many wrong passwords. Try again in 10 minutes.");
  if (!correct) throw new HttpError(403, "Wrong password.");
  if (exchange) await consumeAdminProof((identity as {state: string}).state);
  return identity;
}
function validId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(404, "Subtitle not found.");
  return id;
}
async function getItem(id: string): Promise<Item> {
  const rows = await (await sb(`/rest/v1/subnexa_library_items?id=eq.${validId(id)}&select=*&limit=1`)).json() as Item[];
  if (!rows.length) throw new HttpError(404, "Subtitle not found.");
  return rows[0];
}
function posterType(bytes: Uint8Array) {
  const hex = Buffer.from(bytes.subarray(0, 12));
  if (hex.subarray(0,3).equals(Buffer.from([255,216,255]))) return "jpg";
  if (hex.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (hex.toString("ascii",0,4) === "RIFF" && hex.toString("ascii",8,12) === "WEBP") return "webp";
  return "";
}
async function upload(path: string, bytes: ArrayBuffer, mime: string) {
  await sb(`/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { "Content-Type": mime, "x-upsert": "false" }, body: bytes });
}
async function removeObjects(paths: string[]) {
  if (paths.length) await sb(`/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: paths }) });
}
async function createItem(request: Request) {
  await admin(request);
  if (Number(request.headers.get("content-length") || 0) > 2 * MAX + 65536) throw new HttpError(413, "Upload is too large.");
  let form: FormData;
  try { form = await request.formData(); } catch { throw new HttpError(400, "Invalid upload form."); }
  const field = (name: string, fallback = "") => {
    const value = form.get(name);
    if (value !== null && typeof value !== "string") throw new HttpError(400, "Invalid text field.");
    return (value ?? fallback).trim();
  };
  let title = field("title");
  const year = field("year"), language = field("language", "Sinhala") || "Sinhala";
  const genre = field("genre");
  if (genre.length > 60) throw new HttpError(400, "Genre is too long.");
  if (!title || title.length > 120) throw new HttpError(400, "Title is required (max 120 characters).");
  if (year && !/^\d{4}$/.test(year)) throw new HttpError(400, "Year must be four digits.");
  if (language.length > 30) throw new HttpError(400, "Language is too long.");
  const file = form.get("subtitle"), poster = form.get("poster_image");
  if (!(file instanceof File)) throw new HttpError(400, "Subtitle file is required.");
  const format = file.name.toLowerCase().endsWith(".srt") ? "srt" : file.name.toLowerCase().endsWith(".ass") ? "ass" : null;
  if (!format) throw new HttpError(400, "Subtitle must be SRT or ASS.");
  if (file.size > MAX) throw new HttpError(413, "Subtitle is larger than 2 MB.");
  // Keep episode identity even when a poster search fills only the series name.
  const seasonInput = field("season_number"), episodeInput = field("episode_number");
  if (seasonInput || episodeInput) {
    if (!/^\d{1,2}$/.test(seasonInput) || !/^\d{1,3}$/.test(episodeInput))
      throw new HttpError(400, "Enter both season (0–99) and episode (0–999).");
    title = title.replace(/[ ._-]+s\d{1,2}[ ._-]*e\d{1,3}.*$/i, "").trim();
    title += ` S${seasonInput.padStart(2,"0")}E${episodeInput.padStart(2,"0")}`;
  } else if (!/[ ._-]+(?:s\d{1,2}[ ._-]*e\d{1,3}|\d{1,2}x\d{1,3})(?!\d)/i.test(title)) {
    const match = file.name.match(/(?:^|[ ._-])s(\d{1,2})[ ._-]*e(\d{1,3})(?!\d)/i)
      || file.name.match(/(?:^|[ ._-])(\d{1,2})x(\d{1,3})(?!\d)/i);
    if (match) title += ` S${match[1].padStart(2,"0")}E${match[2].padStart(2,"0")}`;
  }
  if (title.length > 120) throw new HttpError(400, "Use a shorter title to leave room for the episode number.");
  const bytes = await file.arrayBuffer();
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new HttpError(400, "Subtitle must be UTF-8."); }
  if (!text.includes(format === "srt" ? "-->" : "[Events]")) throw new HttpError(400, "Invalid subtitle format.");
  const fingerprint = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  const duplicates = await (await sb(`/rest/v1/subnexa_library_items?content_sha256=eq.${fingerprint}&select=id,title&limit=1`)).json() as {id:string; title:string}[];
  if (duplicates.length) throw new HttpError(409, `Identical subtitle already exists: ${duplicates[0].title}. Different subtitle versions remain allowed.`);
  let posterBytes: ArrayBuffer | null = null, posterKind = "";
  if (poster instanceof File && poster.name) {
    if (poster.size > MAX) throw new HttpError(413, "Poster is larger than 2 MB.");
    posterBytes = await poster.arrayBuffer();
    posterKind = posterType(new Uint8Array(posterBytes));
    if (!posterKind) throw new HttpError(400, "Poster must be JPG, PNG or WebP.");
  } else if (poster !== null && !(poster instanceof File)) throw new HttpError(400, "Invalid poster file.");
  const id = randomUUID();
  const paths: string[] = [];
  try {
    paths.push(`${id}/subtitle.${format}`);
    await upload(paths[0], bytes, "text/plain; charset=utf-8");
    if (posterBytes) {
      paths.push(`${id}/poster.${posterKind}`);
      await upload(paths[1], posterBytes, posterKind === "jpg" ? "image/jpeg" : `image/${posterKind}`);
    }
  } catch (error) {
    await removeObjects(paths).catch(() => console.error("Library upload cleanup needed", id));
    throw error;
  }
  const item: Item = { id, title, year, language, genre, content_sha256: fingerprint, format, poster_type: posterKind, downloads: 0 };
  // On an ambiguous DB timeout retain files: the INSERT might have committed.
  // Removing them could corrupt a successfully published item.
  await sb("/rest/v1/subnexa_library_items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
  return json(publicItem(item));
}
// Phase 4B: bounded read of request bytes, including chunked/missing-length bodies.
// Reads before any privileged action; avoids trusting Content-Length alone.
async function boundedRequest(request: Request): Promise<Request> {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return request;
  const type = request.headers.get('content-type') || '';
  const multipart = type.toLowerCase().startsWith('multipart/form-data');
  const limit = multipart ? 5 * 1024 * 1024 : 16 * 1024;
  const claimed = request.headers.get('content-length');
  if (claimed !== null && (!/^\d+$/.test(claimed) || Number(claimed) > limit))
    throw new HttpError(413, 'Request body exceeds security limit.');
  if (!request.body) return request;
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new HttpError(413, 'Request body exceeds security limit.');
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
  return new Request(request.url, { method: request.method, headers: request.headers, body, duplex: 'half' } as RequestInit & { duplex: 'half' });
}

async function handle(request: Request, context: Context) {
  try {
    request = await boundedRequest(request);
    const { path } = await context.params;
    const route = path.join("/");
    if (request.method === "POST" && route === "poster/import") {
      await admin(request);
      if (Number(request.headers.get("content-length") || 0) > 4096) throw new HttpError(413, "Image link request is too large.");
      const body = await request.json().catch(() => null);
      if (!body || typeof body.url !== "string") throw new HttpError(400, "Enter an image link.");
      let bytes: Buffer;
      try { bytes = await fetchPoster(body.url.trim()); }
      catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "Could not import poster."); }
      const kind = posterType(bytes);
      if (!kind) throw new HttpError(400, "Link must point to a JPG, PNG or WebP image, not a webpage.");
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": kind === "jpg" ? "image/jpeg" : `image/${kind}`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    if (request.method === "GET" && route === "posters/search") {
      await admin(request);
      const q = (new URL(request.url).searchParams.get("q") || "").trim();
      if (q.length < 2 || q.length > 120) throw new HttpError(400, "Enter 2–120 characters to search.");
      const token = process.env.TMDB_READ_ACCESS_TOKEN;
      if (!token) throw new HttpError(503, "Poster search is not configured. You can still choose, paste or drop an image.");
      const response = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(10000), cache: "no-store"
      });
      if (!response.ok) throw new HttpError(503, "Poster search is temporarily unavailable. Check the server TMDB token.");
      type Match = { id: number; media_type: string; title?: string; name?: string; poster_path?: string; release_date?: string; first_air_date?: string };
      const data = await response.json() as { results?: Match[] };
      const results = (data.results || []).filter(x => ["movie","tv"].includes(x.media_type) && /^\/[a-zA-Z0-9]+\.(jpg|png)$/.test(x.poster_path || "")).slice(0,8).map(x => ({
        id: x.id, type: x.media_type, title: x.title || x.name || "Untitled",
        year: (x.release_date || x.first_air_date || "").slice(0,4),
        poster_url: `https://image.tmdb.org/t/p/w500${x.poster_path}`
      }));
      return json({ results });
    }
    if (request.method === "GET" && ["admin/users", "admin/users/online", "admin/users/stats"].includes(route)) {
      await admin(request);
      const backend = (process.env.SUBNEXA_BACKEND_URL || "https://subnexa-backend-x7qa.onrender.com").replace(/\/$/, "");
      const target = new URL(backend);
      if (target.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(target.hostname))) throw new HttpError(503, "Invalid backend configuration.");
      const query = new URL(request.url).search;
      const response = await fetch(`${backend}/${route}${query}`, {
        headers: {cookie: request.headers.get("cookie") || "", "X-Library-Admin-Key": request.headers.get("x-library-admin-key") || ""},
        cache: "no-store", signal: AbortSignal.timeout(20000), redirect: "error"
      });
      const result = await response.json().catch(() => ({detail:"User directory unavailable."}));
      return json(result, response.status);
    }
    if (route === "admin/live-users" && request.method === "GET") {
      await admin(request); // existing Google-admin session + password checks
      const response = await rpc("subnexa_presence_stats_v1", {});
      return json(await response.json());
    }
    if (route === "admin/requests" && request.method === "GET") {
      await admin(request);
      // select=* works whatever columns the table has; only the fields below are returned.
      const rows = await (await sb("/rest/v1/subnexa_issue_reviews?select=*&order=created_at.desc&limit=200")).json() as Array<Record<string, unknown>>;
      return json({items: rows.map(r => ({id:r.id,title:r.title,details:r.details,status:r.status,admin_note:r.admin_note ?? null,created_at:r.created_at,kind:typeof r.kind === "string" ? r.kind : null}))});
    }
    if (route === "admin/reports" && request.method === "GET") {
      await admin(request);
      const reports = await (await sb("/rest/v1/subnexa_issue_reviews?select=id,title,details,status,admin_note,created_at,updated_at&order=created_at.desc&limit=100")).json();
      return json({items:reports});
    }
    if (path[0] === "admin" && path[1] === "reports" && path.length === 3 && request.method === "PATCH") {
      await admin(request);
      const body = await request.json().catch(()=>null);
      if (!body || !["pending","in_progress","resolved","rejected"].includes(body.status) || typeof body.admin_note !== "string" || body.admin_note.length > 1000) throw new HttpError(400,"Invalid review update.");
      const updated = await sb(`/rest/v1/subnexa_issue_reviews?id=eq.${validId(path[2])}`, {method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=representation"},body:JSON.stringify({status:body.status,admin_note:body.admin_note,updated_at:new Date().toISOString()})});
      return json({items:await updated.json()});
    }
    if (route === "community/queue" && request.method === "GET") {
      await admin(request);
      const rows = await (await sb("/rest/v1/subnexa_community_subtitles?select=id,title,year,format,status,created_at,admin_note&order=created_at.desc&limit=100")).json();
      return json({items:rows});
    }
    if (route.startsWith("community/preview/") && request.method === "GET") {
      await admin(request);
      const sid = validId(path[2]);
      const rows = await (await sb(`/rest/v1/subnexa_community_subtitles?id=eq.${sid}&select=id,format,status&limit=1`)).json() as Array<{id:string;format:string;status:string}>;
      if (!rows.length || rows[0].status !== "pending") throw new HttpError(404,"Pending submission not found.");
      const res = await sb(`/storage/v1/object/authenticated/${BUCKET}/community-pending/${sid}/subtitle.${rows[0].format}`);
      const bytes = await res.arrayBuffer();
      return new Response(bytes,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`attachment; filename="community_review.${rows[0].format}"`}});
    }
    if (route.startsWith("community/review/") && request.method === "POST") {
      await admin(request);
      const submissionId = validId(path[2]);
      const body = await request.json().catch(() => null);
      if (!body || !["approved","rejected"].includes(body.status) || typeof body.note !== "string" || body.note.length > 500)
        throw new HttpError(400,"Invalid moderation request.");
      const list = await (await sb(`/rest/v1/subnexa_community_subtitles?id=eq.${submissionId}&select=*&limit=1`)).json() as Array<{id:string;title:string;year:string;format:"srt"|"ass";status:string;content_sha256:string}>;
      if (!list.length || list[0].status !== "pending") throw new HttpError(409,"Submission is not pending.");
      const item = list[0];
      if (body.status === "rejected") {
        await sb(`/rest/v1/subnexa_community_subtitles?id=eq.${submissionId}&status=eq.pending`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"rejected",admin_note:body.note,updated_at:new Date().toISOString()})});
        return json({status:"rejected"});
      }
      const prior = await (await sb(`/rest/v1/subnexa_library_items?content_sha256=eq.${item.content_sha256}&select=id&limit=1`)).json() as Array<{id:string}>;
      if (prior.length) throw new HttpError(409,"Identical subtitle is already published.");
      const original = await sb(`/storage/v1/object/authenticated/${BUCKET}/community-pending/${submissionId}/subtitle.${item.format}`);
      const bytes = await original.arrayBuffer();
      if (createHash("sha256").update(Buffer.from(bytes)).digest("hex") !== item.content_sha256) throw new HttpError(409,"Content hash mismatch.");
      // Stable ID, so retrying after a partial write cannot publish extra copies.
      const destination = `${submissionId}/subtitle.${item.format}`;
      try { await upload(destination,bytes,"text/plain; charset=utf-8"); }
      catch {
        const check = await sb(`/storage/v1/object/authenticated/${BUCKET}/${destination}`);
        if (createHash("sha256").update(Buffer.from(await check.arrayBuffer())).digest("hex") !== item.content_sha256)
          throw new HttpError(409,"Published object conflict.");
      }
      // Unique SHA-256 database constraint protects racing publications.
      await sb("/rest/v1/subnexa_library_items?on_conflict=id",{method:"POST",headers:{"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates"},body:JSON.stringify({id:submissionId,title:item.title,year:item.year,language:"Sinhala",format:item.format,poster_type:"",downloads:0,content_sha256:item.content_sha256,translated_by:"Community contributor"})});
      await sb(`/rest/v1/subnexa_community_subtitles?id=eq.${submissionId}&status=eq.pending`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"approved",published_item_id:submissionId,admin_note:body.note,updated_at:new Date().toISOString()})});
      return json({status:"approved",item_id:submissionId});
    }
    if (request.method === "POST" && route === "admin/check") {
      const identity = await admin(request, true);
      const response = json({ ok: true });
      response.headers.set("Set-Cookie", issueSession(identity.sub!, identity.email!));
      return response;
    }
    if (request.method === "POST" && route === "admin/logout") {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) throw new HttpError(403,"Untrusted origin.");
      if (request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403,"Untrusted site.");
      // If a valid session is present, revoke it BEFORE telling the browser logout succeeded.
      // A failed database write fails closed rather than claiming server-side logout.
      const cookie = request.headers.get("cookie") || "";
      if (cookie.split(";").some(x=>x.trim().startsWith(ADMIN_COOKIE+"="))) {
        const identity = await sessionCookie(request);
        const hash = createHash("sha256").update("subnexa-admin-session-revoke-v1:" + identity.jti).digest("hex");
        await sb("/rest/v1/subnexa_admin_session_revocations?on_conflict=session_hash", {
          method:"POST",headers:{"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"},
          body:JSON.stringify({session_hash:hash, expires_at:new Date(identity.exp! * 1000).toISOString()})
        });
      }
      const response = json({ok:true});
      response.headers.set("Set-Cookie", `${ADMIN_COOKIE}=; Path=/api/library; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
      return response;
    }
    if (route === "items" && request.method === "POST") return await createItem(request);
    if (route === "items" && request.method === "GET") {
      const url = new URL(request.url);
      const query = (url.searchParams.get("q") || "").trim();
      const limit = Number(url.searchParams.get("limit") || 60);
      if (query.length > 80 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new HttpError(400, "Invalid search query or limit.");
      const rows = await (await rpc("subnexa_library_search", { query_text: query, result_limit: limit })).json() as Item[];
      return json({ items: rows.map(publicItem) });
    }
    if (request.method === "GET" && (route === "browse" || (path[0] === "seasons" && path.length === 2))) {
      const url = new URL(request.url);
      const offset = Number(url.searchParams.get("offset") || 0);
      const query = (url.searchParams.get("q") || "").trim();
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000 || query.length > 80)
        throw new HttpError(400, "Invalid page or search.");
      const isSeason = route !== "browse";
      if (isSeason && !/^[a-z0-9][a-z0-9-]{0,199}$/.test(path[1])) throw new HttpError(404, "Season not found.");
      const year = (url.searchParams.get("year") || "").trim();
      const genre = (url.searchParams.get("genre") || "").trim();
      const language = (url.searchParams.get("language") || "").trim();
      const sort = (url.searchParams.get("sort") || "newest").trim();
      if (year.length > 4 || genre.length > 60 || language.length > 30 || !["newest","oldest","title","year"].includes(sort))
        throw new HttpError(400, "Invalid browse filters.");
      const data = await (await rpc(isSeason ? "subnexa_library_season_url_v1" : "subnexa_library_browse_filtered_v2",
        isSeason ? {p_key: path[1], p_offset: offset, p_limit: 60} : {
          p_query: query, p_year: year, p_genre: genre, p_language: language, p_sort: sort, p_offset: offset, p_limit: 60
        })).json();
      if (isSeason && !data.total) throw new HttpError(404, "No subtitles are available for this season.");
      return json({...data, items: (data.items as Item[]).map(publicItem)});
    }
    if (path[0] !== "items" || !path[1] || path.length > 3) throw new HttpError(404, "Not found.");
    // SubNexa poster update v1: overwrite only the poster; never touch subtitle objects or counters.
    if (request.method === "PATCH" && path[0] === "items" && path.length === 3 && path[2] === "poster") {
      await admin(request);
      const item = await getItem(path[1]);
      if (Number(request.headers.get("content-length") || 0) > MAX + 65536) throw new HttpError(413, "Poster is larger than 2 MB.");
      let form: FormData;
      try { form = await request.formData(); } catch { throw new HttpError(400, "Invalid poster upload."); }
      const image = form.get("poster_image");
      if (!(image instanceof File) || !image.name || image.size < 1 || image.size > MAX)
        throw new HttpError(400, "Choose a JPG, PNG or WebP poster up to 2 MB.");
      const bytes = new Uint8Array(await image.arrayBuffer());
      const kind = posterType(bytes);
      if (!kind) throw new HttpError(400, "Poster must be a JPG, PNG or WebP image.");
      const currentPath = item.poster_type ? `${item.id}/poster.${item.poster_type}` : "";
      const nextPath = `${item.id}/poster.${kind}`;
      // Upsert keeps a stable URL while supporting same-format replacements.
      await sb(`/storage/v1/object/${BUCKET}/${nextPath}`, {
        method: "POST", headers: { "Content-Type": kind === "jpg" ? "image/jpeg" : `image/${kind}`, "x-upsert": "true" }, body: bytes
      });
      await sb(`/rest/v1/subnexa_library_items?id=eq.${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify({ poster_type: kind })
      });
      if (currentPath && currentPath !== nextPath) await removeObjects([currentPath]).catch(() => console.error("Old poster cleanup pending", item.id));
      return json({ ok: true, poster_url: `/library/items/${item.id}/poster`, cache_version: Date.now() });
    }
    /* SUBNEXA_RENAME_V1: change only the title of one library item. */
    if (request.method === "PATCH" && path.length === 2) {
      await admin(request);
      const item = await getItem(path[1]);
      const body = await request.json().catch(() => null);
      const title = body && typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 120 || /[\x00-\x1f\x7f]/.test(title)) throw new HttpError(400, "Title must be 1-120 characters with no control characters.");
      await sb(`/rest/v1/subnexa_library_items?id=eq.${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify({ title })
      });
      return json({ ok: true, id: item.id, title });
    }
    if (request.method === "DELETE" && path.length === 2) {
      await admin(request);
      const item = await getItem(path[1]);
      // Hide the item first. A failed object cleanup leaves only private orphans.
      await sb(`/rest/v1/subnexa_library_items?id=eq.${item.id}`, { method: "DELETE" });
      await removeObjects([`${item.id}/subtitle.${item.format}`, ...(item.poster_type ? [`${item.id}/poster.${item.poster_type}`] : [])])
        .catch(() => console.error("Library delete cleanup needed", item.id));
      return json({ deleted: item.id });
    }
    /* SUBNEXA_FILM_PAGE_V1: public details of one library item (used by the film page). */
    if (request.method === "GET" && path.length === 2) return json({ item: publicItem(await getItem(path[1])) });
    if (request.method !== "GET" || !["poster", "download"].includes(path[2])) throw new HttpError(404, "Not found.");
    const item = await getItem(path[1]);
    const isPoster = path[2] === "poster";
    if (isPoster && !item.poster_type) throw new HttpError(404, "Poster not found.");
    const object = `${item.id}/${isPoster ? `poster.${item.poster_type}` : `subtitle.${item.format}`}`;
    const response = await sb(`/storage/v1/object/authenticated/${BUCKET}/${object}`);
    const bytes = await response.arrayBuffer();
    const headers = new Headers({ "X-Content-Type-Options": "nosniff", "Cache-Control": isPoster ? "public, max-age=3600" : "no-store" });
    headers.set("Content-Type", isPoster ? (item.poster_type === "jpg" ? "image/jpeg" : `image/${item.poster_type}`) : "text/plain; charset=utf-8");
    if (!isPoster) {
      const stem = item.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,"_").replace(/^[ .]+|[ .]+$/g, "") || "subtitles";
      const name = encodeURIComponent(`${stem}_sinhala_by_subnexa_ai.${item.format}`).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      headers.set("Content-Disposition", `attachment; filename="subnexa.${item.format}"; filename*=UTF-8''${name}`);
      await rpc("subnexa_library_count_download", { item_id: item.id }).catch(() => console.error("Library download count update failed"));
    }
    return new Response(bytes, { headers });
  } catch (error) {
    if (error instanceof HttpError) return json({ detail: error.message }, error.status);
    console.error("Library request failed", error instanceof Error ? error.name : "UnknownError");
    return json({ detail: "Library temporarily unavailable. Please retry." }, 503);
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const PATCH = handle;
