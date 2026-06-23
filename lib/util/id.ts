/**
 * Collision-resistant id that works in EVERY context.
 *
 * `crypto.randomUUID()` only exists in a *secure context* (HTTPS or localhost).
 * On a phone hitting the dev server over the LAN (http://192.168.x.x:3000) it is
 * undefined — which threw "crypto.randomUUID is not a function". This falls back
 * to `crypto.getRandomValues` (available over plain http) and finally to
 * Math.random, so ids are always generated.
 */
export function uid(): string {
  const c: Crypto | undefined =
    typeof crypto !== "undefined" ? crypto : undefined;

  if (c?.randomUUID) {
    return c.randomUUID();
  }

  if (c?.getRandomValues) {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    // RFC4122-ish v4 layout (not security-critical, just unique).
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
    return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h
      .slice(6, 8)
      .join("")}-${h.slice(8, 10).join("")}-${h.slice(10, 16).join("")}`;
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
