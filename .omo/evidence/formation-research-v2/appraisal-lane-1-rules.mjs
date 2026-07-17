import {
  correctedFullTextPending,
  directYouthMiddleDistance,
  highConcern,
  lowConcern,
  methodOrGuidanceTypes,
  partialArchitecture,
  partialYouthMiddleDistance,
  specificTool,
} from "./appraisal-lane-1-data.mjs";

export function appraisalTool(source) {
  const override = specificTool.get(source.source_id);
  if (override) return override;

  const type = source.source_type;
  if (type.includes("SCOPING_REVIEW")) return "JBI_SCOPING_REVIEW_NO_SCORE";
  if (type.includes("SYSTEMATIC_REVIEW") || type.includes("META_ANALYSIS")) return "AMSTAR_2";
  if (type.includes("RANDOMIZED") || type.includes("CLUSTER_RANDOMIZED")) return "RoB_2";
  if (
    type.includes("CONTROLLED_TRAINING_TRIAL") ||
    type.includes("COMPARATIVE_STUDY") ||
    type.includes("TRAINING_TRIAL")
  ) return "ROBINS_I";
  if (type.includes("PROSPECTIVE") || type.includes("COHORT")) return "JBI_COHORT";
  if (type.includes("CROSS_SECTIONAL") || type.includes("EPIDEMIOLOGY")) {
    return "JBI_ANALYTICAL_CROSS_SECTIONAL";
  }
  if (
    type.includes("DEVICE_VALIDATION") ||
    type.includes("INSTRUMENT_VALIDATION") ||
    type.includes("VALIDATION_STUDY") ||
    type.includes("MEASUREMENT")
  ) return "COSMIN_RISK_OF_BIAS_ADAPTED_NO_SCORE";
  if (type.includes("SINGLE_CASE")) return "RoBiNT_PLUS_SCRIBE";
  if (type.includes("CASE")) return "JBI_CASE_REPORT_OR_SERIES";
  if (type.includes("QUALITATIVE")) return "CASP_QUALITATIVE_NO_SCORE";
  if (type.includes("MIXED_METHOD")) return "MMAT_2018_NO_SCORE";
  if (type.includes("NARRATIVE_REVIEW") || type === "REVIEW" || type.includes("CLINICAL_REVIEW")) {
    return "SANRA_NO_SCORE";
  }
  if (
    type.includes("INTERVIEW") ||
    type.includes("COACHING_ARTICLE") ||
    type.includes("ADVICE_SAMPLE_PLAN") ||
    type.includes("SYMPOSIUM_PRESENTATION") ||
    type.includes("JOURNALISTIC")
  ) return "NON_RESEARCH_PROVENANCE_AND_ATTRIBUTION_CHECK";
  if (
    type.includes("CONSENSUS") ||
    type.includes("GUIDELINE") ||
    type.includes("STANDARD") ||
    type.includes("OFFICIAL_PUBLIC_GUIDANCE")
  ) return "AUTHORITY_METHOD_STAKEHOLDER_EVIDENCE_COI_APPRAISAL_NO_SCORE";
  if (type.includes("REPORTING_GUIDELINE")) return "RIGHT_ADAPTED_NO_SCORE";
  if (type.includes("COMMENTARY") || type.includes("CONCEPTUAL")) return "JBI_TEXT_AND_OPINION";
  if (methodOrGuidanceTypes.some((marker) => type.includes(marker))) {
    return "METHOD_VALIDITY_AND_TRANSPARENCY_APPRAISAL_NO_SCORE";
  }
  if (type.includes("PRIMARY_ACUTE") || type.includes("REPEATED_BOUT")) {
    return "JBI_QUASI_EXPERIMENTAL";
  }
  return "JBI_DESIGN_MATCHED_CHECKLIST_NO_SCORE";
}

