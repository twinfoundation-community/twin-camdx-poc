import {
  ACTIVITY_STREAMS_CONTEXT,
  type CamdxEnvelopeMetadata,
  type IActivity,
} from "./types";

export interface TranslateInput {
  /** Parsed metadata from the inbound X-Road envelope (headers). */
  envelope: CamdxEnvelopeMetadata;
  /** The DID acting on behalf of the upstream system (e.g. CamDX provider). */
  actorDid: string;
  /** The JSON-LD object delivered by CamDX — citizen record, attestation, etc. */
  payload: Record<string, unknown>;
}

/**
 * Wrap a CamDX-delivered JSON-LD payload as a W3C Activity Streams `Add`
 * activity, ready for POST to a TWIN node's `/dataspace/notify` route.
 *
 * Pure function — no I/O, no side effects. Unit-testable in isolation.
 */
export function translateToActivity(input: TranslateInput): IActivity {
  const { envelope, actorDid, payload } = input;

  return {
    "@context": ACTIVITY_STREAMS_CONTEXT,
    type: "Add",
    actor: { id: actorDid },
    object: ensureActivityStreamsType(payload),
    updated: envelope.receivedAt,
  };
}

/**
 * Activity Streams 2.0 requires the activity's `object` to carry a `type`
 * field. JSON-LD payloads commonly use `@type` alone — mirror it onto `type`
 * so the activity passes Activity Streams schema validation without forcing
 * upstream systems to change their JSON-LD shape.
 */
function ensureActivityStreamsType(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof obj.type === "string" || Array.isArray(obj.type)) return obj;
  const ldType = obj["@type"];
  if (typeof ldType === "string" || Array.isArray(ldType)) {
    return { ...obj, type: ldType };
  }
  return obj;
}
