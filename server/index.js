const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const Entry = require("./models/Entry");

const app = express();
app.set('trust proxy', 1); // Required for Render's reverse proxy — lets Express see HTTPS so secure cookies work
const server = http.createServer(app);

// --- Config ---
const PORT = process.env.PORT || 3001;
const SESSION_SECRET = "studyhub_s3cr3t_key_2024";

// --- Database Connection ---
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/studyhub";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("[Database] Connected to MongoDB"))
  .catch((err) => console.error("[Database] Connection error:", err));

// Hardcoded users
const USERS = [
  { id: "u1", username: "krati", password: "krishna", displayName: "Krati" },
  { id: "u2", username: "avni", password: "krishna", displayName: "Avni" },
  { id: "u3", username: "vishi", password: "krishna", displayName: "Vishi" },
  { id: "u4", username: "vibhuti", password: "krishna", displayName: "Vibhuti" },
];

// --- Middleware ---
const sessionOptions = {
  secret: process.env.SESSION_SECRET || "studyhub_s3cr3t_key_2024",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
  },
};
const sessionMiddleware = session(sessionOptions);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];
let allowedOrigin = process.env.CORS_ORIGIN || allowedOrigins;

// Robustly handle trailing slashes in environment variables to prevent CORS mismatches
if (typeof allowedOrigin === 'string') {
  allowedOrigin = allowedOrigin.replace(/\/$/, "");
}

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.use(sessionMiddleware);

// --- Auth helpers ---
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// --- Routes (generic naming) ---

// Verify credentials
app.post("/api/verify", (req, res) => {
  const { username, password } = req.body;
  console.log(`[Auth] Login attempt: ${username}`);
  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  req.session.user = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
  return res.json({
    success: true,
    user: { id: user.id, username: user.username, displayName: user.displayName },
  });
});

// Check auth status
app.get("/api/status", (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});

// Logout
app.post("/api/reset", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Failed" });
    res.clearCookie("connect.sid");
    return res.json({ success: true });
  });
});

// Get discussion entries (protected)
app.get("/api/data", requireAuth, async (req, res) => {
  try {
    const entries = await Entry.find().sort({ timestamp: 1 });
    return res.json({ entries });
  } catch (err) {
    console.error("[API] Error fetching entries:", err);
    return res.status(500).json({ error: "Failed to fetch entries" });
  }
});

// Purge all entries and sign out (panic)
app.post("/api/purge", requireAuth, async (req, res) => {
  if (req.session.user.id !== 'u1' && req.session.user.id !== 'u2') {
    return res.status(403).json({ error: "Unauthorized: Only allowed users can purge chat" });
  }
  try {
    await Entry.deleteMany({});
    io.emit("entries-cleared");
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Failed" });
      res.clearCookie("connect.sid");
      return res.json({ success: true });
    });
  } catch (err) {
    console.error("[API] Error purging entries:", err);
    return res.status(500).json({ error: "Failed to purge entries" });
  }
});

// --- YouTube Search Proxy (public) ---
app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  const pwOnly = req.query.pw === '1';

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Missing search query" });
  }

  const apiKey = "AIzaSyCEc_xbhDMRWPM57y3MYqcDSmvEt6T-Trs";

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: pwOnly ? `${query.trim()} Physics Wallah` : query.trim(),
      type: "video",
      maxResults: "12",
      key: apiKey,
    });

    // When PW filter is on, restrict to Physics Wallah channel
    if (pwOnly) {
      params.set("channelId", "UCibaUdOW_7BJRKvkOSDRMZw");
    }

    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );
    const ytData = await ytRes.json();

    if (!ytRes.ok) {
      console.error("[YouTube] API error:", ytData.error?.message);
      return res
        .status(ytRes.status)
        .json({ error: ytData.error?.message || "YouTube API error" });
    }

    const videos = (ytData.items || []).map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.channelTitle,
    }));

    return res.json({ videos });
  } catch (err) {
    console.error("[YouTube] Fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch from YouTube" });
  }
});

