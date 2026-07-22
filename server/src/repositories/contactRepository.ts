import { ContactSubmissionInput, ContactSubmissionRecord } from "../types/contact";

export interface ContactRepository {
  create(input: ContactSubmissionInput): Promise<ContactSubmissionRecord>;
  findAll(): Promise<ContactSubmissionRecord[]>;
}
