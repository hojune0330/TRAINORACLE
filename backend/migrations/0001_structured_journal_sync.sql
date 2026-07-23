CREATE TABLE journal_sync_batches (
  tenant_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  acknowledged_ids_json TEXT NOT NULL CHECK (json_valid(acknowledged_ids_json)),
  received_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, account_id, batch_id)
);

CREATE TABLE structured_journal_entries (
  tenant_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  journal_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('post-session', 'evening')),
  journal_date TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  memo_server_state TEXT NOT NULL CHECK (memo_server_state = 'local_only'),
  fields_json TEXT NOT NULL CHECK (json_valid(fields_json)),
  sync_batch_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, account_id, journal_id),
  FOREIGN KEY (tenant_id, account_id, sync_batch_id)
    REFERENCES journal_sync_batches (tenant_id, account_id, batch_id)
);

CREATE INDEX structured_journal_entries_by_date
  ON structured_journal_entries (tenant_id, account_id, journal_date, kind);
