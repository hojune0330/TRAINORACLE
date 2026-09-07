import type { PendingMethodProtocol } from "./method-proposal-sequence-v3"
export const METHOD_ADOPTION_PROTOCOLS: PendingMethodProtocol[]
export const METHOD_ADOPTION_VARIANTS: PendingMethodProtocol[]
export function expandProposal(p: PendingMethodProtocol): { role: string; unit: string; value: number; boundary: string }[]
export function assembleProposalSession(p: PendingMethodProtocol): {
  supportRef: { id: string; version: string } | null;
  warmup: { role: string; unit: string; value: number; cue: string }[];
  cooldown: { role: string; unit: string; value: number; cue: string }[];
  supportSeconds: number; totalSeconds: number | null;
}
