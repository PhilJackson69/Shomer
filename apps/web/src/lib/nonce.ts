export function cspNonce() {
  // Not cryptographically perfect but adequate for per-request nonces in Next headers()
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
}
