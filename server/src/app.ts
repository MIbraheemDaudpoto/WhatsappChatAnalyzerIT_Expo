import express from "express";
import cors from "cors";
import compression from "compression";
import { createContactRouter } from "./routes/contactRoutes";
import { SqliteContactRepository } from "./repositories/sqliteContactRepository";
import { TurnstileService } from "./services/turnstileService";
import { EmailService } from "./services/emailService";
import { attachRequestContext } from "./middleware/requestContext";
import { csrfProtection, allowedOrigins, helmetMiddleware } from "./middleware/security";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export const createApp = () => {
  const app = express();
  const dbPath = process.env.CONTACT_DB_PATH || "./data/contact-feedback.db";

  app.use(attachRequestContext);
  app.use(helmetMiddleware);
  app.use(compression());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(csrfProtection);

  const repository = new SqliteContactRepository(dbPath);
  const turnstileService = new TurnstileService();
  const emailService = new EmailService();

  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      message: "Contact API is running",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  app.use("/api", createContactRouter(repository, turnstileService, emailService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
