import { demand } from "./core.mjs";

export const BASE_NETWORK = "eip155:8453";
export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const DEFAULT_PAY_TO = "0x1050eddd8282623b0c263ed6bdbd42370bbc28d3";
export const CATALOG_VERSION = "1.0.1";
export const CATALOG_BUILD = "RESTORED-2026-09-22.1";

const DEFINITIONS = [
  ["claim-classifier", "WHP-DI-CC-001", "Claim Classifier", "50000", "0.050000 USDC", "WHP-DI-CC-001-v1.0.1-restored.zip", 4768, "e353c7314154acaec2e6b0c955b3b2c6c81cfdab015bd862e676c4064ca30ea8", "Classify what a claim actually asks before answering it."],
  ["return-the-burden", "WHP-DI-RB-001", "Return the Burden", "50001", "0.050001 USDC", "WHP-DI-RB-001-v1.0.1-restored.zip", 3954, "09eae59e6d3a740f802f2412c78f4393eded6ac50ff361c17867ba82dbf5a67e", "Assign each claim's proof burden and test whether it shifted."],
  ["audit-the-move", "WHP-DI-ATM-001", "Audit the Move", "100000", "0.100000 USDC", "WHP-DI-ATM-001-v1.0.1-restored.zip", 4072, "5cee6c8904a14e1c8e8137660a705cf437d6d31fa003913b1e46c1a008fc3cca", "Run the eleven-question panel against a consequential move."],
  ["limited-verdict", "WHP-DI-LV-001", "Limited Verdict", "100001", "0.100001 USDC", "WHP-DI-LV-001-v1.0.1-restored.zip", 3801, "48e8018c06496f76d3e18d82558f509005246129c5c93a1c87360ff68484e650", "Issue the strongest conclusion fully carried by the record."],
  ["response-auditor", "WHP-DI-RA-001", "Response Auditor", "300000", "0.300000 USDC", "WHP-DI-RA-001-v1.0.1-restored.zip", 6787, "675f7e4b9468008a09b69f520171b127ea8d8ffd5d7df3b76bf4c31583b8549d", "Audit request, authority, fidelity, burden, dependencies, repair, and verification."],
];

export const PRODUCT_DEFINITIONS = Object.freeze(Object.fromEntries(
  DEFINITIONS.map(([id, sku, name, amount, display_price, filename, size, artifact_sha256, description]) => [
    id,
    Object.freeze({
      id,
      sku,
      name,
      amount,
      display_price,
      filename,
      size,
      artifact_sha256,
      description,
      version: CATALOG_VERSION,
      build: CATALOG_BUILD,
      path: "/v1/products/" + id + "/artifact",
    }),
  ]),
));

function httpsUrl(value, code, { originOnly = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error(code); }
  demand(url.protocol === "https:" && !url.username && !url.password && !url.hash, code, 503);
  if (originOnly) demand(url.origin === value.replace(/\/$/u, "") && url.pathname === "/" && !url.search, code, 503);
  return originOnly ? url.origin : url.href.replace(/\/$/u, "");
}

export function paymentRequirements(payTo, amount) {
  demand(/^0x[0-9a-fA-F]{40}$/u.test(payTo), "CONFIG_PAY_TO_INVALID", 503);
  demand(/^[1-9][0-9]*$/u.test(amount), "CONFIG_AMOUNT_INVALID", 503);
  return Object.freeze({
    scheme: "exact",
    network: BASE_NETWORK,
    amount,
    asset: BASE_USDC,
    payTo: payTo.toLowerCase(),
    maxTimeoutSeconds: 300,
    extra: Object.freeze({
      assetTransferMethod: "eip3009",
      paymentFlow: "authorization",
      name: "USD Coin",
      version: "2",
    }),
  });
}

function required(env, name) {
  const value = env[name];
  demand(typeof value === "string" && value.length > 0, "CONFIG_" + name + "_REQUIRED", 503);
  return value;
}

export function runtimeConfiguration(env = process.env) {
  const origin = httpsUrl(required(env, "WHP_VENDING_ORIGIN"), "CONFIG_WHP_VENDING_ORIGIN_INVALID", { originOnly: true });
  const facilitatorUrl = httpsUrl(required(env, "WHP_FACILITATOR_URL"), "CONFIG_WHP_FACILITATOR_URL_INVALID");
  const rpcUrl = httpsUrl(required(env, "WHP_RPC_URL"), "CONFIG_WHP_RPC_URL_INVALID");
  const databaseUrl = required(env, "DATABASE_URL");
  let database;
  try { database = new URL(databaseUrl); } catch { demand(false, "CONFIG_DATABASE_URL_INVALID", 503); }
  demand(["postgres:", "postgresql:"].includes(database.protocol) && database.hostname && database.pathname.length > 1, "CONFIG_DATABASE_URL_INVALID", 503);
  const payTo = (env.WHP_VENDING_PAY_TO || DEFAULT_PAY_TO).toLowerCase();
  demand(payTo === DEFAULT_PAY_TO, "CONFIG_WHP_VENDING_PAY_TO_NOT_CANONICAL", 503);
  const port = env.PORT === undefined ? 8080 : Number(env.PORT);
  demand(Number.isSafeInteger(port) && port > 0 && port <= 65535, "CONFIG_PORT_INVALID", 503);
  const products = Object.fromEntries(Object.entries(PRODUCT_DEFINITIONS).map(([id, product]) => [
    id,
    { ...product, requirements: paymentRequirements(payTo, product.amount) },
  ]));
  const artifacts = Object.fromEntries(Object.keys(products).map((id) => {
    const key = "WHP_ARTIFACT_" + id.replaceAll("-", "_").toUpperCase() + "_B64";
    return [id, required(env, key)];
  }));
  return { origin, facilitatorUrl, rpcUrl, databaseUrl, payTo, port, products, artifacts };
}
