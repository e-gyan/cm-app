import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for Gemini
  app.post("/api/generate-executive-report", async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your environment variables." });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          });
          break;
        } catch (err: any) {
          retries--;
          const isRetryable = err.message && (err.message.includes('fetch failed') || err.message.includes('ECONNRESET') || err.message.includes('503'));
          if (!isRetryable || retries === 0) {
            throw err;
          }
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      res.json({ text: response?.text });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message ? error.message : "Failed to generate report" });
    }
  });

  app.post("/api/generate-insight", async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your environment variables." });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          });
          break;
        } catch (err: any) {
          retries--;
          const isRetryable = err.message && (err.message.includes('fetch failed') || err.message.includes('ECONNRESET') || err.message.includes('503') || err.message.includes('500'));
          if (!isRetryable || retries === 0) {
            throw err;
          }
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      res.json({ text: response?.text });
    } catch (error: any) {
      console.error("AI Insight Error:", error);
      res.status(500).json({ error: error.message ? error.message : "Failed to generate insight" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
