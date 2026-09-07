// Review-packet data, not an operating registry or an execution authorization.
const time = (seconds, role = "WORK") => ({ role, unit: "SECONDS", value: seconds })
const distance = (meters, role = "WORK") => ({ role, unit: "METERS", value: meters })
const protocol = (id, family, method, sets, reps, work, between, setRest, afterEvery = null) => ({
  id, family, method, sets, reps, work, between, setRest, afterEvery,
  status: "OWNER_ADOPTION_PENDING", executionAuthority: "NONE",
})

export const METHOD_ADOPTION_PROTOCOLS = [
  protocol("P-BASE-C", "BASE", "CONTINUOUS", 1, 1, [time(1800)], null, null),
  protocol("P-BASE-B", "BASE", "WALK_BREAKS", 1, 3, [time(600)], time(60, "WALK"), null),
  protocol("P-LT-C", "LT", "CONTINUOUS", 1, 1, [time(1200)], null, null),
  protocol("P-LT-B", "LT", "LONG_SPLIT", 1, 2, [time(600)], time(60, "JOG"), null),
  protocol("P-LT-S", "LT", "SHORT_SPLIT", 1, 3, [time(420)], time(60, "JOG"), null),
  protocol("P-RHYTHM-400", "MIX", "ROLL_ON_400", 1, 12, [distance(400)], null, null, distance(100, "ROLL_ON")),
  protocol("P-RHYTHM-300", "MIX", "ROLL_ON_SETS_300", 3, 2, [distance(300)], null, time(120, "EASY_RUN"), distance(100, "ROLL_ON")),
  protocol("P-VO2-2", "VO2", "TWO_MINUTE", 1, 6, [time(120)], time(60, "JOG"), null),
  protocol("P-VO2-3", "VO2", "THREE_MINUTE", 1, 5, [time(180)], time(120, "JOG"), null),
  protocol("P-VO2-4", "VO2", "FOUR_MINUTE", 1, 4, [time(240)], time(180, "JOG"), null),
  protocol("P-ATP-A", "ATP-PC", "STANDING_ACCELERATION", 1, 6, [distance(20)], time(120, "WALK_OR_STAND"), null),
  protocol("P-ATP-F", "ATP-PC", "FLYING_SEGMENT", 1, 4, [distance(20, "BUILDUP"), distance(10)], time(240, "WALK_OR_STAND"), null),
  protocol("P-ATP-T", "ATP-PC", "TIMED_ACCELERATION", 1, 4, [time(6)], time(180, "WALK_OR_STAND"), null),
  protocol("P-GLY-D", "GLY", "UNBROKEN_REPEATS", 1, 6, [distance(200)], time(120, "WALK"), null),
  protocol("P-GLY-S", "GLY", "SET_REPEATS", 2, 3, [distance(200)], time(120, "WALK"), time(300, "WALK_OR_STAND")),
  protocol("P-REC-W", "REC", "WALK", 1, 1, [time(900)], null, null),
  protocol("P-OFF", "OFF", "NO_PLANNED_EXERCISE", 0, 0, [], null, null),
]

const roles = new Set(["WORK", "BUILDUP", "WALK", "JOG", "EASY_RUN", "WALK_OR_STAND", "ROLL_ON"])
function validate(p) {
  if (!p || p.status !== "OWNER_ADOPTION_PENDING" || p.executionAuthority !== "NONE") throw new Error("NOT_A_PENDING_PROPOSAL")
  if (!Number.isInteger(p.sets) || !Number.isInteger(p.reps) || p.sets < 0 || p.reps < 0
    || p.sets > 100 || p.reps > 100 || !Array.isArray(p.work)) throw new Error("INVALID_STRUCTURE")
  if (p.family === "OFF") {
    if (p.sets || p.reps || p.work.length || p.between || p.setRest || p.afterEvery) throw new Error("INVALID_OFF")
    return
  }
  if (!p.sets || !p.reps || !p.work.length || (p.sets > 1 && !p.setRest)
    || (p.sets === 1 && p.setRest) || (p.reps === 1 && p.between)
    || (p.reps > 1 && !p.between && !p.afterEvery)
    || (p.between && p.afterEvery)) throw new Error("AMBIGUOUS_RECOVERY")
  for (const segment of [...p.work, p.between, p.setRest, p.afterEvery].filter(Boolean)) {
    if (!roles.has(segment.role) || !["SECONDS", "METERS"].includes(segment.unit)
      || !Number.isFinite(segment.value) || segment.value <= 0) throw new Error("INVALID_SEGMENT")
  }
  if (p.work.some(s => !["WORK", "BUILDUP"].includes(s.role))
    || [p.between, p.setRest, p.afterEvery].filter(Boolean).some(s => ["WORK", "BUILDUP"].includes(s.role))) {
    throw new Error("INVALID_ROLE")
  }
}

