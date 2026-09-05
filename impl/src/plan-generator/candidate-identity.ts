import type {
  PlanCandidate,
  PlanCandidateKind,
  PlanSourceMode,
  PlanSelectionAuthority,
  PlannedEnergyIntent,
  DetailedTemplateRef,
  SupportedPlanEventDistanceM,
} from "./types"
import type { CanonicalPlanFrame, PlanSession } from "./session-types"

const CANDIDATE_HASH_MARKER = ":candidate-sha256-"
const PAIR_HASH_MARKER = ":pair-sha256-"
const PACE_TARGET_MARKER = ":pace-target:"

const SHA256_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

export type PlanCandidateIdentityProjection = {
  readonly kind: PlanCandidateKind
  readonly eventDistanceM: SupportedPlanEventDistanceM
  readonly selectedDetailedTemplateRef: DetailedTemplateRef | null
  readonly selectedEnergyIntent: PlannedEnergyIntent
  readonly sourceMode: PlanSourceMode
  readonly selectionAuthority: PlanSelectionAuthority
  readonly frame: CanonicalPlanFrame
  readonly sessions: readonly PlanSession[]
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value !== "object") throw new TypeError("Candidate identity requires JSON data")
  const record = value as Readonly<Record<string, unknown>>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift))
}

function utf8Bytes(input: string): Uint8Array {
  const bytes: number[] = []
  for (const character of input) {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined) continue
    if (codePoint <= 0x7f) bytes.push(codePoint)
    else if (codePoint <= 0x7ff) bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f))
    else if (codePoint <= 0xffff) bytes.push(
      0xe0 | (codePoint >>> 12),
      0x80 | ((codePoint >>> 6) & 0x3f),
      0x80 | (codePoint & 0x3f),
    )
    else bytes.push(
      0xf0 | (codePoint >>> 18),
      0x80 | ((codePoint >>> 12) & 0x3f),
      0x80 | ((codePoint >>> 6) & 0x3f),
      0x80 | (codePoint & 0x3f),
    )
  }
  return Uint8Array.from(bytes)
}

function sha256Hex(input: string): string {
  const bytes = utf8Bytes(input)
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const words = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false)
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0
      const previous2 = words[index - 2] ?? 0
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3)
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10)
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0
    }

    let a = hash[0] ?? 0
    let b = hash[1] ?? 0
    let c = hash[2] ?? 0
    let d = hash[3] ?? 0
    let e = hash[4] ?? 0
    let f = hash[5] ?? 0
    let g = hash[6] ?? 0
    let h = hash[7] ?? 0
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 = (h + sum1 + choice + (SHA256_CONSTANTS[index] ?? 0) + (words[index] ?? 0)) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }
    hash[0] = ((hash[0] ?? 0) + a) >>> 0
    hash[1] = ((hash[1] ?? 0) + b) >>> 0
    hash[2] = ((hash[2] ?? 0) + c) >>> 0
    hash[3] = ((hash[3] ?? 0) + d) >>> 0
    hash[4] = ((hash[4] ?? 0) + e) >>> 0
    hash[5] = ((hash[5] ?? 0) + f) >>> 0
    hash[6] = ((hash[6] ?? 0) + g) >>> 0
    hash[7] = ((hash[7] ?? 0) + h) >>> 0
  }
  return [...hash].map((word) => word.toString(16).padStart(8, "0")).join("")
}

export function canonicalJsonFingerprint(domain: string, value: unknown): string {
  return `sha256:${sha256Hex(`${domain}\0${canonicalJson(value)}`)}`
}

export function detailedPrescriptionFingerprintFromSessions(
  sessions: readonly PlanSession[],
): string | null {
  const details = sessions.flatMap(session => session.prescription.kind === "PACE_TARGET"
    ? [{ day: session.day, slot: session.slot, fingerprint: session.prescription.prescriptionFingerprint }]
    : []).sort((left, right) => left.day - right.day || left.slot.localeCompare(right.slot))
  if (details.length === 0) return null
  if (details.length === 1) return details[0]?.fingerprint ?? null
  return canonicalJsonFingerprint("trainoracle.multi-detailed-prescription.v1", details)
}

function detailedFingerprint(projection: PlanCandidateIdentityProjection): string | null {
  return detailedPrescriptionFingerprintFromSessions(projection.sessions)
}

function candidateBaseId(candidateId: string): string {
  const withoutPrescription = candidateId.split(PACE_TARGET_MARKER)[0] ?? candidateId
  const markerIndex = withoutPrescription.indexOf(CANDIDATE_HASH_MARKER)
  return markerIndex < 0 ? withoutPrescription : withoutPrescription.slice(0, markerIndex)
}

