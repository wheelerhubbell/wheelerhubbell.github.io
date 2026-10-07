import http from "node:http";
import { createVendingService } from "./app.mjs";
import { createArtifactVault } from "./artifacts.mjs";
import { runtimeConfiguration } from "./config.mjs";
import { PaymentRail } from "./payment.mjs";
import { createPostgresStore } from "./store.mjs";

function incomingRequest(nodeRequest, origin) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeRequest.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else headers.set(name, value);
  }
  const hasBody = !["GET", "HEAD"].includes(nodeRequest.method ?? "GET");
  return new Request(new URL(nodeRequest.url || "/", origin), {
    method: nodeRequest.method,
    headers,
    ...(hasBody ? { body: nodeRequest, duplex: "half" } : {}),
  });
}

async function writeResponse(nodeResponse, response) {
  const headers = {};
  for (const [name, value] of response.headers) headers[name] = value;
  nodeResponse.writeHead(response.status, headers);
  if (!response.body) { nodeResponse.end(); return; }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!nodeResponse.write(Buffer.from(value))) await new Promise((resolve) => nodeResponse.once("drain", resolve));
  }
  nodeResponse.end();
}

export async function startServer(env = process.env) {
  const config = runtimeConfiguration(env);
  const store = await createPostgresStore(config.databaseUrl);
  const vault = createArtifactVault(config.products, config.artifacts);
  vault.verifyAll();
  const currentArtifacts = Object.values(config.products).map((product) => ({
    sha256: product.artifact_sha256,
    size: product.size,
    filename: product.filename,
    bytes_base64: vault.getByHash(product.artifact_sha256).toString("base64"),
  }));
  await store.retainArtifacts(currentArtifacts);
  for (const retained of await store.listArtifacts()) vault.retain(retained);
  const rail = new PaymentRail({ facilitatorUrl: config.facilitatorUrl, rpcUrl: config.rpcUrl });
  const service = createVendingService({ origin: config.origin, products: config.products, store, rail, vault });
  const server = http.createServer({ maxHeaderSize: 98_304 }, async (request, response) => {
    try { await writeResponse(response, await service.handle(incomingRequest(request, config.origin))); }
    catch {
      if (!response.headersSent) {
        response.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end('{"error":{"code":"SERVICE_UNAVAILABLE","retryable":true}}\n');
      } else response.destroy();
    }
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, "0.0.0.0", resolve);
  });
  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    await store.close();
  };
  return { server, service, close, config };
}

if (import.meta.url === "file://" + process.argv[1]) {
  const runtime = await startServer();
  console.log("WHP Vending autonomous runtime listening on " + runtime.config.port);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try { await runtime.close(); process.exitCode = 0; }
    catch { process.exitCode = 1; }
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
