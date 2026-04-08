# Hot topic & emerging topics — definition

This document defines how the app picks **one primary “hot” topic** (with a vote) and a small set of **emerging topics**, using **people’s entries** only. It is **not calendar-driven**: the hot topic stays until something else **clearly** deserves to replace it.

---

## 1. Concepts

| Term | Meaning |
|------|--------|
| **Topic** | A cluster of user entries (submissions) that share keywords / theme — same idea as your existing **cluster** in the backend. |
| **Hot topic** | The single topic that owns the main home / vote slot. **One at a time.** |
| **Emerging topics** | The next **2–5** topics that are rising but are **not** yet hot — shown as “watch this” or “join the conversation.” |
| **Score** | A number computed from your signals (below) so topics can be ranked and compared. |

---

## 2. Signals (what feeds the score)

Use whatever you already store per entry / cluster. Typical weights:

| Signal | Role |
|--------|------|
| **Entry count** (in window) | Breadth — how many people care. |
| **Engagement** (comments, reactions, saves — if you have them) | Depth — not just noise. |
| **Velocity** | Entries (or engagement) in the **last 24–48h** vs the previous window — catches **new** waves. |
| **Uniqueness** | Prefer topics with **≥2 distinct authors** (or a minimum unique submitter count) to reduce spam / one-person domination. |

**Suggested score (tune constants after you have data):**

```
score = (w1 * log(1 + entry_count_window))
      + (w2 * engagement_in_window)
      + (w3 * velocity_ratio)
```

- **Window for “hot”**: sliding **7 days** (or 48h for velocity only — your choice).
- **Velocity ratio**: e.g. `entries_last_48h / max(1, entries_prev_48h)` capped at some max so one day doesn’t explode.

---

## 3. Hot topic — selection & replacement (not daily)

### 3.1 First hot topic (cold start)

- If **no** hot topic exists: promote the **highest-scoring** topic that passes **minimum bar** (see §5).
- If nothing passes the bar: show a **fallback** (curated prompt, or “Share what’s on your mind”) — no fake hot topic.

### 3.2 Staying in place

The current hot topic **stays** until a **replacement condition** is met (below). There is **no** requirement to rotate at midnight.

### 3.3 Replacement — when a new topic takes over

Promote topic **B** over current hot **A** only if **all** are true:

1. **B passes** the minimum bar (§5).  
2. **B beats A by margin**: e.g. `score(B) >= score(A) * R` where **R = 1.25–1.5** (configurable), **or** `score(B) - score(A) >= D` (absolute gap).  
3. **Optional — velocity gate**: B must have **meaningful recent activity** (e.g. velocity_ratio ≥ 1.2 or ≥ N new entries in 48h) so a stale leader doesn’t block forever.

If multiple topics qualify, pick the **highest score** among them.

### 3.4 Safety cap (optional but recommended)

- If the hot topic is older than **T_max** days (e.g. **10–14**) **and** no replacement has met the margin rule, **force refresh**: pick the best candidate anyway, or fall back to curated — avoids a dead screen.

---

## 4. Emerging topics

### 4.1 Purpose

- Show **momentum** without stealing the main vote every day.  
- Let users **discover** what’s heating up before it becomes hot.

### 4.2 Definition

- After computing scores for **all** eligible topics in the window:  
  - **Hot** = rank **1** (subject to replacement rules above).  
  - **Emerging** = ranks **2 .. (2+K)** where **K = 3–5** (configurable).  
- **Exclude** the current hot topic from emerging (it’s already featured).  
- **Emerging** topics should still pass a **lighter** minimum bar (§5.2) so the list isn’t junk.

### 4.3 “Emerging” vs “almost hot”

Optional tag:

- **Fast risers**: high **velocity** even if total score is still below hot — surface 1–2 in emerging with a badge like **“Rising fast”** (velocity_ratio above threshold).

---

## 5. Minimum bars (quality floor)

### 5.1 Hot topic

- At least **N_min** entries in the cluster in the chosen window (e.g. **5–10** — tune with volume).  
- At least **U_min** unique submitters (e.g. **2–3**).  
- Pass **moderation** (blocklist / report queue if you have it).

### 5.2 Emerging topics

- Lower floor: e.g. **N_emerge = max(2, N_min - 3)**, same uniqueness rule or slightly relaxed.

---

## 6. Vote / prompt

- The **vote** stays attached to the **hot** topic until that topic is replaced.  
- Copy idea: **“What’s drawing attention right now”** + poll generated from cluster (aligned with your `question.service` / templates).  
- Emerging rows: **tap to open** that cluster / submissions — optional **secondary** vote later if you want.

---

## 7. Operational notes

- **Recompute** scores on a schedule (e.g. every **1–6 hours**) or on new entry — no need for real-time every second at MVP.  
- **Admin override**: ability to **pin** or **hide** a topic without breaking the whole system.  
- **Tune** `R`, `D`, windows, and weights once you see real traffic.

---

## 8. Summary one-liner

**Hot** = best topic above the bar until another topic **clearly** beats it by margin (+ optional velocity); **Emerging** = next few runners-up + optional “rising fast” — **not** tied to the calendar.

---

## 9. Implementation (this repo)

| Piece | Location |
|--------|----------|
| Scoring + replacement + emerging list | `Backend/src/services/trending.service.ts` |
| Persisted hot pointer (`hotQuestionId`, `hotPromotedAt`) | `Backend/src/store/store.ts` (`SpaceTrending`), `FileDataStore`, `PostgresDataStore` table `space_trending` |
| HTTP | `GET /spaces/:slug/trending` (see `Backend/src/server.ts`) |
| When it runs | After every `runClusteringForSpace` (try/finally); also on each GET `/trending` (recomputes + may update DB) |
| Tunable constants | `TRENDING_DEFAULTS` in `trending.service.ts` |

Frontend can call `spaceFetch(slug, "/trending")` or add a thin helper in `lib/spaceApi.ts`.
