export interface ContactSubmissionMetadata {
  timezone?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  screenResolution?: string;
  language?: string;
  referrerUrl?: string;
  currentPageUrl?: string;
  userAgent?: string;
  submittedAtLocal?: string;
}

export interface ContactSubmissionInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  sendCopy: boolean;
  submittedAtUtc: string;
  metadata: ContactSubmissionMetadata;
  ipAddress?: string;
}

export interface ContactSubmissionRecord extends ContactSubmissionInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}
