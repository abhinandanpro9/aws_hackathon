-- What each answer cost, stored beside what was said.
-- FLOW: answerQuestion measures -> recordConversation -> this column, JSON read whole
-- One column, not five: latency, tokens and tools are read together or not at all, and a
-- future field (per-tool timing, cache hits) lands here without another migration.
ALTER TABLE conversations ADD COLUMN metrics TEXT;
