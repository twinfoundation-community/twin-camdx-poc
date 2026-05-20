/**
 * Local subclass that patches a single broken method in
 * `@twin.org/identity-rest-client@0.0.3-next.25`.
 *
 * Bug: `IdentityRestClient.verifiableCredentialCreate` builds the URL
 *   `POST /identity/:identity/verifiable-credential`
 * but the server route in `@twin.org/identity-service` is
 *   `POST /identity/:identity/verifiable-credential/:verificationMethodId`
 * (verified in `workspace/identity/packages/identity-service/src/identityRoutes.ts:332`).
 *
 * Result: every call returns `RestRouteProcessor.routeNotFound`. The neighbouring
 * `verifiableCredentialRevoke` / `verifiableCredentialUnrevoke` rest-client methods
 * DO include `:revocationIndex` correctly, so the issue is isolated to one method.
 *
 * Why subclass instead of raw fetch? Same pattern that `identity-mvp` uses in
 * `lib/services/identity-management-client.ts` to override three PATCH methods
 * with the same kind of upstream bug — keeps the typed-rest-client framework
 * intact and the rest of the call sites unchanged.
 *
 * Remove this file once a published rest-client emits the correct URL. The
 * referenced upstream issue, if it doesn't exist yet, should be filed against
 * `twinfoundation/identity`.
 */

import type { IBaseRestClientConfig } from "@twin.org/api-models";
import { IdentityRestClient } from "@twin.org/identity-rest-client";

type VerifiableCredentialCreateReturn = Awaited<
  ReturnType<IdentityRestClient["verifiableCredentialCreate"]>
>;
type Subject = Parameters<
  IdentityRestClient["verifiableCredentialCreate"]
>[2];
type Options = Parameters<IdentityRestClient["verifiableCredentialCreate"]>[3];

interface FetchableRestClient {
  // The protected `fetch` from BaseRestClient — typed loosely so we can call it
  // without re-deriving the full IHttpRequest/IHttpResponse generics here.
  fetch(
    route: string,
    method: "POST",
    request: { pathParams: Record<string, string>; body: unknown },
  ): Promise<{ body: VerifiableCredentialCreateReturn }>;
}

export class PatchedIdentityRestClient extends IdentityRestClient {
  constructor(config: IBaseRestClientConfig) {
    super(config);
  }

  /**
   * Identical signature to the upstream method, but emits the correct route
   * including `:verificationMethodId`.
   */
  public override async verifiableCredentialCreate(
    verificationMethodId: string,
    id: string | undefined,
    subject: Subject,
    options?: Options,
  ): Promise<VerifiableCredentialCreateReturn> {
    const hashIndex = verificationMethodId.lastIndexOf("#");
    if (hashIndex < 0) {
      throw new Error(
        `verificationMethodId must contain a '#' fragment: got ${verificationMethodId}`,
      );
    }
    const identity = verificationMethodId.slice(0, hashIndex);
    const fragment = verificationMethodId.slice(hashIndex + 1);

    // `fetch` is protected on the base class; cast through the local interface
    // rather than `any` to keep the typed surface.
    const self = this as unknown as FetchableRestClient;
    const response = await self.fetch(
      "/:identity/verifiable-credential/:verificationMethodId",
      "POST",
      {
        pathParams: { identity, verificationMethodId: fragment },
        body: {
          credentialId: id,
          subject,
          revocationIndex: options?.revocationIndex,
          expirationDate: options?.expirationDate?.toISOString(),
        },
      },
    );
    return response.body;
  }
}
