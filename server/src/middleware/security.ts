import helmet from "helmet";
import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";

const getAllowedOrigins = () => {
  const allowedOrigins = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  return allowedOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const allowedOrigins = getAllowedOrigins();

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://challenges.cloudflare.com"],
      frameSrc: ["'self'", "https://challenges.cloudflare.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
});

export const csrfProtection = (req: Request, _res: Response, next: NextFunction) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  const origin = req.header("origin");

  if (!origin || allowedOrigins.includes(origin)) {
    return next();
  }

  throw new HttpError(403, "Invalid request origin.", "CSRF_BLOCKED");
};

export const escapeLikePattern = (input: string) => input.replace(/[\\%_]/g, "\\$&");
