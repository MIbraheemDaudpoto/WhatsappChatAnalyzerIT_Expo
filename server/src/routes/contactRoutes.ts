import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import xss from "xss";
import validator from "validator";
import { ContactRepository } from "../repositories/contactRepository";
import { TurnstileService } from "../services/turnstileService";
import { EmailService } from "../services/emailService";
import { requireAdminApiKey } from "../middleware/adminAuth";
import { HttpError } from "../utils/httpError";
import { logger } from "../utils/logger";

const DUPLICATE_WINDOW_SECONDS = 30;
const shouldBlockDisposableEmails = process.env.BLOCK_DISPOSABLE_EMAILS === "true";

const disposableEmailDomains = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "trashmail.com",
  "yopmail.com",
]);

const FIELD_LIMITS = {
  name: 120,
  email: 254,
  subject: 200,
  message: 2000,
  timezone: 100,
  browser: 120,
  os: 120,
  deviceType: 40,
  screenResolution: 40,
  language: 40,
  referrerUrl: 1024,
  currentPageUrl: 1024,
  userAgent: 1024,
  submittedAtLocal: 120,
  firstVisitAtUtc: 120,
  sessionId: 128,
  utm: 200,
  preferredColorScheme: 20,
  viewportSize: 40,
} as const;

const sanitizeText = (value: string, maxLength: number) =>
  xss(value, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script"],
  })
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);

const sanitizeUrl = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizeText(value, FIELD_LIMITS.currentPageUrl);

  if (!sanitized) {
    return undefined;
  }

  try {
    const parsed = new URL(sanitized);
    return parsed.toString();
  } catch {
    return undefined;
  }
};

const metadataSchema = z
  .object({
    submittedAtLocal: z.string().max(FIELD_LIMITS.submittedAtLocal).optional(),
    timezone: z.string().max(FIELD_LIMITS.timezone).optional(),
    browser: z.string().max(FIELD_LIMITS.browser).optional(),
    os: z.string().max(FIELD_LIMITS.os).optional(),
    deviceType: z.string().max(FIELD_LIMITS.deviceType).optional(),
    screenResolution: z.string().max(FIELD_LIMITS.screenResolution).optional(),
    language: z.string().max(FIELD_LIMITS.language).optional(),
    referrerUrl: z.string().max(FIELD_LIMITS.referrerUrl).optional(),
    currentPageUrl: z.string().max(FIELD_LIMITS.currentPageUrl).optional(),
    userAgent: z.string().max(FIELD_LIMITS.userAgent).optional(),
    firstVisitAtUtc: z.string().max(FIELD_LIMITS.firstVisitAtUtc).optional(),
    isReturningVisitor: z.boolean().optional(),
    sessionId: z.string().max(FIELD_LIMITS.sessionId).optional(),
    timeOnPageSeconds: z.number().min(0).max(60 * 60 * 24).optional(),
    utmSource: z.string().max(FIELD_LIMITS.utm).optional(),
    utmMedium: z.string().max(FIELD_LIMITS.utm).optional(),
    utmCampaign: z.string().max(FIELD_LIMITS.utm).optional(),
    utmTerm: z.string().max(FIELD_LIMITS.utm).optional(),
    utmContent: z.string().max(FIELD_LIMITS.utm).optional(),
    preferredColorScheme: z.enum(["light", "dark", "no-preference"]).optional(),
    viewportSize: z.string().max(FIELD_LIMITS.viewportSize).optional(),
  })
  .optional()
  .default({});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(FIELD_LIMITS.name),
  email: z.string().trim().email().max(FIELD_LIMITS.email),
  subject: z.string().trim().max(FIELD_LIMITS.subject).optional().default(""),
  message: z.string().trim().min(1).max(FIELD_LIMITS.message),
  sendCopy: z.boolean().optional().default(false),
  turnstileToken: z.string().trim().min(1),
  metadata: metadataSchema,
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().max(255).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

const isValidDateInput = (value?: string) => !value || validator.isDate(value, { format: "YYYY-MM-DD", strictMode: true });

const buildIp = (forwardedHeader: string | undefined, fallback?: string) => {
  if (forwardedHeader) {
    const firstValue = forwardedHeader.split(",")[0]?.trim();
    if (firstValue) {
      return firstValue;
    }
  }

  return fallback;
};

const getEmailDomain = (email: string) => email.split("@")[1]?.toLowerCase();

