import type { PendingMethodProtocol } from "./method-proposal-sequence-v3"
export const METHOD_ADOPTION_PROTOCOLS: PendingMethodProtocol[]
export const METHOD_ADOPTION_VARIANTS: PendingMethodProtocol[]
export function expandProposal(p: PendingMethodProtocol): { role: string; unit: string; value: number; boundary: string }[]
