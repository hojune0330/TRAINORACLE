/** Read-only projection of the existing journal; never a second sleep record. */
export interface SleepInnJournalContext {
  date: string;
  status: 'recorded' | 'missing' | 'draft' | 'unavailable';
  entryId?: string;
  sleepH?: number;
  sleepQuality?: number;
  sourceLabel?: string;
}

export interface SleepInnGameProps {
  journal: SleepInnJournalContext;
  persistenceScope: string;
  onBack: () => void;
  onOpenJournal: () => void;
  /** A saved-journal reader shortcut instead of the default sleep editor. */
  journalLinkLabel?: string | undefined;
  /** Only an explicit '친구 만나기' shortcut requests this initial destination. */
  startWithJournalMeeting?: boolean | undefined;
  returnLabel?: string;
  /** The modal asks before native Back/Escape; pending game writes stay visible. */
  onCanExitReady?: ((canExit: (() => boolean) | null) => void) | undefined;
}
