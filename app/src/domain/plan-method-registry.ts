import type { DetailedTemplateRef } from "@impl/plan-generator/types"
import type { MethodReference } from "@impl/prescription/method-recommendation"

export const PLAN_METHOD_MAPPING_VERSION = "1.0.0"

export type PlanMethodMapping = {
  readonly mappingVersion: typeof PLAN_METHOD_MAPPING_VERSION
  readonly templateRef: DetailedTemplateRef
  readonly method: MethodReference
}

// Identity crosswalk only, not runtime authority or a claim of equivalent effects.
// These straight distance repetitions at race pace share an approach; event, dose
// and recovery remain independently reviewed configurations, not new families.
export const PLAN_METHOD_REGISTRY: readonly PlanMethodMapping[] = Object.freeze(([
  ["V2-SEED-05", "sha256:ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a"],
  ["MD-800-01", "sha256:8aa917947277883df94a9de665accd59a028b6753cec22d8fecf06795d28b149"],
  ["MD-1500-01", "sha256:dd82bb01baa7b34e163f9148b76eae3956285dc5d1bd7e5217cd39373d966fab"],
  ["MD-3000-01", "sha256:a69b24eccf72be076865b091d6a4ee408da6444512c09a788d717d99adc7a455"],
] as const).map(([templateId, fingerprint]) => Object.freeze({
  mappingVersion: PLAN_METHOD_MAPPING_VERSION,
  templateRef: Object.freeze({ templateId, version: "1.0.0", fingerprint }),
  method: Object.freeze({
    familyId: "race-pace-distance-repetitions",
    configurationId: templateId,
    version: "1.0.0",
  }),
})))

export function resolvePlanMethodMapping(reference: DetailedTemplateRef): PlanMethodMapping | null {
  return PLAN_METHOD_REGISTRY.find(({ templateRef }) => (
    templateRef.templateId === reference.templateId
    && templateRef.version === reference.version
    && templateRef.fingerprint === reference.fingerprint
  )) ?? null
}
