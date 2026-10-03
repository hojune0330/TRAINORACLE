# Multi-Event Pace Adoption Review

```yaml
review_date: 2026-10-02
status: BOUNDED_PRIMARY_SOURCE_REVIEW_NOT_APPLIED_ADOPTION
contract: specs/reconstruct/MULTI_EVENT_PACE_REFERENCE_CONTRACT.md
observed_base_head: 1ff8349beb7fd4abbff7c8893ba9a6094c12891a
worktree_state: existing_dirty_shared_checkout_preserved
canonical_promotion_allowed: false
new_applied_pair_approvals: []
new_template_approvals: []
runtime_tests_executed_by_this_sidecar: false
```

## 1. Review Outcome

The user's approved feature is seven-event reference selection with recent actual
first, rolling 12-month best, PB/goal alternatives, versioned evidence, and explicit
remaining-plan application. Riegel 1.06 is an explicitly labeled comparison baseline,
not an applied cross-event training model. **This review grants zero new applied
pair approvals.** The parent implements core/UI and verifies persistence separately.

The [companion contract](../../specs/reconstruct/MULTI_EVENT_PACE_REFERENCE_CONTRACT.md)
records the bounded supersession of old goal-display-only and 18-month/season
coupling. It does not rewrite canonical source documents, add scientific authority,
alter volume/recovery, or modify past plans and journals.

## 2. Independent Access Ledger

Only public bibliographic/article URLs were sent to research tools. No athlete,
journal, account, or private record content was transmitted.

