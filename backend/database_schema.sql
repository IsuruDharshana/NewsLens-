-- NewsLens Database Schema
-- Run this in Supabase SQL Editor

-- Grouped stories (same event from multiple sources) — MUST be before articles
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    summary TEXT,
    source_count INTEGER DEFAULT 0,
    category TEXT NOT NULL,
    is_breaking BOOLEAN DEFAULT false,
    confidence_score FLOAT DEFAULT 0.0,
    official_source_data JSONB,
    bias_analysis JSONB,
    trend_score FLOAT DEFAULT 0.0,
    published_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Articles ingested from RSS feeds (references clusters)
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT,
    published_at TIMESTAMPTZ,
    category TEXT,
    language TEXT DEFAULT 'en',
    cluster_id UUID REFERENCES clusters(id),
    bias_label TEXT,
    bias_explanation TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User preferences for personalization
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
    categories TEXT[] DEFAULT '{}',
    language TEXT DEFAULT 'en',
    sports_interests TEXT[] DEFAULT '{}',
    notification_enabled BOOLEAN DEFAULT true,
    fcm_token TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline execution logs
CREATE TABLE pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    articles_fetched INTEGER DEFAULT 0,
    clusters_created INTEGER DEFAULT 0,
    clusters_updated INTEGER DEFAULT 0,
    errors JSONB,
    status TEXT DEFAULT 'running'
);

-- User likes on story clusters
CREATE TABLE likes (
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, cluster_id)
);

-- User comments on story clusters
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_articles_cluster ON articles(cluster_id);
CREATE INDEX idx_articles_published ON articles(published_at DESC);
CREATE INDEX idx_articles_source ON articles(source_name);
CREATE INDEX idx_clusters_category ON clusters(category);
CREATE INDEX idx_clusters_breaking ON clusters(is_breaking) WHERE is_breaking = true;
CREATE INDEX idx_clusters_trend ON clusters(trend_score DESC);
CREATE INDEX idx_clusters_published ON clusters(published_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Public read access for articles and clusters (news is public)
CREATE POLICY "Articles are publicly readable"
    ON articles FOR SELECT
    USING (true);

CREATE POLICY "Clusters are publicly readable"
    ON clusters FOR SELECT
    USING (true);

-- Users can only read/write their own profile and preferences
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can view own preferences"
    ON user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON user_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Likes: users can manage own likes, anyone can read
CREATE POLICY "Likes are publicly readable"
    ON likes FOR SELECT
    USING (true);

CREATE POLICY "Users can manage own likes"
    ON likes FOR ALL
    USING (auth.uid() = user_id);

-- Comments: anyone can read, users manage own
CREATE POLICY "Comments are publicly readable"
    ON comments FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own comments"
    ON comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
    ON comments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
    ON comments FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Full-text search (Feature: GET /api/news/search?q=...)
-- Generated tsvector column on clusters (title=A, summary=B) + GIN index.
-- Auto-updates on insert/update — no trigger or backend function needed.
-- ============================================================================
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,   '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_clusters_search ON clusters USING GIN (search_vector);
