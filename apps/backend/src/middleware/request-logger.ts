import { randomUUID } from "crypto";
import { type NextFunction, type Request, type Response } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const requestId = req.header("x-request-id") || randomUUID();
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const payload = {
      level: "info",
      event: "http_request",
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      at: new Date().toISOString(),
    };
    console.log(JSON.stringify(payload));
  });

  next();
}

