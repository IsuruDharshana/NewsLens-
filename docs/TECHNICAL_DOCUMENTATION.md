# NewsLens — Technical Documentation

## 1. Project Overview

NewsLens is an AI-powered multi-agent news aggregation platform built for Sri Lanka. It autonomously collects articles from local RSS feeds, clusters related stories, generates neutral summaries, detects source bias, translates content into Sinhala, and answers natural-language questions over the news archive. The system is delivered through an Android mobile app and a web admin dashboard.

---

## 2. System Architecture

```
┌─────────────────┐      ┌─────────────────────────────┐      ┌──────────────┐
│   Mobile App    │◄────►│  FastAPI Backend (Render)   │◄────►│   Supabase   │
│  (Expo / RN)    │      │                             │      │  PostgreSQL  │
└─────────────────┘      │  • Scout Agent              │      └──────────────┘
                         │  • Analyst Agent            │            ▲
┌─────────────────┐      │  • Writer Agent             │            │
│  Admin Dashboard│◄────►│  • Verifier Agent           │            │
│ (React / Vite)  │      │  • RAG over ChromaDB        │      ┌──────────────┐
└─────────────────┘      │  • Auth / Engagement API    │      │   ChromaDB   │
                         └─────────────────────────────┘      │  (local)     │
                                    │                          └──────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  Gemini / Groq (LLM) │
                         └──────────────────────┘
```

---

## 3. Backend

### 3.1 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | FastAPI (Python 3.12) |
| Database | Supabase PostgreSQL |
| Vector Store | ChromaDB (local) |
| LLM | Gemini (primary), Groq (fallback) |
| Auth | Supabase Auth |
| Deployment | Render (Web Service) |
| Scheduling | GitHub Actions keep-alive ping |

### 3.2 Multi-Agent Pipeline

The backend runs a coordinated pipeline of four agents:

#### Scout Agent (`backend/app/agents/scout.py`)
- Fetches RSS feeds from six Sri Lankan sources:
  - The Island
  - EconomyNext
  - Daily News
  - Lanka Business Online
  - NewsWire
  - Sri Lanka Mirror
- Extracts title, content, publish date, and image URL
- Filters articles older than 72 hours
- Deduplicates by URL
- Strips embedded HTML tags from content before storage

#### Analyst Agent (`backend/app/agents/analyst.py`)
- Clusters related articles into single news stories
- Assigns a category to each cluster:
  - Politics, Economy, Sports, Technology, Health, Education, Environment, Entertainment
- Uses LLM-based semantic grouping

#### Writer Agent (`backend/app/agents/writer.py`)
- Generates a neutral 8–15 word headline
- Generates a 2–3 sentence factual summary
- Uses batched LLM calls for efficiency
- Implements strong fallbacks so cards never ship blank:
  - Falls back to first article headline
  - Falls back to first sentence of summary
  - Falls back to category-based generic title
  - Strips HTML from any raw content

#### Verifier Agent (`backend/app/agents/verifier.py`)
- Labels each source's coverage as:
  - Neutral
  - Pro-Government
  - Critical
  - Sensationalist
- Computes an overall bias breakdown per story
- Scores urgency/trending signals for breaking-news detection

### 3.3 Pipeline Orchestrator

`backend/app/services/pipeline_service.py` wires the agents together:

1. Fetch articles
2. Store raw articles in Supabase
3. Embed recent articles in ChromaDB for RAG
4. Cluster and categorize
5. Generate headlines and summaries
6. Detect bias and breaking-news scores
7. Save final clusters

The orchestrator reports stats at the end of each run: articles fetched, stored, clusters created, LLM call count, and provider name.

