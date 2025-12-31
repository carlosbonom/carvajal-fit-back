-- Migration: Add preferred_weight_unit column to users table
-- Date: 2024

-- Add preferred_weight_unit column with default 'kg'
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_weight_unit VARCHAR(2) NOT NULL DEFAULT 'kg';

-- Add check constraint to ensure only 'kg' or 'lb' values
ALTER TABLE users
ADD CONSTRAINT check_preferred_weight_unit 
CHECK (preferred_weight_unit IN ('kg', 'lb'));

-- Update existing users to have 'kg' as default if not set
UPDATE users
SET preferred_weight_unit = 'kg'
WHERE preferred_weight_unit IS NULL OR preferred_weight_unit NOT IN ('kg', 'lb');