// --- Socket.io ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
  },
  maxHttpBufferSize: 5e6, // 5MB for image attachments
});

// Share session with Socket.io
io.engine.use(sessionMiddleware);

// Track connected sockets by user ID for signaling
const connectedUsers = new Map(); // userId -> socket

io.on("connection", (socket) => {
  // Validate session
  const session = socket.request.session;
  if (!session || !session.user) {
    socket.disconnect(true);
    return;
  }

  const user = session.user;
  console.log(`[StudyHub] ${user.displayName} connected`);

  // Track this user's socket
  connectedUsers.set(user.id, socket);

  // When mini (u1) connects, check if avni (u2) is online
  if (user.id === "u1") {
    const avniSocket = connectedUsers.get("u2");
    if (avniSocket) {
      // Both are online — tell mini to start streaming and avni to expect it
      socket.emit("viewer-ready");
      avniSocket.emit("streamer-online");
    }
  }

  // When avni (u2) connects, check if mini (u1) is online
  if (user.id === "u2") {
    const miniSocket = connectedUsers.get("u1");
    if (miniSocket) {
      // Both are online — tell mini to start streaming and avni to expect it
      miniSocket.emit("viewer-ready");
      socket.emit("streamer-online");
    }
  }

  // Avni: request initial status if missed the connection event
  socket.on("get-initial-status", () => {
    if (user.id === "u2") {
      if (connectedUsers.has("u1")) {
        socket.emit("streamer-online");
        // Also signal mini to start if not already
        const miniSocket = connectedUsers.get("u1");
        if (miniSocket) miniSocket.emit("viewer-ready");
      } else {
        socket.emit("streamer-offline");
      }
    }
  });

  // WebRTC signaling: relay offer from mini to avni
  socket.on("rtc-offer", (offer) => {
    if (user.id === "u1") {
      const avniSocket = connectedUsers.get("u2");
      if (avniSocket) avniSocket.emit("rtc-offer", offer);
    }
  });

  // WebRTC signaling: relay answer from avni to mini
  socket.on("rtc-answer", (answer) => {
    if (user.id === "u2") {
      const miniSocket = connectedUsers.get("u1");
      if (miniSocket) miniSocket.emit("rtc-answer", answer);
    }
  });

  // WebRTC signaling: relay ICE candidates
  socket.on("rtc-ice-candidate", (candidate) => {
    const targetId = user.id === "u1" ? "u2" : "u1";
    const targetSocket = connectedUsers.get(targetId);
    if (targetSocket) targetSocket.emit("rtc-ice-candidate", candidate);
  });

  // Force-logout: Avni can remotely log out Mini
  socket.on("force-logout", () => {
    if (user.id !== "u2") return; // Only Avni can trigger
    const miniSocket = connectedUsers.get("u1");
    if (miniSocket) {
      miniSocket.emit("force-logout");
      miniSocket.disconnect(true);
    }
  });

  // Handle new discussion entry (text and/or image)
  socket.on("submit-entry", async (data) => {
    try {
      const entry = await Entry.create({
        author: user.displayName,
        authorId: user.id,
        content: data.content || "",
        image: data.image || null,
        replyTo: data.replyTo || null,
      });

      io.emit("new-entry", entry);
    } catch (err) {
      console.error("[Socket] Error creating entry:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[StudyHub] ${user.displayName} disconnected`);
    connectedUsers.delete(user.id);

    // If mini disconnects, tell avni to remove the feed
    if (user.id === "u1") {
      const avniSocket = connectedUsers.get("u2");
      if (avniSocket) avniSocket.emit("streamer-offline");
    }
  });
});

// --- Start ---
server.listen(PORT, () => {
  console.log(`[StudyHub] Server running on http://localhost:${PORT}`);
});
