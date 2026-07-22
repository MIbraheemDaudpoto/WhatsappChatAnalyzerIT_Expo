import "dotenv/config";
import express from "express";
import cors from "cors";
import { createContactRouter } from "./routes/contactRoutes";
import { SqliteContactRepository } from "./repositories/sqliteContactRepository";
import { TurnstileService } from "./services/turnstileService";
import { EmailService } from "./services/emailService";

const app = express();
const port = Number(process.env.PORT || 8787);
const dbPath = process.env.CONTACT_DB_PATH || "./data/contact-feedback.db";
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));

const repository = new SqliteContactRepository(dbPath);
const turnstileService = new TurnstileService();
const emailService = new EmailService();

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Contact API is running" });
});

app.use("/api", createContactRouter(repository, turnstileService, emailService));

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(port, () => {
  console.log(`Contact API server running at http://localhost:${port}`);
});
