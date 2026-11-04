/* ──────────────────────────────────────────────
   解锁 token — 独立于后台 JWT 的域分离签名
   - 不能直接复用 JWT_SECRET 签 JWT：/api/admin/* 只验签名，
     读者 token 会顺带获得后台权限。
   - token 里携带密码哈希指纹，改密后旧 token 立即失效。
   ────────────────────────────────────────────── */

import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { ContentLockKind, PostLock } from "../storage/interfaces";

export const UNLOCK_COOKIE = "monolith_unlock";
const TOKEN_PREFIX = "mu1";
const TOKEN_VERSION = 1;
const MAX_GRANTS = 16;
const DEFAULT_TTL_HOURS = 12;

export type UnlockGrant = {
  k: ContentLockKind;
  v: string;
  f: string;
};

type UnlockPayload = {
  v: number;
  exp: number;
  g: UnlockGrant[];
};

type UnlockEnv = {
  UNLOCK_SECRET?: string;
  JWT_SECRET?: string;
  UNLOCK_TTL_HOURS?: string;
};

const keyCache = new Map<string, Promise<CryptoKey>>();

export function getUnlockSecret(env: UnlockEnv): string {
  return (env.UNLOCK_SECRET || env.JWT_SECRET || "").trim();
}

export function resolveUnlockTtlSeconds(env: UnlockEnv): number {
  const hours = Number.parseInt(env.UNLOCK_TTL_HOURS || "", 10);
  const safeHours = Number.isFinite(hours)
    ? Math.min(168, Math.max(1, Math.trunc(hours)))
    : DEFAULT_TTL_HOURS;
  return safeHours * 3600;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/")
      + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function getHmacKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const promise = (async () => {
    // 域分离：即使 UNLOCK_SECRET 回退到 JWT_SECRET，签名 key 也与后台 JWT 不同。
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`monolith-unlock-token-v1:${secret}`)
    );
    return crypto.subtle.importKey(
      "raw",
      digest,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  })();
  keyCache.set(secret, promise);
  return promise;
}

export function grantKey(grant: Pick<UnlockGrant, "k" | "v">): string {
  return `${grant.k}:${grant.v}`;
}

export function dedupeGrants(grants: UnlockGrant[]): UnlockGrant[] {
  const map = new Map<string, UnlockGrant>();
  for (const grant of grants) {
    if (!grant || typeof grant.k !== "string" || typeof grant.v !== "string") continue;
    if (!["post", "tag", "category", "series"].includes(grant.k)) continue;
    if (!grant.v || typeof grant.f !== "string" || !grant.f) continue;
    map.set(grantKey(grant), grant);
    if (map.size >= MAX_GRANTS) break;
  }
  return [...map.values()];
}

export async function createUnlockToken(
  grants: UnlockGrant[],
  secret: string,
  ttlSeconds: number
): Promise<string> {
  const payload: UnlockPayload = {
    v: TOKEN_VERSION,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    g: dedupeGrants(grants),
  };
  const payloadPart = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${TOKEN_PREFIX}.${payloadPart}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getHmacKey(secret),
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyUnlockToken(
  token: string,
  secret: string
): Promise<UnlockGrant[] | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;

  const signature = fromBase64Url(parts[2]);
  if (!signature) return null;

  const signingInput = `${parts[0]}.${parts[1]}`;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await getHmacKey(secret),
    signature,
    new TextEncoder().encode(signingInput)
  );
  if (!valid) return null;

  const payloadBytes = fromBase64Url(parts[1]);
  if (!payloadBytes) return null;

  let payload: UnlockPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as UnlockPayload;
  } catch {
    return null;
  }

  if (payload.v !== TOKEN_VERSION) return null;
  if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (!Array.isArray(payload.g) || payload.g.length > MAX_GRANTS) return null;

  return dedupeGrants(payload.g);
}

export function readUnlockProof(c: Context): string {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer mu1.")) return auth.slice("Bearer ".length).trim();
  return getCookie(c, UNLOCK_COOKIE) || "";
}

export function setUnlockCookie(c: Context, token: string, maxAge: number): void {
  setCookie(c, UNLOCK_COOKIE, token, {
    path: "/api",
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    maxAge,
  });
}

export function clearUnlockCookie(c: Context): void {
  deleteCookie(c, UNLOCK_COOKIE, { path: "/api" });
}

/** 当前 token 是否满足某个锁（kind + key + 密码指纹都匹配）。 */
export function grantsSatisfyLock(grants: UnlockGrant[], lock: PostLock, fingerprint: string): boolean {
  return grants.some((grant) =>
    grant.k === lock.kind && grant.v === lock.key && grant.f === fingerprint
  );
}
