import { timingSafeEqual } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpError";

const isApiKeyMatch = (provided: string, expected: string) => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

export const requireAdminApiKey = (req: Request, _res: Response, next: NextFunction) => {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    throw new HttpError(500, "Admin API key is not configured", "ADMIN_API_KEY_MISSING");
  }

  const providedKey = req.header("x-api-key") ?? "";

  if (!isApiKeyMatch(providedKey, adminApiKey)) {
    throw new HttpError(401, "Unauthorized", "ADMIN_UNAUTHORIZED");
  }

  next();
};
