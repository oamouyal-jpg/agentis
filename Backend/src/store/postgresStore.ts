import * as crypto from "crypto";
import { Pool } from "pg";
import type {
  AgentisStore,
  Petition,
  PetitionSignature,
  Question,
  QuestionComment,
  QuestionUpdate,
  SpaceTrending,
  SubmitVoteResult,
  Submission,
  VoteDemographics,
  VoteEvent,
  VoteFlipEvent,
} from "./store";
import type { CreateSpaceInput, Space } from "./spaceTypes";

function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

export class PostgresDataStore implements AgentisStore {
  private pool: Pool;
  private ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.PGSSLMODE === "disable"
          ? false
          : { rejectUnauthorized: false },
    });
    this.ready = this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'members_only')),
        invite_secret TEXT,
        host_secret TEXT,
        branding JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);
    await this.pool.query(`
      ALTER TABLE spaces ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    await this.pool.query(`
      ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_secret TEXT;
    `);
    await this.pool.query(`
      UPDATE spaces SET host_secret = encode(gen_random_bytes(24), 'base64')
      WHERE host_secret IS NULL OR host_secret = '';
    `).catch(async () => {
      // gen_random_bytes may not be available; fallback to app-generated secrets on create.
    });

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        clustered BOOLEAN NOT NULL DEFAULT FALSE,
        cluster_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        arguments_for JSONB NOT NULL DEFAULT '[]'::jsonb,
        arguments_against JSONB NOT NULL DEFAULT '[]'::jsonb,
        votes_yes INTEGER NOT NULL DEFAULT 0,
        votes_no INTEGER NOT NULL DEFAULT 0,
        cluster_id TEXT NOT NULL,
        source_submission_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vote_events (
        id SERIAL PRIMARY KEY,
        space_id INTEGER REFERENCES spaces(id),
        question_id INTEGER NOT NULL,
        vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
        gender TEXT,
        age_range TEXT,
        country TEXT,
        town TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS petitions (
        id SERIAL PRIMARY KEY,
        space_id INTEGER REFERENCES spaces(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        goal_signatures INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS petition_signatures (
        id SERIAL PRIMARY KEY,
        space_id INTEGER REFERENCES spaces(id),
        petition_id INTEGER REFERENCES petitions(id),
        name TEXT,
        email TEXT,
        country TEXT,
        town TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS question_updates (
        id SERIAL PRIMARY KEY,
        space_id INTEGER REFERENCES spaces(id),
        question_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS question_updates_space_question_idx ON question_updates(space_id, question_id);`
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS question_comments (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id),
        question_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        author_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS question_comments_space_question_idx ON question_comments(space_id, question_id);`
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL REFERENCES question_comments(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (comment_id, device_id)
      );
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS comment_likes_comment_idx ON comment_likes(comment_id);`
    );

    await this.pool.query(`
      INSERT INTO spaces (name, slug, description, visibility, invite_secret)
      SELECT 'Open', 'open', 'Public crowd signal — anyone can participate.', 'public', NULL
      WHERE NOT EXISTS (SELECT 1 FROM spaces WHERE slug = 'open');
    `);
    await this.pool.query(`
      UPDATE spaces SET host_secret = $1
      WHERE slug='open' AND (host_secret IS NULL OR host_secret='');
    `, [crypto.randomBytes(24).toString("base64url")]);

    await this.pool.query(`
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id);
    `);
    await this.pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id);
    `);

    const openIdRes = await this.pool.query(
      `SELECT id FROM spaces WHERE slug = 'open' LIMIT 1;`
    );
    const openId = openIdRes.rows[0]?.id;
    if (openId != null) {
      await this.pool.query(
        `UPDATE submissions SET space_id = $1 WHERE space_id IS NULL;`,
        [openId]
      );
      await this.pool.query(
        `UPDATE questions SET space_id = $1 WHERE space_id IS NULL;`,
        [openId]
      );
    }

    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS submissions_space_idx ON submissions(space_id);`
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS questions_space_idx ON questions(space_id);`
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS submissions_clustered_idx ON submissions(clustered);`
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS questions_cluster_id_idx ON questions(cluster_id);`
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS vote_events_space_idx ON vote_events(space_id);`
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS vote_events_question_idx ON vote_events(question_id);`
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS device_votes (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id),
        question_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (space_id, question_id, device_id)
      );
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS device_votes_space_idx ON device_votes(space_id);`
    );
    await this.pool.query(`
      ALTER TABLE device_votes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    `);
    await this.pool.query(`
      ALTER TABLE device_votes ADD COLUMN IF NOT EXISTS vote_change_used BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vote_flip_events (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id),
        question_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        from_vote TEXT NOT NULL CHECK (from_vote IN ('yes', 'no')),
        to_vote TEXT NOT NULL CHECK (to_vote IN ('yes', 'no')),
        ms_since_first_vote BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS vote_flip_events_space_idx ON vote_flip_events(space_id);`
    );
    await this.pool.query(`
      UPDATE device_votes dv SET vote_change_used = TRUE
      WHERE EXISTS (
        SELECT 1 FROM vote_flip_events vfe
        WHERE vfe.space_id = dv.space_id AND vfe.question_id = dv.question_id AND vfe.device_id = dv.device_id
      );
    `).catch(() => {});

    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS petitions_space_idx ON petitions(space_id);`
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS petition_signatures_space_idx ON petition_signatures(space_id);`
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS petition_signatures_petition_idx ON petition_signatures(petition_id);`
    );

    await this.pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    await this.pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS yes_means TEXT;
    `);
    await this.pool.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS no_means TEXT;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS space_trending (
        space_id INTEGER PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
        hot_question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
        hot_promoted_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  private rowToSpace(r: any): Space {
    return {
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description ?? ""),
      visibility: r.visibility === "members_only" ? "members_only" : "public",
      inviteSecret: r.invite_secret ?? null,
      hostSecret: String(r.host_secret || ""),
      branding:
        r.branding && typeof r.branding === "object" ? (r.branding as any) : undefined,
    };
  }

  private async rowsToSubmissions(rows: any[]): Promise<Submission[]> {
    return rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      text: String(r.text),
      clustered: Boolean(r.clustered),
      clusterId: r.cluster_id ?? undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  private async rowsToQuestions(rows: any[]): Promise<Question[]> {
    return rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      title: String(r.title),
      description: String(r.description),
      argumentsFor: parseJsonArray<string>(r.arguments_for, []),
      argumentsAgainst: parseJsonArray<string>(r.arguments_against, []),
      votesYes: Number(r.votes_yes ?? 0),
      votesNo: Number(r.votes_no ?? 0),
      clusterId: String(r.cluster_id),
      sourceSubmissionIds: parseJsonArray<number>(r.source_submission_ids, []).map(
        (n) => Number(n)
      ),
      imageUrl:
        r.image_url != null && String(r.image_url).trim() !== ""
          ? String(r.image_url).trim()
          : undefined,
      yesMeans:
        r.yes_means != null && String(r.yes_means).trim() !== ""
          ? String(r.yes_means).trim()
          : undefined,
      noMeans:
        r.no_means != null && String(r.no_means).trim() !== ""
          ? String(r.no_means).trim()
          : undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async ensureDefaultSpace(): Promise<void> {
    await this.ready;
    await this.pool.query(`
      INSERT INTO spaces (name, slug, description, visibility, invite_secret)
      SELECT 'Open', 'open', 'Public crowd signal — anyone can participate.', 'public', NULL
      WHERE NOT EXISTS (SELECT 1 FROM spaces WHERE slug = 'open');
    `);
  }

  async listSpaces(): Promise<Space[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT id, name, slug, description, visibility, invite_secret, host_secret, branding FROM spaces ORDER BY id ASC;`
    );
    return result.rows.map((r) => this.rowToSpace(r));
  }

  async createSpace(input: CreateSpaceInput): Promise<Space> {
    await this.ready;
    const slug = normalizeSlug(input.slug);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error("Invalid slug (use lowercase letters, numbers, hyphens)");
    }

    const inviteSecret =
      input.visibility === "members_only"
        ? crypto.randomBytes(24).toString("base64url")
        : null;
    const hostSecret = crypto.randomBytes(24).toString("base64url");

    try {
      const result = await this.pool.query(
        `INSERT INTO spaces (name, slug, description, visibility, invite_secret, host_secret)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, slug, description, visibility, invite_secret, host_secret, branding;`,
        [
          input.name.trim(),
          slug,
          (input.description ?? "").trim(),
          input.visibility,
          inviteSecret,
          hostSecret,
        ]
      );
      return this.rowToSpace(result.rows[0]);
    } catch (e: any) {
      if (e?.code === "23505") {
        throw new Error("Slug already exists");
      }
      throw e;
    }
  }

  async getSpaceBySlug(slug: string): Promise<Space | undefined> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT id, name, slug, description, visibility, invite_secret, host_secret, branding FROM spaces WHERE slug=$1;`,
      [normalizeSlug(slug)]
    );
    if (!result.rows[0]) return undefined;
    return this.rowToSpace(result.rows[0]);
  }

  async getSpaceById(id: number): Promise<Space | undefined> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT id, name, slug, description, visibility, invite_secret, host_secret, branding FROM spaces WHERE id=$1;`,
      [id]
    );
    if (!result.rows[0]) return undefined;
    return this.rowToSpace(result.rows[0]);
  }

  async updateSpace(
    spaceId: number,
    updates: Partial<Omit<Space, "id" | "slug" | "inviteSecret" | "hostSecret">> & {
      branding?: Space["branding"];
    }
  ): Promise<Space | undefined> {
    await this.ready;
    const existing = await this.getSpaceById(spaceId);
    if (!existing) return undefined;

    const merged: Space = {
      ...existing,
      ...updates,
      id: existing.id,
      slug: existing.slug,
      inviteSecret: existing.inviteSecret,
      hostSecret: existing.hostSecret,
      branding: updates.branding ?? existing.branding,
    };

    const result = await this.pool.query(
      `UPDATE spaces SET name=$2, description=$3, visibility=$4, branding=$5::jsonb
       WHERE id=$1
       RETURNING id, name, slug, description, visibility, invite_secret, host_secret, branding;`,
      [
        spaceId,
        merged.name,
        merged.description ?? "",
        merged.visibility,
        JSON.stringify(merged.branding ?? {}),
      ]
    );
    return this.rowToSpace(result.rows[0]);
  }

  async addSubmission(spaceId: number, text: string): Promise<Submission> {
    await this.ready;
    const result = await this.pool.query(
      `INSERT INTO submissions (text, space_id) VALUES ($1, $2) RETURNING *;`,
      [text, spaceId]
    );
    return (await this.rowsToSubmissions(result.rows))[0];
  }

  async getSubmissions(spaceId: number): Promise<Submission[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM submissions WHERE space_id=$1 ORDER BY id ASC;`,
      [spaceId]
    );
    return this.rowsToSubmissions(result.rows);
  }

  async getSubmissionById(
    spaceId: number,
    id: number
  ): Promise<Submission | undefined> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM submissions WHERE id=$1 AND space_id=$2;`,
      [id, spaceId]
    );
    const items = await this.rowsToSubmissions(result.rows);
    return items[0];
  }

  async markSubmissionClustered(
    spaceId: number,
    id: number,
    clusterId: string
  ): Promise<void> {
    await this.ready;
    await this.pool.query(
      `UPDATE submissions SET clustered=TRUE, cluster_id=$3 WHERE id=$1 AND space_id=$2;`,
      [id, spaceId, clusterId]
    );
  }

  async addQuestion(
    spaceId: number,
    input: Omit<Question, "id" | "votesYes" | "votesNo" | "spaceId">
  ): Promise<Question> {
    await this.ready;
    const result = await this.pool.query(
      `INSERT INTO questions
        (title, description, arguments_for, arguments_against, cluster_id, source_submission_ids, space_id, image_url, yes_means, no_means)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, $7, $8, $9, $10)
       RETURNING *;`,
      [
        input.title,
        input.description,
        JSON.stringify(input.argumentsFor ?? []),
        JSON.stringify(input.argumentsAgainst ?? []),
        input.clusterId,
        JSON.stringify(input.sourceSubmissionIds ?? []),
        spaceId,
        input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null,
        input.yesMeans && input.yesMeans.trim() ? input.yesMeans.trim() : null,
        input.noMeans && input.noMeans.trim() ? input.noMeans.trim() : null,
      ]
    );
    return (await this.rowsToQuestions(result.rows))[0];
  }

  async getQuestions(spaceId: number): Promise<Question[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM questions WHERE space_id=$1 ORDER BY id ASC;`,
      [spaceId]
    );
    return this.rowsToQuestions(result.rows);
  }

  async getQuestionById(spaceId: number, id: number): Promise<Question | undefined> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM questions WHERE id=$1 AND space_id=$2;`,
      [id, spaceId]
    );
    const items = await this.rowsToQuestions(result.rows);
    return items[0];
  }

  async getQuestionByClusterId(
    spaceId: number,
    clusterId: string
  ): Promise<Question | undefined> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM questions WHERE space_id=$1 AND cluster_id=$2 ORDER BY id ASC LIMIT 1;`,
      [spaceId, clusterId]
    );
    const items = await this.rowsToQuestions(result.rows);
    return items[0];
  }

  async updateQuestion(
    spaceId: number,
    questionId: number,
    updates: Partial<Omit<Question, "id" | "spaceId">>
  ): Promise<Question | undefined> {
    await this.ready;
    const existing = await this.getQuestionById(spaceId, questionId);
    if (!existing) return undefined;

    const merged: Question = {
      ...existing,
      ...updates,
      id: existing.id,
      spaceId: existing.spaceId,
    };

    const result = await this.pool.query(
      `UPDATE questions SET
        title=$2,
        description=$3,
        arguments_for=$4::jsonb,
        arguments_against=$5::jsonb,
        votes_yes=$6,
        votes_no=$7,
        cluster_id=$8,
        source_submission_ids=$9::jsonb,
        image_url=$11,
        yes_means=$12,
        no_means=$13
      WHERE id=$1 AND space_id=$10
      RETURNING *;`,
      [
        questionId,
        merged.title,
        merged.description,
        JSON.stringify(merged.argumentsFor ?? []),
        JSON.stringify(merged.argumentsAgainst ?? []),
        merged.votesYes ?? 0,
        merged.votesNo ?? 0,
        merged.clusterId,
        JSON.stringify(merged.sourceSubmissionIds ?? []),
        spaceId,
        merged.imageUrl && merged.imageUrl.trim() ? merged.imageUrl.trim() : null,
        merged.yesMeans != null && String(merged.yesMeans).trim() !== ""
          ? String(merged.yesMeans).trim()
          : null,
        merged.noMeans != null && String(merged.noMeans).trim() !== ""
          ? String(merged.noMeans).trim()
          : null,
      ]
    );

    const items = await this.rowsToQuestions(result.rows);
    return items[0];
  }

  async deleteQuestion(spaceId: number, questionId: number): Promise<boolean> {
    await this.ready;
    const result = await this.pool.query(
      `DELETE FROM questions WHERE id=$1 AND space_id=$2;`,
      [questionId, spaceId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async addSubmissionIdsToQuestion(
    spaceId: number,
    questionId: number,
    submissionIds: number[]
  ): Promise<Question | undefined> {
    const question = await this.getQuestionById(spaceId, questionId);
    if (!question) return undefined;
    const merged = Array.from(
      new Set([...(question.sourceSubmissionIds ?? []), ...(submissionIds ?? [])])
    );
    return this.updateQuestion(spaceId, questionId, { sourceSubmissionIds: merged });
  }

  async addSubmissionIdsToQuestionByClusterId(
    spaceId: number,
    clusterId: string,
    submissionIds: number[]
  ): Promise<Question | undefined> {
    const question = await this.getQuestionByClusterId(spaceId, clusterId);
    if (!question) return undefined;
    return this.addSubmissionIdsToQuestion(spaceId, question.id, submissionIds);
  }

  async clearQuestions(spaceId: number): Promise<void> {
    await this.ready;
    await this.pool.query(`DELETE FROM questions WHERE space_id=$1;`, [spaceId]);
  }

  async voteOnQuestion(
    spaceId: number,
    questionId: number,
    vote: "yes" | "no"
  ): Promise<Question | undefined> {
    await this.ready;

    const field = vote === "yes" ? "votes_yes" : "votes_no";
    const result = await this.pool.query(
      `UPDATE questions SET ${field} = ${field} + 1 WHERE id=$1 AND space_id=$2 RETURNING *;`,
      [questionId, spaceId]
    );

    const items = await this.rowsToQuestions(result.rows);
    return items[0];
  }

  async submitQuestionVote(
    spaceId: number,
    questionId: number,
    deviceId: string,
    vote: "yes" | "no",
    demographics?: VoteDemographics
  ): Promise<SubmitVoteResult> {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const exists = await client.query(
        `SELECT 1 FROM questions WHERE id=$1 AND space_id=$2 LIMIT 1;`,
        [questionId, spaceId]
      );
      if (!exists.rows[0]) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "not_found" };
      }

      const existing = await client.query(
        `SELECT vote, created_at, vote_change_used FROM device_votes
         WHERE space_id=$1 AND question_id=$2 AND device_id=$3
         FOR UPDATE;`,
        [spaceId, questionId, deviceId]
      );

      const demo: VoteDemographics = demographics ?? {};

      if (!existing.rows[0]) {
        await client.query(
          `INSERT INTO device_votes (space_id, question_id, device_id, vote)
           VALUES ($1, $2, $3, $4);`,
          [spaceId, questionId, deviceId, vote]
        );
        const field = vote === "yes" ? "votes_yes" : "votes_no";
        const up = await client.query(
          `UPDATE questions SET ${field} = ${field} + 1 WHERE id=$1 AND space_id=$2 RETURNING *;`,
          [questionId, spaceId]
        );
        if (!up.rows[0]) {
          await client.query("ROLLBACK");
          return { ok: false, reason: "not_found" };
        }
        await client.query(
          `INSERT INTO vote_events (space_id, question_id, vote, gender, age_range, country, town)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [
            spaceId,
            questionId,
            vote,
            demo.gender ?? null,
            demo.ageRange ?? null,
            demo.country ?? null,
            demo.town ?? null,
          ]
        );
        await client.query("COMMIT");
        const items = await this.rowsToQuestions([up.rows[0]]);
        return {
          ok: true,
          question: items[0],
          status: "created",
          canChangeVote: true,
        };
      }

      const prevVote = existing.rows[0].vote === "no" ? "no" : "yes";
      const changeUsed = !!existing.rows[0].vote_change_used;
      const firstAt = existing.rows[0].created_at
        ? Date.parse(existing.rows[0].created_at)
        : Date.now();

      if (prevVote === vote) {
        await client.query("ROLLBACK");
        const q = await this.getQuestionById(spaceId, questionId);
        return q
          ? {
              ok: true,
              question: q,
              status: "unchanged",
              canChangeVote: !changeUsed,
            }
          : { ok: false, reason: "not_found" };
      }

      if (changeUsed) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "vote_change_limit" };
      }

      await client.query(
        `UPDATE device_votes SET vote=$1, updated_at=NOW(), vote_change_used=TRUE WHERE space_id=$2 AND question_id=$3 AND device_id=$4;`,
        [vote, spaceId, questionId, deviceId]
      );

      if (prevVote === "yes") {
        await client.query(
          `UPDATE questions SET votes_yes = votes_yes - 1, votes_no = votes_no + 1 WHERE id=$1 AND space_id=$2 RETURNING *;`,
          [questionId, spaceId]
        );
      } else {
        await client.query(
          `UPDATE questions SET votes_yes = votes_yes + 1, votes_no = votes_no - 1 WHERE id=$1 AND space_id=$2 RETURNING *;`,
          [questionId, spaceId]
        );
      }

      const up = await client.query(
        `SELECT * FROM questions WHERE id=$1 AND space_id=$2;`,
        [questionId, spaceId]
      );

      await client.query(
        `INSERT INTO vote_events (space_id, question_id, vote, gender, age_range, country, town)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          spaceId,
          questionId,
          vote,
          demo.gender ?? null,
          demo.ageRange ?? null,
          demo.country ?? null,
          demo.town ?? null,
        ]
      );

      const msSince = Math.max(0, Date.now() - firstAt);
      await client.query(
        `INSERT INTO vote_flip_events (space_id, question_id, device_id, from_vote, to_vote, ms_since_first_vote)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [spaceId, questionId, deviceId, prevVote, vote, msSince]
      );

      await client.query("COMMIT");
      const items = await this.rowsToQuestions([up.rows[0]]);
      return {
        ok: true,
        question: items[0],
        status: "changed",
        previousVote: prevVote,
        canChangeVote: false,
      };
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async listVoteFlipEvents(spaceId: number): Promise<VoteFlipEvent[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM vote_flip_events WHERE space_id=$1 ORDER BY id ASC;`,
      [spaceId]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      deviceId: String(r.device_id),
      fromVote: r.from_vote === "no" ? "no" : "yes",
      toVote: r.to_vote === "no" ? "no" : "yes",
      msSinceFirstVote: Number(r.ms_since_first_vote ?? 0),
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async addVoteEvent(
    spaceId: number,
    input: Omit<VoteEvent, "id" | "spaceId">
  ): Promise<VoteEvent> {
    await this.ready;
    const demo = input.demographics ?? {};
    const result = await this.pool.query(
      `INSERT INTO vote_events (space_id, question_id, vote, gender, age_range, country, town)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [
        spaceId,
        input.questionId,
        input.vote,
        demo.gender ?? null,
        demo.ageRange ?? null,
        demo.country ?? null,
        demo.town ?? null,
      ]
    );
    const r = result.rows[0];
    return {
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      vote: r.vote === "no" ? "no" : "yes",
      demographics: {
        gender: r.gender ?? undefined,
        ageRange: r.age_range ?? undefined,
        country: r.country ?? undefined,
        town: r.town ?? undefined,
      },
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    };
  }

  async getVoteEvents(spaceId: number): Promise<VoteEvent[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM vote_events WHERE space_id=$1 ORDER BY id ASC;`,
      [spaceId]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      vote: r.vote === "no" ? "no" : "yes",
      demographics: {
        gender: r.gender ?? undefined,
        ageRange: r.age_range ?? undefined,
        country: r.country ?? undefined,
        town: r.town ?? undefined,
      },
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async listPetitions(spaceId: number): Promise<Petition[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM petitions WHERE space_id=$1 ORDER BY id DESC;`,
      [spaceId]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      title: String(r.title),
      description: String(r.description),
      goalSignatures:
        typeof r.goal_signatures === "number" ? Number(r.goal_signatures) : undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async getPetitionById(
    spaceId: number,
    petitionId: number
  ): Promise<Petition | undefined> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM petitions WHERE space_id=$1 AND id=$2 LIMIT 1;`,
      [spaceId, petitionId]
    );
    const r = result.rows[0];
    if (!r) return undefined;
    return {
      id: Number(r.id),
      spaceId: Number(r.space_id),
      title: String(r.title),
      description: String(r.description),
      goalSignatures:
        typeof r.goal_signatures === "number" ? Number(r.goal_signatures) : undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    };
  }

  async createPetition(
    spaceId: number,
    input: Omit<Petition, "id" | "spaceId" | "createdAt">
  ): Promise<Petition> {
    await this.ready;
    const result = await this.pool.query(
      `INSERT INTO petitions (space_id, title, description, goal_signatures)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [
        spaceId,
        input.title.trim(),
        input.description.trim(),
        typeof input.goalSignatures === "number" ? input.goalSignatures : null,
      ]
    );
    const r = result.rows[0];
    return {
      id: Number(r.id),
      spaceId: Number(r.space_id),
      title: String(r.title),
      description: String(r.description),
      goalSignatures:
        typeof r.goal_signatures === "number" ? Number(r.goal_signatures) : undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    };
  }

  async signPetition(
    spaceId: number,
    petitionId: number,
    input: Omit<PetitionSignature, "id" | "spaceId" | "petitionId" | "createdAt">
  ): Promise<PetitionSignature> {
    await this.ready;
    const result = await this.pool.query(
      `INSERT INTO petition_signatures (space_id, petition_id, name, email, country, town)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
      [
        spaceId,
        petitionId,
        input.name?.trim() || null,
        input.email?.trim() || null,
        input.country?.trim() || null,
        input.town?.trim() || null,
      ]
    );
    const r = result.rows[0];
    return {
      id: Number(r.id),
      spaceId: Number(r.space_id),
      petitionId: Number(r.petition_id),
      name: r.name ?? undefined,
      email: r.email ?? undefined,
      country: r.country ?? undefined,
      town: r.town ?? undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    };
  }

  async getPetitionSignatures(
    spaceId: number,
    petitionId: number
  ): Promise<PetitionSignature[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM petition_signatures WHERE space_id=$1 AND petition_id=$2 ORDER BY id ASC;`,
      [spaceId, petitionId]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      petitionId: Number(r.petition_id),
      name: r.name ?? undefined,
      email: r.email ?? undefined,
      country: r.country ?? undefined,
      town: r.town ?? undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async listQuestionUpdates(spaceId: number, questionId: number): Promise<QuestionUpdate[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM question_updates WHERE space_id=$1 AND question_id=$2 ORDER BY id DESC;`,
      [spaceId, questionId]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      title: String(r.title),
      body: String(r.body),
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async addQuestionUpdate(
    spaceId: number,
    questionId: number,
    input: Omit<QuestionUpdate, "id" | "spaceId" | "questionId" | "createdAt">
  ): Promise<QuestionUpdate> {
    await this.ready;
    const result = await this.pool.query(
      `INSERT INTO question_updates (space_id, question_id, title, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [spaceId, questionId, input.title.trim(), input.body.trim()]
    );
    const r = result.rows[0];
    return {
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      title: String(r.title),
      body: String(r.body),
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    };
  }

  async listQuestionComments(
    spaceId: number,
    questionId: number
  ): Promise<QuestionComment[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM question_comments WHERE space_id=$1 AND question_id=$2 ORDER BY id ASC;`,
      [spaceId, questionId]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      body: String(r.body),
      authorName: r.author_name != null ? String(r.author_name) : undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async listQuestionCommentsForSpace(spaceId: number): Promise<QuestionComment[]> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT * FROM question_comments WHERE space_id=$1 ORDER BY question_id ASC, id ASC;`,
      [spaceId]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      body: String(r.body),
      authorName: r.author_name != null ? String(r.author_name) : undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    }));
  }

  async addQuestionComment(
    spaceId: number,
    questionId: number,
    input: Omit<QuestionComment, "id" | "spaceId" | "questionId" | "createdAt">
  ): Promise<QuestionComment> {
    await this.ready;
    const result = await this.pool.query(
      `INSERT INTO question_comments (space_id, question_id, body, author_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [
        spaceId,
        questionId,
        input.body.trim(),
        input.authorName?.trim() ? input.authorName.trim() : null,
      ]
    );
    const r = result.rows[0];
    return {
      id: Number(r.id),
      spaceId: Number(r.space_id),
      questionId: Number(r.question_id),
      body: String(r.body),
      authorName: r.author_name != null ? String(r.author_name) : undefined,
      createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    };
  }

  async getCommentLikeInfo(
    spaceId: number,
    commentIds: number[],
    deviceId: string | null
  ): Promise<Record<number, { count: number; liked: boolean }>> {
    await this.ready;
    const out: Record<number, { count: number; liked: boolean }> = {};
    if (commentIds.length === 0) return out;

    const valid = await this.pool.query(
      `SELECT id FROM question_comments WHERE space_id=$1 AND id = ANY($2::int[])`,
      [spaceId, commentIds]
    );
    const validSet = new Set(valid.rows.map((r) => Number(r.id)));

    const counts = await this.pool.query(
      `SELECT comment_id, COUNT(*)::int AS c FROM comment_likes WHERE comment_id = ANY($1::int[]) GROUP BY comment_id;`,
      [commentIds]
    );
    const countBy = new Map<number, number>(
      counts.rows.map((r) => [Number(r.comment_id), Number(r.c)])
    );

    let likedRows: Set<number> = new Set();
    if (deviceId) {
      const liked = await this.pool.query(
        `SELECT comment_id FROM comment_likes WHERE device_id=$1 AND comment_id = ANY($2::int[])`,
        [deviceId, commentIds]
      );
      likedRows = new Set(liked.rows.map((r) => Number(r.comment_id)));
    }

    for (const id of commentIds) {
      if (!validSet.has(id)) continue;
      out[id] = {
        count: countBy.get(id) ?? 0,
        liked: likedRows.has(id),
      };
    }
    return out;
  }

  async toggleCommentLike(
    spaceId: number,
    questionId: number,
    commentId: number,
    deviceId: string
  ): Promise<
    | { ok: true; count: number; liked: boolean }
    | { ok: false; reason: "not_found" }
  > {
    await this.ready;
    const check = await this.pool.query(
      `SELECT id FROM question_comments WHERE id=$1 AND space_id=$2 AND question_id=$3 LIMIT 1;`,
      [commentId, spaceId, questionId]
    );
    if (!check.rows[0]) {
      return { ok: false, reason: "not_found" };
    }

    const del = await this.pool.query(
      `DELETE FROM comment_likes WHERE comment_id=$1 AND device_id=$2 RETURNING id;`,
      [commentId, deviceId]
    );

    let liked: boolean;
    if ((del.rowCount ?? 0) > 0) {
      liked = false;
    } else {
      await this.pool.query(
        `INSERT INTO comment_likes (comment_id, device_id) VALUES ($1, $2);`,
        [commentId, deviceId]
      );
      liked = true;
    }

    const cnt = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM comment_likes WHERE comment_id=$1;`,
      [commentId]
    );
    const count = Number(cnt.rows[0]?.c ?? 0);

    return { ok: true, count, liked };
  }

  async getSpaceTrending(spaceId: number): Promise<SpaceTrending | null> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT hot_question_id, hot_promoted_at FROM space_trending WHERE space_id=$1;`,
      [spaceId]
    );
    const r = result.rows[0];
    if (!r) return null;
    return {
      hotQuestionId:
        r.hot_question_id != null ? Number(r.hot_question_id) : null,
      hotPromotedAt: r.hot_promoted_at
        ? Date.parse(String(r.hot_promoted_at))
        : null,
    };
  }

  async setSpaceTrending(spaceId: number, state: SpaceTrending): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO space_trending (space_id, hot_question_id, hot_promoted_at, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (space_id) DO UPDATE SET
         hot_question_id = EXCLUDED.hot_question_id,
         hot_promoted_at = EXCLUDED.hot_promoted_at,
         updated_at = NOW();`,
      [
        spaceId,
        state.hotQuestionId,
        state.hotPromotedAt != null
          ? new Date(state.hotPromotedAt).toISOString()
          : null,
      ]
    );
  }
}
