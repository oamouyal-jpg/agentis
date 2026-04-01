import * as crypto from "crypto";
import { Pool } from "pg";
import type { AgentisStore, Question, Submission } from "./store";
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
        invite_secret TEXT
      );
    `);

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
      INSERT INTO spaces (name, slug, description, visibility, invite_secret)
      SELECT 'Open', 'open', 'Public crowd signal — anyone can participate.', 'public', NULL
      WHERE NOT EXISTS (SELECT 1 FROM spaces WHERE slug = 'open');
    `);

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
  }

  private rowToSpace(r: any): Space {
    return {
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description ?? ""),
      visibility: r.visibility === "members_only" ? "members_only" : "public",
      inviteSecret: r.invite_secret ?? null,
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
      `SELECT id, name, slug, description, visibility, invite_secret FROM spaces ORDER BY id ASC;`
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

    try {
      const result = await this.pool.query(
        `INSERT INTO spaces (name, slug, description, visibility, invite_secret)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, slug, description, visibility, invite_secret;`,
        [
          input.name.trim(),
          slug,
          (input.description ?? "").trim(),
          input.visibility,
          inviteSecret,
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
      `SELECT id, name, slug, description, visibility, invite_secret FROM spaces WHERE slug=$1;`,
      [normalizeSlug(slug)]
    );
    if (!result.rows[0]) return undefined;
    return this.rowToSpace(result.rows[0]);
  }

  async getSpaceById(id: number): Promise<Space | undefined> {
    await this.ready;
    const result = await this.pool.query(
      `SELECT id, name, slug, description, visibility, invite_secret FROM spaces WHERE id=$1;`,
      [id]
    );
    if (!result.rows[0]) return undefined;
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
        (title, description, arguments_for, arguments_against, cluster_id, source_submission_ids, space_id)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, $7)
       RETURNING *;`,
      [
        input.title,
        input.description,
        JSON.stringify(input.argumentsFor ?? []),
        JSON.stringify(input.argumentsAgainst ?? []),
        input.clusterId,
        JSON.stringify(input.sourceSubmissionIds ?? []),
        spaceId,
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
        source_submission_ids=$9::jsonb
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
}
