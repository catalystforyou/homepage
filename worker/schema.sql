CREATE TABLE IF NOT EXISTS submissions (
  token           TEXT    PRIMARY KEY,
  my_id           TEXT    NOT NULL,
  my_id_norm      TEXT    NOT NULL,
  target_id       TEXT    NOT NULL,
  target_id_norm  TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  matched_at      INTEGER,
  withdrawn       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_my   ON submissions(my_id_norm);
CREATE INDEX IF NOT EXISTS idx_pair ON submissions(my_id_norm, target_id_norm);
