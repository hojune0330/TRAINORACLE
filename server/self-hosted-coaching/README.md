# 회사 서버의 요청 단위 코칭 해설

이 디렉터리는 회사가 관리하는 Node.js 서버에서 실행하는 HTTP 서비스다. 기존
Supabase 인증·암호화 계정 일지를 사용한다. 새 계정 저장소나 외부 AI 업체를
만들지 않는다. 배포·Garmin 서면 승인·실제 모델 검수의 완료 영수증은 아니다.

## 실행과 검사

Node.js 24 이상에서 저장소 루트 기준으로 실행한다. 서비스 런타임은 Node 내장
모듈과 저장소의 생성된 순수 계약 모듈만 사용한다.

```powershell
node server/self-hosted-coaching/service.mjs

# 테스트 전 기존 프로젝트의 고정된 PGlite 개발 의존성 설치
npm ci --prefix supabase/tests/local-postgres --ignore-scripts --no-audit --no-fund
node --test server/self-hosted-coaching/service.test.mjs
node app/scripts/build-coaching-record-evidence.mjs --check
```

서비스는 `127.0.0.1:8788`에만 바인딩된다(`PORT` 변경 가능). 회사 TLS 역방향
프록시가 `/api/self-hosted-coaching`를 전달한다. TLS·로그 미수집·egress 방화벽을
프록시와 모델 서버에서도 확인해야 한다. 설정이 없으면 추론은 닫혀 있다.
테스트는 loopback HTTP, 실제 PGlite SQL, 합성 Auth, 실제 AES-GCM, 합성 모델을
사용한다. 실제 Supabase나 Garmin, 모델 가중치에는 접속하지 않는다.

## 필요한 서버 설정

설정값은 회사의 secret manager에서 주입한다. `.env`나 셸 명령·검사 로그에 실제
토큰·키를 적어 보관하지 않는다. `service_role` 키는 사용하지 않는다.

| 설정 이름 | 용도 |
| --- | --- |
| `SUPABASE_URL` | 기존 프로젝트의 HTTPS origin |
| `SUPABASE_ANON_KEY` | 기존 publishable/anon key; 사용자 JWT와 함께 요청 |
| `TRAINORACLE_JOURNAL_KEYRING_JSON` | 기존 계정 일지 복호화 keyring |
| `TRAINORACLE_COACHING_ATTESTATION_JSON` | 별도 RUNTIME HMAC `{keyId,key}`; 32바이트 key의 base64 |
| `TRAINORACLE_SELF_HOSTED_COACHING_ENABLED` | `true`만 추론을 허용; 기본 비활성 |
| `TRAINORACLE_COACHING_ALLOWED_ORIGINS` | 정확한 브라우저 origin 목록, 쉼표 구분 |
| `TRAINORACLE_INTERNAL_LLM_ORIGIN` | 회사 관리 모델의 허용된 HTTPS origin |
| `TRAINORACLE_INTERNAL_LLM_URL` | 같은 origin의 `/v1/chat/completions` |
| `TRAINORACLE_INTERNAL_LLM_MODEL` | 회사가 배포·검수한 모델 ID |
| `TRAINORACLE_INTERNAL_LLM_TOKEN` | 필요한 경우 모델 서버 전용 인증 토큰 |
| `TRAINORACLE_COACHING_FILE_FORMATS` | 별도 검수된 파일 형식의 쉼표 목록; 기본 빈 목록 |

모델은 OpenAI 호환 Chat Completions와 strict `json_schema` 응답을 지원해야 한다.
응답은 서버가 준 사실 ID와 검토 동작 ID의 선택이다. 새로운 숫자·자유 문장·도구
호출은 받지 않는다. 모델 추론 서버의 실제 무학습·무평가·무로그·무캐시 운영은
요청의 `store:false`만으로 증명되지 않는다. `REQUEST_ONLY` 표시 전에 별도로
검수하고 `self_hosted_coaching_controls`에 근거를 남긴다.

정밀 파일은 기존 파일 분석 계약을 재사용하여 종목·시간 의미별로 분리한다.
알 수 없는 시간 의미와 직접 입력값은 개별 기록의 참고값으로 남긴다. 파일의
호환용 km/min 문자열은 분석 원천으로 사용하지 않는다. 평균 페이스는 기존
검증된 계산식과 원천 필드뿐 아니라 `avgPace` 파생 필드까지 공급자 권한이
허용하는 경우에만 모델 입력·결과에 포함한다. 누락·중복·시간 의미의 한계는
모델이 생략할 수 없으며 모든 확정 사실은 결과에 남는다.

## 기존 DB와의 연결

`schema-candidate.sql`은 운영에 적용되지 않은 후보다. 기존 0001–0065 스키마에
대한 합성 SQL 시험을 포함한다. 운영 적용 시 Supabase CLI로 정식 migration을
생성하고 RLS·접근·철회·키 주입을 검수해야 한다. 후보 파일을 운영 적용 완료로
표시하지 않는다.

- 모든 신규 테이블의 RLS를 켜고 `anon`·`authenticated`·`service_role` 직접 접근을
  회수한다. 공개 RPC는 사용자 JWT와 별도 HMAC 둘 다 필요하다.
- RPC는 실제 `auth.sessions`·사용자·현재 계정 저장 동의를 재검사한다. 요청이
  지정한 계정 ID나 브라우저가 보낸 권한·활동 수치는 신뢰하지 않는다.
- `controls`와 키는 기본 비활성이고 공급자 grant는 빈 상태로 시작한다.
- Garmin grant는 실제 서면 승인 문서와 범위에 맞게 운영자가 기록해야 한다.
  이 코드나 테스트의 `SYNTHETIC_*` 문구를 승인 근거로 사용하지 않는다.
