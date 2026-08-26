# Taper Evidence Authority Matrix V1 - 2026-08-23

Status: INACTIVE_RESEARCH_CANDIDATE

This matrix records local research observations only. It grants no numeric taper,
placement, runtime, or owner authority. A cell is encoded as
`[provenance, value]`, where provenance is exactly `REPORTED`,
`NOT_REPORTED`, or `NOT_APPLICABLE`. `NOT_FOUND` is an explicit result,
not a value to be inferred.

```json
{
  "schemaVersion": 1,
  "kind": "TRAINORACLE_TAPER_EVIDENCE_AUTHORITY_MATRIX",
  "matrixVersion": "TAPER-EVIDENCE-AUTHORITY-V1",
  "status": "INACTIVE_RESEARCH_CANDIDATE",
  "numericTaperAuthority": "NOT_GRANTED",
  "runtimeAuthority": false,
  "formulaAuthority": false,
  "sourceGate": {
    "path": ".omo/reports/personalized-prescription-source-gate-2026-08-23.md",
    "sha256": "sha256:82061a918835ef9e73d663b8a3e27fbf3ec543f70e964ebfb6980b36041e7f41",
    "extraction": "LF_NORMALIZED_SOURCE_ID_PLUS_EXACT_LINE_FRAGMENT_SHA256"
  },
  "supplementalEvidence": [
    {
      "evidenceId": "SUPP-PMID-12165889-SUBGROUPS",
      "sourceId": "SRC-PMID-12165889",
      "path": ".omo/evidence/formation-research-v2/competition-anchor-primary-research.md",
      "fileSha256": "sha256:2ecfff924f7af37aa4c0192ff0ee7c465652122addbbc0cf79e880ec4072308b",
      "lineStart": 109,
      "lineEnd": 109,
      "fragmentSha256": "sha256:c8455c9de891aee3788d5ad08da25c556c04908a8fda6601b01b48d07dfe72d1",
      "extraction": "LF_NORMALIZED_PATH_PLUS_LINE_RANGE_PLUS_EXACT_FRAGMENT_SHA256"
    }
  ],
  "provenanceVocabulary": [
    "REPORTED",
    "NOT_REPORTED",
    "NOT_APPLICABLE"
  ],
  "cellEncoding": [
    "PROVENANCE",
    "VALUE"
  ],
  "sourceInventory": [
    { "sourceId": "SRC-PMID-25189116", "lineStart": 38, "lineEnd": 38, "evidenceSha256": "sha256:f174577511bc5473af76e40491c5e14b9209700a924cbd5bf99387a93c0dfd86" },
    { "sourceId": "SRC-PMID-37163550", "lineStart": 39, "lineEnd": 39, "evidenceSha256": "sha256:ca7b693b1910164807caf72ae4b4b2536440cd34b805efd7258869c53ec0bb10" },
    { "sourceId": "SRC-PMID-10694140", "lineStart": 124, "lineEnd": 124, "evidenceSha256": "sha256:824151f5931cdd95b7761f40a1f1e243dfa89f8282cd8e247a79c33585757c6c" },
    { "sourceId": "SRC-PMID-12165889", "lineStart": 125, "lineEnd": 125, "evidenceSha256": "sha256:080cc50c6ba9beff2d15dc9c4c4b9cdf9464aff02755df8eb87d902b3048b019" },
    { "sourceId": "SRC-PMID-1559951", "lineStart": 126, "lineEnd": 126, "evidenceSha256": "sha256:45885792d9786cd8a800216d8e2ecc518a8cabd70166f4f8e5f88b3c1628be9a" },
    { "sourceId": "SRC-PMID-30608885", "lineStart": 127, "lineEnd": 127, "evidenceSha256": "sha256:35726e6007c33c1d418ffa76a356add517244c6b846eff463d35ea09b8a6db6c" },
    { "sourceId": "SRC-PMID-34062089", "lineStart": 128, "lineEnd": 128, "evidenceSha256": "sha256:dc670f3184e5f4ea8d53e5e73ef17162086c84135f98e1f8b7cfc7da1c54320a" },
    { "sourceId": "SRC-PMID-8007812", "lineStart": 129, "lineEnd": 129, "evidenceSha256": "sha256:726c5c34b34cef9777399a37b4bf3650db7808e3205a6fd7b1ea73a592e9e1b6" },
    { "sourceId": "SRC-JSTAGE-RJSP-15-2243", "lineStart": 130, "lineEnd": 130, "evidenceSha256": "sha256:e067685c3fdec7d45014e66b0786bcab26a124fa5f77d9b748a76b85f27d6729" },
    { "sourceId": "SRC-JSTAGE-JSPEHSSCONF-73-162", "lineStart": 131, "lineEnd": 131, "evidenceSha256": "sha256:019be1e8cc3d2de17e14add772e9bb9b7498db760bada04f45aa5b58b7dcfd3f" },
    { "sourceId": "SRC-CINII-1390296343172624640", "lineStart": 132, "lineEnd": 132, "evidenceSha256": "sha256:6ce4737e5162b614f25e2224f588fe3df5bd40f4fa505dbdac826e8bd42796ac" },
    { "sourceId": "SRC-ANALEFEFS-2014-I1-9", "lineStart": 144, "lineEnd": 144, "evidenceSha256": "sha256:d0cf7806f29c7df53d43844d6ee07624495e36ca25c31e52fafc769fe3988aff" },
    { "sourceId": "SRC-PMID-2318562", "lineStart": 146, "lineEnd": 146, "evidenceSha256": "sha256:ae933d86d648e3bc5cb06527de665f261e443e9c9b1a54ba78fe72b68f9a313b" },
    { "sourceId": "SRC-PMID-8440543", "lineStart": 146, "lineEnd": 146, "evidenceSha256": "sha256:5745be6c1ac98ad728f8d5c6de63d9808dec0c9fd8d2fcbef91636879e7607e0" },
    { "sourceId": "SRC-PMID-25134000", "lineStart": 156, "lineEnd": 160, "evidenceSha256": "sha256:f6b296a3da028d7311a0849ba82b908ffe06621bdf00c4dccc4ef32cbad794dc" },
    { "sourceId": "SRC-PMID-25019608", "lineStart": 161, "lineEnd": 166, "evidenceSha256": "sha256:83c38d2c4cf9e09231482f1dd2eb226b3a75d62cad4c0d2e25c47c0afd18a266" },
    { "sourceId": "SRC-PMID-17762369", "lineStart": 180, "lineEnd": 186, "evidenceSha256": "sha256:2a50b2b3fc8958e5f2131ffd022d2d5758369bff7a5f31d540f19f173e090c7f" },
    { "sourceId": "SRC-PMID-32661839", "lineStart": 201, "lineEnd": 203, "evidenceSha256": "sha256:70968f56b47fb5ddc765510f39bc32597c4043841176d7c357afb6c14df41777" },
    { "sourceId": "SRC-PMID-37726100", "lineStart": 204, "lineEnd": 207, "evidenceSha256": "sha256:3136d3e4d9927bcb006751d098d03d04a1ae7c18967a86a533f5de52765c6577" },
    { "sourceId": "SRC-PMID-36696042", "lineStart": 208, "lineEnd": 210, "evidenceSha256": "sha256:31d6a42d52d9d9e68f0ea1097f183fa8515c34525373cfe9f59ffb09b25231dc" },
    { "sourceId": "SRC-PMID-2813655", "lineStart": 211, "lineEnd": 215, "evidenceSha256": "sha256:db6453777459e2760ddf373f6b2d37973c855df46503b5813abe51704f2fa746" },
    { "sourceId": "SRC-PMID-9140908", "lineStart": 216, "lineEnd": 217, "evidenceSha256": "sha256:c82a276bd093aeba64f15dcf38d1b81b60b8407df5c31682c30521afeec14c2b" }
  ],
  "evidenceRequests": [
    { "requestId": "TAPER-800-ADULT-MALE", "eventM": 800, "population": "ADULT", "sex": "MALE", "status": "REVIEWED_ROWS", "sourceIds": ["SRC-PMID-10694140", "SRC-PMID-12165889"] },
    { "requestId": "TAPER-800-YOUTH", "eventM": 800, "population": "YOUTH", "sex": "ANY", "status": "NOT_FOUND", "sourceIds": [] },
    { "requestId": "TAPER-800-CONTROLLED-FEMALE-RUNNING", "eventM": 800, "population": "ANY", "sex": "FEMALE", "status": "NOT_FOUND", "sourceIds": [] },
    { "requestId": "TAPER-1500-ADULT-MALE", "eventM": 1500, "population": "ADULT", "sex": "MALE", "status": "REVIEWED_ROWS", "sourceIds": ["SRC-PMID-1559951", "SRC-PMID-30608885", "SRC-PMID-34062089"] },
    { "requestId": "TAPER-1500-YOUTH", "eventM": 1500, "population": "YOUTH", "sex": "UNKNOWN", "status": "REVIEWED_ROWS", "sourceIds": ["SRC-ANALEFEFS-2014-I1-9"] },
    { "requestId": "TAPER-1500-CONTROLLED-FEMALE-RUNNING", "eventM": 1500, "population": "ANY", "sex": "FEMALE", "status": "NOT_FOUND", "sourceIds": [] },
    { "requestId": "TAPER-3000-YOUTH-MALE", "eventM": 3000, "population": "YOUTH", "sex": "MALE", "status": "REVIEWED_ROWS", "sourceIds": ["SRC-JSTAGE-RJSP-15-2243", "SRC-JSTAGE-JSPEHSSCONF-73-162"] },
    { "requestId": "TAPER-3000-ADULT-FLAT", "eventM": 3000, "population": "ADULT", "sex": "ANY", "status": "NOT_FOUND", "sourceIds": [] },
    { "requestId": "TAPER-3000-CONTROLLED-FEMALE-RUNNING", "eventM": 3000, "population": "ANY", "sex": "FEMALE", "status": "NOT_FOUND", "sourceIds": [] },
    { "requestId": "TAPER-5000-ADULT-MALE", "eventM": 5000, "population": "ADULT", "sex": "MALE", "status": "REVIEWED_ROWS", "sourceIds": ["SRC-PMID-8007812", "SRC-PMID-2318562", "SRC-PMID-8440543"] },
    { "requestId": "TAPER-5000-YOUTH", "eventM": 5000, "population": "YOUTH", "sex": "ANY", "status": "NOT_FOUND", "sourceIds": [] },
    { "requestId": "TAPER-5000-CONTROLLED-FEMALE-RUNNING", "eventM": 5000, "population": "ANY", "sex": "FEMALE", "status": "NOT_FOUND", "sourceIds": [] }
  ],
  "reviewedRows": [
    {
      "sourceId": "SRC-PMID-25189116",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONTEXT_ONLY",
      "fields": {
        "event": ["REPORTED", [800, 1500, 3000, 5000]],
        "population": ["REPORTED", "ELITE_BRITISH_ENDURANCE_RUNNERS"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "EVENT_GROUP_PRACTICE_DIFFERENCES"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "PRACTICE_PREVALENCE_NOT_EFFICACY_AND_BASELINE_REQUIRED"],
        "sourceGrade": ["REPORTED", "PRACTICE_SURVEY_REVIEW_INPUT"]
      },
      "numericObservations": []
    },
    {
      "sourceId": "SRC-PMID-37163550",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONFLICTING",
      "fields": {
        "event": ["NOT_REPORTED", "NOT_FOUND"],
        "population": ["REPORTED", "HETEROGENEOUS_ENDURANCE"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "HETEROGENEOUS_LENGTHS"],
        "volumeChange": ["REPORTED", "HETEROGENEOUS_PROTOCOLS"],
        "frequencyChange": ["REPORTED", "HETEROGENEOUS_PROTOCOLS"],
        "intensityChange": ["REPORTED", "HETEROGENEOUS_PROTOCOLS"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "MIXED_TIME_TRIAL_AND_TIME_TO_EXHAUSTION"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "NO_EXACT_EVENT_YOUTH_FEMALE_OR_9_5_DAY_RULE"],
        "sourceGrade": ["REPORTED", "META_ANALYSIS_REVIEW_INPUT"]
      },
      "numericObservations": [
        { "field": "includedStudies", "provenance": "REPORTED", "value": 14, "unit": "STUDIES" }
      ]
    },
    {
      "sourceId": "SRC-PMID-10694140",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "NULL",
      "fields": {
        "event": ["REPORTED", [800]],
        "population": ["REPORTED", "TRAINED_MIDDLE_DISTANCE_RUNNERS"],
        "sex": ["REPORTED", "MALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "SIX_DAYS"],
        "volumeChange": ["REPORTED", "TWO_REDUCTION_PROTOCOLS_PERCENTAGES_NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "ACTUAL_800_M_PERFORMANCE_NO_SIGNIFICANT_IMPROVEMENT"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "SMALL_MALE_SAMPLE_NULL_NO_UNIVERSAL_PERCENT"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 8, "unit": "ATHLETES" },
        { "field": "taperDuration", "provenance": "REPORTED", "value": 6, "unit": "DAYS" },
        { "field": "conditionCount", "provenance": "REPORTED", "value": 2, "unit": "CONDITIONS" }
      ]
    },
    {
      "sourceId": "SRC-PMID-12165889",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "POSITIVE",
      "fields": {
        "event": ["REPORTED", [800]],
        "population": ["REPORTED", "MALE_MIDDLE_DISTANCE_RUNNERS"],
        "sex": ["REPORTED", "MALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "SIX_DAYS"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["REPORTED", "DAILY_TRAINING_VS_REST_EVERY_THIRD_DAY"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "ACTUAL_800_M_PERFORMANCE_DAILY_CONDITION_IMPROVED"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "SMALL_MALE_SAMPLE_NO_UNIVERSAL_DURATION_OR_FREQUENCY"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 9, "unit": "ATHLETES" },
        { "field": "taperDuration", "provenance": "REPORTED", "value": 6, "unit": "DAYS" },
        { "field": "restInterval", "provenance": "REPORTED", "value": 3, "unit": "EVERY_NTH_DAY" },
        { "field": "dailyConditionSize", "provenance": "REPORTED", "value": 5, "unit": "ATHLETES", "evidenceRef": "SUPP-PMID-12165889-SUBGROUPS" },
        { "field": "restConditionSize", "provenance": "REPORTED", "value": 4, "unit": "ATHLETES", "evidenceRef": "SUPP-PMID-12165889-SUBGROUPS" }
      ]
    },
    {
      "sourceId": "SRC-PMID-1559951",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONTEXT_ONLY",
      "fields": {
        "event": ["REPORTED", [1500]],
        "population": ["REPORTED", "MALE_MIDDLE_DISTANCE_RUNNERS"],
        "sex": ["REPORTED", "MALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "SEVEN_DAYS"],
        "volumeChange": ["REPORTED", "LOW_VOLUME_CONDITION_NO_EXACT_VALUE"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["REPORTED", "HIGH_VS_LOW_VS_REST_ONLY"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "1500_M_PACE_TIME_TO_EXHAUSTION_NOT_RACE"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "NOT_ACTUAL_RACE_NO_RUNTIME_DOSE"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 9, "unit": "ATHLETES" },
        { "field": "taperDuration", "provenance": "REPORTED", "value": 7, "unit": "DAYS" },
        { "field": "conditionCount", "provenance": "REPORTED", "value": 3, "unit": "CONDITIONS" }
      ]
    },
    {
      "sourceId": "SRC-PMID-30608885",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONFLICTING",
      "fields": {
        "event": ["REPORTED", [1500]],
        "population": ["REPORTED", "TRAINED_RUNNERS"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["REPORTED", "FINAL_SESSION_115_PERCENT_RACE_PACE"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "HIGHLY_VARIABLE_LESS_CLEARLY_BENEFICIAL_THAN_RACE_PACE"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "FINAL_SESSION_INTENSITY_REQUIRES_EXACT_REVIEW"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 10, "unit": "ATHLETES" },
        { "field": "finalSessionIntensity", "provenance": "REPORTED", "value": 115, "unit": "PERCENT_OF_RACE_PACE" }
      ]
    },
    {
      "sourceId": "SRC-PMID-34062089",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "POSITIVE",
      "fields": {
        "event": ["REPORTED", [1500]],
        "population": ["REPORTED", "HIGHLY_TRAINED_1500_M_RUNNERS"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["REPORTED", "LOWER_VOLUME_EXACT_VALUE_NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["REPORTED", "FINAL_SESSION_110_PERCENT_RACE_PACE"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "LOWER_VOLUME_FASTER_FINAL_SESSION_PACKAGE_IMPROVED_MORE"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "CONFOUNDED_PACKAGE_NO_SEPARABLE_UNIVERSAL_RULE"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_RUNNING_CROSSOVER"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 8, "unit": "ATHLETES" },
        { "field": "finalSessionIntensity", "provenance": "REPORTED", "value": 110, "unit": "PERCENT_OF_RACE_PACE" }
      ]
    },
    {
      "sourceId": "SRC-PMID-8007812",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "POSITIVE",
      "fields": {
        "event": ["REPORTED", [5000]],
        "population": ["REPORTED", "RUNNERS"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "SEVEN_DAYS"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["REPORTED", "HIGH_INTENSITY_INTERVALS_EXACT_VALUE_NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "ACTUAL_5_KM_RUN_TAPER_IMPROVED"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "ONLY_EIGHT_RUN_TAPER_ATHLETES_NO_UNIVERSAL_TEMPLATE"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "groupCount", "provenance": "REPORTED", "value": 3, "unit": "GROUPS" },
        { "field": "groupSize", "provenance": "REPORTED", "value": 8, "unit": "ATHLETES_PER_GROUP" },
        { "field": "taperDuration", "provenance": "REPORTED", "value": 7, "unit": "DAYS" }
      ]
    },
    {
      "sourceId": "SRC-JSTAGE-RJSP-15-2243",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "NULL",
      "fields": {
        "event": ["REPORTED", [3000]],
        "population": ["REPORTED", "JUNIOR_HIGH_RUNNERS"],
        "sex": ["REPORTED", "MALE"],
        "age": ["REPORTED", "YOUTH_JUNIOR_HIGH"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["REPORTED", "1000_M_STIMULUS_EXACT_INTENSITY_NOT_FOUND"],
        "finalSessionTiming": ["REPORTED", "TAPER_DAY_4_VS_DAY_6"],
        "outcome": ["REPORTED", "NO_SIGNIFICANT_3000_M_DIFFERENCE_FATIGUE_FELL_BOTH"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "DIRECT_YOUTH_MALE_NO_SINGLE_OFFSET_AUTHORITY"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_YOUTH_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 7, "unit": "ATHLETES" },
        { "field": "stimulusDistance", "provenance": "REPORTED", "value": 1000, "unit": "METERS" },
        { "field": "earlierFinalSession", "provenance": "REPORTED", "value": 4, "unit": "TAPER_DAY" },
        { "field": "laterFinalSession", "provenance": "REPORTED", "value": 6, "unit": "TAPER_DAY" }
      ]
    },
    {
      "sourceId": "SRC-JSTAGE-JSPEHSSCONF-73-162",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "NULL",
      "fields": {
        "event": ["REPORTED", [3000]],
        "population": ["REPORTED", "JUNIOR_HIGH_RUNNERS"],
        "sex": ["REPORTED", "MALE"],
        "age": ["REPORTED", "YOUTH_JUNIOR_HIGH"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["REPORTED", "MILEAGE_REDUCTION_21_VS_41_PERCENT"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "NO_SIGNIFICANT_3000_M_DIFFERENCE_LOWER_FATIGUE_AT_41_PERCENT"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "DIRECT_YOUTH_MALE_NO_PERCENT_SUPERIORITY_OR_FEMALE_TRANSFER"],
        "sourceGrade": ["REPORTED", "DIRECT_SMALL_YOUTH_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 12, "unit": "ATHLETES" },
        { "field": "lowerMileageReduction", "provenance": "REPORTED", "value": 21, "unit": "PERCENT" },
        { "field": "higherMileageReduction", "provenance": "REPORTED", "value": 41, "unit": "PERCENT" }
      ]
    },
    {
      "sourceId": "SRC-CINII-1390296343172624640",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONTEXT_ONLY",
      "fields": {
        "event": ["NOT_REPORTED", "NOT_FOUND"],
        "population": ["REPORTED", "JUNIOR_HIGH_HIGH_SCHOOL_UNIVERSITY_COMPANY_RUNNERS"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["REPORTED", "YOUTH_AND_ADULT"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["REPORTED", "HETEROGENEOUS_SOMETIMES_INCREASED"],
        "frequencyChange": ["REPORTED", "HETEROGENEOUS_SOMETIMES_INCREASED"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "PRACTICE_PREVALENCE_ONLY"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "PRACTICE_NOT_EFFICACY_OR_SAFETY_AUTHORITY"],
        "sourceGrade": ["REPORTED", "PRACTICE_SURVEY_REVIEW_INPUT"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 228, "unit": "RUNNERS" }
      ]
    },
    {
      "sourceId": "SRC-ANALEFEFS-2014-I1-9",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "NULL",
      "fields": {
        "event": ["REPORTED", [1500]],
        "population": ["REPORTED", "YOUTH"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["REPORTED", "YOUTH_EXACT_AGE_NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "TWO_14_DAY_PATTERNS"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "NO_SIGNIFICANT_DIFFERENCE"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "UNCLEAR_SEX_AND_PROTOCOL_REPORTING"],
        "sourceGrade": ["REPORTED", "SMALL_YOUTH_RUNNING_STUDY_LIMITED_REPORTING"]
      },
      "numericObservations": [
        { "field": "taperDuration", "provenance": "REPORTED", "value": 14, "unit": "DAYS" },
        { "field": "patternCount", "provenance": "REPORTED", "value": 2, "unit": "PATTERNS" }
      ]
    },
    {
      "sourceId": "SRC-PMID-2318562",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "MAINTENANCE",
      "fields": {
        "event": ["REPORTED", [5000]],
        "population": ["REPORTED", "RUNNERS"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "THREE_WEEKS"],
        "volumeChange": ["REPORTED", "70_PERCENT_REDUCTION"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["REPORTED", "RETAINED"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "ACTUAL_5_KM_MAINTAINED_NOT_IMPROVED"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "MAINTENANCE_IS_NOT_PERFORMANCE_IMPROVEMENT_AUTHORITY"],
        "sourceGrade": ["REPORTED", "DIRECT_RUNNING_TRIAL"]
      },
      "numericObservations": [
        { "field": "taperDuration", "provenance": "REPORTED", "value": 3, "unit": "WEEKS" },
        { "field": "volumeReduction", "provenance": "REPORTED", "value": 70, "unit": "PERCENT" }
      ]
    },
    {
      "sourceId": "SRC-PMID-8440543",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "ADVERSE",
      "fields": {
        "event": ["REPORTED", [5000]],
        "population": ["REPORTED", "RUNNERS"],
        "sex": ["REPORTED", "MALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "FOUR_WEEKS"],
        "volumeChange": ["REPORTED", "REDUCED_EXACT_VALUE_NOT_FOUND"],
        "frequencyChange": ["REPORTED", "REDUCED_EXACT_VALUE_NOT_FOUND"],
        "intensityChange": ["REPORTED", "REDUCED_EXACT_VALUE_NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "NINE_OF_TEN_SLOWED_DESPITE_MAINTAINED_AEROBIC_CAPACITY"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "PHYSIOLOGICAL_MAINTENANCE_NOT_RACE_SUCCESS_SURROGATE"],
        "sourceGrade": ["REPORTED", "DIRECT_RUNNING_ADVERSE_COUNTEREVIDENCE"]
      },
      "numericObservations": [
        { "field": "taperDuration", "provenance": "REPORTED", "value": 4, "unit": "WEEKS" },
        { "field": "slowerAthletes", "provenance": "REPORTED", "value": 9, "unit": "ATHLETES" },
        { "field": "sampleSize", "provenance": "REPORTED", "value": 10, "unit": "ATHLETES" }
      ]
    },
    {
      "sourceId": "SRC-PMID-25134000",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "ADVERSE",
      "fields": {
        "event": ["NOT_APPLICABLE", "NOT_FOUND"],
        "population": ["REPORTED", "TRAINED_TRIATHLETES"],
        "sex": ["REPORTED", "MALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "frequencyChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "intensityChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_APPLICABLE", "NOT_FOUND"],
        "outcome": ["REPORTED", "OVERREACHED_GROUP_LESS_FAVORABLE_PEAK_AND_MORE_INFECTION"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "CROSS_SPORT_BLOCKS_INFERRED_PRE_RACE_OVERLOAD"],
        "sourceGrade": ["REPORTED", "INDIRECT_OVERLOAD_ADVERSE_EVIDENCE"]
      },
      "numericObservations": []
    },
    {
      "sourceId": "SRC-PMID-25019608",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONTEXT_ONLY",
      "fields": {
        "event": ["NOT_APPLICABLE", "NOT_FOUND"],
        "population": ["REPORTED", "OLYMPIC_OR_WORLD_CHAMPION_CROSS_COUNTRY_SKIERS_AND_BIATHLETES"],
        "sex": ["REPORTED", "MIXED_WITH_SEVEN_WOMEN"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["REPORTED", "LONG_INDIVIDUAL_TRAINING_HISTORY_EXACT_UNIT_PERIOD_NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "RETROSPECTIVE_FINAL_PREPARATION_CONTEXT"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "CROSS_SPORT_RETROSPECTIVE_NO_RUNNING_PERCENT_OR_OFFSET"],
        "sourceGrade": ["REPORTED", "INDIRECT_ELITE_FEMALE_TRANSFER_CONTEXT"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 11, "unit": "ATHLETES" },
        { "field": "femaleCount", "provenance": "REPORTED", "value": 7, "unit": "ATHLETES" }
      ]
    },
    {
      "sourceId": "SRC-PMID-17762369",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONFLICTING",
      "fields": {
        "event": ["NOT_REPORTED", "NOT_FOUND"],
        "population": ["REPORTED", "HETEROGENEOUS_ENDURANCE"],
        "sex": ["NOT_REPORTED", "NOT_FOUND"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_REPORTED", "NOT_FOUND"],
        "taperDuration": ["REPORTED", "HETEROGENEOUS"],
        "volumeChange": ["REPORTED", "POOLED_PATTERN_NO_EXACT_RUNTIME_VALUE"],
        "frequencyChange": ["REPORTED", "SUBGROUPS_DO_NOT_SUPPORT_EVERY_REDUCTION"],
        "intensityChange": ["REPORTED", "SUBGROUPS_DO_NOT_SUPPORT_EVERY_REDUCTION"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "FAVORABLE_POOLED_PATTERN_WITH_HETEROGENEITY"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "GROUP_AVERAGE_CANNOT_RESOLVE_DIRECT_NULL_RESULTS"],
        "sourceGrade": ["REPORTED", "META_ANALYSIS_REVIEW_INPUT"]
      },
      "numericObservations": []
    },
    {
      "sourceId": "SRC-PMID-32661839",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONTEXT_ONLY",
      "fields": {
        "event": ["NOT_APPLICABLE", "NOT_FOUND"],
        "population": ["REPORTED", "MENSTRUAL_CYCLE_PERFORMANCE_META_ANALYSIS"],
        "sex": ["REPORTED", "FEMALE_CONTEXT"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_APPLICABLE", "NOT_FOUND"],
        "taperDuration": ["NOT_APPLICABLE", "NOT_FOUND"],
        "volumeChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "frequencyChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "intensityChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_APPLICABLE", "NOT_FOUND"],
        "outcome": ["REPORTED", "AT_MOST_TRIVIAL_AVERAGE_EFFECT_LOW_QUALITY_HETEROGENEOUS"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "INDIVIDUAL_CONSIDERATION_NOT_UNIVERSAL_PHASE_RULE"],
        "sourceGrade": ["REPORTED", "INDIRECT_FEMALE_TRANSFER_CONTEXT"]
      },
      "numericObservations": []
    },
    {
      "sourceId": "SRC-PMID-37726100",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONTEXT_ONLY",
      "fields": {
        "event": ["NOT_APPLICABLE", "NOT_FOUND"],
        "population": ["REPORTED", "FEMALE_ENDURANCE_ATHLETES"],
        "sex": ["REPORTED", "FEMALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_APPLICABLE", "NOT_FOUND"],
        "taperDuration": ["NOT_APPLICABLE", "NOT_FOUND"],
        "volumeChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "frequencyChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "intensityChange": ["NOT_APPLICABLE", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_APPLICABLE", "NOT_FOUND"],
        "outcome": ["REPORTED", "SMALL_PHASE_RELATED_RECOVERY_STATUS_DIFFERENCES"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "CYCLE_PHASE_ONE_OF_MANY_STRESSORS_NO_TAPER_DOSE"],
        "sourceGrade": ["REPORTED", "INDIRECT_FEMALE_TRANSFER_CONTEXT"]
      },
      "numericObservations": []
    },
    {
      "sourceId": "SRC-PMID-36696042",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONFLICTING",
      "fields": {
        "event": ["NOT_APPLICABLE", "NOT_FOUND"],
        "population": ["REPORTED", "MOSTLY_ADULT_MALE_MIXED_SPORTS"],
        "sex": ["REPORTED", "MOSTLY_MALE"],
        "age": ["REPORTED", "MOSTLY_ADULT"],
        "baselineUnitReference": ["NOT_APPLICABLE", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_REPORTED", "NOT_FOUND"],
        "outcome": ["REPORTED", "TAPER_MAY_REDUCE_FATIGUE_AND_MAY_BE_STRESSOR"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "MOSTLY_NON_RUNNING_NO_MOOD_TRIGGERED_RULE"],
        "sourceGrade": ["REPORTED", "INDIRECT_PSYCHOLOGICAL_REVIEW"]
      },
      "numericObservations": []
    },
    {
      "sourceId": "SRC-PMID-2813655",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "CONFLICTING",
      "fields": {
        "event": ["NOT_APPLICABLE", "NOT_FOUND"],
        "population": ["REPORTED", "COLLEGIATE_SWIMMERS"],
        "sex": ["REPORTED", "FEMALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_APPLICABLE", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["NOT_REPORTED", "NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_APPLICABLE", "NOT_FOUND"],
        "outcome": ["REPORTED", "GROUP_MOOD_AND_CORTISOL_RECOVERED_STALE_SUBGROUP_WORSE"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "CROSS_SPORT_MONITORING_CONTEXT_NOT_AUTOMATIC_RULE"],
        "sourceGrade": ["REPORTED", "INDIRECT_PSYCHOLOGICAL_COUNTEREVIDENCE"]
      },
      "numericObservations": [
        { "field": "sampleSize", "provenance": "REPORTED", "value": 14, "unit": "ATHLETES" }
      ]
    },
    {
      "sourceId": "SRC-PMID-9140908",
      "reviewDisposition": "REVIEWED",
      "status": "INACTIVE_RESEARCH_CANDIDATE",
      "numericTaperAuthority": "NOT_GRANTED",
      "resultClass": "ADVERSE",
      "fields": {
        "event": ["NOT_APPLICABLE", "NOT_FOUND"],
        "population": ["REPORTED", "SWIMMERS"],
        "sex": ["REPORTED", "FEMALE"],
        "age": ["NOT_REPORTED", "NOT_FOUND"],
        "baselineUnitReference": ["NOT_APPLICABLE", "NOT_FOUND"],
        "taperDuration": ["NOT_REPORTED", "NOT_FOUND"],
        "volumeChange": ["REPORTED", "REDUCED_EXACT_VALUE_NOT_FOUND"],
        "frequencyChange": ["NOT_REPORTED", "NOT_FOUND"],
        "intensityChange": ["NOT_REPORTED", "NOT_FOUND"],
        "finalSessionTiming": ["NOT_APPLICABLE", "NOT_FOUND"],
        "outcome": ["REPORTED", "MOOD_DETERIORATED_AFTER_REDUCED_TRAINING"],
        "adherence": ["NOT_REPORTED", "NOT_FOUND"],
        "transferLimits": ["REPORTED", "CROSS_SPORT_PSYCHOLOGICAL_COUNTEREVIDENCE_NO_DOSE_RULE"],
        "sourceGrade": ["REPORTED", "INDIRECT_PSYCHOLOGICAL_ADVERSE_EVIDENCE"]
      },
      "numericObservations": []
    }
  ],
  "explicitExclusions": [],
  "owningIssues": [
    {
      "id": "OI-PG-COMPETITION-TAPER-POLICY-001",
      "path": "specs/active/PLAN_GENERATOR_SPEC.md",
      "status": "OPEN"
    },
    {
      "id": "OI-FA-COACH-RULESET-001",
      "path": "specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md",
      "status": "OPEN"
    },
    {
      "id": "CA-O3",
      "path": "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md",
      "status": "NOT_REVIEWED"
    }
  ],
  "prohibitions": [
    "NO_PROTOCOL_AVERAGES",
    "NO_9_5_DAY_TAPER_RULE",
    "NO_INFERRED_YOUTH_OR_FEMALE_MULTIPLIER",
    "NO_RUNTIME_FORMULA",
    "NO_NUMERIC_ACTIVATION",
    "NO_DELEGATED_B_OWNER_SUBSTITUTION"
  ]
}
```

The controlled female-running cells and adult flat-3000 m cell remain explicitly
`NOT_FOUND`. These gaps do not block plan access and do not authorize a hidden
sex, age, population, event, or baseline multiplier. All source-reported numbers
above remain inactive observations bound to their local source fragment.

[DRAFT_COMPLETE]
