import { Request, Response, NextFunction } from "express";

export const requireAdminApiKey = (req: Request, res: Response, next: NextFunction) => {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    return res.status(500).json({
      success: false,
      message: "Admin API key is not configured",
    });
  }

  const providedKey = req.header("x-api-key") ?? (typeof req.query.apiKey === "string" ? req.query.apiKey : "");

  if (providedKey !== adminApiKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  next();
};
