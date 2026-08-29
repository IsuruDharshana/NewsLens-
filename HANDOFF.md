# NewsLens — Developer Handoff Document

> This document is for contributors picking up where the initial build left off.
> Read this top to bottom before touching any code.

---

## What is NewsLens?

An AI-powered multi-agent news aggregation system built for Sri Lanka. It aggregates articles from 6+ RSS feeds, clusters stories about the same topic, generates neutral AI headlines + summaries, detects source bias, and delivers a clean mobile news feed with Sinhala translation support.

Built for the **AI Buildathon Hackathon**.

---

## Repository

```
https://github.com/IsuruDharshana/NewsLens-
Active branch: feature/auth-and-preferences
```

Clone and switch to the active branch:
```bash
git clone https://github.com/IsuruDharshana/NewsLens-.git
cd NewsLens-
git checkout feature/auth-and-preferences
```

---

## Project Structure

```
newslens/
├── backend/                        # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                 # App entry point, scheduler, CORS
│   │   ├── config.py               # Pydantic settings (reads .env)
│   │   ├── agents/
│   │   │   ├── scout.py            # Fetches RSS feeds → raw articles
│   │   │   ├── analyst.py          # Clusters articles by topic (ChromaDB embeddings)
│   │   │   ├── writer.py           # Gemini: generates headline + neutral summary
│   │   │   └── verifier.py         # Gemini: bias detection + confidence score
│   │   ├── services/
│   │   │   ├── supabase_service.py # All DB read/write operations
│   │   │   ├── gemini_service.py   # Gemini API wrapper with rate limiting
│   │   │   ├── pipeline_service.py # Orchestrates all 4 agents
│   │   │   └── chroma_service.py   # Local vector DB for clustering
│   │   ├── routes/
│   │   │   ├── news.py             # GET /api/news, /api/news/{id}, trending, breaking
│   │   │   ├── auth.py             # POST /api/auth/register, /login, GET /me
│   │   │   ├── user.py             # GET/PUT /api/user/preferences
│   │   │   ├── engage.py           # Likes + comments endpoints
│   │   │   ├── pipeline.py         # POST /api/pipeline/trigger, GET /status
│   │   │   └── admin.py            # GET /api/admin/dashboard (all monitoring data)
│   │   └── models/
│   │       ├── schemas.py          # Pydantic request/response models
│   │       └── sources.py          # RSS feed list (FEED_SOURCES)
│   ├── database_schema.sql         # Full Supabase schema (run this first!)
│   └── requirements.txt
├── mobile/                         # Expo React Native app
│   ├── app/
│   │   ├── _layout.tsx             # Root layout — auth guard, tab/stack navigation
│   │   ├── login.tsx               # Login + register screen
│   │   ├── (tabs)/
│   │   │   ├── index.tsx           # Home feed (category chips, news cards)
│   │   │   └── settings.tsx        # User preferences + logout
│   │   └── story/[id].tsx          # Story detail (headline, summary, sources, likes, comments)
│   └── lib/
│       ├── api.ts                  # Axios client + all API functions
│       ├── auth.tsx                # Auth context (login/logout/token storage)
│       └── types.ts                # TypeScript interfaces
├── admin/                          # Vite + React admin dashboard (port 3000)
│   └── src/
│       ├── App.tsx                 # All 10 monitoring panels
│       └── index.css               # Dark theme styles
└── .github/workflows/ci.yml        # GitHub Actions CI (lint + import check)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | Expo (React Native) — runs on iOS, Android, Web |
| Backend API | FastAPI (Python 3.12) |
| Database | Supabase (PostgreSQL + Auth) |
| LLM | Google Gemini 2.0 Flash |
| Embeddings/Clustering | ChromaDB (local, in-process) |
| Admin dashboard | Vite + React (plain, no extra UI library) |
| CI | GitHub Actions |

---

## Environment Setup

### 1. Supabase

Create a free project at [supabase.com](https://supabase.com). You need:
- **Project URL** — looks like `https://xxxx.supabase.co`
- **Anon key** — found in Project Settings → API
- **Service Role key** — same page (keep this secret)

In the Supabase SQL editor, run the full contents of `backend/database_schema.sql`.

Then run these extra migrations (not yet in the schema file):
```sql
-- AI-generated headline column
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS title TEXT;

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, cluster_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes are publicly readable" ON likes;
CREATE POLICY "Likes are publicly readable" ON likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own likes" ON likes;
CREATE POLICY "Users can manage own likes" ON likes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Comments are publicly readable" ON comments;
CREATE POLICY "Comments are publicly readable" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own comments" ON comments;
CREATE POLICY "Users can manage own comments" ON comments FOR ALL USING (auth.uid() = user_id);
```

**Important:** Go to Authentication → Providers → Email → turn OFF "Confirm email". Otherwise new registrations will fail with email rate limit errors during development.

### 2. Gemini API key

