/*
 * 컬렉션 레지스트리 → 법적 고지·자산 장부 렌더러.
 *
 * `public/legal/open-source.html`과 `public/collections/<dir>/assets.json`은 손으로 고치지 않는다.
 * `scripts/generate-collection-docs.mjs`가 이 모듈을 실행해 파일을 쓰고,
 * `decoration-collection-docs.contract.test.ts`가 "저장소 파일 == 렌더 결과"를 강제한다.
 * 그래서 컬렉션·라이선스를 레지스트리에 추가하면 문서가 자동으로 따라오고, 빠뜨리면 테스트가 막는다.
 *
 * 렌더는 결정적이어야 한다(입력이 같으면 바이트 단위로 같은 출력). 날짜·난수·환경 의존 금지.
 */

import {
  DECORATION_COLLECTIONS,
  LICENSES,
  acquisitionCost,
  collectionItemAcquisition,
  licenseById,
  type DecorationCollection,
  type DecorationLicense,
} from "./decoration-collections"

/** 생성 스크립트(esbuild 번들)가 한 모듈만 import 하면 되도록 레지스트리를 다시 내보낸다. */
export { DECORATION_COLLECTIONS }

const CONTACT_EMAIL = "hojune0330@gmail.com"

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
}

/** ISO 날짜 → "2026년 9월 1일". 문자열 조작만 하므로 타임존과 무관하다. */
export function formatKoreanDate(iso: string): string {
  const [year, month, day] = iso.split("-")
  return `${year}년 ${Number(month)}월 ${Number(day)}일`
}

function licensesOf(collection: DecorationCollection): readonly DecorationLicense[] {
  const seen = new Set<string>()
  const result: DecorationLicense[] = []
  for (const item of collection.items) {
    if (seen.has(item.licenseId)) continue
    seen.add(item.licenseId)
    const license = licenseById(item.licenseId)
    if (license !== undefined) result.push(license)
  }
  return result
}

function acquisitionSummary(collection: DecorationCollection): string {
  const acquisition = collection.defaultAcquisition
  const base = acquisition.kind === "POINTS" || acquisition.kind === "BUNDLE"
    ? `개별 ${acquisition.cost}P`
    : acquisition.kind === "REWARD"
      ? "활동 보상 지급"
      : `${acquisition.from} ~ ${acquisition.to} 기간 한정 무료`
  const bundle = collection.bundle === undefined ? "" : ` · 컬렉션 일괄 ${collection.bundle.cost}P`
  return `${base}${bundle}`
}

function renderLicenseSection(license: DecorationLicense, count: number): string {
  const lines: string[] = []
  lines.push(`      <h3>${escapeHtml(license.holder)}</h3>`)
  lines.push(`      <ul>`)
  lines.push(`        <li>사용 수: ${count}종</li>`)
  lines.push(`        <li>라이선스: ${escapeHtml(license.terms)}</li>`)
  if (license.sourceUrl !== undefined) {
    lines.push(`        <li>원본: <a href="${escapeHtml(license.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(license.sourceUrl)}</a></li>`)
  }
  if (license.revision !== undefined) lines.push(`        <li>고정 리비전: <code>${escapeHtml(license.revision)}</code></li>`)
  if (license.modification !== undefined) lines.push(`        <li>가공: ${escapeHtml(license.modification)}</li>`)
  lines.push(`        <li>출처 표기: ${license.attributionRequired ? "필요 (이 페이지로 이행)" : "불필요 (자발적 표기)"}</li>`)
  if (license.validUntil !== undefined) lines.push(`        <li>신규 판매 종료일: ${formatKoreanDate(license.validUntil)}</li>`)
  if (license.contractRef !== undefined) lines.push(`        <li>계약 참조: <code>${escapeHtml(license.contractRef)}</code></li>`)
  if (license.licenseFile !== undefined) lines.push(`        <li><a href="../${escapeHtml(license.licenseFile)}">라이선스 전문 보기</a></li>`)
  lines.push(`      </ul>`)
  return lines.join("\n")
}