export function expandProposal(p) {
  validate(p)
  const segments = []
  for (let set = 0; set < p.sets; set++) {
    for (let rep = 0; rep < p.reps; rep++) {
      for (const part of p.work) segments.push({ ...part, set: set + 1, rep: rep + 1, boundary: "WORK" })
      if (p.afterEvery) segments.push({ ...p.afterEvery, set: set + 1, rep: rep + 1, boundary: "AFTER_EVERY" })
      if (rep < p.reps - 1 && p.between) segments.push({ ...p.between, set: set + 1, rep: rep + 1, boundary: "BETWEEN_REPS" })
    }
    if (set < p.sets - 1 && p.setRest) segments.push({ ...p.setRest, set: set + 1, rep: p.reps, boundary: "BETWEEN_SETS" })
  }
  return segments
}

export function summarizeProposal(p) {
  const segments = expandProposal(p)
  const amounts = predicate => {
    const selected = segments.filter(predicate)
    return Object.fromEntries(["SECONDS", "METERS"].map(unit => [unit,
      selected.some(s => s.unit === unit) ? selected.filter(s => s.unit === unit).reduce((sum, s) => sum + s.value, 0) : null]))
  }
  return {
    id: p.id, executionAuthority: "NONE", repeats: p.sets * p.reps,
    work: amounts(s => s.role === "WORK"), buildup: amounts(s => s.role === "BUILDUP"),
    recovery: amounts(s => s.boundary !== "WORK"),
    betweenReps: segments.filter(s => s.boundary === "BETWEEN_REPS").length,
    betweenSets: segments.filter(s => s.boundary === "BETWEEN_SETS").length,
    afterEvery: segments.filter(s => s.boundary === "AFTER_EVERY").length,
    totalSeconds: segments.length && segments.every(s => s.unit === "SECONDS")
      ? segments.reduce((sum, s) => sum + s.value, 0) : null,
    observedExercise: null,
  }
}

// Explicit whole configurations. These do not create candidate pairings or permission edges.
const base = id => {
  const matches = METHOD_ADOPTION_PROTOCOLS.filter(p => p.id === id)
  if (matches.length !== 1) throw new Error("AMBIGUOUS_BASE_PROPOSAL")
  return matches[0]
}
export const METHOD_ADOPTION_VARIANTS = [
  ...[1200, 1500].map(seconds => ({ ...base("P-BASE-C"), id: `P-BASE-C-${seconds}`, parentId: "P-BASE-C", work: [time(seconds)] })),
  { ...base("P-LT-B"), id: "P-LT-B-480", parentId: "P-LT-B", work: [time(480)] },
  ...[4, 5].map(reps => ({ ...base("P-VO2-2"), id: `P-VO2-2-${reps}`, parentId: "P-VO2-2", reps })),
  ...[4, 5].map(reps => ({ ...base("P-ATP-A"), id: `P-ATP-A-${reps}`, parentId: "P-ATP-A", reps })),
  { ...base("P-RHYTHM-400"), id: "P-RHYTHM-400-2X6", parentId: "P-RHYTHM-400", sets: 2, reps: 6, setRest: time(180, "EASY_RUN") },
]

export const MAIN_SUPPORT_PROPOSAL = {
  id: "P-SUPPORT-MAIN-01", version: "0.2", status: "OWNER_ADOPTION_PENDING",
  executionAuthority: "NONE",
  warmup: [
    { ...time(900, "EASY_RUN"), cue: "RPE 2-3" },
    ...Array.from({ length: 4 }, (_, index) => [
      { ...time(20, "BUILDUP"), cue: "PROGRESSIVE_NOT_ALL_OUT" },
      { ...time(index === 3 ? 60 : 40, "WALK"), cue: "WALK" },
    ]).flat(),
  ],
  cooldown: [{ ...time(600, "EASY_RUN"), cue: "RPE 1-2" }],
}

export function assembleProposalSession(p) {
  const main = expandProposal(p)
  const summary = summarizeProposal(p)
  // Source conditions, population and frame placement remain separate review gates.
  const supported = ["LT", "VO2", "ATP-PC", "GLY", "MIX"].includes(p.family)
  const support = supported ? structuredClone(MAIN_SUPPORT_PROPOSAL) : null
  const warmup = support?.warmup ?? []
  const cooldown = support?.cooldown ?? []
  const supportSeconds = [...warmup, ...cooldown].reduce((sum, s) => sum + s.value, 0)
  return {
    id: p.id, executionAuthority: "NONE", supportRef: support ? { id: support.id, version: support.version } : null,
    supportPolicy: supported ? "PROPOSED_SEPARATE_SUPPORT" : "NO_ADDITIONAL_SUPPORT",
    warmup, main, cooldown, supportSeconds,
    totalSeconds: summary.totalSeconds === null ? null : summary.totalSeconds + supportSeconds,
    applicabilityReviewed: false,
  }
}
