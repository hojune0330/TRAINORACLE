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
  returnLabel?: string;
  /** The modal asks before native Back/Escape; pending game writes stay visible. */
  onCanExitReady?: ((canExit: (() => boolean) | null) => void) | undefined;
}
