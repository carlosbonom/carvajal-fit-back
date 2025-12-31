-- Migration: Create user_weight_progress table
-- Description: Creates the user_weight_progress table to track user weight over time
-- Date: 2024

-- Create user_weight_progress table
CREATE TABLE IF NOT EXISTS user_weight_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0),
    notes TEXT,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_weight_user ON user_weight_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_date ON user_weight_progress(recorded_at);

-- Add comment to table
COMMENT ON TABLE user_weight_progress IS 'Stores user weight progress entries over time for tracking fitness goals.';

