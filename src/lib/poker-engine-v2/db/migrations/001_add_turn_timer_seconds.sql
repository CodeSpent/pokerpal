-- Add turn_timer_seconds column to tournaments table
-- NULL means unlimited timer, default is 30 seconds

ALTER TABLE tournaments ADD COLUMN turn_timer_seconds INTEGER DEFAULT 30;
