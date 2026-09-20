import type { CreatorProgramVersion } from "./schema"

/** No authorized creator source has been supplied. Test fixtures must never be imported here. */
export const CREATOR_PROGRAM_REGISTRY: readonly CreatorProgramVersion[] = Object.freeze([])

export function getCreatorProgram(programId: string, version: string): CreatorProgramVersion | undefined {
  return CREATOR_PROGRAM_REGISTRY.find(program => program.programId === programId && program.version === version)
}

export function getCreatorProgramSupplyStatus(): "BLOCKED_SOURCE" | "AVAILABLE" {
  return CREATOR_PROGRAM_REGISTRY.length === 0 ? "BLOCKED_SOURCE" : "AVAILABLE"
}
