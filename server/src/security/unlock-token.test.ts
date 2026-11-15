import { describe, expect, it } from "vitest";
import {
  createUnlockToken,
  dedupeGrants,
  grantsSatisfyLock,
  verifyUnlockToken,
  type UnlockGrant,
} from "./unlock-token";

const SECRET = "test-unlock-secret-at-least-32-bytes-long";
const OTHER_SECRET = "another-test-secret-at-least-32-bytes-long";

const GRANT: UnlockGrant = { k: "post", v: "hello", f: "fingerprint" };

describe("unlock token", () => {
  it("round-trips grants", async () => {
    const token = await createUnlockToken([GRANT], SECRET, 60);
    expect(token.startsWith("mu1.")).toBe(true);
    await expect(verifyUnlockToken(token, SECRET)).resolves.toEqual([GRANT]);
  });

  it("rejects a wrong secret or tampered payload", async () => {
    const token = await createUnlockToken([GRANT], SECRET, 60);
    await expect(verifyUnlockToken(token, OTHER_SECRET)).resolves.toBeNull();

    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}x.${parts[2]}`;
    await expect(verifyUnlockToken(tampered, SECRET)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createUnlockToken([GRANT], SECRET, -1);
    await expect(verifyUnlockToken(token, SECRET)).resolves.toBeNull();
  });

  it("dedupes grants and caps invalid entries", () => {
    const grants = dedupeGrants([
      GRANT,
      { ...GRANT },
      { k: "tag", v: "frontend", f: "f2" },
      { k: "invalid" as UnlockGrant["k"], v: "x", f: "f3" },
      { k: "series", v: "", f: "f4" },
    ]);
    expect(grants).toHaveLength(2);
    expect(grants.map((grant) => `${grant.k}:${grant.v}`)).toEqual(["post:hello", "tag:frontend"]);
  });

  it("matches grants against lock kind, key and fingerprint", () => {
    const lock = { kind: "post" as const, key: "hello", passwordHash: "hash" };
    expect(grantsSatisfyLock([GRANT], lock, "fingerprint")).toBe(true);
    expect(grantsSatisfyLock([GRANT], lock, "other")).toBe(false);
    expect(grantsSatisfyLock([{ ...GRANT, k: "tag" }], lock, "fingerprint")).toBe(false);
  });
});
