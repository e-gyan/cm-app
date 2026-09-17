import type { Request, Response, NextFunction } from "express";

/**
 * Applies HTTP security headers to all incoming requests.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
}

/**
 * Validates prompt input for AI generation routes.
 */
export function validatePromptPayload(req: Request, res: Response, next: NextFunction): void {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "A valid string prompt is required." });
    return;
  }

  if (prompt.length > 50000) {
    res.status(400).json({ error: "Prompt exceeds maximum allowed length of 50,000 characters." });
    return;
  }

  next();
}
