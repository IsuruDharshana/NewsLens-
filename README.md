# NewsLens — See Every Angle

An AI-powered multi-agent news aggregation system for Sri Lanka. Aggregates news from 15+ sources, clusters stories using semantic similarity, generates neutral summaries, detects source bias, and delivers a unified, transparent news feed.

Built for the AI Buildathon Hackathon.

## Problem

Sri Lanka lacks a non-biased news platform. Existing services deliver single-source content. NewsLens aggregates from multiple English, Sinhala, and Tamil media outlets, shows how different sources frame the same story, and lets readers form their own opinions.

## How It Works

```
RSS Feeds → Scout Agent → Analyst Agent → Writer Agent → Verifier Agent → Mobile App
              (fetch)      (cluster)       (summarize)    (bias/confidence)
```

Four specialized AI agents work together in a pipeline:

1. **Scout Agent** — Fetches articles from RSS feeds, Telegram, and Reddit every 15 minutes
2. **Analyst Agent** — Clusters same-story articles using Gemini embeddings, categorizes them
3. **Writer Agent** — Generates neutral, factual summaries with strict no-opinion prompts
4. **Verifier Agent** — Detects source bias, cross-references claims, scores confidence

## Tech Stack

| Layer | Technology | Free Tier |
|-------|-----------|-----------|
| Frontend | Expo (React Native) | Open source |
| Backend | FastAPI (Python) | Open source |
| Database | Supabase (PostgreSQL) | 500 MB |
| LLM | Google Gemini API | 15 RPM |
| Agent Framework | LangGraph | Open source |
| Vector DB | ChromaDB | Local/in-process |
| Notifications | Firebase Cloud Messaging | Unlimited |
| Hosting | Render.com | 750 hrs/month |

## Project Structure

```
newslens/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment settings
│   │   ├── agents/              # AI agent implementations
│   │   │   ├── scout.py         # RSS feed ingestion
│   │   │   ├── analyst.py       # Clustering & categorization
│   │   │   ├── writer.py        # Neutral summarization
│   │   │   └── verifier.py      # Bias detection & confidence
│   │   ├── services/            # External service integrations
│   │   │   ├── supabase_service.py
│   │   │   ├── gemini_service.py
│   │   │   └── chroma_service.py
│   │   ├── routes/              # API endpoints
│   │   └── models/              # Pydantic schemas & source config
│   ├── database_schema.sql      # Supabase table definitions
│   └── requirements.txt
├── mobile/                      # Expo React Native app
└── .github/workflows/           # CI pipeline
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Supabase project (free tier)
- Google Gemini API key (free tier)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

pip install -r requirements.txt

cp .env.example .env
# Edit .env with your Supabase and Gemini API keys

# Run the database schema in Supabase SQL Editor
# (copy contents of database_schema.sql)

uvicorn app.main:app --reload
```

API docs available at `http://localhost:8000/docs`

### Mobile Setup

```bash
cd mobile
npm install
npx expo start
```

Open in browser or scan QR code with Expo Go app on your phone.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/news` | Paginated news feed |
| GET | `/api/news/{id}` | Story detail with sources & bias analysis |
| GET | `/api/news/trending` | Stories sorted by trend score |
| GET | `/api/news/breaking` | Current breaking news |
| POST | `/api/news/query` | Ask AI questions about news (RAG) |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| PUT | `/api/user/preferences` | Update interests |
| POST | `/api/pipeline/trigger` | Manually trigger news pipeline |
| GET | `/api/pipeline/status` | Pipeline status |

## News Sources

Ada Derana, Daily Mirror, NewsFirst, The Island, EconomyNext, Daily FT, Lanka Business Online, Daily News, Lankadeepa (Sinhala), Virakesari (Tamil), and more.

## License

MIT
