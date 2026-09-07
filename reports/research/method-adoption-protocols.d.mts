import type { PendingMethodProtocol } from "./method-proposal-sequence-v3"
export const METHOD_ADOPTION_PROTOCOLS: PendingMethodProtocol[]
export const METHOD_ADOPTION_VARIANTS: PendingMethodProtocol[]
export const MAIN_SUPPORT_PROPOSAL: { id: string; version: string; status: string; executionAuthority: string;
  warmup: { role: string; unit: string; value: number; cue: string }[];
  cooldown: { role: string; unit: string; value: number; cue: string }[] }
export const INTRO_MAIN_SUPPORT_PROPOSAL: typeof MAIN_SUPPORT_PROPOSAL
export function expandProposal(p: PendingMethodProtocol): { role: string; unit: string; value: number; boundary: string; set: number; rep: number }[]
export function assembleProposalSession(p: PendingMethodProtocol, supportVariant?: "EXISTING" | "INTRO_COMPARISON"): {
  supportRef: { id: string; version: string } | null;
  main: ReturnType<typeof expandProposal>;
  warmup: { role: string; unit: string; value: number; cue: string }[];
  cooldown: { role: string; unit: string; value: number; cue: string }[];
  supportSeconds: number; totalSeconds: number | null;
}