| Primary source | Access in this run | Not independently accessed or reproduced |
|---|---|---|
| Vickers AJ, Vertosick EA (2016), *An empirical study of race times in recreational endurance runners*. BMC Sports Science, Medicine and Rehabilitation 8:26. DOI `10.1186/s13102-016-0052-y`; PMID `27570626` | [PubMed primary article record](https://pubmed.ncbi.nlm.nih.gov/27570626/): citation, abstract, and Figure 2 caption read on 2026-10-02 | Full article via [PMC5000509](https://pmc.ncbi.nlm.nih.gov/articles/PMC5000509/) returned a browser/reCAPTCHA check. Full methods, supplements, data, and author code were not independently inspected or reproduced. |
| Blythe DAJ, Kiraly FJ (2016), *Prediction and Quantification of Individual Athletic Performance of Runners*. PLOS ONE 11(6):e0157257. DOI `10.1371/journal.pone.0157257` | [Official PLOS article](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0157257): abstract, introduction, data/validation methods, results, and discussion read on 2026-10-02 | Supplementary PDF, linked code/data, coefficient implementation, and independent model reproduction were not accessed/executed. |

Agent-reach's documented Jina read route was attempted for the PubMed URL and failed
to connect. The available web tool successfully read PubMed and PLOS directly.
Access success is source inspection, not reproduction or clinical validation.

## 3. Source-Bounded Findings

### 3.1 Vickers And Vertosick

The abstract describes an Internet survey of 2,303 recreational endurance runners
and a 2:1 training/validation split. It reports satisfactory Riegel calibration up
to half-marathon but overly fast marathon predictions, by at least ten minutes for
half of runners. Crucially, Figure 2 identifies the evaluated Riegel exponent as
**1.07**, using the longest reported non-marathon race. These results are not a
direct validation or quantified error estimate for this product's **1.06** baseline.
Source locator: Abstract, Methods/Results; Figure 2 caption on [PubMed](https://pubmed.ncbi.nlm.nih.gov/27570626/).

Review inference: this is a reason to expose marathon extrapolation limitations,
not to promise a ten-minute correction for an individual or adopt another formula.
The accessible evidence does not establish 800/1500/3000 m application, a seven-event
pair matrix, goal-based capability, training-template doses, or a 12-month validity
threshold. No uninspected regression coefficients are copied into the contract.

### 3.2 Blythe And Kiraly

The article analyzes 164,746 British runners and 1,417,432 performances. Its ten
distances include 800 m, 1500 m, 5 km, 10 km, half-marathon, and marathon, but **not
3000 m**. Main-text analyses use the male subset; further subgroup results are
deferred to supplements. It contrasts fixed-exponent Riegel 1.06 with individual
power-law and local matrix-completion models. Validation removes performances from
runners with multiple observed events; it is not a prospective training trial.
Source locators: Introduction; Data Set, Analyses and Model Validation; Results I
and Discussion in the [PLOS article](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0157257).

Review inference: event specialization and population/input dependence matter.
Distance coverage and aggregate prediction performance cannot authorize every
directed pair, a one-record reconstruction of a multi-input model, or 3000 m
interpolation. No coefficients, subgroup safety guarantees, individual error bars,
or training-volume/recovery policy are adopted from this paper.

## 4. Adoption Matrix

Each off-diagonal cell is **C**: comparison-only Riegel 1.06 under the user-approved
feature, with **no new applied approval** from this review. Each diagonal is **D**:
same-event direct arithmetic, which still needs existing training eligibility to
become a prescription. A displayed prediction is neither an achieved record nor a
default replacement for missing direct evidence.

| Source -> target | 800 | 1500 | 3000 | 5000 | 10000 | 21097.5 | 42195 |
|---|---|---|---|---|---|---|---|
| 800 | D | C | C | C | C | C | C |
| 1500 | C | D | C | C | C | C | C |
| 3000 | C | C | D | C | C | C | C |
| 5000 | C | C | C | D | C | C | C |
| 10000 | C | C | C | C | D | C | C |
| 21097.5 | C | C | C | C | C | D | C |
| 42195 | C | C | C | C | C | C | D |

This accounts for 7 direct-event cells and 42 directed comparison pairs. It is a
feature-boundary matrix, not a claim that the papers validate all 42 pairs. An
independently existing adoption may only be consumed after its exact directed pair,
model/version/parameters, template/version/fingerprint, population, source-reference
lane, and owner decision are verified. Reverse direction is not implied. This
bounded review is not an exhaustive audit asserting that no other adoption exists.

| Candidate or behavior | Review disposition | Why it is not new applied authority |
|---|---|---|
| Same-event actual/PB/rolling reference arithmetic | Within approved reference feature; application gated | Arithmetic is not a new template, optimal dose, or currentness decision |
| Same-event goal-reference alternative | Explicit aspirational preview/apply lane under companion contract | Goal must not masquerade as actual current capability |
| Riegel 1.06 | Comparison-only baseline | User approved comparison, not 42 applied pairs |
| Riegel 1.07 from Vickers figure | Not substituted/adopted | Different exponent; no exact owner adoption here |
| Vickers fitted marathon models | Not adopted | Full methods/coefficients uninspected; no template/population adoption |
| Blythe individual exponent/LMC model | Not adopted | Inputs, implementation, validation transfer, and owner adoption unresolved |
| Predicted 5000 m -> existing LT/VO2 path | Not permitted by this review | Existing actual-5000 m scope cannot be widened through a prediction |

## 5. Local Conflicts And Evidence

Read-only local inspection used AGENTS, North Star, P1/P3 work orders, template
library section 16A, training-session prescription contract, current-scope notes,
the all-workout calculation/binding contract, and `pace-target-evidence.ts`.
The checkout was already dirty; observations describe inspected files, not a clean
commit snapshot or live deployment. Concurrent parent edits may change code later.

| Observed source | Relevant finding | Bounded resolution |
|---|---|---|
| `WORK_ORDER_P1_ATHLETE_RECORDS.md` sections 4.2 and 5 | Goals are aspirational; 18-month season window was expressly display policy, not scientific safety/currentness | Preserve provenance; new rolling query is 12 calendar months and independent of season |
| `WORK_ORDER_P3_PACE_WIRING.md` section 5.3 | `calculateGoalReferenceRacePace` and `goalReference.displayOnly` isolate goals from current prescriptions | New explicitly selected goal lane supersedes display-only restriction only within its approved preview/apply scope |
| `app/src/domain/pace-target-evidence.ts` `deriveRecordCurrentness` | CURRENT/STALE uses `SEASON_WINDOW_MONTHS`; source season metadata is also represented in existing snapshots | New lane must separate record age, rolling membership, currentness, and capability; do not overwrite historical snapshots |
| `TEMPLATE_LIBRARY_SPEC.md` section 16A; prescription contract section 9 | Four exact legacy same-event identities, current-record gates, cross-event prohibition | Do not expand their allowlist or silently pass goals/predictions through a current-capability validator |
| `TRAINING_PLAN_CURRENT_SCOPE.md` section 10; all-workout contract sections 2, 3, 8, 9 | Later calculation lane and explicit replacement protections coexist with the legacy lane | Keep lane-specific approvals and protected slots; do not treat historical four-template scope as the whole product |

The companion contract specifies record-version snapshots, source-revision and
plan-revision checks, preview invalidation, past/today/journal/progress protection,
and explicit remaining-plan apply. A faster reference cannot trigger automatic
volume/recovery changes. Existing safety/privacy restrictions are not superseded.

## 6. Evidence Required Before Any Later Applied Adoption

Any later proposal must supply a real owner decision, not merely complete this table:

| Requirement | Evidence to obtain |
|---|---|
| Precise transfer claim | Directed pair, exact model/parameters, required actual inputs or explicit goal lane |
| Intended use | Exact template/configuration/version/fingerprint and training purpose |
| Population | Applicable experience/population and source-to-product differences; no inferred youth/sex multipliers |
| Validation | Reproducible held-out results appropriate to the claim, errors/calibration, limitations, failure cases |
| Product controls | Comparison/application separation; provenance; safety; preview/consent; immutable history; concurrency validation |
| Owner adoption | Reviewable decision reference and lifecycle, with no extrapolation to adjacent pairs/models/templates |

Neither inspected paper supplies the owner's missing adoption. The 12-month window
is a user-approved product selection rule, not a scientific expiry inferred from
these sources. Current runtime, public deployment, numerical correctness of the
parent implementation, and real-user behavior remain outside this review's evidence.

## 7. Delivery Boundary

- Delivered: bounded reference contract and primary-source adoption review only.
- New applied-pair approvals, runtime registry writes, template changes: zero.
- Core/UI/storage implementation and executable tests: parent responsibility.
- Commit, push, deployment, journal/plan mutation, or other external write: not performed.

[DRAFT_COMPLETE]
