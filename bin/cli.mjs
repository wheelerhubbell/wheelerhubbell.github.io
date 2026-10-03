#!/usr/bin/env node
import readline from 'readline';

const TARGET_ENDPOINT = process.env.WHP_STANDING_ENDPOINT || 'https://standing-guard-service.lovable.app/mcp';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const jsonReq = JSON.parse(line);
    
    const response = await fetch(TARGET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(jsonReq)
    });

    const bodyText = await response.text();
    // Forward JSON-RPC response back over stdout
    if (bodyText) {
      process.stdout.write(bodyText.trim() + '\n');
    }
  } catch (err) {
    const errResp = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: err.message || "Failed to communicate with Standing Witness service"
      }
    };
    process.stdout.write(JSON.stringify(errResp) + '\n');
  }
});
