# Agentis

Agentis is a civic intelligence platform:
- People **submit public concerns**
- **AI clustering** runs automatically after submissions to generate structured civic questions
- People **vote yes/no**
- The system produces **insights** over attention, controversy, and consensus

## Local development

### Combined server (recommended)

```bash
npm install
cd Backend && npm install && cd ..
cp .env.example .env.local
npm run build:backend
node server.js
```

App runs at `http://localhost:3000` — pages and API on the same URL (API under `/api`).

### Separate servers (alternative)

```bash
cd Backend && npm install && npm run dev   # API on :4000
cd .. && npm install && npm run dev        # Next.js on :3000
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` in `.env.local` if using separate servers.

## Deploy to Render

This repo includes a Render Blueprint (`render.yaml`) that creates **one** web service:
- **agentis** — Express API + Next.js, same process, same URL

### Render env vars to set

- `OPENAI_API_KEY`: (optional) enables AI narrative generation for `/insights`
- `NEXT_PUBLIC_SITE_URL`: your production URL (for share links / OG metadata)
- `NEXT_PUBLIC_API_BASE_URL`: optional. Leave **unset** on Render (same origin → requests use `/api`). If you set it to your public site URL, use `https://YOUR-SERVICE.onrender.com` **without** a path — the app will append `/api`. Do **not** point this at a different host unless that host serves the same API.

Local **split** dev (Backend on :4000): set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` (no `/api`; the Backend listens at the root).

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

