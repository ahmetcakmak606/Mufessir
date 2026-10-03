import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler or middleware so a rejection is routed to
 * next(error) instead of becoming an unhandled promise rejection (which
 * kills the process on Express 4 — plan 1B.1 / SEC-01).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
