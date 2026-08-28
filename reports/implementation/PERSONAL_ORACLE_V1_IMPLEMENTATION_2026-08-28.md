# TrainOracle Personal Oracle V1 Implementation Report

## Scope

This change adds a deterministic personal Oracle explanation to the existing Analysis
screen. It reuses accepted structured observations, cumulative-distance rules,
energy-system ledger rules, and separate plan progress marks. It does not add a score,
friend comparison, training-method compatibility, prescription change, or deployment.

## Athlete Experience

The Analysis screen now opens with three plain-language questions:

1. How much eligible distance was recorded in the recent four weeks?
2. Which athlete-selected training-purpose labels were recorded in the recent eight weeks?
3. How many current-plan sessions are planned and separately marked complete?

Each answer names its evidence count and states what cannot be inferred. A collapsed
section exposes the source rules and unknowns without putting governance text before the
main result.

## Data And Safety Boundaries

- The Oracle receives `StructuredJournalObservation[]`, not raw journal entries.
- Private memo text and private-memo existence metadata have no input field.
- A regression fixture adds memo-shaped properties and verifies identical output.
- Unverified imported sessions do not count as evidence.
- Planned, progress-marked, and journal-observed values remain separate.
- No D9, RVE, Safety Gate, plan generator, template, reward, account or sharing code changed.

## Local Verification

- app TypeScript: PASS
- focused Oracle domain and component tests: 6 PASS
- full app unit suite: 1,754 PASS
- full app KST suite: 1,754 PASS
- hosted release environment suite: 11 PASS
- production build: PASS
- browser suite: pending GitHub CI before merge

## Remaining Scope

- independent Korean copy, minor, coach and accessibility review;
- deployed 320/375 px browser evidence;
- training-method compatibility contract and implementation;
- friend comparison and together-running consent contract;
- public/private diary sharing remains a separate account and RLS task.

This report is implementation evidence for the listed local checks only. It is not
runtime production evidence, canonical promotion, or issue closure.
