import { startServer } from "./server/app";

// Launch Express + Vite server on port 3000
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