export function overallJudgment(source) {
  if (source.source_id === "SRC-PMID-36086887") return "NOT_ASSESSABLE";
  if (source.full_text_state === "ABSTRACT_ONLY") return "NOT_ASSESSABLE";
  if (correctedFullTextPending.has(source.source_id)) return "NOT_ASSESSABLE";
  if (highConcern.has(source.source_id)) return "HIGH_CONCERN";
  if (lowConcern.has(source.source_id)) return "LOW_CONCERN";
  return "SOME_CONCERNS";
}

export function domainJudgments(source, tool, overall) {
  if (source.source_id === "SRC-PMID-36086887") {
    return "IDENTIFIER=INCORRECT_FOR_RQ;ELIGIBLE_METHOD=NOT_ASSESSABLE;EFFECT_USE=PROHIBITED";
  }
  if (correctedFullTextPending.has(source.source_id)) {
    return "CORRECTED_FULL_TEXT=NOT_ASSESSED;METHOD_DOMAINS=NOT_ASSESSABLE;EFFECT_USE=PENDING_CORRECTION_AWARE_REVIEW";
  }
  if (source.full_text_state === "ABSTRACT_ONLY") {
    return "FULL_METHOD=NOT_ASSESSABLE;SELECTION=NOT_ASSESSABLE;MEASUREMENT=NOT_ASSESSABLE;MISSING_DATA=NOT_ASSESSABLE;SELECTIVE_REPORTING=NOT_ASSESSABLE";
  }

  if (tool.startsWith("RoB_2")) {
    return `RANDOMIZATION=NOT_VERIFIED;DEVIATIONS=${overall};MISSING_OUTCOME_DATA=SOURCE_SPECIFIC;OUTCOME_MEASUREMENT=SOURCE_SPECIFIC;SELECTIVE_REPORTING=NOT_VERIFIED`;
  }
  if (tool.startsWith("ROBINS_I")) {
    return `CONFOUNDING=${overall};SELECTION=${overall};INTERVENTION_CLASSIFICATION=REPORTED;DEVIATIONS=SOURCE_SPECIFIC;MISSING_DATA=SOURCE_SPECIFIC;OUTCOME_MEASUREMENT=SOURCE_SPECIFIC;SELECTIVE_REPORTING=NOT_VERIFIED`;
  }
  if (tool === "AMSTAR_2") {
    return `PROTOCOL=NOT_VERIFIED;SEARCH=SOURCE_REPORTED;DUPLICATE_PROCESSES=NOT_VERIFIED;RISK_OF_BIAS_APPRAISAL=SOURCE_SPECIFIC;SYNTHESIS=${overall};OVERLAP=RECORDED_SEPARATELY`;
  }
  if (tool === "RoBiNT_PLUS_SCRIBE") {
    return `DESIGN_AND_BASELINE=${overall};RANDOMIZATION=SOURCE_SPECIFIC;MEASUREMENT=SOURCE_SPECIFIC;REPLICATION=SOURCE_SPECIFIC;MISSINGNESS=SOURCE_SPECIFIC;REPORTING_COMPLETENESS=PARTIAL`;
  }
  if (tool.includes("NON_RESEARCH_PROVENANCE")) {
    return "PROVENANCE=VERIFIED_FOR_REPORTED_PRACTICE;SELECTION=HIGH_CONCERN;SELF_REPORT=HIGH_CONCERN;COMPARATOR=ABSENT;OUTCOME_ATTRIBUTION=PROHIBITED";
  }
  if (tool.includes("AUTHORITY_METHOD_STAKEHOLDER") || tool.includes("RIGHT_ADAPTED")) {
    return `AUTHORITY=IDENTIFIED;METHODS_TRANSPARENCY=${overall};STAKEHOLDER_RANGE=SOURCE_SPECIFIC;EVIDENCE_LINK=SOURCE_SPECIFIC;CONFLICT_DISCLOSURE=RECORDED_SEPARATELY`;
  }
  if (tool.includes("SANRA")) {
    return `IMPORTANCE=STATED;AIMS=STATED;SEARCH_DESCRIPTION=PARTIAL;REFERENCING=SOURCE_SPECIFIC;SCIENTIFIC_REASONING=${overall};EFFECT_CERTAINTY=NOT_ESTIMATED`;
  }
  if (tool.includes("COSMIN")) {
    return `CONSTRUCT_AND_PROTOCOL=SOURCE_SPECIFIC;RELIABILITY_OR_VALIDITY=${overall};MEASUREMENT_ERROR=SOURCE_SPECIFIC;MISSING_DATA=SOURCE_SPECIFIC;TRANSFER=RESTRICTED_TO_DEVICE_OUTCOME_PROTOCOL`;
  }
  if (tool.includes("MMAT")) {
    return `QUALITATIVE_COMPONENT=${overall};QUANTITATIVE_COMPONENT=${overall};INTEGRATION=${overall};MISSINGNESS=SOURCE_SPECIFIC;INTERPRETATION=RESTRICTED_TO_FEASIBILITY`;
  }
  if (tool.includes("CASP_QUALITATIVE")) {
    return `AIMS=STATED;RECRUITMENT=${overall};DATA_COLLECTION=SOURCE_SPECIFIC;REFLEXIVITY=NOT_VERIFIED;ANALYSIS=SOURCE_SPECIFIC;TRANSFERABILITY=LIMITED`;
  }
  if (tool.includes("METHOD_VALIDITY")) {
    return `QUESTION=STATED;ASSUMPTIONS=SOURCE_SPECIFIC;METHOD_TRANSPARENCY=${overall};SENSITIVITY=SOURCE_SPECIFIC;EXTERNAL_VALIDITY=LIMITED_TO_STATED_METHOD_USE`;
  }
  if (tool.includes("JBI_SCOPING")) {
    return `QUESTION=STATED;SEARCH=SOURCE_REPORTED;SELECTION=SOURCE_SPECIFIC;CHARTING=SOURCE_SPECIFIC;SYNTHESIS=${overall};EFFECT_ESTIMATE=NOT_APPLICABLE`;
  }
  if (tool.includes("JBI_TEXT")) {
    return `SOURCE_IDENTIFIED;EXPERTISE=SOURCE_SPECIFIC;EVIDENCE_LINK=${overall};LOGICAL_COHERENCE=${overall};EMPIRICAL_EFFECT_USE=PROHIBITED`;
  }
  if (tool.includes("JBI_CASE")) {
    return `CASE_SELECTION=${overall};HISTORY=SOURCE_SPECIFIC;EXPOSURE=SOURCE_SPECIFIC;OUTCOMES=SOURCE_SPECIFIC;CONCURRENT_CHANGE=HIGH_CONCERN;GENERALIZATION=PROHIBITED`;
  }
  if (tool.includes("JBI_COHORT")) {
    return `GROUP_SELECTION=${overall};EXPOSURE_MEASUREMENT=SOURCE_SPECIFIC;CONFOUNDING=${overall};OUTCOME_MEASUREMENT=SOURCE_SPECIFIC;FOLLOW_UP=SOURCE_SPECIFIC;CAUSAL_USE=PROHIBITED`;
  }
  if (tool.includes("JBI_ANALYTICAL_CROSS_SECTIONAL")) {
    return `SAMPLE_FRAME=${overall};EXPOSURE_MEASUREMENT=SOURCE_SPECIFIC;CONFOUNDING=${overall};OUTCOME_MEASUREMENT=SOURCE_SPECIFIC;TEMPORALITY=ABSENT;CAUSAL_USE=PROHIBITED`;
  }
  if (tool.includes("JBI_QUASI")) {
    return `CAUSAL_DIRECTION=REPORTED;COMPARATOR=${overall};CONFOUNDING=${overall};REPEATED_MEASURES=SOURCE_SPECIFIC;MISSING_DATA=SOURCE_SPECIFIC;SELECTIVE_REPORTING=NOT_VERIFIED`;
  }
  return `DESIGN_MATCH=${overall};SELECTION=SOURCE_SPECIFIC;MEASUREMENT=SOURCE_SPECIFIC;CONFOUNDING=SOURCE_SPECIFIC;MISSING_DATA=SOURCE_SPECIFIC;REPORTING=NOT_VERIFIED`;
}

