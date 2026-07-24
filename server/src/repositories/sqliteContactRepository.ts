import path from "node:path";
import fs from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { ContactRepository } from "./contactRepository";
import {
  ContactAnalyticsStats,
  ContactSubmissionInput,
  ContactSubmissionQuery,
  ContactSubmissionQueryResult,
  ContactSubmissionRecord,
} from "../types/contact";

interface ContactSubmissionRow {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  send_copy: number;
  submitted_at_utc: string;
  timezone: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  screen_resolution: string | null;
  language: string | null;
  referrer_url: string | null;
  current_page_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  submitted_at_local: string | null;
  first_visit_at_utc: string | null;
  is_returning_visitor: number | null;
  session_id: string | null;
  time_on_page_seconds: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  preferred_color_scheme: string | null;
  viewport_size: string | null;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: ContactSubmissionRow): ContactSubmissionRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  subject: row.subject,
  message: row.message,
  sendCopy: Boolean(row.send_copy),
  submittedAtUtc: row.submitted_at_utc,
  metadata: {
    submittedAtLocal: row.submitted_at_local ?? undefined,
    timezone: row.timezone ?? undefined,
    browser: row.browser ?? undefined,
    os: row.os ?? undefined,
    deviceType: row.device_type ?? undefined,
    screenResolution: row.screen_resolution ?? undefined,
    language: row.language ?? undefined,
    referrerUrl: row.referrer_url ?? undefined,
    currentPageUrl: row.current_page_url ?? undefined,
    userAgent: row.user_agent ?? undefined,
    firstVisitAtUtc: row.first_visit_at_utc ?? undefined,
    isReturningVisitor: row.is_returning_visitor === null ? undefined : Boolean(row.is_returning_visitor),
    sessionId: row.session_id ?? undefined,
    timeOnPageSeconds: row.time_on_page_seconds ?? undefined,
    utmSource: row.utm_source ?? undefined,
    utmMedium: row.utm_medium ?? undefined,
    utmCampaign: row.utm_campaign ?? undefined,
    utmTerm: row.utm_term ?? undefined,
    utmContent: row.utm_content ?? undefined,
    preferredColorScheme: (row.preferred_color_scheme as "light" | "dark" | "no-preference" | null) ?? undefined,
    viewportSize: row.viewport_size ?? undefined,
  },
  ipAddress: row.ip_address ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export class SqliteContactRepository implements ContactRepository {
  private readonly dbPromise: Promise<Database>;

  constructor(dbPath: string) {
    this.dbPromise = this.initDatabase(dbPath);
  }

  private async initDatabase(dbPath: string) {
    const resolvedPath = path.resolve(dbPath);
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    const db = await open({
      filename: resolvedPath,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        send_copy INTEGER NOT NULL DEFAULT 0,
        submitted_at_utc TEXT NOT NULL,
        timezone TEXT,
        browser TEXT,
        os TEXT,
        device_type TEXT,
        screen_resolution TEXT,
        language TEXT,
        referrer_url TEXT,
        current_page_url TEXT,
        user_agent TEXT,
        ip_address TEXT,
        submitted_at_local TEXT,
        first_visit_at_utc TEXT,
        is_returning_visitor INTEGER,
        session_id TEXT,
        time_on_page_seconds REAL,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        utm_term TEXT,
        utm_content TEXT,
        preferred_color_scheme TEXT,
        viewport_size TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at
      ON contact_submissions(submitted_at_utc DESC);

      CREATE INDEX IF NOT EXISTS idx_contact_submissions_email
      ON contact_submissions(email);
    `);

    return db;
  }

  async create(input: ContactSubmissionInput): Promise<ContactSubmissionRecord> {
    const db = await this.dbPromise;

    const result = await db.run(
      `
      INSERT INTO contact_submissions (
        name,
        email,
        subject,
        message,
        send_copy,
        submitted_at_utc,
        timezone,
        browser,
        os,
        device_type,
        screen_resolution,
        language,
        referrer_url,
        current_page_url,
        user_agent,
        ip_address,
        submitted_at_local,
        first_visit_at_utc,
        is_returning_visitor,
        session_id,
        time_on_page_seconds,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        preferred_color_scheme,
        viewport_size,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      input.name,
      input.email,
      input.subject,
      input.message,
      input.sendCopy ? 1 : 0,
      input.submittedAtUtc,
      input.metadata.timezone ?? null,
      input.metadata.browser ?? null,
      input.metadata.os ?? null,
      input.metadata.deviceType ?? null,
      input.metadata.screenResolution ?? null,
      input.metadata.language ?? null,
      input.metadata.referrerUrl ?? null,
      input.metadata.currentPageUrl ?? null,
      input.metadata.userAgent ?? null,
      input.ipAddress ?? null,
      input.metadata.submittedAtLocal ?? null,
      input.metadata.firstVisitAtUtc ?? null,
      typeof input.metadata.isReturningVisitor === "boolean" ? (input.metadata.isReturningVisitor ? 1 : 0) : null,
      input.metadata.sessionId ?? null,
      input.metadata.timeOnPageSeconds ?? null,
      input.metadata.utmSource ?? null,
      input.metadata.utmMedium ?? null,
      input.metadata.utmCampaign ?? null,
      input.metadata.utmTerm ?? null,
      input.metadata.utmContent ?? null,
      input.metadata.preferredColorScheme ?? null,
      input.metadata.viewportSize ?? null,
    );

    const row = await db.get<ContactSubmissionRow>("SELECT * FROM contact_submissions WHERE id = ?", result.lastID);

    if (!row) {
      throw new Error("Failed to fetch created contact submission");
    }

    return mapRow(row);
  }

  async findAll(): Promise<ContactSubmissionRecord[]> {
    const db = await this.dbPromise;

    const rows = await db.all<ContactSubmissionRow[]>(
      "SELECT * FROM contact_submissions ORDER BY submitted_at_utc DESC, id DESC",
    );

    return rows.map(mapRow);
  }

  async findByQuery(query: ContactSubmissionQuery): Promise<ContactSubmissionQueryResult> {
    const db = await this.dbPromise;

    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, Math.min(100, query.pageSize));
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (query.search) {
      const escaped = `%${escapeLikePattern(query.search.toLowerCase())}%`;
      whereClauses.push("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(email) LIKE ? ESCAPE '\\')");
      params.push(escaped, escaped);
    }

    if (query.dateFrom) {
      whereClauses.push("date(submitted_at_utc) >= date(?)");
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereClauses.push("date(submitted_at_utc) <= date(?)");
      params.push(query.dateTo);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRow = await db.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM contact_submissions ${whereClause}`,
      ...params,
    );

    const rows = await db.all<ContactSubmissionRow[]>(
      `
      SELECT * FROM contact_submissions
      ${whereClause}
      ORDER BY submitted_at_utc DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      ...params,
      pageSize,
      offset,
    );

    const total = countRow?.total ?? 0;

    return {
      data: rows.map(mapRow),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getStats(): Promise<ContactAnalyticsStats> {
    const db = await this.dbPromise;

    const [totalRow, todayRow, weekRow, monthRow, avgRow] = await Promise.all([
      db.get<{ total: number }>("SELECT COUNT(*) as total FROM contact_submissions"),
      db.get<{ total: number }>(
        "SELECT COUNT(*) as total FROM contact_submissions WHERE date(submitted_at_utc) = date('now')",
      ),
      db.get<{ total: number }>(
        "SELECT COUNT(*) as total FROM contact_submissions WHERE datetime(submitted_at_utc) >= datetime('now', '-7 days')",
      ),
      db.get<{ total: number }>(
        "SELECT COUNT(*) as total FROM contact_submissions WHERE datetime(submitted_at_utc) >= datetime('now', 'start of month')",
      ),
      db.get<{ averageLength: number }>("SELECT AVG(LENGTH(message)) as averageLength FROM contact_submissions"),
    ]);

    const [topEmailDomains, browserDistribution, deviceDistribution] = await Promise.all([
      db.all<Array<{ domain: string; count: number }>>(
        `
        SELECT
          LOWER(SUBSTR(email, INSTR(email, '@') + 1)) as domain,
          COUNT(*) as count
        FROM contact_submissions
        WHERE INSTR(email, '@') > 0
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 5
        `,
      ),
      db.all<Array<{ label: string; count: number }>>(
        `
        SELECT COALESCE(browser, 'Unknown') as label, COUNT(*) as count
        FROM contact_submissions
        GROUP BY label
        ORDER BY count DESC
        LIMIT 8
        `,
      ),
      db.all<Array<{ label: string; count: number }>>(
        `
        SELECT COALESCE(device_type, 'Unknown') as label, COUNT(*) as count
        FROM contact_submissions
        GROUP BY label
        ORDER BY count DESC
        LIMIT 8
        `,
      ),
    ]);

    return {
      total: totalRow?.total ?? 0,
      today: todayRow?.total ?? 0,
      week: weekRow?.total ?? 0,
      month: monthRow?.total ?? 0,
      averageMessageLength: Number((avgRow?.averageLength ?? 0).toFixed(2)),
      topEmailDomains,
      browserDistribution,
      deviceDistribution,
    };
  }

  async deleteById(id: number): Promise<boolean> {
    const db = await this.dbPromise;
    const result = await db.run("DELETE FROM contact_submissions WHERE id = ?", id);
    return (result.changes ?? 0) > 0;
  }

  async findRecentDuplicate(email: string, message: string, sinceUtcIso: string): Promise<ContactSubmissionRecord | null> {
    const db = await this.dbPromise;
    const row = await db.get<ContactSubmissionRow>(
      `
      SELECT * FROM contact_submissions
      WHERE email = ? AND message = ? AND datetime(submitted_at_utc) >= datetime(?)
      ORDER BY submitted_at_utc DESC
      LIMIT 1
      `,
      email,
      message,
      sinceUtcIso,
    );

    return row ? mapRow(row) : null;
  }
}
