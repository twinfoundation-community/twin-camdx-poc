/**
 * IOTA Rebased testnet explorer link helpers. Mirrors the convention used
 * across other IOTA PoCs (see etd-demo-ui/components/BlockchainAnchors.tsx).
 */

const EXPLORER_BASE = "https://explorer.iota.org";
const NETWORK = "testnet";

export function explorerObjectUrl(objectId: string): string {
  return `${EXPLORER_BASE}/object/${objectId}?network=${NETWORK}`;
}

/**
 * Extract the on-chain object id from a DID. Returns null for malformed DIDs.
 * `did:iota:testnet:0xabc...` → `0xabc...`
 */
export function didToObjectId(did: string | undefined | null): string | null {
  if (!did) return null;
  const parts = did.split(":");
  const last = parts[parts.length - 1];
  return last && last.startsWith("0x") ? last : null;
}

/**
 * Extract the NFT object id from a TWIN attestation URN.
 * `attestation:nft:<base64-of "nft:iota:testnet:<pkg>:<obj>">` → `<obj>`
 *
 * Returns null if the URN is malformed or the inner structure is unfamiliar.
 */
export function attestationUrnToObjectId(
  urn: string | undefined | null,
): string | null {
  if (!urn) return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(urn);
    } catch {
      return urn;
    }
  })();

  const prefix = "attestation:nft:";
  if (!decoded.startsWith(prefix)) return null;
  const b64 = decoded.slice(prefix.length);

  let inner: string;
  try {
    inner =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }

  const parts = inner.split(":");
  const last = parts[parts.length - 1];
  return last && last.startsWith("0x") ? last : null;
}