function renderCollectionSection(collection: DecorationCollection): string {
  const lines: string[] = []
  // 시즌은 날짜 의존이라 상태를 단정하지 않는다(렌더 결정성 유지). 기간을 함께 적어 독자가 판단하게 한다.
  const status = collection.availability !== "ACTIVE"
    ? "신규 제공 종료 (보유분은 계속 사용 가능)"
    : collection.season !== undefined
      ? "시즌 기간 안에서만 제공 (기간 뒤에도 보유분은 계속 사용 가능)"
      : "제공 중"
  lines.push(`    <section id="${escapeHtml(collection.id)}" aria-labelledby="${escapeHtml(collection.id)}-title">`)
  lines.push(`      <h2 id="${escapeHtml(collection.id)}-title">${escapeHtml(collection.title)} <small>(${escapeHtml(collection.id)})</small></h2>`)
  lines.push(`      <p>${escapeHtml(collection.sourceNote)}</p>`)
  lines.push(`      <ul>`)
  lines.push(`        <li>아트 디렉션: ${escapeHtml(collection.artDirection)}</li>`)
  lines.push(`        <li>구성: ${collection.items.length}종 · ${collection.render.width}×${collection.render.height} WebP${collection.render.transparentBackground ? " (투명 배경)" : ""}</li>`)
  lines.push(`        <li>획득: ${escapeHtml(acquisitionSummary(collection))}</li>`)
  lines.push(`        <li>상태: ${status}</li>`)
  if (collection.season !== undefined) {
    lines.push(`        <li>시즌 기간: ${formatKoreanDate(collection.season.from)} ~ ${formatKoreanDate(collection.season.to)}</li>`)
  }
  lines.push(`        <li>라이선스 확인일: ${formatKoreanDate(collection.licenseReviewedOn)}</li>`)
  lines.push(`        <li>자산 장부: <a href="../${escapeHtml(collection.assetDir)}/assets.json">assets.json</a> (원본 파일명·가공·SHA-256)</li>`)
  lines.push(`      </ul>`)
  for (const license of licensesOf(collection)) {
    const count = collection.items.filter((item) => item.licenseId === license.id).length
    lines.push(renderLicenseSection(license, count))
  }
  lines.push(`    </section>`)
  return lines.join("\n")
}

/** `public/legal/open-source.html` 전체 문서. */
export function renderOpenSourceHtml(collections: readonly DecorationCollection[] = DECORATION_COLLECTIONS): string {
  const reviewedOn = collections.map((collection) => collection.licenseReviewedOn).sort().at(-1)
  const summaryIds = collections.map((collection) => collection.id).join(", ")
  const toc = collections
    .map((collection) => `        <li><a href="#${escapeHtml(collection.id)}">${escapeHtml(collection.title)}</a> — ${collection.items.length}종</li>`)
    .join("\n")
  return `<!doctype html>
<!-- 자동 생성 파일: app/scripts/generate-collection-docs.mjs 가 src/domain/decoration-collections.ts 에서 만든다. 손으로 고치지 말 것. -->
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index,follow" />
  <title>스티커·오픈소스 출처 | TrainOracle</title>
  <link rel="stylesheet" href="./legal.css" />
</head>
<body>
  <header class="legal-header">
    <div class="legal-header__inner">
      <a class="legal-brand" href="../">TRAINORACLE</a>
      <nav class="legal-nav" aria-label="서비스 문서">
        <a href="./privacy.html">개인정보처리방침</a>
        <a href="./terms.html">이용약관</a>
        <a href="./open-source.html" aria-current="page">자산 출처</a>
      </nav>
    </div>
  </header>

  <main class="legal-document">
    <header>
      <h1>스티커·오픈소스 출처</h1>
      <p class="legal-summary">TrainOracle 꾸미기 컬렉션에 사용한 공개 자산과 라이선스를 컬렉션별로 안내합니다. 기본 재료(도장·테이프·라벨 등)는 TrainOracle이 직접 그렸습니다.</p>
      <p class="legal-date">최근 확인일: ${reviewedOn === undefined ? "-" : formatKoreanDate(reviewedOn)} · 컬렉션: ${escapeHtml(summaryIds)}</p>
      <ul>
${toc}
      </ul>
    </header>

${collections.map(renderCollectionSection).join("\n\n")}

    <h2>가공과 서비스 제공</h2>
    <p>모든 그림은 앱에 함께 저장되어 외부 그림 서버로 사용 기록을 보내지 않습니다. TrainOracle의 포인트는 현금이나 재산상 가치가 없는 베타 포인트이며, 스티커의 원본 저작권이나 상표권을 판매하는 것이 아니라 앱 안에서 쓸 수 있는 이용 상태를 제공합니다.</p>
    <p>시즌이 끝나거나 라이선스가 만료된 컬렉션은 신규 제공만 멈추고, 이미 받아 일지에 붙인 그림은 계속 표시됩니다.</p>

    <footer class="legal-footer">
      <p>문의: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
    </footer>
  </main>
</body>
</html>
`
}

