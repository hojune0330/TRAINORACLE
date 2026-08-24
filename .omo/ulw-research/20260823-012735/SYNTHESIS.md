# Taper and Personalized Prescription Research Synthesis

## Decision

Do not skip taper, but do not fake it. The implementation plan now gives taper its own
evidence/authority task and requires a machine-validated matrix. Every numeric taper
row remains inactive in this wave because TrainOracle lacks a compatible athlete
baseline, exact event/population convergence, and owner authority for numeric taper.

## What may ship in this wave

- Optional target race date as a transient preview input while retention governance is
  blocked.
- Exact-event, exact-projection, population-reviewed placement-only behavior after a
  named privacy/governance receipt.
- Five honest states including `TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED`; stored
  race states remain conditional on that receipt.
- Explicit disclosure that training quantity and intensity were not changed.

## What remains inactive

- Universal or event-specific taper percentages.
- A fixed number of taper days or last-quality-session offset.
- Race-date-triggered overload, intensity increase, or frequency change.
- Youth, female, menstrual-cycle, mood, or sleep multipliers.
- Multi-race/round behavior without a separate competition-anchor decision.

## Why

Direct studies are small and often male-only. The 800 m and junior-high 3000 m sets
contain null performance findings; 1500 m trials conflict and confound variables; 5 km
research includes improvement, maintenance, and deterioration depending on what was
reduced. Meta-analyses provide a group prior but cannot supply a missing athlete
baseline or exact-event transfer authority.

The psychological transfer evidence is also bidirectional. Female-swimming cohorts
include both post-overload mood/cortisol recovery and mood deterioration during reduced
training, while an elite endurance peaking series includes women but is retrospective
and cross-sport. These sources justify individual monitoring and honest uncertainty,
not a sex, mood, or taper-dose multiplier.

## Plan changes

The work plan now has nine tasks. Task 5 builds the inactive taper matrix; Task 6
implements placement-only race anchoring. Template selection is athlete-explicit,
candidate names no longer imply safety superiority, PB/SB/request triggers cannot
invent a delta, and exactly two already bounded duration-only VOLUME sibling transforms
are active: the existing BALANCED-to-CONSERVATIVE reduction and the owner-approved
CONSERVATIVE-to-BALANCED increase. FREQUENCY and INTENSITY remain inactive. All race
placement is projection- and spacing-bound.

## Convergence

Further searches are unlikely to change the immediate implementation boundary. The
important evidence gaps are themselves durable findings and are recorded as explicit
`NOT_FOUND`/inactive states rather than filled with generated defaults.