Get a free key at [aistudio.google.com](https://aistudio.google.com). The free tier (15 RPM) works fine. For faster runs, use a paid key.

### 3. Backend `.env` file

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
ENVIRONMENT=development
PIPELINE_INTERVAL_MINUTES=15
```

### 4. Backend — run locally

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # Mac/Linux

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### 5. Mobile — run locally

```bash
cd mobile
npm install
npx expo start --web        # browser at http://localhost:8082
# or: npx expo start        # shows QR code for Expo Go app
```

### 6. Admin dashboard — run locally

```bash
cd admin
npm install
npx vite --port 3000
```

Open `http://localhost:3000`. It proxies all `/api` calls to `http://localhost:8000` automatically (configured in `vite.config.ts`).

---

## How the Pipeline Works

Every 15 minutes (configurable via `PIPELINE_INTERVAL_MINUTES`), the pipeline runs automatically:

```
1. Scout Agent
   - Reads FEED_SOURCES from backend/app/models/sources.py
   - Fetches each RSS feed with feedparser
   - Deduplicates against existing articles (URL match)
   - Saves new articles to Supabase `articles` table

2. Analyst Agent
   - Takes all unclustered articles
   - Generates embeddings via ChromaDB
   - Groups articles about the same story using cosine similarity
   - Assigns category (Politics, Business, Sports, etc.)
   - Creates/updates `clusters` table entries

3. Writer Agent
   - For each new cluster, calls Gemini once per batch
   - Returns: { title: "Headline", summary: "2-3 sentences" }
   - The title is attention-grabbing (news-style, 8-15 words)
   - The summary is strictly factual (no opinion, no editorializing)

4. Verifier Agent
   - Detects bias signals per source
   - Cross-references claims across sources
   - Assigns confidence_score (0.0–1.0) and trend_score
   - Stores bias_analysis JSONB in the cluster

5. Pipeline saves stats to `pipeline_runs` table
   (visible in the admin dashboard → Recent Runs)
```

You can trigger it manually:
- Via the admin dashboard **▶ Run Pipeline** button
- Via `POST http://localhost:8000/api/pipeline/trigger`
- Via Swagger UI at `http://localhost:8000/docs`

---

## API Reference

All endpoints are under `http://localhost:8000/api/`.
Full interactive docs at `http://localhost:8000/docs`.

### News
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/news` | Paginated feed. Params: `page`, `limit`, `category`, `lang` (en/si) |
| GET | `/news/{id}` | Full story detail with sources, bias analysis. Param: `lang` |
| GET | `/news/trending` | Stories sorted by trend_score |
| GET | `/news/breaking` | Stories where is_breaking=true |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | `{ email, password, full_name }` |
| POST | `/auth/login` | `{ email, password }` → returns `access_token` |
| GET | `/auth/me` | Returns current user (requires Bearer token) |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/preferences` | Get user preferences |
| PUT | `/user/preferences` | Update categories, language, sports_interests |

### Engagement
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/engage/like/{cluster_id}` | Toggle like (requires auth) |
| GET | `/engage/like/{cluster_id}` | Get like count + whether user liked (auth optional) |
| GET | `/engage/comments/{cluster_id}` | List comments |
| POST | `/engage/comments/{cluster_id}` | Add comment (requires auth) |
| DELETE | `/engage/comments/{cluster_id}` | Delete own comment (requires auth) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | All 10 monitoring data points in one call |

### Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pipeline/trigger` | Run pipeline now |
| GET | `/pipeline/status` | Running status + last run stats |

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `articles` | Raw fetched articles (url, title, content, source_name, published_at, cluster_id) |
| `clusters` | Story clusters (id, title, summary, category, is_breaking, confidence_score, trend_score, bias_analysis, published_at) |
| `article_clusters` | Many-to-many join of articles ↔ clusters |
| `user_profiles` | User display names (mirrors auth.users) |
| `user_preferences` | Categories, language (en/si), sports_interests |
| `likes` | user_id + cluster_id composite PK |
| `comments` | id, user_id, cluster_id, text, created_at |
| `pipeline_runs` | started_at, completed_at, articles_fetched, clusters_created, status, errors |

---

## Active RSS Sources

Configured in `backend/app/models/sources.py`:

| Source | Language | Priority |
|--------|----------|----------|
| The Island | English | 0 |
| EconomyNext | English | 0 |
| Daily News | English | 0 |
| Lanka Business Online | English | 0 |
| NewsWire | English | 0 |
| Sri Lanka Mirror | English | 1 |

> Priority 0 = primary sources. Priority 1 = supplementary.
> To add a new source, just append to `FEED_SOURCES` in `sources.py`.

---

## What's Built ✅

- [x] Multi-agent pipeline (Scout → Analyst → Writer → Verifier)
- [x] Supabase database integration
- [x] ChromaDB semantic clustering
- [x] Gemini AI headline + summary generation
- [x] Gemini bias detection + confidence scoring
- [x] Sinhala translation (batched Gemini calls)
- [x] FastAPI REST backend with all routes
- [x] User registration + login (Supabase Auth JWT)
- [x] User preferences (categories, language, sports)
- [x] Expo mobile app — feed, story detail, settings
- [x] Category filter chips on home feed
- [x] Breaking news + trending news endpoints
- [x] Likes system (toggle, count on feed cards)
- [x] Comments system (add, list, delete own)
- [x] Engagement counts on feed cards (heart + chat icons)
- [x] Web admin dashboard (10 monitoring panels)
- [x] Manual pipeline trigger button in admin
- [x] GitHub Actions CI (runs on every push)
- [x] Rate limiting on Gemini (separate limiters for pipeline vs translation)

---

## What's Left to Build 🚧

These are the remaining features in rough priority order:

### High Priority (needed for a complete demo)
1. **Backend deployment to Render.com** — the app currently only runs locally. Deploy backend to `https://newslens.onrender.com` (free tier). See `render.yaml` setup needed.
2. **App branding** — app icon, splash screen, proper name in Expo config. Currently uses default Expo icon.

### Medium Priority (strong hackathon features)
3. **RAG "Ask about the news"** — the `/api/news/query` endpoint is scaffolded but not implemented. Use ChromaDB + Gemini to answer questions like "What happened with the Sri Lanka economy this week?". ChromaDB already has article embeddings stored.
4. **News images/thumbnails** — RSS feeds include image URLs. Extract `og:image` or `<media:content>` from feeds in Scout Agent and store in articles. Display in feed cards and story detail.
5. **Push notifications** — Firebase Cloud Messaging is in the tech stack but not implemented. Notify users when a breaking news story is published.

### Nice to Have
6. **Live cricket/football scores** — integrate a sports scores API (e.g., CricAPI for cricket). Show a live score widget on the home feed for Sports category users.
7. **Search** — full-text search across clusters. Supabase supports `ts_vector` search natively.
8. **More RSS sources** — especially Sinhala and Tamil sources. Add Lankadeepa, Virakesari when their feeds are stable.
9. **Refresh fetch rate setting** in admin dashboard — let admin change `PIPELINE_INTERVAL_MINUTES` at runtime without restarting the server.

---

## Known Issues / Gotchas

1. **Existing clusters have no title** — clusters created before the headline feature was added will have `title = null`. The mobile app handles this gracefully (shows summary only). Re-run the pipeline to generate new clusters with titles.

2. **ChromaDB is local/ephemeral** — ChromaDB runs in-process and stores data in memory (or a local directory). On Render free tier, the filesystem is ephemeral. When deploying, you may want to switch to a persistent ChromaDB cloud instance, or use Supabase `pgvector` extension instead.

3. **Gemini free tier limits** — free tier is 15 RPM and ~1500 requests/day. The pipeline uses ~5 Gemini calls per run (batched). Translation adds more calls. If you hit 429 errors, either wait or use a paid key. The code already handles quota errors gracefully (falls back to English).

4. **Supabase email confirmation** — must be disabled in Authentication → Providers → Email → "Confirm email" OFF, otherwise registration fails with rate limit errors during development.

5. **iOS simulator** — for native iOS testing you need macOS + Xcode. On Windows, use the Expo web build or Android emulator.

---

## Coding Conventions

### Backend (Python)
- All DB operations go through `supabase_service.py` — never call `supabase_service.client` directly from routes
- All Gemini calls go through `gemini_service.py` — handles rate limiting automatically
- Route files are thin — business logic belongs in services or agents
- Always use `try/except` around Supabase queries and return sensible defaults (empty list, 0 count) on error
- Use `logger.debug()` for non-critical failures (table missing, etc.) and `logger.error()` for real errors

### Mobile (TypeScript/React Native)
- All API calls go through `mobile/lib/api.ts` — never use `fetch` directly in components
- All type definitions live in `mobile/lib/types.ts`
- Auth state comes from `useAuth()` hook (`mobile/lib/auth.tsx`)
- Navigation uses Expo Router file-based routing
- After logout, always call `router.replace('/login')` explicitly — conditional Stack re-rendering alone does not navigate

### Admin (React)
- Single-file app (`App.tsx`) — keep it that way for simplicity
- All data comes from one `GET /api/admin/dashboard` call — add new data to that endpoint, not separate calls

---

## Running Everything Together

Open 3 terminals:

**Terminal 1 — Backend**
```bash
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Mobile app**
```bash
cd mobile
npx expo start --web
# Opens at http://localhost:8082
```

**Terminal 3 — Admin dashboard**
```bash
cd admin
npx vite --port 3000
# Opens at http://localhost:3000
```

---

## Git Branch Strategy

```
main                          ← stable, merged PRs only
feature/auth-and-preferences  ← current active branch (most up to date)
feature/mobile-app-ui         ← merged
feature/scout-agent-pipeline  ← merged
```

For new features, branch off `feature/auth-and-preferences` (not `main`) since `main` is behind.

```bash
git checkout feature/auth-and-preferences
git checkout -b feature/your-feature-name
```

---

## Questions?

The original developer is **Isuru Dharshana** (`isurudharshana05@gmail.com`).
This project was built using **Qoder AI IDE** in a single session.
