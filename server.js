import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
async function startServer() {
  const app = express();
  const PORT = 3e3;
  app.use(express.json({ limit: "50mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/cloud/sync-up", async (req, res) => {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      return res.status(500).json({
        status: "error",
        message: "Ch\u01B0a c\u1EA5u h\xECnh GOOGLE_SCRIPT_URL trong bi\u1EBFn m\xF4i tr\u01B0\u1EDDng."
      });
    }
    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Sync Up Error:", error);
      res.status(500).json({
        status: "error",
        message: "L\u1ED7i khi k\u1EBFt n\u1ED1i t\u1EDBi Google Script: " + (error instanceof Error ? error.message : String(error))
      });
    }
  });
  app.get("/api/cloud/sync-down", async (req, res) => {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      return res.status(500).json({
        status: "error",
        message: "Ch\u01B0a c\u1EA5u h\xECnh GOOGLE_SCRIPT_URL trong bi\u1EBFn m\xF4i tr\u01B0\u1EDDng."
      });
    }
    try {
      const url = new URL(scriptUrl);
      Object.entries(req.query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
      const response = await fetch(url.toString(), {
        method: "GET"
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (e) {
        console.error("Invalid JSON from Google Script:", text);
        res.status(502).json({
          status: "error",
          message: "Google Script tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7 (c\xF3 th\u1EC3 l\xE0 trang l\u1ED7i HTML).",
          raw: text.substring(0, 200)
        });
      }
    } catch (error) {
      console.error("Sync Down Error:", error);
      res.status(500).json({
        status: "error",
        message: "L\u1ED7i khi k\u1EBFt n\u1ED1i t\u1EDBi Google Script: " + (error instanceof Error ? error.message : String(error))
      });
    }
  });
  const BANNER_FILE = "/tmp/app-config.json";
  app.get("/api/app-config", (_req, res) => {
    try {
      if (fs.existsSync(BANNER_FILE)) {
        const data = fs.readFileSync(BANNER_FILE, "utf8");
        res.json(JSON.parse(data));
      } else {
        res.json({ url: "" });
      }
    } catch (e) {
      res.json({ url: "" });
    }
  });
  app.post("/api/app-config", (req, res) => {
    if (!req.body) {
      return res.status(400).json({ status: "error", message: "Thi\u1EBFu d\u1EEF li\u1EC7u y\xEAu c\u1EA7u (req.body is undefined)" });
    }
    const { url, password } = req.body;
    if (password !== "Tducteam") {
      return res.status(401).json({ status: "error", message: "Sai m\u1EADt kh\u1EA9u!" });
    }
    try {
      const tmpDir = path.dirname(BANNER_FILE);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      fs.writeFileSync(BANNER_FILE, JSON.stringify({ url }));
      res.json({ status: "success" });
    } catch (e) {
      console.error("Banner save error:", e);
      res.status(500).json({ status: "error", message: "L\u1ED7i l\u01B0u banner: " + (e instanceof Error ? e.message : String(e)) });
    }
  });
  app.use("/api", (err, _req, res, _next) => {
    console.error("API Error:", err);
    res.status(500).json({ status: "error", message: "L\u1ED7i m\xE1y ch\u1EE7 n\u1ED9i b\u1ED9: " + err.message });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