export function youthDirectness(source) {
  if (source.source_id === "SRC-PMID-36086887") return "NOT_APPLICABLE";
  if (directYouthMiddleDistance.has(source.source_id)) return "DIRECT";
  if (partialYouthMiddleDistance.has(source.source_id)) return "PARTIAL";
  const population = source.population.toUpperCase();
  if (
    population.includes("NO ATHLETE") ||
    population.includes("NOT_APPLICABLE") ||
    population.includes("NO INTERVENTION POPULATION") ||
    population.includes("METHOD") ||
    population.includes("GUIDANCE")
  ) return "NOT_APPLICABLE";
  return "INDIRECT";
}

export function architectureDirectness(source) {
  if (source.source_id === "SRC-PMID-36086887") return "NOT_APPLICABLE";
  if (partialArchitecture.has(source.source_id)) return "PARTIAL";
  if (methodOrGuidanceTypes.some((marker) => source.source_type.includes(marker))) {
    return "NOT_APPLICABLE";
  }
  return "INDIRECT";
}

export function outcomeCompatibility(source, rqId) {
  if (source.source_id === "SRC-PMID-36086887") return "NOT_APPLICABLE";
  if (["RQ-A", "RQ-B", "RQ-C"].includes(rqId)) return "PARTIAL";
  if (["RQ-D", "RQ-E", "RQ-F"].includes(rqId)) return "DIRECT";
  if (rqId === "RQ-G") {
    return source.source_type.includes("COHORT") || source.source_type.includes("REVIEW")
      ? "PARTIAL"
      : "DIRECT";
  }
  return "PARTIAL";
}

