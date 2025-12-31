-- Migration: Create comments table
-- Description: Creates the comments table to support comments and replies on content
-- Date: 2024

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    parent_id UUID NULL REFERENCES comments(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- Add constraint to ensure text is not empty
ALTER TABLE comments ADD CONSTRAINT comments_text_not_empty CHECK (LENGTH(TRIM(text)) > 0);

-- Add comment to table
COMMENT ON TABLE comments IS 'Stores comments and replies on content. Supports one level of nesting (comments and replies only).';

