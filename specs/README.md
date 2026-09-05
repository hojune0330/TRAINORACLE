# TrainOracle SPEC Package

This directory contains the TrainOracle SPEC layer added after the initial design handoff package.

Start with [`../TRAINORACLE_SPEC_INDEX.md`](../TRAINORACLE_SPEC_INDEX.md).

Before patching active SPEC targets, read [`../SPEC_TARGET_PATCH_MATRIX.md`](../SPEC_TARGET_PATCH_MATRIX.md). It is the current count-safe source-to-target patch guide, not runtime evidence or issue closure.

Directory roles:

- `active/`: current active SPEC candidates.
- `test-packages/`: candidate local test packages, not runtime evidence by themselves.
- `legacy-reference/`: legacy/reference material that must not override current SPEC semantics.
- `reconstruct/`: placeholder area for missing or reconstructed contracts.

Do not treat this upload as canonical promotion. Each SPEC file's own metadata, issue table, and runtime-evidence requirements still control its status.

## Session Method Implementation Entry Points (2026-09-05)

- [구현 현황과 다음 연결 작업](../reports/implementation/SESSION_METHOD_SELECTION_IMPLEMENTATION_2026-09-05.md): 실제 화면 연결 / 준비된 코어·편집기 / 미완료 범위와 검증을 구분한 한국어 인수인계.
- [Session method selection and adjustment](reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md): binding owner-approved engineering direction, with a Korean overview; no blanket new-dose/scientific approval.
- [Whole-catalogue readiness and source matrix](../reports/review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md): 30 exact source rows, four separate runtime baseline refs, grouped source/adjustment gaps and static inspection evidence.
- [Local source-map entry](legacy-reference/SOURCE_MAP.md#6-세션-방법-구현-소스-연결-2026-09-05): current contract/source/runtime-evidence ownership, separate from historical canonical mappings.

The `reconstruct/` location alone does not make the new owner-approved engineering
contract a non-runtime draft. Read its metadata and exact scope. Current one-detail
placement, eventual concurrent per-MAIN detail, and numeric activation are distinct.
