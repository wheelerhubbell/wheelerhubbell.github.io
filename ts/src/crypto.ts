import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, utf8ToBytes, randomBytes, concatBytes } from "@noble/hashes/utils";
import { canonical, sha256Hex } from "./canonical.js";
import { StandingError } from "./errors.js";

const SPKI_ED25519_PREFIX = hexToBytes("302a300506032b6570032100");
const b64 = (b: Uint8Array): string => Buffer.from(b).toString("base64");

/** Ed25519 buyer identity used for the WHP client proof and the submission's buyer_key. */
export class BuyerKey {
  readonly #seed: Uint8Array;
  readonly publicKeyDer: string; // base64 SPKI DER, as the service expects in buyer_key
  readonly keyId: string;
  private constructor(seed: Uint8Array) {
    this.#seed = seed;
    const pub = ed25519.getPublicKey(seed);
    const der = concatBytes(SPKI_ED25519_PREFIX, pub);
    this.publicKeyDer = b64(der);
    this.keyId = sha256Hex(der);
  }
  static generate(): BuyerKey { return new BuyerKey(ed25519.utils.randomPrivateKey()); }
  static fromSeedHex(hex: string): BuyerKey {
    const h = hex.replace(/^0x/, "");
    if (!/^[0-9a-fA-F]{64}$/.test(h)) throw new StandingError("INVALID_INPUT", "Buyer seed must be 32 bytes of hex");
    return new BuyerKey(hexToBytes(h));
  }
  exportSeedHex(): string { return bytesToHex(this.#seed); }
  /** Seal an envelope: {protected, payload, signature} over WHP-JCS-I1 bytes. */
  seal(type: string, payload: unknown): { protected: Record<string, string>; payload: unknown; signature: string } {
    const prot = { type, algorithm: "Ed25519", canonicalization: "WHP-JCS-I1", key_id: this.keyId };
    const sig = ed25519.sign(utf8ToBytes(canonical({ protected: prot, payload })), this.#seed);
    return { protected: prot, payload, signature: b64(sig) };
  }
  /** Value for the whp-client-proof header. */
  clientProof(method: string, path: string, body: string, nowSec: number): string {
    const payload = {
      method, path, body_hash: sha256Hex(body), issued_at: nowSec, expires_at: nowSec + 120,
      nonce: bytesToHex(randomBytes(16)),
    };
    return b64(utf8ToBytes(canonical(this.seal("WHP-CLIENT-PROOF-v1", payload))));
  }
}

export interface TransferAuthorization {
  from: string; to: string; value: string; validAfter: string; validBefore: string; nonce: string;
}
export interface Eip712Domain { name: string; version: string; chainId: string; verifyingContract: string }

const k = (s: string) => keccak_256(utf8ToBytes(s));
const p32 = (n: string | bigint) => hexToBytes(BigInt(n).toString(16).padStart(64, "0"));
const a32 = (a: string) => hexToBytes(a.toLowerCase().replace(/^0x/, "").padStart(64, "0"));

export function eip3009Digest(domain: Eip712Domain, m: TransferAuthorization): Uint8Array {
  const ds = keccak_256(concatBytes(
    k("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    k(domain.name), k(domain.version), p32(domain.chainId), a32(domain.verifyingContract)));
  const sh = keccak_256(concatBytes(
    k("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"),
    a32(m.from), a32(m.to), p32(m.value), p32(m.validAfter), p32(m.validBefore), hexToBytes(m.nonce.replace(/^0x/, ""))));
  return keccak_256(concatBytes(new Uint8Array([0x19, 0x01]), ds, sh));
}

export function addressOf(privateKeyHex: string): string {
  const pub = secp256k1.getPublicKey(hexToBytes(privateKeyHex.replace(/^0x/, "")), false).slice(1);
  return "0x" + bytesToHex(keccak_256(pub).slice(-20));
}

/** Gasless EIP-3009 TransferWithAuthorization signature (65 bytes, v = 27/28), deterministic (RFC 6979), low-s. */
export function signTransferAuthorization(privateKeyHex: string, domain: Eip712Domain, m: TransferAuthorization): string {
  try {
    const pk = hexToBytes(privateKeyHex.replace(/^0x/, ""));
    const sig = secp256k1.sign(eip3009Digest(domain, m), pk, { lowS: true });
    return "0x" + sig.toCompactHex() + (27 + sig.recovery).toString(16);
  } catch (e) {
    throw new StandingError("SIGNATURE_FAILED", "EIP-3009 signing failed: " + (e instanceof Error ? e.message : String(e)));
  }
}

export function recoverSigner(digest: Uint8Array, signature: string): string {
  const s = signature.replace(/^0x/, "");
  const v = parseInt(s.slice(128, 130), 16);
  const sig = secp256k1.Signature.fromCompact(s.slice(0, 128)).addRecoveryBit(v >= 27 ? v - 27 : v);
  return "0x" + bytesToHex(keccak_256(sig.recoverPublicKey(digest).toRawBytes(false).slice(1)).slice(-20));
}
