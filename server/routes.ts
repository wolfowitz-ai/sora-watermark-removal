import type { Express } from "express";
import type { Server } from "http";

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
}