### 3.4 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service health check |
| `POST /api/pipeline/trigger` | Trigger a pipeline run |
| `GET /api/pipeline/status` | Pipeline run status |
| `GET /api/news` | Paginated news feed |
| `GET /api/news/breaking` | Breaking news stories |
| `GET /api/news/trending` | Trending stories |
| `GET /api/news/search` | Full-text search |
| `GET /api/news/{id}` | Story detail |
| `GET /api/news/personalized` | Personalized feed by preferences |
| `POST /api/news/query` | RAG question answering |
| `POST /api/auth/register` | User registration |
| `POST /api/auth/login` | User login |
| `GET /api/auth/me` | Current user profile |
| `GET /api/user/preferences` | Get user preferences |
| `PUT /api/user/preferences` | Update preferences |
| `POST /api/engage/like/{id}` | Like/unlike a story |
| `GET /api/engage/like/{id}` | Like status |
| `GET /api/engage/comments/{id}` | Get comments |
| `POST /api/engage/comments/{id}` | Add comment |
| `DELETE /api/engage/comments/{id}` | Delete comment |
| `GET /api/admin/dashboard` | Admin dashboard stats |

### 3.5 Database & Storage

**Supabase PostgreSQL stores:**
- Users and authentication
- Article records
- Cluster records (stories with generated title/summary)
- User preferences
- Likes and comments
- Pipeline run logs

**ChromaDB (local) stores:**
- Article embedding vectors for RAG
- Enables semantic search for "Ask about the news"

### 3.6 LLM Provider Abstraction

A unified provider architecture makes the backend LLM-agnostic:

- `backend/app/services/llm_provider.py` — abstract interface
- `backend/app/services/gemini_service.py` — Gemini adapter
- `backend/app/services/groq_provider.py` — Groq implementation
- `backend/app/services/llm_service.py` — factory + embedding fallback

Switch providers by setting the environment variable:

```bash
LLM_PROVIDER=gemini   # or groq
```

Embeddings always fall back to Gemini because Groq does not provide an embedding model.

### 3.7 Backend Deployment

- Hosted on Render at `https://newslens-wcki.onrender.com`
- `render.yaml` defines the web service with autoDeploy
- GitHub Actions workflow `.github/workflows/keep-alive.yml` pings `/health` every 10 minutes to prevent free-tier spin-down
- Backend auto-redeploys on every push to `main`

---

## 4. Frontend

### 4.1 Mobile App (Expo React Native)

**Location:** `mobile/`

**Features:**
- News feed with category filtering
- Breaking news banner with dismiss action
- Story detail page with bias breakdown and source links
- Likes and comments
- User preferences (categories, language, notifications)
- Sinhala language support
- RAG "Ask about the news"
- Full-text search
- Dark/light theme
- Responsive layout for different screen sizes and orientations
- Safe area handling
- Skeleton loading screens
- Relative timestamps ("2 hrs ago")
- Offline cache + demo fallback for demo reliability

**Key files:**
- `mobile/app/(tabs)/index.tsx` — Home feed
- `mobile/app/story/[id].tsx` — Story detail
- `mobile/lib/api.ts` — API client
- `mobile/lib/cache.ts` — AsyncStorage cache
- `mobile/lib/demoData.ts` — Demo fallback stories
- `mobile/components/NewsImage.tsx` — Image with placeholder fallback
- `mobile/components/Skeleton.tsx` — Loading skeletons

### 4.2 Admin Dashboard (React + Vite)

**Location:** `admin/`

**Features:**
- Trigger pipeline runs
- View pipeline stats and progress
- Monitor source health
- View LLM call counts and provider
- Deployed on Vercel

---

## 5. AI Usage in NewsLens

AI is used in six core ways:

1. **Headline & Summary Generation** — Writer Agent generates neutral, readable story cards from raw RSS articles.
2. **News Categorization** — Analyst Agent classifies stories into topics (Politics, Economy, Sports, etc.).
3. **Event Clustering** — Analyst Agent groups related articles into single stories.
4. **Source Bias Detection** — Verifier Agent labels each source as Neutral, Pro-Government, Critical, or Sensationalist.
5. **Breaking News Scoring** — Verifier Agent scores urgency to surface breaking stories.
6. **Sinhala Translation** — News summaries are translated in batch for Sinhala-speaking users.
7. **RAG Question Answering** — Natural-language questions are answered using ChromaDB vector search + LLM.

All LLM calls route through `llm_service`, so the provider (Gemini or Groq) can be swapped without changing agent code.

