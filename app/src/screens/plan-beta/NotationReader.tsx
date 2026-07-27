import React from "react"
import { ArrowLeft } from "lucide-react"
import {
  derivePrescriptionTotals,
  parsePrescriptionNotation,
} from "@impl/index"
import type {
  PrescriptionDerivedTotals,
  UnboundPrescriptionNotation,
} from "@impl/index"
import { TermHelp } from "../../components/TermHelp"

const EXAMPLE_NOTATION = "2×(10×400m) @5000m RP · r60″ · R3′"

type ParsedNotation = {
  readonly notation: UnboundPrescriptionNotation
  readonly totals: PrescriptionDerivedTotals
}

function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR")
}

function parseForDisplay(value: string): ParsedNotation | null {
  const parsed = parsePrescriptionNotation(value)
  if (parsed.kind !== "parsed") return null
  return {
    notation: parsed.notation,
    totals: derivePrescriptionTotals(parsed.notation),
  }
}

export function NotationReader({ onBack }: { readonly onBack: () => void }) {
  const [input, setInput] = React.useState("")
  const [result, setResult] = React.useState<ParsedNotation | null>(null)
  const [hasTried, setHasTried] = React.useState(false)

  function showExample(): void {
    setInput(EXAMPLE_NOTATION)
    setResult(null)
    setHasTried(false)
  }

  function readNotation(): void {
    setHasTried(true)
    setResult(parseForDisplay(input))
  }

  return (
    <section className="plan-notation-reader" aria-labelledby="notation-reader-title">
      <button className="plan-back" type="button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        계획 시작으로 돌아가기
      </button>
      <div className="plan-eyebrow">NOTATION READER</div>
      <div className="plan-heading-row">
        <h1 id="notation-reader-title">훈련표 표기 읽기</h1>
        <TermHelp term="training-notation" />
      </div>
      <p className="plan-copy">
        세트, 반복, 거리, 회복 시간을 숫자로 풀어 보여줘요. 입력한 내용은 저장하지 않고,
        이 화면만으로 개인별 훈련 계획을 만들지 않아요.
      </p>

      <label className="plan-notation-field" htmlFor="plan-notation-input">
        <span>훈련표 표기</span>
        <input
          id="plan-notation-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setResult(null)
            setHasTried(false)
          }}
          placeholder={EXAMPLE_NOTATION}
          spellCheck={false}
        />
      </label>
      <div className="plan-notation-actions">
        <button className="plan-text-action" type="button" onClick={showExample}>
          예시 넣기
        </button>
        <button className="plan-select-action" type="button" onClick={readNotation}>
          표기 풀어보기
        </button>
      </div>

      {hasTried && result === null && (
        <p className="plan-notation-error" role="alert">
          아직 이 표기 형식은 읽지 못해요. 예시처럼 세트·반복·회복 단위를 모두 적어 주세요.
          곱셈은 <code>×</code> 대신 <code>x</code>로 써도 되고, 따옴표도 <code>&quot;</code>·<code>&apos;</code>로 써도 읽어요.
        </p>
      )}

      {result !== null && (
        <NotationFacts notation={result.notation} totals={result.totals} />
      )}

      <details className="plan-session-guidance plan-notation-boundary">
        <summary>이 화면에서 하지 않는 것</summary>
        <p>
          개인 최고기록이나 목표기록으로 페이스를 계산하지 않아요. 자동으로 훈련을 배정하거나
          초안 훈련 템플릿을 활성화하지도 않아요. 몸 상태를 확인하거나 안전 판단을 대신하지 않습니다.
        </p>
      </details>
    </section>
  )
}

function NotationFacts({
  notation,
  totals,
}: {
  readonly notation: UnboundPrescriptionNotation
  readonly totals: PrescriptionDerivedTotals
}) {
  return (
    <section className="plan-notation-results" aria-live="polite" aria-label="훈련표 표기 결과">
      <h2>표기에서 확인한 내용</h2>
      <dl className="plan-notation-facts">
        <Fact label="세트" value={`${formatNumber(notation.setCount)}세트`} />
        <Fact label="세트마다 반복" value={`${formatNumber(notation.repetitionsPerSet)}회`} />
        <Fact label="전체 반복" value={`${formatNumber(totals.totalRepetitions)}회`} />
        {totals.qualityDistanceM !== null && (
          <Fact label="빠르게 달리는 거리" value={`${formatNumber(totals.qualityDistanceM)}m`} />
        )}
        {notation.repetitionRecoverySeconds !== null && (
          <Fact
            label="반복 사이 회복"
            value={`${formatNumber(notation.repetitionRecoverySeconds)}초 · ${formatNumber(totals.repetitionRecoveryOccurrences)}번`}
          />
        )}
        {notation.setRecoverySeconds !== null && (
          <Fact
            label="세트 사이 회복"
            value={`${formatNumber(notation.setRecoverySeconds / 60)}분 · ${formatNumber(totals.setRecoveryOccurrences)}번`}
          />
        )}
        {totals.plannedRecoverySeconds !== null && (
          <Fact label="계획된 회복 시간 합계" value={`${formatNumber(totals.plannedRecoverySeconds)}초`} />
        )}
      </dl>
      <p className="plan-notation-race-pace">
        {formatNumber(notation.paceTargetEventDistanceM)}m RP는 그 거리 경기 페이스를 뜻하는 표기예요.
        이 결과는 개인 페이스 숫자를 계산한 것이 아닙니다.
      </p>
    </section>
  )
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
