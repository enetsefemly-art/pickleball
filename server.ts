import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Cloud Sync Proxy Routes
  app.post("/api/cloud/sync-up", async (req, res) => {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Chưa cấu hình GOOGLE_SCRIPT_URL trong biến môi trường.' 
      });
    }

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Sync Up Error:", error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Lỗi khi kết nối tới Google Script: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  });

  app.get("/api/cloud/sync-down", async (req, res) => {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Chưa cấu hình GOOGLE_SCRIPT_URL trong biến môi trường.' 
      });
    }

    try {
      // Forward query params if any
      const url = new URL(scriptUrl);
      Object.entries(req.query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });

      const response = await fetch(url.toString(), {
        method: 'GET'
      });

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (e) {
        // If Google Script returns HTML error page
        console.error("Invalid JSON from Google Script:", text);
        res.status(502).json({
            status: 'error',
            message: 'Google Script trả về dữ liệu không hợp lệ (có thể là trang lỗi HTML).',
            raw: text.substring(0, 200)
        });
      }
    } catch (error) {
      console.error("Sync Down Error:", error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Lỗi khi kết nối tới Google Script: ' + (error instanceof Error ? error.message : String(error))
      });
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
    // Production: Serve static files from dist
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
