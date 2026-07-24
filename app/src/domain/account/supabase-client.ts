// Supabase 클라이언트 lazy 싱글턴 (동적 import — feature flag OFF면
// 라이브러리 자체를 내려받지 않는다: 기존 사용자 번들 영향 0).
import type { SupabaseClient } from "@supabase/supabase-js"
import { accountConfig } from "./config"

let clientPromise: Promise<SupabaseClient | null> | null = null

export function supabase(): Promise<SupabaseClient | null> {
  if (clientPromise !== null) return clientPromise
  const config = accountConfig()
  if (config === null) {
    clientPromise = Promise.resolve(null)
    return clientPromise
  }
  clientPromise = import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "trainoracle.auth.v1",
        },
      }),
    )
    .catch(() => null)
  return clientPromise
}

/** 테스트 전용: 싱글턴 초기화 */
export function __resetSupabaseForTest(): void {
  clientPromise = null
}
