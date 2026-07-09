// allow: SIZE_OK - verbatim D9 evaluator module extracted from runtime evidence; SHA recorded in impl/README.md.
export type D9Disposition = "D9_ACTIVE" | "D9_UNKNOWN" | "D9_CLEARED";
type Route = "ACTIVE" | "UNKNOWN" | "ADVISORY";

interface Evidence {
  ruleId: string;
  family: string;
  route: Route;
  reasonCode: string;
  clauseIndex: number;
  clause: string;
  matchedBy: string[];
}

export interface D9Result {
  disposition: D9Disposition;
  blocksPlanGeneration: boolean;
  reasonCodes: string[];
  evidence: Evidence[];
}

interface Rule {
  id: string;
  family: string;
  route: Route;
  reasonCode: string;
  any?: RegExp[];
  all?: RegExp[];
  none?: RegExp[];
  suppressibleByHardNegation?: boolean;
  suppressibleBySoftMitigation?: boolean;
}

const RX2 = {
  bodyPartStrict:
    /(햄스트링|햄스|종아리|비복근|가자미근|아킬레스|사타구니|고관절|둔근|허리|무릎|정강이|발목|발바닥|족저|발등|엉덩이)/u,

  genericFootWithSymptom:
    /((발(?!표|전|생|견|음|달|길).{0,12}(접질|삐끗|꺾|아프|아픈|아파|아픔|아팠|통증|찌릿|붓|부었|열감))|((접질|삐끗|꺾|아프|아픈|아파|아픔|아팠|통증|찌릿|붓|부었|열감).{0,12}발(?!표|전|생|견|음|달|길)))/u,

  current:
    /(지금|오늘|방금|어제부터|훈련\s*중|뛰다가|이후로|아직|계속|남아|안\s*없어|안\s*풀려)/u,

  acuteCatastrophic:
    /(뚝|퍽|찢(어|어진|어졌)?|터진|파열|끊어|끊어진)/u,

  acuteMechanical:
    /(삐끗|접질|꺾였|꺾인|접지른|접질렀)/u,

  acuteSharpOrPull:
    /(찌릿|저릿|전기|잡혔|올라왔|땡기|땡김|당기|당김)/u,

  painHigh:
    /(찌르|찌릿|전기|타는|찢어|터질|날카|쥐어짜|저려|저림|마비|감각\s*이상)/u,

  painConcerning:
    /(욱신|쑤시|쑤셔|땡기|땡겨|땡김|당기|당겨|당김|아프|아픈|아파|아픔|아팠|통증)/u,

  painWeak:
    /(뻐근|묵직|불편|무거|근육통|알\s*배김|알배김|운동한\s*느낌)/u,

  contextualAbnormal:
    /((몸|다리|느낌|호흡|숨|컨디션).{0,5}이상|이상.{0,5}(느낌|호흡|숨|컨디션))/u,

  functionLimit:
    /(못\s*(디디|딛|걷|뛰)|체중.{0,6}못\s*(싣|실)|절뚝|쩔뚝|걷기\s*힘|뛰기\s*힘|주저앉|무너질|불안정|빠질\s*것\s*같|꺾일\s*것\s*같|폼이\s*바뀌|균형\s*안)/u,

  worsening:
    /(점점|더\s*아파|더\s*심해|심해져|악화|계속\s*(남|아프|아파|쑤시|욱신|불편|그래)|안\s*없어|안\s*풀려|워밍업해도|워밍업할수록|(?:뛰|뛸|달리|달릴|걷|걸을|움직|움직일|디디|디딜|밟|밟을)\s*수록|(?:뛸|달릴|걸을|움직일|디딜|밟을)\s*때마다|자고\s*일어났는데|어제보다|반복)/u,

  localInflammation:
    /((무릎|발목|아킬레스|정강이|발등|발바닥|종아리|햄스트링|햄스|발(?!표|전|생|견|음|달|길)).{0,24}(붓|부었|부어|열감|화끈|후끈)|((붓|부었|부어|열감|화끈|후끈).{0,24}(무릎|발목|아킬레스|정강이|발등|발바닥|종아리|햄스트링|햄스|발(?!표|전|생|견|음|달|길)|느낌)))/u,

  fever:
    /(발열|고열|오한|몸살|독감|코로나|열(이|은|도)?\s*(좀|약간|많이|계속)?\s*(나|나요|남|난다|올라)|체온.{0,6}(3[8-9]|4[0-2])|3[8-9](\.\d)?\s*도)/u,

  // lint/reference only. 실제 SYSTEMIC_FEVER rule의 none suppressor로 쓰지 않는다.
  falseFever:
    /(열심|열정|열\s*번|열개|열\s*번째|대열|정렬|열감)/u,

  vomiting:
    /(구토|토했|토해|토함|토할|토\s*나올|메스꺼)/u,

  // lint/reference only. 실제 VOMITING rule의 none suppressor로 쓰지 않는다.
  falseVomiting:
    /(토요일|토욜|토너먼트|토픽|토양)/u,

  respiratoryIllness:
    /(코로나|감기|기침.{0,5}(심|계속|많)|가래.{0,5}(많|심|계속)?|인후통|목.{0,5}(아프|붓)|콧물.{0,5}(심|많|계속))/u,

  chest:
    /((가슴|흉통).{0,8}(답답|조이|압박|쥐어짜|아프|통증)|(답답|조이|압박).{0,8}(가슴|흉통))/u,

  breathingSevere:
    /(호흡\s*곤란|숨(이|을)?\s*(안\s*(돌아|쉬어|쉬|참)|막혀|가빠|이상|답답))/u,

  syncope:
    /(실신|기절|쓰러질|쓰러졌|눈앞.{0,6}(깜깜|하얘)|핑\s*돌|어지러.{0,8}(쓰러|실신|기절))/u,

  heart:
    /((심장|맥박).{0,8}(불규칙|이상|두근|쿵쾅))/u,

  neuro:
    /((한쪽).{0,8}(마비|저림|힘\s*빠|감각\s*이상)|말이\s*어눌|심한\s*두통|마비)/u,

  authority:
    /(병원|의사|치료사|물리치료|트레이너|보호자|코치)/u,

  restriction:
    /(금지|하지\s*말|뛰지\s*말|쉬라|쉬라고|보류|중단)/u,

  rehabActive:
    /(재활\s*중|재활중|아직\s*재활|복귀\s*전|완치\s*전|치료\s*중)/u,

  rehabCleared:
    /(복귀\s*(허가|승인|완료|했|함)|클리어런스\s*(받|완료)|의사가\s*(뛰어도|해도)\s*된)/u,

  riskMaskingHard:
    /(참고|그냥\s*(할|하|뛰)|해볼게|뛰어볼게|약\s*(먹|복용)|진통제|파스|테이핑|테잎|붕대|무시하고|참을\s*만|참을만|시합이라|대회라|중요한\s*훈련)/u,

  softMitigationClear:
    /(괜찮(아|아요)?|갠찮|괜춘|할\s*만|할만|걸을\s*만|뛸\s*만|풀렸|나아졌|가볍게)/u,

hedgedNegation:
    /(괜찮(?:은|긴|았)?\s*(데|는데)|괜찮긴\s*한데|갠찮(?:은|긴|았)?\s*(데|는데)|참을\s*만(?:한)?데|통증.{0,8}없\s*(는데|지만|긴\s*한데)|아프(?:지|진)\s*않(?:은|는)?\s*(데|는데|지만|긴\s*한데)|없긴\s*한데|아닌\s*것\s*같긴\s*한데)/u,

  hardNegation:
    /(통증.{0,6}없|아프(?:지|진)\s*않|괜찮아졌|나았|사라졌|풀렸)/u,

  ambiguous:
    /(쎄하|쌔하|찝찝|평소랑\s*달라|몸이.{0,8}안\s*받|다리가.{0,8}안\s*나가|컨디션\s*바닥|기운\s*없|뭔가\s*아닌|느낌이\s*이상)/u,

  permissionQuestion:
    /((뛰|달리|훈련|운동|인터벌|스프린트).{0,12}(해도|해볼|되|될까|되까|괜찮|가능|가도))/u,

  equipmentOnly:
    /((신발|스파이크|양말|깔창|끈|레이스).{0,10}(불편|무거|딱딱|헐거|조여|쓸려)|(불편|무거|딱딱|헐거|조여).{0,10}(신발|스파이크|양말|깔창|끈|레이스))/u,
};

