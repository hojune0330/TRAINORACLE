export const FORM_INPUT_DRAFT_TITLE = "TRAINORACLE_FORM_INPUT_V1"

/** Reserved even when its body is malformed: the free-text editor cannot repair it. */
export function isFormInputDraft(draft: { title: string }) {
  return draft.title === FORM_INPUT_DRAFT_TITLE
}
