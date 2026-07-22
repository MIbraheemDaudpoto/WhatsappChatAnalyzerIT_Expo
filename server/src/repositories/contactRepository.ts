import {
  ContactAnalyticsStats,
  ContactSubmissionInput,
  ContactSubmissionQuery,
  ContactSubmissionQueryResult,
  ContactSubmissionRecord,
} from "../types/contact";

export interface ContactRepository {
  create(input: ContactSubmissionInput): Promise<ContactSubmissionRecord>;
  findAll(): Promise<ContactSubmissionRecord[]>;
  findByQuery(query: ContactSubmissionQuery): Promise<ContactSubmissionQueryResult>;
  getStats(): Promise<ContactAnalyticsStats>;
  deleteById(id: number): Promise<boolean>;
  findRecentDuplicate(email: string, message: string, sinceUtcIso: string): Promise<ContactSubmissionRecord | null>;
}
