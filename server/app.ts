import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { securityHeaders } from "./middleware/security";
import { apiRouter } from "./routes/api";

export async function createApp() {
  const app = express();

  // Basic security and request parsing
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "5mb" }));

  // Mount backend API router
  app.use("/api", apiRouter);

  // Frontend SPA serving (Vite in development, static build in production)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

export async function startServer() {
  const PORT = 3000;
  const app = await createApp();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