---

## 6. Caching Methods

NewsLens uses a multi-layer caching strategy:

### 6.1 Backend Caching

- **ChromaDB vector cache:** Article embeddings are persisted locally and reused for RAG. Avoids regenerating embeddings on every pipeline run.
- **Supabase relational cache:** Clusters, articles, likes, comments, and preferences are persisted in PostgreSQL.

### 6.2 Mobile Caching

- **AsyncStorage offline cache:** Successful API responses for feed, breaking news, and story details are cached locally.
- **Demo fallback data:** If the backend is unreachable and no cache exists, the app shows realistic demo Sri Lankan news stories.
- **Cache keys:**
  - `newslens:news`
  - `newslens:breaking`
  - `newslens:story:{id}`
  - `newslens:cacheMeta`

### 6.3 Deployment-Level Caching

- **Render keep-alive:** GitHub Actions pings the backend every 10 minutes to keep the free-tier instance warm.
- **APK cache warming:** Before judging, the app is opened once to cache real news on the device.

---

## 7. Reliability & Demo Hardening

Specific fixes implemented to ensure a reliable hackathon demo:

- **Never-blank headlines:** Multi-level fallback chain in Writer Agent and mobile UI.
- **HTML stripping:** RSS `<img>` tags and other HTML are stripped before display.
- **Image placeholder:** `NewsImage` component shows a branded placeholder when no image exists or loading fails.
- **Backend URL fix:** Mobile app uses production Render URL in release builds; error messages show the actual URL.
- **Timeout increase:** Axios timeout raised to 45s to survive Render cold starts.
- **Offline mode:** Cached and demo stories keep the app usable without connectivity.
- **Render keep-alive:** Scheduled GitHub Actions ping prevents spin-down.

---

## 8. DevOps & Monitoring

- **Version control:** GitHub
- **Backend CI/CD:** Render autoDeploy on `main`
- **Admin CI/CD:** Vercel auto-deploy on `main`
- **Mobile CI/CD:** EAS Build (Expo)
- **Monitoring:** Admin dashboard shows pipeline stats, source health, and LLM usage
- **Keep-alive:** GitHub Actions cron job

---

## 9. Strong Points for an AI Hackathon

1. **Real multi-agent architecture** — Four specialized agents (Scout, Analyst, Writer, Verifier) cooperate to produce the final news feed.
2. **Bias transparency** — The app makes media bias visible to users, addressing a real societal problem.
3. **Language inclusion** — Sinhala translation makes the app accessible to a majority of Sri Lankans.
4. **RAG-powered Q&A** — Users can ask natural-language questions about the news archive.
5. **LLM-agnostic backend** — Unified provider interface allows switching between Gemini and Groq without rewriting agents.
6. **End-to-end product** — Backend, mobile app, admin dashboard, authentication, engagement, and deployment are all functional.
7. **Demo resilience** — Offline cache and demo fallback ensure judges always see content.
8. **Sri Lanka-focused** — Built specifically for the local news ecosystem with real local sources.

---

## 10. Repository Structure

```
newslens/
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── agents/        # Scout, Analyst, Writer, Verifier
│   │   ├── models/        # Schemas and RSS sources
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # LLM providers, pipeline, Supabase, ChromaDB
│   │   └── utils/         # Text utilities (HTML stripping)
│   ├── render.yaml        # Render deployment blueprint
│   └── requirements.txt
├── mobile/                # Expo React Native app
│   ├── app/               # Screens
│   ├── components/        # Reusable UI components
│   ├── lib/               # API, cache, demo data, auth, types
│   └── app.json
├── admin/                 # React admin dashboard
│   ├── src/
│   └── vite.config.ts
├── .github/workflows/     # CI/CD and keep-alive
└── docs/                  # Documentation
```

---

## 11. Environment Variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Gemini LLM / embeddings |
| `GROQ_API_KEY` | Groq LLM (optional fallback) |
| `LLM_PROVIDER` | `gemini` or `groq` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `EXPO_PUBLIC_API_URL` | Mobile API override (optional) |

---

*Last updated: September 2026*
