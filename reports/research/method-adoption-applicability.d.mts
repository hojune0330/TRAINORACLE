export type ProposedMethodContext = {
  eventDistanceM: number; experience: string; population: string; actor: string; family: string;
}
export const PROPOSED_METHOD_SCOPES: {
  id: string; eventDistances: number[]; experience: string[]; replacementRole: string;
  population: string[]; actor: string[]; status: "OWNER_ADOPTION_PENDING";
}[]
export function previewMethodScope(context: ProposedMethodContext): {
  kind: "invalid_context" | "scope_preview"; executionAuthority: "NONE";
  rows: { id: string; scopeMatch: boolean; reasons: string[] }[];
}
