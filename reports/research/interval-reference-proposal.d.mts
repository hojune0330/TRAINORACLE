export type IntervalReferenceInput = {
  protocolId: string; eventDistanceM: number; performanceSeconds: number;
  freshness: string; purpose: string;
}
export function calculateIntervalReferenceProposal(input: IntervalReferenceInput):
  | { kind: "unavailable"; executionAuthority: "NONE" }
  | { kind: "research_reference"; executionAuthority: "NONE"; protocolId: string;
      modelId: string; modelVersion: string; secondsPerKm: number; secondsPer400m: number;
      prescription: { workSeconds: number; repeats: number; restSeconds: number; finalRecoverySeconds: null };
      recoveryMode: "JOG"; measuredVo2maxPace: false;
      provenance: { inputEventDistanceM: number; inputPerformanceSeconds: number; inputPurpose: string;
        freshnessClaim: string; verifiedRecordIdentity: false; backgroundIsFormulaSource: false;
        derivation: string; adoptionBasis: string };
    }
