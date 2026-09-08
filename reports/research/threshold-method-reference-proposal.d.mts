import type { IntervalReferenceInput } from "./interval-reference-proposal.mjs"
import type { METHOD_ADOPTION_PROTOCOLS } from "./method-adoption-protocols.mjs"
export function previewThresholdMethodReference(input: IntervalReferenceInput):
  | { kind: "unavailable"; executionAuthority: "NONE" }
  | {
    kind: "threshold_method_review_preview"; executionAuthority: "NONE";
    protocol: (typeof METHOD_ADOPTION_PROTOCOLS)[number];
    reference: {
      kind: "research_reference"; executionAuthority: "NONE";
      modelId: string; modelVersion: string; secondsPerKm: number[]; secondsPer400m: number[];
      recoverySeconds: null; measuredThreshold: false;
      provenance: { source: string; sourceOffsetUnit: string; offsets: number[]; metersPerMile: number;
        input: Omit<IntervalReferenceInput, "protocolId">; recordIdentityVerified: false; freshnessVerified: false };
      applicability: { status: "NOT_ASSESSED"; protocolBound: true; durationAdjustmentApplied: false;
        environmentAdjustmentApplied: false; populationSuitabilityEstablished: false };
      pendingReviews: string[];
    };
    instructions: Array<{ partIndex: number; role: string; unit: "SECONDS"; value: number;
      set: number; rep: number; boundary: string; stopRule: { kind: "DURATION"; seconds: number };
      paceReference: null | { secondsPerKm: number[]; secondsPer400m: number[]; distanceCompletionRequired: false } }>;
    cue: string; limitations: string[];
  }
