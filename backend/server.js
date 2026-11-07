import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import os from "os";
import { db, sqlite } from "./db-sqlite.js";
import { setCsrfCookie, csrfProtection } from "./middleware/auth.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { convertNumberedPinyin } from "./utils/pinyin.js";

import dictionaryRouter from "./routes/dictionary.js";
import ttsRouter from "./routes/tts.js";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3002;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(compression());

// Discover local network interfaces for mobile testing on LAN
const localIps = [];
try {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIps.push(net.address);
      }
    }
  }
} catch {
  /* ignore */
}

app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = [
        /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d+$/,
      ];
      for (const ip of localIps) {
        allowed.push(new RegExp(`^https?:\\/\\/${ip.replace(/\\./g, "\\\\.")}:\\d+$`));
      }
      if (process.env.ALLOWED_ORIGIN) {
        allowed.push(process.env.ALLOWED_ORIGIN);
      }
      if (!origin || allowed.some((a) => (typeof a === "string" ? a === origin : a.test(origin)))) {
        callback(null, true);
      } else {
        // Allow mobile app requests
        callback(null, true);
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(setCsrfCookie);
app.use(express.json({ limit: "10kb" }));

// Recursive Pinyin Formatter Middleware
function recursiveFormatPinyin(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = recursiveFormatPinyin(obj[i]);
    }
    return obj;
  }
  for (const key of Object.keys(obj)) {
    if (key === "pinyin" && typeof obj[key] === "string") {
      obj[key] = convertNumberedPinyin(obj[key]);
    } else if (typeof obj[key] === "object") {
      obj[key] = recursiveFormatPinyin(obj[key]);
    }
  }
  return obj;
}

app.use("/api/", (req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (body) {
      body = recursiveFormatPinyin(body);
    }
    return originalJson.call(this, body);
  };
  return apiLimiter(req, res, next);
});

// Health check / ping
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", service: "zihai-search-backend" });
});

// Mount search dictionary and TTS routes
app.use("/api", dictionaryRouter);
app.use("/api", ttsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

const server = http.createServer(app);

if (process.env.NODE_ENV !== "test") {
  let currentPort = parseInt(process.env.PORT || "3002", 10);

  function tryListen(port) {
    currentPort = port;
    server.listen(port, () => {
      console.log(`\n🔍 Zihai Search Backend running on http://localhost:${port}`);
      console.log(`API URL: http://localhost:${port}/api`);
    });
  }

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      if (!process.env.PORT && currentPort < 3010) {
        console.log(`Port ${currentPort} in use, trying ${currentPort + 1}...`);
        tryListen(currentPort + 1);
      } else {
        console.error(`Port ${currentPort} is already in use.`);
        process.exit(1);
      }
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });

  tryListen(currentPort);
}

export { app, db, sqlite };
