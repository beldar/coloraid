import { describe, it, expect, afterEach } from "vitest";
import { uid } from "@/lib/util/id";

const realCrypto = globalThis.crypto;
afterEach(() => {
  Object.defineProperty(globalThis, "crypto", { value: realCrypto, configurable: true });
});

describe("uid()", () => {
  it("generates unique non-empty ids", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = uid();
      expect(id).toBeTruthy();
      expect(id).not.toContain(" ");
      seen.add(id);
    }
    expect(seen.size).toBe(1000);
  });

  it("works without crypto.randomUUID (non-secure context, e.g. phone on LAN http)", () => {
    // Simulate the mobile bug: randomUUID missing, only getRandomValues present.
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) },
      configurable: true,
    });
    const id = uid();
    expect(id).toMatch(/^[0-9a-f-]{30,}$/);
  });

  it("falls back even with no crypto at all", () => {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    expect(uid()).toBeTruthy();
  });
});
