import type { RGB } from "@/lib/color/sampling";
import type { Lab } from "@/lib/color/describe";

/** A single physical paint in the user's palette. */
export interface Paint {
  id: string;
  name: string;
  rgb: RGB;
  /** Cached Lab so matching doesn't reconvert on every reading. */
  lab: Lab;
}
