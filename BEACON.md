# WHP Beacon transport

The existing beacon now has two bounded transport functions:

- `summonAgent(targetUrl, challenge)` sends the exact reviewed challenge to a caller-selected HTTPS webhook. The result includes HTTP status, response text and SHA256 of request bytes. HTTP acknowledgment does not prove an outside agent woke or completed work. Browser targets must allow the required CORS request. No automatic recipient discovery, payment or bounty occurs.
- `listenBeaconStream({onPulse, onError})` reads `https://standing-guard-service.lovable.app/v1/beacon/stream`. The existing service sends a liveness pulse immediately, then every 15 seconds, closing after four pulses. Reconnect to keep listening. Pulses are unsigned service-liveness data, not standing or completed challenge proof.

The page at `https://wheelerhubbell.github.io/beacon.html` keeps repository browsing separate from beacon controls. A direct summon requires target, subject and exact claim review before Send is enabled. Editing any field cancels that review. No callback endpoint is assumed; supply a callback only when one really exists.

## Reproduce

Import `packages/client/beacon.mjs` in Node 22+ or a modern browser. Use `node --check packages/client/beacon.mjs` for syntax. Verify real SSE events independently with `curl -N https://standing-guard-service.lovable.app/v1/beacon/stream`. The client returns an abort function with `.done` for stream completion/error.

Test receiving adapters must be explicitly labeled local. A synthetic fetch adapter proves exact client transport behavior, not delivery to an outside agent. Production acceptance separately checks the live stream from a cold downloaded client and the page controls.

## Not live

`contracts/StandingBeacon.sol` is unverified contract source, not evidence of a deployed bounty contract. No contract address, funded bounty, challenge registry, resolve service, external wake or completed work is claimed here.
