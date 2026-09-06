import React from "react"
import { PrescriptionAdjustmentEditor } from "./PrescriptionAdjustmentEditor"
import type { PrescriptionAdjustmentEditorProps } from "./PrescriptionAdjustmentEditor"
import { createAdjustmentCommitController } from "../../domain/prescription-adjustment-commit"
import type { AdjustmentCommitAdapter, AdjustmentCommitState } from "../../domain/prescription-adjustment-commit"

export type PrescriptionAdjustmentCommitHostProps = Omit<PrescriptionAdjustmentEditorProps, "current" | "onApply"> & {
  readonly base: AdjustmentCommitState
  readonly adapter: AdjustmentCommitAdapter
  readonly onCommitted: (state: AdjustmentCommitState) => void
}

/** Mount only with a real eligible transition. The controller rechecks the live
 * environment and commits number/explanation/receipt together, never by fields.
 */
export function PrescriptionAdjustmentCommitHost({ base, adapter, onCommitted, ...editor }: PrescriptionAdjustmentCommitHostProps) {
  const [openedBase] = React.useState(() => structuredClone(base))
  const live = React.useRef({ adapter, onCommitted })
  live.current = { adapter, onCommitted }
  const [controller] = React.useState(() => createAdjustmentCommitController({
    readState: () => live.current.adapter.readState(),
    readEnvironment: () => live.current.adapter.readEnvironment(),
    now: () => live.current.adapter.now(),
    compareAndSwap: (expected, next, validate) => live.current.adapter.compareAndSwap(expected, next, validate),
  }))
  const mounted = React.useRef(true)
  React.useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; controller.invalidate() }
  }, [controller])
  return <PrescriptionAdjustmentEditor {...editor} current={base.prescription}
    onCancel={() => { controller.invalidate(); editor.onCancel() }}
    onApply={async (receipt, prescription) => {
      const result = await controller.commit({ base: openedBase, receipt, prescription })
      if (result.kind === "rejected") throw new Error(result.code)
      if (mounted.current) live.current.onCommitted(result.state)
    }} />
}
