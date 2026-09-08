const introSupport = {
  id: "P-SUPPORT-INTRO-01", version: "0.1", adoptionVersion: "1",
  status: "OWNER_ADOPTED_COMPONENT_ONLY", adoptedOn: "2026-09-08",
  decisionRef: "SESSION_METHOD_OWNER_DECISIONS_2026-09-08#5",
  selectionMode: "USER_EXPLICIT", scope: "INTRODUCTION_REVIEWED_MAIN_AND_FULL_PLAN_REQUIRED",
  executionAuthority: "NONE", independentExpertApproval: false,
  warmup: [
    { role: "EASY_RUN", unit: "SECONDS", value: 300, cue: "RPE 2-3" },
    { role: "BUILDUP", unit: "SECONDS", value: 20, cue: "PROGRESSIVE_NOT_ALL_OUT" },
    { role: "WALK", unit: "SECONDS", value: 60, cue: "WALK" },
    { role: "BUILDUP", unit: "SECONDS", value: 20, cue: "PROGRESSIVE_NOT_ALL_OUT" },
    { role: "WALK", unit: "SECONDS", value: 60, cue: "WALK" },
  ],
  cooldown: [{ role: "EASY_RUN", unit: "SECONDS", value: 300, cue: "RPE 1-2" }],
} as const

/** Component adoption does not grant MAIN, combination, or personal-pace authority. */
export function readOwnerAdoptedSupportV3(id: string, version: string) {
  return id === introSupport.id && version === introSupport.version ? structuredClone(introSupport) : null
}
