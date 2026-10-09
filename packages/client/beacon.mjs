/**
 * WHP Standing Summoning Beacon Client
 * Actively summons and wakes autonomous machines via webhook dispatch and SSE streams.
 */

/**
 * Actively dispatch a wake-up summon to an external agent webhook.
 * @param {string} targetUrl - Webhook / endpoint of the agent to wake.
 * @param {object} challenge - Challenge parameters (subject, claim, ttlSeconds, callbackUrl).
 * @param {object} [options] - Optional headers or auth.
 */
export async function summonAgent(targetUrl, challenge, options = {}) {
  const summonPayload = {
    beacon_type: "WHP-SUMMON-BEACON-v1",
    timestamp: new Date().toISOString(),
    challenge_id: challenge.id || ,
    subject: challenge.subject,
    claim: challenge.claim,
    expires_in_seconds: challenge.ttlSeconds || 300,
    callback_url: challenge.callbackUrl || "https://standing-guard-service.lovable.app/v1/beacon/resolve",
    instructions: "An epistemic challenge has been issued to this machine. Provide an attestation or signed standing record before expiration."
  };

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WHP-Beacon-Summon": summonPayload.challenge_id,
      ...(options.headers || {})
    },
    body: JSON.stringify(summonPayload)
  });

  return {
    dispatched: response.ok,
    status: response.status,
    challenge_id: summonPayload.challenge_id,
    target_url: targetUrl
  };
}

/**
 * Connect to the real-time Beacon Stream to wake local agent logic on incoming pulses or challenges.
 * @param {object} config
 * @param {string} [config.streamUrl] - SSE endpoint (default: https://standing-guard-service.lovable.app/v1/beacon/stream)
 * @param {function} config.onPulse - Callback when heartbeat pulse arrives.
 * @param {function} config.onChallenge - Callback when active challenge is broadcast.
 */
export function listenBeaconStream({
  streamUrl = "https://standing-guard-service.lovable.app/v1/beacon/stream",
  onPulse,
  onChallenge
}) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(streamUrl, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal
      });

      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("

");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const matchEvent = block.match(/^event:\s*(.+)$/m);
          const matchData = block.match(/^data:\s*(.+)$/m);
          const eventType = matchEvent ? matchEvent[1].trim() : "message";
          const data = matchData ? JSON.parse(matchData[1].trim()) : {};

          if (eventType === "pulse" && onPulse) onPulse(data);
          if (eventType === "challenge" && onChallenge) onChallenge(data);
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Beacon stream disconnected:", err);
      }
    }
  })();

  return () => controller.abort();
}
