export const ENERGY_SYSTEM_KEYS = [
  "RECOVERY",
  "BASE",
  "LT",
  "VO2",
  "GLY",
  "ATP_PC",
  "MIXED_UNALLOCATED",
] as const

export type EnergySystemKey = (typeof ENERGY_SYSTEM_KEYS)[number]

export const ENERGY_SYSTEM_META: Readonly<Record<EnergySystemKey, {
  readonly code: string
  readonly shortLabel: string
  readonly journalValue: string
}>> = {
  RECOVERY: { code: "REC", shortLabel: "회복", journalValue: "rest" },
  BASE: { code: "BASE", shortLabel: "기초 지구력", journalValue: "base" },
  LT: { code: "LT", shortLabel: "지속 페이스", journalValue: "lt" },
  VO2: { code: "VO2", shortLabel: "강한 유산소", journalValue: "vo2" },
  GLY: { code: "GLY", shortLabel: "젖산성 스피드", journalValue: "gly" },
  ATP_PC: { code: "ATP", shortLabel: "짧고 빠른 가속", journalValue: "atp" },
  MIXED_UNALLOCATED: { code: "MIX", shortLabel: "복합·미배분", journalValue: "mixed" },
}

export const JOURNAL_ENERGY_SYSTEM_OPTIONS = ENERGY_SYSTEM_KEYS.map((key) => ({
  key,
  ...ENERGY_SYSTEM_META[key],
}))

const JOURNAL_VALUE_TO_KEY = new Map(
  JOURNAL_ENERGY_SYSTEM_OPTIONS.map((option) => [option.journalValue, option.key]),
)

const PLANNED_INTENT_TO_KEY: Readonly<Record<string, EnergySystemKey>> = {
  RECOVERY_INTENT: "RECOVERY",
  BASE_INTENT: "BASE",
  LT_INTENT: "LT",
  VO2_INTENT: "VO2",
  GLY_INTENT: "GLY",
  ATP_PC_INTENT: "ATP_PC",
  MIXED_INTENT: "MIXED_UNALLOCATED",
}

export function journalSystemToEnergySystem(value: string): EnergySystemKey | null {
  return JOURNAL_VALUE_TO_KEY.get(value) ?? null
}

export function plannedIntentToEnergySystem(value: string): EnergySystemKey | null {
  return PLANNED_INTENT_TO_KEY[value] ?? null
}
