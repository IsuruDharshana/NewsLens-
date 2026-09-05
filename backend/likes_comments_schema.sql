-- NewsLens Likes & Comments Schema
-- Run this in Supabase SQL Editor if likes/comments tables are missing.
-- Assumes clusters and user_profiles tables already exist.

-- User likes on story clusters
CREATE TABLE IF NOT EXISTS likes (
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, cluster_id)
);

-- User comments on story clusters
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Likes: anyone can read counts, users manage only their own
DROP POLICY IF EXISTS "Likes are publicly readable" ON likes;
CREATE POLICY "Likes are publicly readable"
    ON likes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON likes;
CREATE POLICY "Users can manage own likes"
    ON likes FOR ALL
    USING (auth.uid() = user_id);

-- Comments: anyone can read, users manage only their own
DROP POLICY IF EXISTS "Comments are publicly readable" ON comments;
CREATE POLICY "Comments are publicly readable"
    ON comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert own comments" ON comments;
CREATE POLICY "Users can insert own comments"
    ON comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments"
    ON comments FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments"
    ON comments FOR DELETE
    USING (auth.uid() = user_id);
