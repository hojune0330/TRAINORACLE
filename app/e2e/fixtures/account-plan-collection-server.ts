import type { BrowserContext } from "@playwright/test"
import { pathToFileURL } from "node:url"
import path from "node:path"
import type { AccountPlanCollectionIndex, AccountPlanSnapshotPart, AccountPlanProgressPart } from "../../src/domain/account/account-plan-collection-schema"
import type { AccountPlanCollectionCommit, AccountPlanCollectionReceipt } from "../../src/domain/account/account-plan-collection-transfer"

type Part = AccountPlanSnapshotPart | AccountPlanProgressPart
type Request = { action: string; part?: Part; partId?: string; partKind?: Part["kind"]; operationId?: string; request?: AccountPlanCollectionCommit }

// HTTP double only. Native browser crypto/IndexedDB, service, transfer and UI stay real.
export async function mockPlanCollectionServer() {
  const validator = await import(pathToFileURL(path.resolve("../supabase/functions/_shared/account-plan-collection-validator.mjs")).href)
  const indexes = new Map<string, { revision: number; index: AccountPlanCollectionIndex }>()
  const parts = new Map<string, Part>(), receipts = new Map<string, AccountPlanCollectionReceipt>()
  const calls: { ownerId: string; request: Request }[] = []
  let failWrites = false, loseAck = false
  const materialize = (owner: string, index: AccountPlanCollectionIndex) => ({ index,
    snapshots: index.plans.map(ref => parts.get(`${owner}:${ref.snapshotId}`)),
    progress: index.plans.map(ref => parts.get(`${owner}:${ref.progressId}`)) })
  return {
    calls, indexes, parts, receipts,
    offline(value: boolean) { failWrites = value },
    loseNextAck() { loseAck = true },
    async install(context: BrowserContext) {
      await context.route("**/__collection_api__", async route => {
        const { ownerId, request } = route.request().postDataJSON() as { ownerId: string; request: Request }
        calls.push(structuredClone({ ownerId, request }))
        const answer = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
        if (!ownerId) return answer({ error: "AUTH_REQUIRED" }, 401)
        const current = indexes.get(ownerId)
        if (request.action === "readIndex") return answer(current ? { kind: "index", ...current } : { kind: "missing" })
        if (request.action === "readPart") {
          const part = parts.get(`${ownerId}:${request.partId}`)
          return answer(part && part.kind === request.partKind ? { kind: "part", part } : { kind: "missing" })
        }
        if (request.action === "receipt") {
          const receipt = receipts.get(`${ownerId}:${request.operationId}`)
          return answer(receipt ? { kind: "receipt", receipt } : { kind: "missing" })
        }
        if (failWrites) return answer({ error: "UNAVAILABLE" }, 503)
        if (request.action === "stage") {
          if (!validator.validateAccountPlanCollectionPart(request.part)) return answer({ error: "INVALID" }, 400)
          const part = request.part!, key = `${ownerId}:${part.id}`, old = parts.get(key)
          if (old && validator.accountPlanFingerprint(old) !== validator.accountPlanFingerprint(part)) return answer({ error: "IMMUTABLE" }, 409)
          parts.set(key, structuredClone(part)); return answer({ kind: "staged" })
        }
        if (request.action === "commit") {
          const body = request.request!
          if (!body || body.ownerId !== ownerId) return answer({ error: "OWNER" }, 403)
          const hash = validator.accountPlanFingerprint(body), previous = receipts.get(`${ownerId}:${body.operationId}`)
          if (previous) return previous.requestFingerprint === hash ? answer({ kind: "committed", receipt: previous }) : answer({ error: "REUSED" }, 409)
          if (body.expectedRevision !== (current?.revision ?? 0) || body.previousIndexFingerprint !== (current ? validator.accountPlanFingerprint(current.index) : null)) return answer({ kind: "conflict" }, 409)
          const next = materialize(ownerId, body.index)
          if (!validator.joinAccountPlanCollection(next) || current && !validator.validateAccountPlanCollectionUpdate(materialize(ownerId, current.index), next)) return answer({ error: "INVALID" }, 400)
          const revision = (current?.revision ?? 0) + 1
          const receipt = { ownerId, operationId: body.operationId, revision,
            indexFingerprint: validator.accountPlanFingerprint(body.index), requestFingerprint: hash }
          indexes.set(ownerId, { revision, index: structuredClone(body.index) }); receipts.set(`${ownerId}:${body.operationId}`, receipt)
          if (loseAck) { loseAck = false; return answer({ error: "ACK_LOST" }, 503) }
          return answer({ kind: "committed", receipt })
        }
        return answer({ error: "INVALID" }, 400)
      })
    },
  }
}
