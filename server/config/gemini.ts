import { GoogleGenAI } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;

/**
 * Lazy initialization of Google GenAI SDK.
 * Reads GEMINI_API_KEY from environment variables on demand.
 */
export function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    genAIClient = new GoogleGenAI({ apiKey: key });
  }
  return genAIClient;
}
