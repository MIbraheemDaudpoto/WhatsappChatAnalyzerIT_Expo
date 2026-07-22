import path from "node:path";
import fs from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { ContactRepository } from "./contactRepository";
import { ContactSubmissionInput, ContactSubmissionRecord } from "../types/contact";

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
    timezone: row.timezone ?? undefined,
    browser: row.browser ?? undefined,
    os: row.os ?? undefined,
    deviceType: row.device_type ?? undefined,
    screenResolution: row.screen_resolution ?? undefined,
    language: row.language ?? undefined,
    referrerUrl: row.referrer_url ?? undefined,
    currentPageUrl: row.current_page_url ?? undefined,
    userAgent: row.user_agent ?? undefined,
  },
  ipAddress: row.ip_address ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at
      ON contact_submissions(submitted_at_utc DESC);
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
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    );

    const row = await db.get<ContactSubmissionRow>(
      "SELECT * FROM contact_submissions WHERE id = ?",
      result.lastID,
    );

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
}