const RULES_V2: Rule[] = [
  { id: "MED_CHEST", family: "medical_red_flag", route: "ACTIVE", reasonCode: "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM", any: [RX2.chest] },
  { id: "MED_BREATHING_SEVERE", family: "medical_red_flag", route: "ACTIVE", reasonCode: "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM", any: [RX2.breathingSevere] },
  { id: "MED_SYNCOPE", family: "medical_red_flag", route: "ACTIVE", reasonCode: "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM", any: [RX2.syncope] },
  { id: "MED_HEART", family: "medical_red_flag", route: "ACTIVE", reasonCode: "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM", any: [RX2.heart] },
  { id: "MED_NEURO", family: "medical_red_flag", route: "ACTIVE", reasonCode: "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM", any: [RX2.neuro] },

  { id: "SYSTEMIC_FEVER", family: "illness", route: "ACTIVE", reasonCode: "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM", any: [RX2.fever] },
  { id: "VOMITING", family: "illness", route: "ACTIVE", reasonCode: "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM", any: [RX2.vomiting] },
  { id: "RESPIRATORY_ILLNESS", family: "illness", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_RESPIRATORY_ILLNESS_CONTEXT", any: [RX2.respiratoryIllness] },

  { id: "LOCAL_INFLAMMATION", family: "local_inflammation", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_LOCAL_INFLAMMATION_SIGN", any: [RX2.localInflammation] },

  { id: "FUNCTION_LIMIT", family: "functional_limitation", route: "ACTIVE", reasonCode: "D9_ACTIVE_ACUTE_INJURY_OR_FUNCTIONAL_LIMITATION", any: [RX2.functionLimit] },

  { id: "AUTHORITY_RESTRICTION", family: "authority_hold", route: "ACTIVE", reasonCode: "D9_ACTIVE_MANUAL_OR_MEDICAL_HOLD", all: [RX2.authority, RX2.restriction] },

  { id: "REHAB_NOT_CLEARED", family: "return_to_play", route: "ACTIVE", reasonCode: "D9_ACTIVE_RETURN_TO_PLAY_NOT_CLEARED", all: [RX2.rehabActive], none: [RX2.rehabCleared] },

  { id: "CATASTROPHIC_ACUTE_BODY", family: "acute_injury", route: "ACTIVE", reasonCode: "D9_ACTIVE_ACUTE_INJURY_OR_FUNCTIONAL_LIMITATION", all: [RX2.acuteCatastrophic], any: [RX2.bodyPartStrict, RX2.genericFootWithSymptom] },

  { id: "MECHANICAL_ACUTE_WITH_LOCAL_SIGN", family: "acute_injury", route: "ACTIVE", reasonCode: "D9_ACTIVE_ACUTE_INJURY_OR_FUNCTIONAL_LIMITATION", all: [RX2.acuteMechanical], any: [RX2.localInflammation, RX2.functionLimit] },

  { id: "MECHANICAL_ACUTE_BODY_NO_CONTEXT", family: "possible_injury", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_ACUTE_BODYPART_INSUFFICIENT_CONTEXT", all: [RX2.acuteMechanical], any: [RX2.bodyPartStrict, RX2.genericFootWithSymptom] },

  { id: "SHARP_OR_PULL_BODY", family: "possible_injury", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_BODYPART_PAIN_INSUFFICIENT_CONTEXT", all: [RX2.acuteSharpOrPull], any: [RX2.bodyPartStrict, RX2.genericFootWithSymptom] },

  { id: "HIGH_PAIN_WORSENING", family: "acute_injury", route: "ACTIVE", reasonCode: "D9_ACTIVE_ACUTE_INJURY_OR_FUNCTIONAL_LIMITATION", all: [RX2.painHigh, RX2.worsening] },

  { id: "CONCERNING_PAIN_WORSENING", family: "possible_injury", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_PAIN_WORSENING", all: [RX2.painConcerning, RX2.worsening] },

  { id: "BODY_WITH_CONCERNING_PAIN", family: "possible_injury", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_BODYPART_PAIN_INSUFFICIENT_CONTEXT", all: [RX2.painConcerning], any: [RX2.bodyPartStrict, RX2.genericFootWithSymptom], suppressibleByHardNegation: true },

  { id: "BODY_WITH_WEAK_PAIN_ADVISORY", family: "mild_training_response", route: "ADVISORY", reasonCode: "D9_ADVISORY_MILD_BODYPART_DISCOMFORT", all: [RX2.painWeak], any: [RX2.bodyPartStrict, RX2.genericFootWithSymptom], none: [RX2.equipmentOnly], suppressibleBySoftMitigation: true, suppressibleByHardNegation: true },

  { id: "WEAK_PAIN_NO_BODYPART_ADVISORY", family: "mild_training_response", route: "ADVISORY", reasonCode: "D9_ADVISORY_UNLOCALIZED_DISCOMFORT", all: [RX2.painWeak], none: [RX2.equipmentOnly], suppressibleBySoftMitigation: true, suppressibleByHardNegation: true },

  { id: "WEAK_PAIN_WORSENING", family: "possible_injury", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_MILD_SYMPTOM_WORSENING", all: [RX2.painWeak, RX2.worsening] },

  {
    id: "RISK_MASKING_WITH_SYMPTOM",
    family: "risk_masking",
    route: "UNKNOWN",
    reasonCode: "D9_UNKNOWN_RISK_MASKING_WITH_SYMPTOM",
    all: [RX2.riskMaskingHard],
    any: [
      RX2.painHigh,
      RX2.painConcerning,
      RX2.painWeak,
      RX2.acuteCatastrophic,
      RX2.acuteMechanical,
      RX2.acuteSharpOrPull,
      RX2.bodyPartStrict,
      RX2.genericFootWithSymptom,
    ],
  },

  {
    id: "PERMISSION_QUESTION_WITH_SYMPTOM",
    family: "permission_question",
    route: "UNKNOWN",
    reasonCode: "D9_UNKNOWN_ATHLETE_REQUESTS_PERMISSION_WITH_SYMPTOM",
    all: [RX2.permissionQuestion],
    any: [
      RX2.bodyPartStrict,
      RX2.genericFootWithSymptom,
      RX2.painHigh,
      RX2.painConcerning,
      RX2.painWeak,
      RX2.acuteSharpOrPull,
    ],
  },

  { id: "AMBIGUOUS_STANDALONE", family: "ambiguous_concern", route: "UNKNOWN", reasonCode: "D9_UNKNOWN_AMBIGUOUS_CONCERN_STANDALONE", any: [RX2.ambiguous, RX2.contextualAbnormal], suppressibleByHardNegation: true },
];

function normalizeKoreanSafetyText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/쩔뚝/g, "절뚝")
    .replace(/쌔하/g, "쎄하")
    .replace(/갠찮/g, "괜찮")
    .replace(/\s+/g, " ")
    .trim();
}

function splitClauses(text: string): string[] {
  const marked = text
    .replace(/[\n.!?;。！？,，]+/gu, ".")
    .replace(/(^|\s)(근데|그런데|하지만|다만|그리고)(?=\s|$)/gu, "$1.");

  return marked
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
}

function testAny(regexes: RegExp[] | undefined, clause: string): boolean {
  if (!regexes || regexes.length === 0) return true;
  return regexes.some((r) => r.test(clause));
}

function testAll(regexes: RegExp[] | undefined, clause: string): boolean {
  if (!regexes || regexes.length === 0) return true;
  return regexes.every((r) => r.test(clause));
}

function testNone(regexes: RegExp[] | undefined, clause: string): boolean {
  if (!regexes || regexes.length === 0) return true;
  return !regexes.some((r) => r.test(clause));
}

function hasHardRiskInClause(clause: string): boolean {
  return [
    RX2.acuteCatastrophic,
    RX2.acuteMechanical,
    RX2.acuteSharpOrPull,
    RX2.painHigh,
    RX2.painConcerning,
    RX2.functionLimit,
    RX2.worsening,
    RX2.localInflammation,
    RX2.riskMaskingHard,
    RX2.chest,
    RX2.breathingSevere,
    RX2.syncope,
    RX2.heart,
    RX2.neuro,
    RX2.authority,
    RX2.restriction,
    RX2.rehabActive,
  ].some((rx) => rx.test(clause));
}

function isSuppressed(rule: Rule, clause: string): boolean {
  // “괜찮은데”, “괜찮았는데”, “통증은 없는데”는 위험 해제가 아니다.
  if (RX2.hedgedNegation.test(clause)) return false;

  if (rule.suppressibleByHardNegation && RX2.hardNegation.test(clause)) {
    return true;
  }

  // soft mitigation은 ADVISORY만 낮출 수 있다.
  if (rule.suppressibleBySoftMitigation && RX2.softMitigationClear.test(clause)) {
    if (hasHardRiskInClause(clause)) return false;
    return true;
  }

  return false;
}

function matchedBy(rule: Rule, clause: string): string[] {
  return [...(rule.all ?? []), ...(rule.any ?? [])]
    .filter((r) => r.test(clause))
    .map((r) => r.source);
}

function matchRule(rule: Rule, clause: string): boolean {
  if (!testNone(rule.none, clause)) return false;
  if (!testAll(rule.all, clause)) return false;
  if (!testAny(rule.any, clause)) return false;
  if (isSuppressed(rule, clause)) return false;
  return true;
}

function routeRank(route: Route): number {
  if (route === "ACTIVE") return 3;
  if (route === "UNKNOWN") return 2;
  return 1;
}

function dedupeEvidence(evidence: Evidence[]): Evidence[] {
  const map = new Map<string, Evidence>();

  for (const ev of evidence) {
    const key = `${ev.family}:${ev.clauseIndex}`;
    const prev = map.get(key);

    if (!prev || routeRank(ev.route) > routeRank(prev.route)) {
      map.set(key, ev);
    }
  }

  return [...map.values()];
}

function finalizeD9(evidence: Evidence[]): D9Result {
  const active = evidence.filter((e) => e.route === "ACTIVE");
  if (active.length > 0) {
    return {
      disposition: "D9_ACTIVE",
      blocksPlanGeneration: true,
      reasonCodes: [...new Set(active.map((e) => e.reasonCode))],
      evidence,
    };
  }

  const unknown = evidence.filter((e) => e.route === "UNKNOWN");
  if (unknown.length > 0) {
    return {
      disposition: "D9_UNKNOWN",
      blocksPlanGeneration: true,
      reasonCodes: [...new Set(unknown.map((e) => e.reasonCode))],
      evidence,
    };
  }

  const advisory = evidence.filter((e) => e.route === "ADVISORY");
  if (advisory.length > 0) {
    return {
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: [
        "D9_CLEARED_WITH_NON_BLOCKING_ADVISORY",
        ...new Set(advisory.map((e) => e.reasonCode)),
      ],
      evidence,
    };
  }

  return {
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
    evidence: [],
  };
}

export function evaluateD9ColloquialLayer(freeText?: string): D9Result {
  const text = normalizeKoreanSafetyText(freeText ?? "");

  if (!text) {
    return {
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: ["D9_COLLOQUIAL_NO_TEXT"],
      evidence: [],
    };
  }

  const clauses = splitClauses(text);
  const evidence: Evidence[] = [];

  clauses.forEach((clause, clauseIndex) => {
    for (const rule of RULES_V2) {
      if (matchRule(rule, clause)) {
        evidence.push({
          ruleId: rule.id,
          family: rule.family,
          route: rule.route,
          reasonCode: rule.reasonCode,
          clauseIndex,
          clause,
          matchedBy: matchedBy(rule, clause),
        });
      }
    }
  });

  return finalizeD9(dedupeEvidence(evidence));
}

export function d9ToSafetySignal(result: D9Result) {
  if (result.disposition === "D9_ACTIVE") {
    return {
      ruleRef: "RULE_SPEC_D1_D9.D-9",
      storedStatus: "ACTIVE" as const,
      blocksPlanGeneration: true,
      nonSensitiveReasonCodes: result.reasonCodes,
    };
  }

  if (result.disposition === "D9_UNKNOWN") {
    return {
      ruleRef: "RULE_SPEC_D1_D9.D-9",
      storedStatus: "UNKNOWN" as const,
      blocksPlanGeneration: true,
      nonSensitiveReasonCodes: result.reasonCodes,
    };
  }

  return {
    ruleRef: "RULE_SPEC_D1_D9.D-9",
    storedStatus: "CLEARED" as const,
    blocksPlanGeneration: false,
    nonSensitiveReasonCodes: result.reasonCodes,
  };
}
