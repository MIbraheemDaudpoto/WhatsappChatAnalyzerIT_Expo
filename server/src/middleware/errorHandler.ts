import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";
import { logger } from "../utils/logger";

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    errorCode: "ROUTE_NOT_FOUND",
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
};

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const timestamp = new Date().toISOString();

  if (error instanceof ZodError) {
    logger.warn("Validation failure", {
      requestId: req.requestId,
      path: req.path,
      errors: error.flatten().fieldErrors,
    });

    return res.status(400).json({
      success: false,
      message: "Please provide valid contact details.",
      errorCode: "VALIDATION_ERROR",
      timestamp,
      requestId: req.requestId,
      details: error.flatten().fieldErrors,
    });
  }

  if (error instanceof HttpError) {
    if (error.statusCode >= 500) {
      logger.error("API error", {
        requestId: req.requestId,
        path: req.path,
        errorCode: error.errorCode,
        details: error.details,
        message: error.message,
      });
    } else {
      logger.warn("API warning", {
        requestId: req.requestId,
        path: req.path,
        errorCode: error.errorCode,
        details: error.details,
        message: error.message,
      });
    }

    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode,
      timestamp,
      requestId: req.requestId,
      details: error.details,
    });
  }

  logger.error("Unhandled API error", {
    requestId: req.requestId,
    path: req.path,
    error,
  });

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    errorCode: "INTERNAL_SERVER_ERROR",
    timestamp,
    requestId: req.requestId,
  });
};
