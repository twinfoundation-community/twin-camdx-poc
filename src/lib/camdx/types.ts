/**
 * Minimal local shape for a W3C Activity Streams 2.0 activity.
 * Mirrors the IActivity type from @twin.org/standards-w3c-activity-streams so
 * we can wire the typed package in later without changing call sites.
 */
export interface IActivity {
  "@context": string | string[] | Record<string, unknown>;
  type: "Add" | "Update" | "Remove" | "Create" | string;
  actor: { id: string } | string;
  object: Record<string, unknown>;
  updated?: string;
  published?: string;
}

export const ACTIVITY_STREAMS_CONTEXT = "https://www.w3.org/ns/activitystreams";

/**
 * Captured fields from an inbound X-Road REST envelope that survived into our
 * inbound handler. We carry them through as Activity Streams metadata so the
 * downstream consumer can audit provenance.
 */
export interface CamdxEnvelopeMetadata {
  client: string;
  service?: string;
  messageId: string;
  userId?: string;
  issue?: string;
  requestHash?: string;
  receivedAt: string;
}
