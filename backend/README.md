# TrainOracle Account Backend Foundation

This package is the isolated beta backend foundation for TrainOracle. It does
not change the root static-site deployment or the current app runtime.

## What Exists

- `GET /health` reports process health only.
- `POST /v1/journal/sync` accepts a bounded, structured journal projection.
- D1 stores records under an authenticated tenant and account scope.
- Batch IDs are idempotent within that scope.
- The production identity resolver deliberately returns
  `AUTH_NOT_CONFIGURED` until the accepted SSO contract is implemented.

## Privacy Boundary

The request schema is strict. It accepts only explicitly entered numeric
fields for post-session and evening entries. It rejects raw memo/note text,
unknown fields, `MISSING` or unregistered `DERIVED` values, pain narratives,
and race self-check data whose server binding is still pending.

The database has no raw-text column. `memo_server_state` is always
`local_only`.

## Local Verification

```bash
npm install
npm run check
npm run db:migrate:local
npx wrangler deploy --dry-run
```

No production D1 database, token, social-login secret, or deployment is
required for these checks.

The direct `@emnapi/*` development pins keep Wrangler's optional Sharp/WASM
tooling tree reproducible between Windows development and Linux CI. They are
not imported by the Worker.
