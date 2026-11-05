# Garmin ingress: Pages Direct Upload artifact

This is an optional packaging path for the reviewed `worker-bundle.mjs`. It does
not rebuild, rewrite or configure that Worker, and does not change
`wrangler.jsonc`. It performs no upload, API token creation, secret access or
remote mutation. Existing ingress restrictions and the Render verifier remain
the authority for accepting delivery.

## Local preparation

Use Node 24 from the repository root:

```sh
node server/garmin-ingress/build-worker.mjs --check
node --test server/garmin-ingress/build-pages-artifact.test.mjs
node server/garmin-ingress/build-pages-artifact.mjs tmp/garmin-pages-20261105
```

The output must be a **new direct child** of this checkout's `tmp` directory.
Existing output is never merged or overwritten. The ZIP contains exactly:

- `_worker.js`: byte-for-byte copy of `server/garmin-ingress/worker-bundle.mjs`.
- `_routes.json`: version 1, include `/*`, exclude nothing.

The receipt outside the ZIP records the source/copy SHA-256, ZIP SHA-256 and the
size/hash of each entry. No environment file, source tree, receipt or secret is
included in the ZIP. Archive timestamps are fixed for reproducible bytes.

Cloudflare explicitly supports `_worker.js` in dashboard drag-and-drop uploads,
including ZIP uploads. The `/functions` compilation limitation does not apply
to this prebuilt module. The public documentation does **not** establish an
`index.html` requirement for this advanced-mode upload; actual dashboard
acceptance is a separate deployment check. A Direct Upload project cannot later
be converted to Git integration. [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

If the dashboard demonstrably requires a static asset, generate a fresh folder
with the optional final argument `--include-index`. That includes only a Korean
operational notice, not a health response. Do not add a placeholder Worker or
modify the reviewed bundle to accommodate the UI.

## Production configuration, separate from the artifact

The release owner configures the Pages **Production** environment, using the
exact assigned hostname. The planned public endpoint is:
`https://trainoracle-garmin-ingress.pages.dev/webhooks/garmin`.
If Cloudflare assigns another name, stop and reconcile the exact public URL;
do not authorize preview hosts or silently rewrite the artifact.

| Variable | Required value/source |
| --- | --- |
| `TRAINORACLE_GARMIN_INGRESS_PUBLIC_URL` | `https://trainoracle-garmin-ingress.pages.dev/webhooks/garmin` |
| `TRAINORACLE_GARMIN_INGRESS_ORIGIN_URL` | `https://trainoracle-device-gateway.onrender.com/webhooks/garmin` |
| `TRAINORACLE_GARMIN_INGRESS_KEY_ID` | Reviewed ingress key ID, matching the Render verifier |
| `TRAINORACLE_GARMIN_INGRESS_AUDIENCE` | `trainoracle-device-gateway`, matching the Render verifier |
| `TRAINORACLE_GARMIN_INGRESS_SECRET_HEX` | Protected existing ingress signing secret, matching the Render verifier; encrypt in the dashboard, never place in this artifact |

Use **Settings → Variables and Secrets → Add**; choose **Encrypt** for the
secret. Variables/secrets must be set before the deployment that uses them.
If initial project creation cannot configure bindings first, the reviewed
unconfigured Worker returns 503; set bindings and deploy the **same** artifact
again. Advanced mode receives these bindings in its `fetch(request, env)`
argument. [Bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets)

Set the reviewed compatibility date `2026-11-05` separately. Keep invocation/
body logging disabled and do not enable unrelated bindings or data stores.
Select **Settings → Runtime → Fail open / closed → Fail closed**. Otherwise
the free-tier request allowance can cause Pages to skip Functions and serve
static assets. `_routes.json` alone does not control that quota behavior.
[Invocation routes and fail-closed behavior](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed)

## Preserved request behavior

Advanced mode controls all incoming requests and serves static assets only if
the code calls `env.ASSETS.fetch`. This Worker never calls it, and the artifact
includes no excluded route. An optional `index.html` therefore does not become
a root success response while the Worker executes.
[Advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)

The current reviewed code returns **403** for `/`, `/index.html`, a wrong host,
wrong method or disallowed source when fully configured. Missing configuration
returns **503**. It does **not** promise root 404 or a public health endpoint.
Only the exact configured POST `/webhooks/garmin` with the existing trusted
source checks can reach the fixed origin; only the origin's 200 is acknowledged.

Pages Functions use the Workers runtime; incoming `Request.cf` exposes platform
metadata, while the dashboard/Playground preview does not supply it. The
existing `cf.colo`, `CF-Connecting-IP`, `CF-Worker` and `x-real-ip` restrictions
remain unchanged. Cloudflare documents different IP-header semantics for
Worker subrequests and Pseudo IPv4; no direct-origin trust claim is based on a
caller-supplied header alone. Do not add a Worker/CDN hop or enable an IP rewrite
as a workaround. [Pages runtime](https://developers.cloudflare.com/pages/functions/),
[Request.cf](https://developers.cloudflare.com/workers/runtime-apis/request/),
[IP header behavior](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip)

## Evidence and release boundary

The focused tests inspect ZIP entries and CRCs, compare exact Worker bytes,
exercise the extracted module with synthetic runtime metadata, check unchanged
root denial/static-asset isolation, and check fixed-origin forwarding with
byte preservation and source rejection. They do not prove real Cloudflare
metadata, dashboard upload acceptance, deployed settings, Garmin delivery or
durable journal storage.

After upload, the release owner verifies the deployed artifact and production
settings, public denial behavior, Render signature verification and a separately
authorized provider delivery. A 403 or 503 on the public root is not proof of a
completed Garmin integration. The existing body-size/CPU/runtime limits still
apply; this packaging path does not change them.
