import { z } from "zod"

export const RUN_BTI_PROFILE_NAMESPACE = "trainoracle.account.run-bti-profile.v1"

// The stable public keys match the four-pair model. Only combinations across different
// pairs are possible. Display names and custom card text never enter the account.
const sides = [["distance", "speed"], ["numbers", "senses"], ["familiar", "explore"], ["plan", "improvise"]]
const aliases = new Set(["open", "unanswered", ...sides.flat()])
for (const [index, pair] of sides.entries()) {
  for (const first of pair) {
    for (const second of sides.slice(index + 1).flat()) aliases.add(first + "+" + second)
  }
}
const score = z.number().min(0).max(2).nullable()
const pair = z.tuple([score, score]).refine(values => values.some(value => value !== null))
const preferences = z.object({
  style: pair.optional(), signals: pair.optional(), routes: pair.optional(), planning: pair.optional(),
}).strict().refine(value => Object.keys(value).length > 0)
const season = z.enum(["outside", "less", "indoor"])
const weather = z.enum(["want", "maybe", "no"])

export const accountRunBtiProfileDocumentSchema = z.object({
  version: z.literal(3), state: z.literal("ACCOUNT_STATE"), kind: z.literal("RUN_BTI_PROFILE"),
  data: z.object({
    version: z.literal("pairs-1"), source: z.literal("self-report"), answeredAt: z.iso.datetime(),
    preferences: preferences.optional(),
    defaultKey: z.string().max(32).refine(value => aliases.has(value)).optional(),
    distanceLevel: z.enum(["notYet", "under3", "3k", "5k", "10k", "21k", "unknown"]).optional(),
    strength: z.enum(["endurance", "speed", "steady", "consistency", "other", "unknown"]).optional(),
    goal: z.enum(["distance", "speed", "consistency", "finish", "technique", "other", "unknown"]).optional(),
    learning: z.enum(["class", "coach", "solo", "unknown"]).optional(),
    training: z.array(z.enum(["drills", "strength", "distance", "speed"])).min(1).max(4)
      .refine(values => new Set(values).size === values.length).optional(),
    summer: season.optional(), winter: season.optional(), snow: weather.optional(), rain: weather.optional(),
    time: z.enum(["morning", "day", "evening", "varies"]).optional(),
  }).strict().refine(value => Object.keys(value).some(key => !["version", "source", "answeredAt"].includes(key))),
}).strict()

export type AccountRunBtiProfileDocument = z.infer<typeof accountRunBtiProfileDocumentSchema>
