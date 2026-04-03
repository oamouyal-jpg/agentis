# Agentis

Agentis is a civic intelligence platform:
- People **submit public concerns**
- **AI clustering** runs automatically after submissions to generate structured civic questions
- People **vote yes/no**
- The system produces **insights** over attention, controversy, and consensus

## Local development

### Backend (Express, port 4000)

```bash
cd Backend
npm install
cp .env.example .env
npm run dev
```

Backend runs at `http://localhost:4000`.

### Frontend (Next.js, port 3000)

```bash
cd ..
npm install
cp .env.example .env.local
npm run dev
```

Frontend runs at `http://localhost:3000`.

## Deploy to Render

This repo includes a Render Blueprint (`render.yaml`) that creates two web services:
- **agentis-backend** (Express API)
- **agentis-frontend** (Next.js app)

### Render env vars to set

On the **backend** service:
- `OPENAI_API_KEY`: (optional) enables narrative generation for `/insights`
- `CORS_ORIGINS`: comma-separated list of allowed frontend origins
  - Example: `https://agentis-frontend.onrender.com`

On the **frontend** service:
- `NEXT_PUBLIC_API_BASE_URL`: the backend base URL
  - Example: `https://agentis-backend.onrender.com`

## Spaces (Phase 1)

Data is scoped by **space**. Each space has its own submissions, questions, votes, and insights.

- **Public space** — anyone can submit and vote (`visibility: public`).
- **Members-only space** — submit/vote only with the **invite token** (create a `members_only` space; the API returns `inviteSecret` once). Open the app as  
  `/s/your-slug?invite=TOKEN`  
  or send header `X-Space-Invite: TOKEN` on API calls (the UI stores the token from the query string).

**API**

- `GET /spaces` — list spaces (no secrets)
- `POST /spaces` — body: `{ name, slug, description?, visibility: "public" | "members_only" }`
- `GET /spaces/:slug` — space metadata
- Scoped routes (require invite for members-only):  
  `GET/POST /spaces/:slug/questions`, `/submit`, `/vote`, `/insights`, `/admin/...`

Legacy routes without a slug (`/questions`, `/submit`, `/vote`, `/insights`, `/admin`) use the **`open`** space.

**Frontend**

- `/` — directory of spaces + create form
- `/s/[slug]`, `/s/[slug]/submit`, `/s/[slug]/admin`, `/s/[slug]/insights`, `/s/[slug]/questions/[id]` — space UI

## App flow

1. Open `/` and pick a space (or use **open**).
2. **Submit** concerns (clustering runs in the background; refresh after a few seconds if needed).
3. Open a question and vote **Yes/No**.
4. **Insights** for aggregated signal in that space.

