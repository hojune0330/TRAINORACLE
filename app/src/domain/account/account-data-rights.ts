import { z } from "zod"
import { supabase } from "./supabase-client"
import { verifyReturnedAuthSession } from "./verified-auth-session"

export const rightsCollections = {
  journal: "일지·메모·계정 기록", history: "일지 이전 버전·휴지통",
  planParts: "훈련 계획 본문", planIndex: "훈련 계획 목록",
  legacyJournal: "이전 동기화 일지", legacyPlans: "이전 계획 백업",
  legacyPrivateNotes: "이전 비밀 메모 암호문",
  providerActivities: "기기 연동 운동 자료", providerDaily: "기기 연동 일별 암호문",
} as const
export type RightsCollection = keyof typeof rightsCollections
const pageSchema = z.object({
  ownerId: z.uuid(), collection: z.string(),
  items: z.array(z.object({ cursor: z.string(), record: z.record(z.string(), z.unknown()) }).strict()).max(10),
  nextCursor: z.string().nullable(),
}).strict()

// Explicit download only: no effects, persistence, journal ingestion or restoration.
export async function exportAccountDataRights(userId: string, collection: RightsCollection, isCurrent: () => boolean) {
  try {
    const client = await supabase()
    if (!client || !isCurrent()) throw new Error("unavailable")
    const initial = await client.auth.getSession()
    const session = initial.data.session
    if (initial.error || session?.user.id !== userId) throw new Error("identity")
    const token = session.access_token
    const sessionId = await verifyReturnedAuthSession(client, { accessToken: token, expectedUserId: userId })
    if (!sessionId || !isCurrent()) throw new Error("identity")
    const records: Record<string, unknown>[] = []
    let cursor = "", bytes = 0
    const seen = new Set<string>()
    for (let pageCount = 0; pageCount < 2000; pageCount++) {
      const result = await client.functions.invoke("account-data-rights", {
        body: { expectedUserId: userId, expectedSessionId: sessionId, collection, cursor },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (result.error || !isCurrent()) throw new Error("unavailable")
      const page = pageSchema.parse(result.data)
      if (page.ownerId !== userId || page.collection !== collection
        || page.items.some(item => item.record.user_id !== userId || item.cursor <= cursor || seen.has(item.cursor))) throw new Error("identity")
      for (const item of page.items) { seen.add(item.cursor); records.push(item.record) }
      bytes += new TextEncoder().encode(JSON.stringify(page.items)).byteLength
      if (bytes > 64 * 1024 * 1024) throw new Error("size")
      if (page.nextCursor === null) {
        const current = await client.auth.getSession()
        if (!isCurrent() || current.error || current.data.session?.user.id !== userId
          || await verifyReturnedAuthSession(client, { accessToken: current.data.session.access_token, expectedUserId: userId }) !== sessionId) throw new Error("identity")
        return { ok: true as const, text: JSON.stringify({
          format: "trainoracle-data-rights-v1", ownerId: userId, collection,
          exportedAt: new Date().toISOString(), note: "수동 열람 사본. 자동 복구 파일이 아닙니다. 자료 변경 중에는 시점이 다를 수 있습니다. 이전 비밀 메모·기기 연동 자료는 암호문이 포함될 수 있습니다.",
          records,
        }, null, 2) }
      }
      if (!page.items.length || page.nextCursor !== page.items.at(-1)?.cursor || page.nextCursor <= cursor) throw new Error("cursor")
      cursor = page.nextCursor
    }
    throw new Error("size")
  } catch {
    return { ok: false as const, message: "자료를 내려받지 못했어요. 다시 로그인해 시도하거나 개인정보 문의로 열람을 요청해 주세요. 동의가 다시 켜지거나 기존 자료가 바뀌지는 않았어요." }
  }
}
