# CODEX_WORK_ORDER_011 Execution Notepad

## Objective

Produce a target-bound safety, privacy, and youth-governance decision packet without
inventing legal approval or enabling account-linked sensitive storage.

## RED Contract

Five required contract, review, decision, and fixture outputs were absent. The RED
command exited 1 with five failures before any Order 011 output was created.

## Hard Gate

`QUALIFIED_PRIVACY_REVIEWER` must be a named real reviewer before policy acceptance.
Codex and internal review agents may prepare and challenge the packet but cannot satisfy
this role.

## Manual QA

- Canary private-note strings must appear nowhere outside the synthetic fixture input.
- Changing private-note content, presence, frequency, or length must produce identical
  non-private outputs.
- Raw/reconstructable reason, stale/expired ref, wrong target/version, evaluator failure,
  revocation, and unknown role must fail closed.
- Export/share is explicit, local, user-initiated, and separate from analytics consent.

## Active Lanes

- Korea official privacy/youth source review.
- Multi-country official governance question inventory.
- Canonical repository drift audit.
- Opaque safety-envelope and adversarial fixture design.

## Packet Completion

- RED: five absent outputs, exit 1.
- GREEN: five outputs and 41 deterministic fixture cases pass structural checks.
- Independent review: four packet-quality reviews failed first, corrections applied,
  and all four passed.
- Hard gate remains: named qualified privacy reviewer is unassigned.
- Final state: `DECISION_PACKET_COMPLETE_BLOCKED_ON_QUALIFIED_REVIEW`.
