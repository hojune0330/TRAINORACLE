export type ProposedMethodContext = {
  eventDistanceM: number; experience: string; population: string; actor: string; family: string;
}
export function previewMethodScope(context: ProposedMethodContext): {
  kind: "invalid_context" | "scope_preview"; executionAuthority: "NONE";
  rows: { id: string; scopeMatch: boolean; reasons: string[] }[];
}