- 한 건의 consent는 명시적으로 선택한 문서 ID·revision·출처·공급자 권한
  manifest에 결속된다. 자료나 권한이 달라지면 새 확인 전 추론하지 않는다.
- 추론 직전과 응답 직전에 manifest와 동의를 재검사한다. 철회·소스 변경·권한
  취소·운영 중지 후 이전 결과를 내보내지 않는다. 같은 인스턴스의 철회는 진행
  중인 추론에도 중단 신호를 보낸다. 여러 인스턴스는 DB 재검사로 응답을 차단한다.

## 확인된 원천 기록 등록

일반 브라우저나 모델은 원천 기록을 등록할 수 없다. 회사 운영자는 별도
`INTAKE` scope HMAC 키와 대상 계정의 유효한 사용자 JWT를 이용한다. 이 권한은
일반 HTTP 서비스의 `RUNTIME` 키와 다르다. 기존의 검증된 공급자 수신·확인
기록 또는 명시적 원천 검토 근거가 있어야 한다. 파일 확장자·제조사 이름·
`EXPLICIT` 표시만으로 Garmin이 아닌 사용자 기록이라고 바꾸지 않는다.

검토 파일은 다음 형태다. 실제 값은 승인된 비공개 운영 경로에 보관한다.

```json
{
  "version": "COACHING_SOURCE_REVIEW_V1",
  "documentId": "00000000-0000-4000-8000-000000000001",
  "revision": 1,
  "lineage": {
    "schemaVersion": "PROVIDER_DATA_LINEAGE_V1",
    "sources": [{"sourceId":"reviewed-source","originProvider":"GARMIN","transport":"PROVIDER_API","assurance":"PROVIDER_VERIFIED"}],
    "fieldSources": {"distanceKm":["reviewed-source"],"durationMin":["reviewed-source"]}
  },
  "evidenceReference": "reviewed_provider_receipt_reference",
  "reviewedAt": "2026-10-30T00:00:00Z",
  "confirmed": true,
  "analysisEligible": true
}
```

파일 관측은 원천 `distanceMeters`·`durationSeconds`·`sport`·`durationMeaning`에
대한 lineage가 필요하다. 예시의 변환된 km/min 선언으로 원천 필드를 대체하지
않는다. 각 필드가 변환된 경우 원래 의존 필드도 남긴다.

```powershell
# 기본 dry-run: 인증 → 기존 암호문 읽기 → 현재 revision 확인 → 순수 계약 검증
node server/self-hosted-coaching/register-source.mjs <approved-review-file.json>
# 같은 검증 뒤 현재 revision을 DB에서 다시 검사하여 등록
node server/self-hosted-coaching/register-source.mjs <approved-review-file.json> --apply
```

추가 주입값은 `TRAINORACLE_COACHING_INTAKE_ATTESTATION_JSON`과
`TRAINORACLE_COACHING_SUBJECT_TOKEN`이다. 일반 런타임 키로 등록하면 거절한다.
CLI 출력은 성공·실패 코드뿐이며 기록 원문·토큰·키·원문 해시를 출력하지 않는다.
등록 자체는 AI 동의나 공급자 허락이 아니며 각각 별도로 확인한다.

## HTTP 계약

`POST /api/self-hosted-coaching`, `Authorization: Bearer <Supabase access token>`,
`Content-Type: application/json`. 모든 응답은 `Cache-Control: no-store`다.

- `status`: 실제 동의와 검토된 최근 20개 후보의 권한 상태를 제공한다.
- `consent`: `purposeVersion`, `expectedConsentRevision`, `documentIds`,
  `documentRevisions:[{documentId,revision}]`. status에서 본 정확한 수정본을 확인한다.
- `withdraw`: `expectedConsentRevision`. 운영 스위치가 꺼진 상태에서도 가능하다.
- `infer`: `documentIds`, `consentRevision`. 수치·일지 원문·권한·URL은 받지 않는다.

모든 동작은 소유 계정에 한정한다. 한 요청은 문서 20개 이하, body 4KB 이하이며
동일 계정의 진행 요청 1개·전체 8개를 제한한다. 철회는 이 제한을 우회할 수 있다.
LLM 호출은 12초, 결과 16KB, HTTPS origin 고정, redirect 차단이다. 모델에는
기록 ID·계정 ID·일지 제목·메모·GPS·토큰·날짜를 보내지 않는다.

## 기능 범위

`purposeVersion=2026-10-30`의 `SELF_HOSTED_INFERENCE`는 승인된 구조화 사실의
설명·검토에만 사용한다. 같은 purpose를 미래의 개인화 처방·계획 조정 승인으로
확대하지 않는다. 새 용도에는 별도 제품 계약·공급자 허락·동의 버전이 필요하다.
현재 기능은 승인된 구조화 사실의 설명과 기존 일지·계획 검토 동작을 연결한다.
AI가 안전 상태를 해제하거나 계획을 활성화·수정·전송하지 않는다. 자유 대화,
자동 재처방, 모델 학습·평가·임베딩·대화 저장 API는 없다. Garmin 승인이 필요한
기록은 승인 전까지 닫힌 상태이고, 직접 입력도 확인된 출처와 별도 동의가 필요하다.

현재 운영 미완 항목: Garmin의 실제 서면 허용 범위, 회사 서버·모델 선정 및
무로그 검수, 운영 DB migration·키 주입·intake 근거 등록, 실계정 로그인과
원천기록 수신 왕복. 로컬 합성 검사는 이 항목들을 완료했다고 증명하지 않는다.
