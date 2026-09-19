export const FILE_ANALYSIS_POLICY_VERSION = "FILE_ANALYSIS_V1" as const
export const FILE_ANALYSIS_FORMATS = ["tcx", "csv", "json", "gpx"] as const
export type FileAnalysisFormat = typeof FILE_ANALYSIS_FORMATS[number]

/** Display/adoption switches never authorize account writes; the server checks its own gate. */
export function fileAnalysisFormats(env: Readonly<Record<string, unknown>> = import.meta.env): readonly FileAnalysisFormat[] {
  return FILE_ANALYSIS_FORMATS.filter(format => env[`VITE_FEATURE_FILE_ANALYSIS_${format.toUpperCase()}`] === "true"
    && env[`VITE_KILL_FILE_ANALYSIS_${format.toUpperCase()}`] !== "true")
}
