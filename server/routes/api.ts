import { Router } from "express";
import { getGenAI } from "../config/gemini";
import { validatePromptPayload } from "../middleware/security";

export const apiRouter = Router();

// Health check endpoint
apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Insights Generation Endpoint
apiRouter.post("/generate-insight", validatePromptPayload, async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (e: any) {
    console.error("Generate insight error:", e?.message || e);
    res.status(500).json({ error: e?.message || "Failed to generate insight." });
  }
});

// Executive Report Generation Endpoint
apiRouter.post("/generate-executive-report", validatePromptPayload, async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (e: any) {
    console.error("Generate report error:", e?.message || e);
    res.status(500).json({ error: e?.message || "Failed to generate report." });
  }
});
