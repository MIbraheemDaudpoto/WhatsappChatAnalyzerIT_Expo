import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ContactRepository } from "../repositories/contactRepository";
import { TurnstileService } from "../services/turnstileService";
import { EmailService } from "../services/emailService";
import { requireAdminApiKey } from "../middleware/adminAuth";

const FIELD_LIMITS = {
  name: 120,
  email: 254,
  subject: 200,
  message: 5000,
  timezone: 100,
  browser: 120,
  os: 120,
  deviceType: 40,
  screenResolution: 40,
  language: 40,
  referrerUrl: 1024,
  currentPageUrl: 1024,
  userAgent: 1024,
} as const;

const sanitizeText = (value: string, maxLength: number) =>
  value
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);

const metadataSchema = z
  .object({
    submittedAtLocal: z.string().max(120).optional(),
    timezone: z.string().max(FIELD_LIMITS.timezone).optional(),
    browser: z.string().max(FIELD_LIMITS.browser).optional(),
    os: z.string().max(FIELD_LIMITS.os).optional(),
    deviceType: z.string().max(FIELD_LIMITS.deviceType).optional(),
    screenResolution: z.string().max(FIELD_LIMITS.screenResolution).optional(),
    language: z.string().max(FIELD_LIMITS.language).optional(),
    referrerUrl: z.string().max(FIELD_LIMITS.referrerUrl).optional(),
    currentPageUrl: z.string().max(FIELD_LIMITS.currentPageUrl).optional(),
    userAgent: z.string().max(FIELD_LIMITS.userAgent).optional(),
  })
  .optional()
  .default({});

const contactSchema = z.object({
  name: z.string().min(1).max(FIELD_LIMITS.name),
  email: z.string().email().max(FIELD_LIMITS.email),
  subject: z.string().max(FIELD_LIMITS.subject).optional().default(""),
  message: z.string().min(1).max(FIELD_LIMITS.message),
  sendCopy: z.boolean().optional().default(false),
  turnstileToken: z.string().min(1),
  metadata: metadataSchema,
});

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

const buildIp = (forwardedHeader: string | undefined, fallback?: string) => {
  if (forwardedHeader) {
    const firstValue = forwardedHeader.split(",")[0]?.trim();
    if (firstValue) {
      return firstValue;
    }
  }

  return fallback;
};

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
    message: {
      success: false,
      message: "Too many contact attempts. Please try again later.",
    },
  });

  router.post("/contact", postRateLimit, async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid contact details.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const ipAddress = buildIp(req.header("x-forwarded-for"), req.ip);

    try {
      const isTurnstileValid = await turnstileService.verifyToken(parsed.data.turnstileToken, ipAddress);

      if (!isTurnstileValid) {
        return res.status(400).json({
          success: false,
          message: "Turnstile verification failed. Please try again.",
        });
      }

      const metadata = parsed.data.metadata;
      const submission = await repository.create({
        name: sanitizeText(parsed.data.name, FIELD_LIMITS.name),
        email: sanitizeText(parsed.data.email.toLowerCase(), FIELD_LIMITS.email),
        subject: sanitizeText(parsed.data.subject, FIELD_LIMITS.subject),
        message: sanitizeText(parsed.data.message, FIELD_LIMITS.message),
        sendCopy: parsed.data.sendCopy,
        submittedAtUtc: new Date().toISOString(),
        ipAddress: ipAddress ? sanitizeText(ipAddress, 80) : undefined,
        metadata: {
          submittedAtLocal: metadata.submittedAtLocal,
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
        },
      });

      let message = "Feedback submitted successfully.";

      try {
        const emailStatus = await emailService.sendNotifications(submission);
        if (!emailStatus.delivered) {
          message = "Feedback saved. Email notifications are currently unavailable.";
        }
      } catch {
        message = "Feedback saved, but email notifications failed.";
      }

      return res.status(201).json({
        success: true,
        message,
        data: {
          id: submission.id,
          submittedAtUtc: submission.submittedAtUtc,
        },
      });
    } catch (error) {
      const message = error instanceof Error && error.message.includes("TURNSTILE_SECRET_KEY")
        ? "Contact service is temporarily unavailable."
        : "Something went wrong while submitting your feedback.";

      return res.status(500).json({
        success: false,
        message,
      });
    }
  });

  router.get("/contact", requireAdminApiKey, async (_req, res) => {
    try {
      const submissions = await repository.findAll();
      return res.json({
        success: true,
        data: submissions,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Unable to fetch contact submissions.",
      });
    }
  });

  return router;
};
