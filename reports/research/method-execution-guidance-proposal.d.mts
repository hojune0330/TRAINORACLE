import type { PendingMethodProtocol } from "./method-proposal-sequence-v3"
import type { expandProposal } from "./method-adoption-protocols.mjs"

type WorkEffort = { rpe: [number, number] | null; cue: string; adjustment: string }
export function proposeMethodExecutionGuidance(p: PendingMethodProtocol): {
  version: string;
  protocolId: string;
  status: "COACHING_PROPOSAL_NOT_ADOPTED";
  executionAuthority: "NONE";
  scientificDoseValidation: false;
  personalPaceCalculated: false;
  effortProposal: {
    status: "NOT_APPLICABLE";
    work: null;
    recovery: null;
    sessionRpeTarget: null;
  } | {
    status: "PRODUCT_COACHING_CHOICE_OWNER_PENDING";
    scale: "SUBJECTIVE_0_TO_10_WORK_BOUT";
    work: WorkEffort;
    recovery: { rpe: null; cue: string;
      targets: (ReturnType<typeof expandProposal>[number] & { partIndex: number; rpe: [number, number] | null; cue: string })[] };
    sessionRpeTarget: null;
    measuredPhysiology: false;
    automaticDoseChange: false;
    boundary: string;
  };
  methodCue: string | null;
  segments: (ReturnType<typeof expandProposal>[number] & { instruction: string })[];
  offReason: string | null;
  pending: string[];
}
