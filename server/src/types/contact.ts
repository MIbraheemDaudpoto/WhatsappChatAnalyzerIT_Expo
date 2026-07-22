export interface ContactSubmissionMetadata {
  submittedAtLocal?: string;
  timezone?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  screenResolution?: string;
  language?: string;
  referrerUrl?: string;
  currentPageUrl?: string;
  userAgent?: string;
  firstVisitAtUtc?: string;
  isReturningVisitor?: boolean;
  sessionId?: string;
  timeOnPageSeconds?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  preferredColorScheme?: "light" | "dark" | "no-preference";
  viewportSize?: string;
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

export interface ContactSubmissionQuery {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ContactSubmissionQueryResult {
  data: ContactSubmissionRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ContactAnalyticsStats {
  total: number;
  today: number;
  week: number;
  month: number;
  averageMessageLength: number;
  topEmailDomains: Array<{ domain: string; count: number }>;
  browserDistribution: Array<{ label: string; count: number }>;
  deviceDistribution: Array<{ label: string; count: number }>;
}
