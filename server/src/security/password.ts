/* ──────────────────────────────────────────────
   访问密码哈希 — Workers 原生 WebCrypto PBKDF2
   - 不依赖 Node 原生 bcrypt/argon2，也不引入纯 JS 慢实现
   - 版本化存储格式：pbkdf2-sha256$1$<iterations>$<salt>$<hash>
   - 验证时使用存储的迭代次数，调高默认值不会破坏旧哈希
   ────────────────────────────────────────────── */

export const DEFAULT_PBKDF2_ITERATIONS = 120_000;
export const MIN_PBKDF2_ITERATIONS = 10_000;
export const MAX_PBKDF2_ITERATIONS = 1_000_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const VERSION = 1;
const SCHEME = "pbkdf2-sha256";

export function resolvePbkdf2Iterations(env: { UNLOCK_PBKDF2_ITERATIONS?: string } | undefined): number {
  const raw = Number.parseInt(env?.UNLOCK_PBKDF2_ITERATIONS || "", 10);
  if (!Number.isFinite(raw)) return DEFAULT_PBKDF2_ITERATIONS;
  return Math.min(MAX_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, Math.trunc(raw)));
}

/** 密码原样参与哈希；拒绝空串和超长输入，不自动 trim。 */
export function normalizePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 1 || value.length > 256) return null;
  return value;
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

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // 哈希长度固定；长度不同直接判否不会泄露秘密相关时序。
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

export async function hashPassword(
  password: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): Promise<string> {
  const normalized = normalizePassword(password);
  if (!normalized) throw new Error("密码不能为空且不能超过 256 个字符");

  const safeIterations = Math.min(
    MAX_PBKDF2_ITERATIONS,
    Math.max(MIN_PBKDF2_ITERATIONS, Math.trunc(iterations))
  );
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derive(normalized, salt, safeIterations);

  return `${SCHEME}$${VERSION}$${safeIterations}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

type ParsedHash = {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
};

function parseHash(stored: string): ParsedHash | null {
  if (typeof stored !== "string") return null;
  const parts = stored.split("$");
  if (parts.length !== 5) return null;

  const [scheme, version, iterationText, saltText, hashText] = parts;
  if (scheme !== SCHEME || Number(version) !== VERSION) return null;

  const iterations = Number.parseInt(iterationText, 10);
  if (!Number.isFinite(iterations)
    || iterations < MIN_PBKDF2_ITERATIONS
    || iterations > MAX_PBKDF2_ITERATIONS) {
    return null;
  }

  const salt = fromBase64Url(saltText);
  const hash = fromBase64Url(hashText);
  if (!salt || !hash || salt.length < SALT_BYTES || hash.length !== KEY_BYTES) return null;

  return { iterations, salt, hash };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const normalized = normalizePassword(password);
  if (!normalized) return false;

  const parsed = parseHash(stored);
  if (!parsed) return false;

  const derived = await derive(normalized, parsed.salt, parsed.iterations);
  return timingSafeEqual(derived, parsed.hash);
}

/** 密码哈希指纹：写进解锁 token，改密后旧 token 自动失效。 */
export async function fingerprintPasswordHash(stored: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stored));
  return toBase64Url(new Uint8Array(digest).slice(0, 8));
}

/** 限流 key 的短哈希，避免把 IP / slug 明文写进日志或数据库。 */
export async function shortHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest).slice(0, 12));
}
