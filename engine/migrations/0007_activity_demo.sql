-- Marks steps from a demo- session, so demo runs can be told apart without being dropped.
ALTER TABLE activity ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;
