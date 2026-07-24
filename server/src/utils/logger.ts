import winston from "winston";

const logLevel = process.env.LOG_LEVEL || "info";

const loggerFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: logLevel,
  format: loggerFormat,
  defaultMeta: { service: "contact-api" },
  transports: [new winston.transports.Console()],
});