export function timeHorizonCompatibility(source, rqId) {
  if (source.source_id === "SRC-PMID-36086887") return "NOT_APPLICABLE";
  const combined = `${source.notes} ${source.event}`.toUpperCase();
  if (rqId === "RQ-B") {
    return /72 H|72H|72-H|96 H|96H|120 H|144 H/.test(combined) ? "DIRECT" : "PARTIAL";
  }
  if (rqId === "RQ-D" || rqId === "RQ-E") {
    return methodOrGuidanceTypes.some((marker) => source.source_type.includes(marker))
      ? "NOT_APPLICABLE"
      : "PARTIAL";
  }
  if (rqId === "RQ-G" && methodOrGuidanceTypes.some((marker) => source.source_type.includes(marker))) {
    return "NOT_APPLICABLE";
  }
  return "PARTIAL";
}

export function appraisalNote(source, overall) {
  if (source.source_id === "SRC-PMID-36086887") {
    return "Wrong bibliographic identifier for the intended running-HIIT source; quarantined and prohibited from all claim or prescription use.";
  }
  if (correctedFullTextPending.has(source.source_id)) {
    return "A correction or erratum is linked, but a correction-aware full-method appraisal is not present in lane 1; no effect, safety, or prescription claim may rely on this row yet.";
  }
  if (source.full_text_state === "ABSTRACT_ONLY") {
    return `Abstract-only evidence: the design-matched tool is named prospectively, but study-level concern is NOT_ASSESSABLE until full methods are reviewed. ${source.notes}`;
  }
  return `Lane-1 ${overall} judgment applies only to the source's stated narrow use and is not GRADE certainty. It cannot validate 9.5-day optimality, safety, recovery clearance, or runtime authority. ${source.notes}`;
}
