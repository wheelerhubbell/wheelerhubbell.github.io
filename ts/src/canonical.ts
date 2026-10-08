import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { StandingError } from "./errors.js";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** WHP-JCS-I1: RFC 8785 over an I-JSON subset. Safe integers only; decimals are strings. */
export function canonical(x: unknown, depth = 0): string {
  if (depth > 64) throw new StandingError("INVALID_INPUT", "JSON too deep");
  if (x === null) return "null";
  if (typeof x === "boolean") return x ? "true" : "false";
  if (typeof x === "number") {
    if (!Number.isSafeInteger(x) || Object.is(x, -0)) throw new StandingError("INVALID_INPUT", "Only safe integers are allowed; send decimals as strings");
    return String(x);
  }
  if (typeof x === "string") {
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(x)) throw new StandingError("INVALID_INPUT", "Invalid Unicode in string");
    return JSON.stringify(x);
  }
  if (Array.isArray(x)) return "[" + x.map((v) => canonical(v, depth + 1)).join(",") + "]";
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return "{" + Object.keys(o).sort().map((k) => canonical(k, depth + 1) + ":" + canonical(o[k], depth + 1)).join(",") + "}";
  }
  throw new StandingError("INVALID_INPUT", "Unsupported JSON value");
}
export const sha256Hex = (b: Uint8Array | string): string => bytesToHex(sha256(typeof b === "string" ? utf8ToBytes(b) : b));
export const hashCanonical = (x: unknown): string => sha256Hex(canonical(x));
