import type { AppShellMultiPlanRuntime } from "../../AppShell"
import { assembleReviewedMultiMaterialsV3 } from "../../domain/assemble-reviewed-multi-materials-v3"
import { createReviewedMultiAdjustmentProviderV3, type CurrentMultiMaterialsReaderV3 } from "./reviewed-multi-adjustment-provider-v3"

type Materials = Parameters<typeof assembleReviewedMultiMaterialsV3>[0]
type Context = Parameters<CurrentMultiMaterialsReaderV3>[0]
type Sources = Pick<Materials, "slots" | "rpeBindings" | "policies">

/** Reads independent adopted sources afresh; never promotes a research proposal or stored snapshot. */
export function createAssembledMultiPlanRuntimeV3(options: {
  readonly readSources: (context: Context, at: Date) => Sources | null;
  readonly readRetained: NonNullable<AppShellMultiPlanRuntime["readMultiAdjustedEvidenceV3"]>;
  readonly now?: () => Date;
}): AppShellMultiPlanRuntime {
  return {
    readMultiAdjustedEvidenceV3: options.readRetained,
    multiAdjustmentResolverV3: createReviewedMultiAdjustmentProviderV3({
      now: options.now,
      readMaterials: (context, changes, at) => {
        const candidate = context.generated.candidates.find(c => c.candidateId === context.candidateId)
        if (!candidate) return null
        const sources = options.readSources(context, at)
        if (!sources) return null
        const retained = options.readRetained()
        const result = assembleReviewedMultiMaterialsV3({ ...sources, candidate, startDate: context.startDate,
          experienceBand: context.intake.experienceBand, changes, retained }, at)
        // Save must prove reconstruction with the same independent source used after
        // save/reload. Assembly's transient currentEvidence is not durable authority.
        return result.kind === "prepared" ? { ...result.review, retained } : null
      },
    }),
  }
}