export type CollectionLedger = {
  readonly schemaVersion: 2
  readonly generatedBy: string
  readonly collectionId: string
  readonly title: string
  readonly licenseReviewedOn: string
  readonly availability: DecorationCollection["availability"]
  readonly assetDir: string
  readonly render: DecorationCollection["render"]
  readonly licenses: Readonly<Record<string, DecorationLicense>>
  readonly assets: readonly {
    readonly catalogId: string
    readonly file: string
    readonly licenseId: string
    readonly acquisition: ReturnType<typeof collectionItemAcquisition>
    readonly pointCost: number
    readonly sourceAsset?: string
    readonly sha256?: string
  }[]
}

/** `public/<assetDir>/assets.json` 내용. */
export function buildCollectionLedger(collection: DecorationCollection): CollectionLedger {
  const licenses: Record<string, DecorationLicense> = {}
  for (const license of licensesOf(collection)) licenses[license.id] = license
  return {
    schemaVersion: 2,
    generatedBy: "app/scripts/generate-collection-docs.mjs",
    collectionId: collection.id,
    title: collection.title,
    licenseReviewedOn: collection.licenseReviewedOn,
    availability: collection.availability,
    assetDir: collection.assetDir,
    render: collection.render,
    licenses,
    assets: collection.items.map((item) => {
      const acquisition = collectionItemAcquisition(collection, item)
      return {
        catalogId: item.id,
        file: item.fileName,
        licenseId: item.licenseId,
        acquisition,
        pointCost: acquisitionCost(acquisition),
        ...(item.sourceAsset === undefined ? {} : { sourceAsset: item.sourceAsset }),
        ...(item.sha256 === undefined ? {} : { sha256: item.sha256 }),
      }
    }),
  }
}

export function renderCollectionLedgerJson(collection: DecorationCollection): string {
  return `${JSON.stringify(buildCollectionLedger(collection), null, 2)}\n`
}

/** 생성기가 써야 할 파일 목록(public 기준 상대 경로 → 내용). */
export function renderCollectionDocuments(collections: readonly DecorationCollection[] = DECORATION_COLLECTIONS): readonly { readonly path: string; readonly content: string }[] {
  return [
    { path: "legal/open-source.html", content: renderOpenSourceHtml(collections) },
    ...collections.map((collection) => ({ path: `${collection.assetDir}/assets.json`, content: renderCollectionLedgerJson(collection) })),
  ]
}

/** 레지스트리 무결성: 라이선스 참조·파일명·중복 id 검사. 생성기와 테스트가 함께 쓴다. */
export function validateCollectionRegistry(collections: readonly DecorationCollection[] = DECORATION_COLLECTIONS): readonly string[] {
  const problems: string[] = []
  const collectionIds = new Set<string>()
  const itemIds = new Set<string>()
  const knownLicenseIds = new Set<string>(LICENSES.map((license) => license.id))
  for (const collection of collections) {
    if (collectionIds.has(collection.id)) problems.push(`중복 컬렉션 id: ${collection.id}`)
    collectionIds.add(collection.id)
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(collection.licenseReviewedOn)) problems.push(`${collection.id}: licenseReviewedOn 형식 오류`)
    if (collection.assetDir.startsWith("/") || collection.assetDir.endsWith("/")) problems.push(`${collection.id}: assetDir는 슬래시 없이 public 기준 상대 경로`)
    if (!collection.assetDir.startsWith("collections/")) problems.push(`${collection.id}: assetDir는 collections/ 아래여야 SW 프리캐시에서 제외된다`)
    const groupIds = new Set(collection.groups.map((group) => group.id))
    for (const item of collection.items) {
      if (itemIds.has(item.id)) problems.push(`중복 아이템 id: ${item.id}`)
      itemIds.add(item.id)
      if (!knownLicenseIds.has(item.licenseId)) problems.push(`${item.id}: 알 수 없는 licenseId ${item.licenseId}`)
      if (!groupIds.has(item.group)) problems.push(`${item.id}: 알 수 없는 group ${item.group}`)
      if (item.fileName.includes("/")) problems.push(`${item.id}: fileName은 디렉터리 없이`)
      if (item.sha256 !== undefined && !/^[0-9a-f]{64}$/u.test(item.sha256)) problems.push(`${item.id}: sha256 형식 오류`)
    }
    for (const previewId of collection.entryPreviewItemIds) {
      if (!collection.items.some((item) => item.id === previewId)) problems.push(`${collection.id}: entryPreviewItemIds에 없는 아이템 ${previewId}`)
    }
  }
  return problems
}
