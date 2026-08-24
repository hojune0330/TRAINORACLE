# Local civil-date boundary debug

## Hypotheses

1. **H1 - UTC comparison defect:** `parseTargetRaceDate` validates the target date correctly, but compares it with `new Date().toISOString().slice(0, 10)`. At `2026-08-24 00:30 KST`, that comparison date is still `2026-08-23`, so the same local civil date is accepted as future.
2. **H2 - calendar validation defect:** the UTC round-trip used to reject impossible `YYYY-MM-DD` values may be misclassifying `2026-08-24`. This is refuted if the round-trip remains exactly `2026-08-24` while only the present-day comparison differs.
3. **H3 - caller-controlled clock/timezone:** a request field may be supplying the effective clock or timezone. This is refuted if the parser reads only its internal `new Date()` and the request key allowlist contains neither a clock nor timezone.

## Distinguishing evidence before source edit

- With `TZ=Asia/Seoul`, epoch `2026-08-23T15:30:00.000Z` produced `utcDate=2026-08-23`, `localDate=2026-08-24`, and `localHour=0`.
- `parseTargetRaceDate` performs the valid-date round-trip independently, then compares against the UTC date derived from its internal clock.
- The plan-generation request allowlist has no clock or timezone field.

Conclusion: H1 is confirmed; H2 and H3 are refuted. The production fix should replace only the present-day comparison with the established local civil-date convention.
