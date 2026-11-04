# Garmin signed ingress

This small relay carries the existing Garmin Starter PUSH bytes to the existing
Node handler. It does not add provider permissions, user consent, journal rights,
API scopes, AI permission, a new database, or an alternative queue. The original
Garmin migration and encrypted durable ingestion path are unchanged.

## Boundary

1. Garmin sends `POST /webhooks/garmin` directly to the configured Cloudflare
   Worker URL. The Worker requires Cloudflare runtime metadata, a canonical IPv4
   `CF-Connecting-IP` in the existing Garmin CIDRs, and no `CF-Worker`,
   `x-real-ip`, or browser `Origin` header. Do not chain another CDN, Worker,
   service binding, or user-controlled reverse proxy in front of this route.
2. The Worker reads at most **6,500,000 raw bytes**, without parsing health JSON.
   It generates a random 128-bit nonce and signs protocol version, key ID,
   audience, fixed POST/path, timestamp, nonce, verified IP, SHA-256 of the exact
   body, and optional Garmin client ID with a separate 256-bit HMAC-SHA256 key.
   Caller authorization, cookies, proxy headers and signatures are not forwarded.
3. Node's wrapper verifies the signature with `timingSafeEqual`, verifies the
   digest over the received raw bytes, checks the source CIDR again, and checks
   time both before and after body reading. Maximum age is 120 seconds; maximum
   future clock skew is 10 seconds. A bounded 10,000-entry nonce cache rejects
   repeat use and fails closed when full. It never evicts unexpired entries.
4. Only then does the wrapper replace `transport.peerAddress` with the verified
   source IP and call the existing Garmin handler, which repeats its existing
   CIDR/client-ID check and owns consent, epoch, permissions and durable enqueue.
   Signed mode denies a direct Node webhook request even if its source is in a
   Garmin range. Other API/internal routes retain their original authorization.
5. The Worker acknowledges only the Node handler's HTTP 200. It does not reflect
   upstream bodies, cookies, redirects or error details. The fixed origin fetch
   has a 20-second deadline, no credentials, no redirect following and no cache.

This authenticates the company's relay assertion about the network source; it
does not invent a Garmin payload signature. Nonce replay defense is local to a
Node process. Restart/overlapping-instance delivery duplication remains subject
to the existing encrypted queue's durable idempotency and lifecycle rules. A
legitimate provider retry gets a fresh nonce; no repeated HMAC is used for retry.

## Files and integration

- `worker.mjs`: portable Worker source, Web Crypto only.
- `worker-bundle.mjs`: generated single ES module for deployment; no secrets.
- `signed-ingress.mjs`: Node verifier and environment wrapper.
- `protocol.mjs`: exact canonical wire format and bounds.
- `../garmin-integration/delivery-source.mjs`: extracted existing CIDRs/predicate;
  `garmin-starter.mjs` keeps its previous public exports.

At the public deployment handler, wrap the already-created runtime once:

```js
import {signedGarminIngressFromEnvironment} from '../garmin-ingress/signed-ingress.mjs';
const ingressHandler = signedGarminIngressFromEnvironment(runtime.handler, env);
// For the public Garmin route, use ingressHandler(request, transport).
// Keep account-gateway and internal loopback routing as before.
```

The wrapper only intervenes on `/webhooks/garmin`; query strings and other
methods fail. `DIRECT` or an unset mode retains the existing TCP-source path for
other deployments. On this Render deployment, enable `CLOUDFLARE_SIGNED_V1`;
do not configure an arbitrary Render/Cloudflare IP as a legacy trusted proxy.
Any nonempty unknown mode or incomplete signed-mode configuration fails startup.

| Setting | Node | Worker |
| --- | --- | --- |
| `TRAINORACLE_GARMIN_INGRESS_MODE=CLOUDFLARE_SIGNED_V1` | Required | Not read |
| `TRAINORACLE_GARMIN_INGRESS_KEY_ID` | Same ID | Same ID |
| `TRAINORACLE_GARMIN_INGRESS_AUDIENCE` | Same deployment-specific ID | Same ID |
| `TRAINORACLE_GARMIN_INGRESS_SECRET_HEX` | Secret, 64 lowercase hex characters | Secret, same value |
| `TRAINORACLE_GARMIN_INGRESS_PUBLIC_URL` | Not read | Exact HTTPS Worker URL ending `/webhooks/garmin` |
| `TRAINORACLE_GARMIN_INGRESS_ORIGIN_URL` | Not read | Exact HTTPS Node URL ending `/webhooks/garmin` |

Use a fresh secret independent of OAuth, journal encryption and internal worker
keys. Configure it through platform secret settings, never source or public
vars. URLs reject credentials, query, fragment, non-default ports and nonexact
paths. Public and origin hosts must differ. During rotation, coordinate the two
deployments; mismatched keys reject deliveries and the provider must retry.

Build/check with the existing app esbuild dependency (no new package):

```sh
node server/garmin-ingress/build-worker.mjs
node server/garmin-ingress/build-worker.mjs --check
node --test server/garmin-ingress/ingress.test.mjs
```

Deploy the generated ES module using a current Worker compatibility date and
turn off invocation/payload logging for this relay. It needs no KV, R2, Durable
Objects, queues, database, cron, service binding or paid resource. Configure only
the exact public endpoint; alternate preview/custom hosts fail the URL check.
For a custom zone, an additional WAF block for this host/path with
`cf.worker.upstream_zone ne ""` rejects Worker-generated subrequests before the
handler. This is defense in depth, not a replacement for signature verification.

## Official evidence and operational verification

Checked 2026-11-05:

- [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/):
  direct requests carry the connecting IP; same-zone Workers can alter
  `x-real-ip`, and Workers targeting a non-Cloudflare zone can alter client IP
  headers. `CF-Worker` is added to Worker fetch subrequests. Therefore Node never
  trusts `CF-Connecting-IP` or `X-Forwarded-For` on its own. The direct-only Worker
  exclusions are deliberate; generic Cloudflare IP allowlisting alone would not
  prove that the request came through this company's Worker.
- [cf.worker.upstream_zone](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/cf.worker.upstream_zone/):
  the edge rules field identifies the originating Worker zone and is empty for
  non-Worker requests. Use it for WAF rules rather than a request header.
- [Request runtime metadata](https://developers.cloudflare.com/workers/runtime-apis/request/):
  inbound `request.cf`, including `colo`, is supplied by Cloudflare. Synthetic
  tests attach this metadata explicitly; they do not prove deployed edge behavior.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/):
  Free currently allows 100,000 requests/day, 10 ms CPU/request and 128 MB memory.
  Network waiting does not count as CPU. The 6.5 MB protocol ceiling is a bound,
  not a guarantee that every maximum-size request fits the free CPU budget.

Before registering the live provider endpoint, verify unsigned direct Node
rejection, non-Garmin IP rejection at the Worker, Worker-subrequest rejection,
healthy deployment configuration, and exact source revision. Exercise a synthetic
large allowed-source request in an isolated controlled edge test and examine only
CPU/status metadata. Do not relax the Garmin source predicate to run a public
positive test. Actual provider delivery remains the definitive positive source
test; a synthetic local request is not real Garmin OAuth/receipt evidence.

No live provider, private health payload, external registration, infrastructure
creation, database change or deployment occurs in the local test suite.