function pairBaseId(pairId: string): string {
  const markerIndex = pairId.indexOf(PAIR_HASH_MARKER)
  return markerIndex < 0 ? pairId : pairId.slice(0, markerIndex)
}

export function projectPlanCandidate(candidate: PlanCandidate): PlanCandidateIdentityProjection {
  return {
    kind: candidate.kind,
    eventDistanceM: candidate.eventDistanceM,
    selectedDetailedTemplateRef: candidate.selectedDetailedTemplateRef,
    selectedEnergyIntent: candidate.selectedEnergyIntent,
    sourceMode: candidate.sourceMode,
    selectionAuthority: candidate.selectionAuthority,
    frame: candidate.frame,
    sessions: candidate.sessions,
  }
}

export function continuityContextIdentity(
  context: PlanCandidate["continuityContext"],
): string {
  if (context.kind === "NO_PREVIOUS_FRAME_CONTEXT") return "no-continuity"
  return `${context.previousCandidateKind.toLowerCase()}:${context.progressStateCounts
    .map((entry) => `${entry.state.toLowerCase()}-${entry.count}`)
    .join("-")}`
}

export function continuityIdentityFromCandidateId(candidateId: string): string | null {
  const segments = candidateBaseId(candidateId).split(":")
  const templateIndex = segments.findIndex(
    (segment, index) => index > 12 && segment.startsWith("template-"),
  )
  if (templateIndex < 0) return null
  const identity = segments.slice(13, templateIndex).join(":")
  if (identity === "no-continuity") return identity
  return /^(?:balanced|conservative):(?:completed|rested|skipped|pain_checkin)-\d+(?:-(?:completed|rested|skipped|pain_checkin)-\d+)*$/u.test(identity)
    ? identity
    : null
}

export function deriveCandidateId(
  candidateId: string,
  projection: PlanCandidateIdentityProjection,
): string {
  const digest = sha256Hex(`trainoracle.plan-candidate-identity.v1\0${canonicalJson(projection)}`)
  const prescriptionFingerprint = detailedFingerprint(projection)
  const prescriptionSuffix = prescriptionFingerprint === null
    ? ""
    : `${PACE_TARGET_MARKER}${prescriptionFingerprint}`
  return `${candidateBaseId(candidateId)}${CANDIDATE_HASH_MARKER}${digest}${prescriptionSuffix}`
}

export function hasValidCandidateIdentity(
  candidateId: string,
  projection: PlanCandidateIdentityProjection,
): boolean {
  return candidateId === deriveCandidateId(candidateId, projection)
}

export function derivePairId(
  pairId: string,
  balancedCandidateId: string,
  conservativeCandidateId: string,
): string {
  const baseId = pairBaseId(pairId)
  const digest = sha256Hex(`trainoracle.plan-candidate-pair-identity.v1\0${canonicalJson({
    baseId,
    candidateIds: [balancedCandidateId, conservativeCandidateId],
  })}`)
  return `${baseId}${PAIR_HASH_MARKER}${digest}`
}

export function pairIdHasBase(pairId: string, expectedBaseId: string): boolean {
  return /:pair-sha256-[a-f0-9]{64}$/u.test(pairId)
    && pairBaseId(pairId) === expectedBaseId
}

export function rebindCandidatePairIdentity(
  candidates: readonly [PlanCandidate, PlanCandidate],
): readonly [PlanCandidate, PlanCandidate] {
  const balancedId = deriveCandidateId(candidates[0].candidateId, projectPlanCandidate(candidates[0]))
  const conservativeId = deriveCandidateId(candidates[1].candidateId, projectPlanCandidate(candidates[1]))
  const pairId = derivePairId(candidates[0].pairId, balancedId, conservativeId)
  return Object.freeze([
    Object.freeze({ ...candidates[0], candidateId: balancedId, pairId }),
    Object.freeze({ ...candidates[1], candidateId: conservativeId, pairId }),
  ])
}

export function hasValidCandidatePairIdentity(
  balanced: PlanCandidate,
  conservative: PlanCandidate,
): boolean {
  return hasValidCandidateIdentity(balanced.candidateId, projectPlanCandidate(balanced))
    && hasValidCandidateIdentity(conservative.candidateId, projectPlanCandidate(conservative))
    && balanced.pairId === conservative.pairId
    && balanced.pairId === derivePairId(
      balanced.pairId,
      balanced.candidateId,
      conservative.candidateId,
    )
}
