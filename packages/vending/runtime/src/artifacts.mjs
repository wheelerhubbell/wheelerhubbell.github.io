import { demand, sha256 } from "./core.mjs";

export function createArtifactVault(products, encodedArtifacts) {
  const verifiedByProduct = new Map();
  const verifiedByHash = new Map();
  return {
    verifyAll() {
      for (const product of Object.values(products)) this.get(product.id);
      return true;
    },
    get(productId) {
      if (verifiedByProduct.has(productId)) return Buffer.from(verifiedByProduct.get(productId));
      const product = products[productId];
      demand(product, "PRODUCT_NOT_FOUND", 404);
      const encoded = encodedArtifacts[productId];
      demand(typeof encoded === "string" && /^[A-Za-z0-9+/]+={0,2}$/u.test(encoded) && encoded.length % 4 === 0, "ARTIFACT_ENCODING_INVALID", 503);
      const bytes = Buffer.from(encoded, "base64");
      demand(bytes.toString("base64") === encoded, "ARTIFACT_ENCODING_INVALID", 503);
      demand(bytes.length === product.size, "ARTIFACT_LENGTH_MISMATCH", 503);
      demand(sha256(bytes) === product.artifact_sha256, "ARTIFACT_HASH_MISMATCH", 503);
      verifiedByProduct.set(productId, Buffer.from(bytes));
      verifiedByHash.set(product.artifact_sha256, Buffer.from(bytes));
      return Buffer.from(bytes);
    },
    getByHash(hash) {
      if (!verifiedByHash.has(hash)) {
        const product = Object.values(products).find((candidate) => candidate.artifact_sha256 === hash);
        demand(product, "ARTIFACT_REVISION_UNAVAILABLE", 503);
        this.get(product.id);
      }
      return Buffer.from(verifiedByHash.get(hash));
    },
    retain({ sha256: hash, size, bytes_base64: encoded }) {
      demand(/^[0-9a-f]{64}$/u.test(hash) && Number.isSafeInteger(size) && size > 0, "ARTIFACT_REVISION_INVALID", 503);
      demand(typeof encoded === "string" && /^[A-Za-z0-9+/]+={0,2}$/u.test(encoded) && encoded.length % 4 === 0, "ARTIFACT_ENCODING_INVALID", 503);
      const bytes = Buffer.from(encoded, "base64");
      demand(bytes.toString("base64") === encoded && bytes.length === size && sha256(bytes) === hash, "ARTIFACT_REVISION_INVALID", 503);
      const existing = verifiedByHash.get(hash);
      demand(!existing || existing.equals(bytes), "ARTIFACT_REVISION_CONFLICT", 503);
      verifiedByHash.set(hash, Buffer.from(bytes));
      return true;
    },
  };
}