export const createContactRouter = (
  repository: ContactRepository,
  turnstileService: TurnstileService,
  emailService: EmailService,
) => {
  const router = Router();

  const postRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, _res, next) => {
      next(new HttpError(429, "Too many contact attempts. Please try again later.", "RATE_LIMIT_EXCEEDED", {
        retryAfterMs: 15 * 60 * 1000,
        requestId: req.requestId,
      }));
    },
  });

  router.post("/contact", postRateLimit, async (req, res) => {
    const parsed = contactSchema.parse(req.body);

    const ipAddress = buildIp(req.header("x-forwarded-for"), req.ip);
    const normalizedEmail = validator.normalizeEmail(parsed.email.toLowerCase()) || parsed.email.toLowerCase();
    const sanitizedName = sanitizeText(parsed.name, FIELD_LIMITS.name);
    const sanitizedEmail = sanitizeText(normalizedEmail, FIELD_LIMITS.email);
    const sanitizedSubject = sanitizeText(parsed.subject, FIELD_LIMITS.subject);
    const sanitizedMessage = sanitizeText(parsed.message, FIELD_LIMITS.message);

    if (shouldBlockDisposableEmails) {
      const domain = getEmailDomain(sanitizedEmail);
      if (domain && disposableEmailDomains.has(domain)) {
        throw new HttpError(400, "Disposable email domains are not allowed.", "DISPOSABLE_EMAIL_BLOCKED");
      }
    }

    const isTurnstileValid = await turnstileService.verifyToken(parsed.turnstileToken, ipAddress);

    if (!isTurnstileValid) {
      throw new HttpError(400, "Turnstile verification failed. Please try again.", "TURNSTILE_FAILED");
    }

    const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_SECONDS * 1000).toISOString();
    const duplicate = await repository.findRecentDuplicate(sanitizedEmail, sanitizedMessage, duplicateSince);

    if (duplicate) {
      throw new HttpError(
        429,
        "Duplicate submission detected. Please wait before submitting again.",
        "DUPLICATE_SUBMISSION",
      );
    }

    const metadata = parsed.metadata;
    const submission = await repository.create({
      name: sanitizedName,
      email: sanitizedEmail,
      subject: sanitizedSubject,
      message: sanitizedMessage,
      sendCopy: parsed.sendCopy,
      submittedAtUtc: new Date().toISOString(),
      ipAddress: ipAddress ? sanitizeText(ipAddress, 80) : undefined,
      metadata: {
        submittedAtLocal: metadata.submittedAtLocal
          ? sanitizeText(metadata.submittedAtLocal, FIELD_LIMITS.submittedAtLocal)
          : undefined,
        timezone: metadata.timezone ? sanitizeText(metadata.timezone, FIELD_LIMITS.timezone) : undefined,
        browser: metadata.browser ? sanitizeText(metadata.browser, FIELD_LIMITS.browser) : undefined,
        os: metadata.os ? sanitizeText(metadata.os, FIELD_LIMITS.os) : undefined,
        deviceType: metadata.deviceType ? sanitizeText(metadata.deviceType, FIELD_LIMITS.deviceType) : undefined,
        screenResolution: metadata.screenResolution
          ? sanitizeText(metadata.screenResolution, FIELD_LIMITS.screenResolution)
          : undefined,
        language: metadata.language ? sanitizeText(metadata.language, FIELD_LIMITS.language) : undefined,
        referrerUrl: sanitizeUrl(metadata.referrerUrl),
        currentPageUrl: sanitizeUrl(metadata.currentPageUrl),
        userAgent: metadata.userAgent ? sanitizeText(metadata.userAgent, FIELD_LIMITS.userAgent) : undefined,
        firstVisitAtUtc: metadata.firstVisitAtUtc
          ? sanitizeText(metadata.firstVisitAtUtc, FIELD_LIMITS.firstVisitAtUtc)
          : undefined,
        isReturningVisitor: metadata.isReturningVisitor,
        sessionId: metadata.sessionId ? sanitizeText(metadata.sessionId, FIELD_LIMITS.sessionId) : undefined,
        timeOnPageSeconds: metadata.timeOnPageSeconds,
        utmSource: metadata.utmSource ? sanitizeText(metadata.utmSource, FIELD_LIMITS.utm) : undefined,
        utmMedium: metadata.utmMedium ? sanitizeText(metadata.utmMedium, FIELD_LIMITS.utm) : undefined,
        utmCampaign: metadata.utmCampaign ? sanitizeText(metadata.utmCampaign, FIELD_LIMITS.utm) : undefined,
        utmTerm: metadata.utmTerm ? sanitizeText(metadata.utmTerm, FIELD_LIMITS.utm) : undefined,
        utmContent: metadata.utmContent ? sanitizeText(metadata.utmContent, FIELD_LIMITS.utm) : undefined,
        preferredColorScheme: metadata.preferredColorScheme,
        viewportSize: metadata.viewportSize ? sanitizeText(metadata.viewportSize, FIELD_LIMITS.viewportSize) : undefined,
      },
    });

    let message = "Feedback submitted successfully.";

    try {
      const emailStatus = await emailService.sendNotifications(submission);
      if (!emailStatus.delivered) {
        message = "Feedback saved. Email notifications are currently unavailable.";
      }
    } catch (error) {
      logger.error("Email delivery failed", {
        requestId: req.requestId,
        error,
        submissionId: submission.id,
      });
      message = "Feedback saved, but email notifications failed.";
    }

    return res.status(201).json({
      success: true,
      message,
      data: {
        id: submission.id,
        submittedAtUtc: submission.submittedAtUtc,
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  router.get("/contact", requireAdminApiKey, async (req, res) => {
    const query = listSchema.parse(req.query);

    if (!isValidDateInput(query.dateFrom) || !isValidDateInput(query.dateTo)) {
      throw new HttpError(400, "Date filters must use YYYY-MM-DD format.", "INVALID_DATE_FILTER");
    }

    const result = await repository.findByQuery({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    return res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  router.get("/contact/stats", requireAdminApiKey, async (req, res) => {
    const stats = await repository.getStats();

    return res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  router.delete("/contact/:id", requireAdminApiKey, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, "Invalid submission id.", "INVALID_SUBMISSION_ID");
    }

    const deleted = await repository.deleteById(id);

    if (!deleted) {
      throw new HttpError(404, "Submission not found.", "SUBMISSION_NOT_FOUND");
    }

    return res.json({
      success: true,
      message: "Submission deleted successfully.",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  return router;
};
