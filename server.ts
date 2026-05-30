import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Message, UserSession, TypingState } from "./src/types.js";

// Polyfill __dirname in ESM if needed, though with tsx we run directly.
const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent store path
const DATA_FILE = path.join(process.cwd(), "messages_store.json");

// In-memory caches with disk persistence fallback
let messages: Message[] = [];
let activeUsers: Record<string, UserSession> = {};
let typingUsers: Record<string, { nickname: string; timestamp: number }> = {};

// Load messages from file if exists
const loadMessages = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      messages = JSON.parse(data);
    } else {
      messages = [];
    }
  } catch (err) {
    console.error("Failed to load messages from file:", err);
    messages = [];
  }
};

// Save messages to file
const saveMessages = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save messages to file:", err);
  }
};

// Load on boot
loadMessages();

// Cleanup stale typing status and active users periodically
setInterval(() => {
  const now = Date.now();
  // Remove typing states older than 4 seconds
  for (const senderId in typingUsers) {
    if (now - typingUsers[senderId].timestamp > 4000) {
      delete typingUsers[senderId];
    }
  }

  // Remove active users showing no heartbeat in 10 seconds
  let activeChanged = false;
  for (const id in activeUsers) {
    if (now - activeUsers[id].lastActive > 10000) {
      delete activeUsers[id];
      activeChanged = true;
    }
  }
}, 3000);

// API Endpoints

// 1. Get messages
app.get("/api/messages", (req, res) => {
  // Return the latest 100 messages
  res.json(messages.slice(-100));
});

// 2. Post a message
app.post("/api/messages", (req, res) => {
  const { text, senderId, senderName, senderColor, senderAvatar } = req.body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Message text cannot be empty." });
  }
  if (!senderId || !senderName) {
    return res.status(400).json({ error: "Sender details are required." });
  }

  const newMessage: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: text.trim().slice(0, 1000), // Max 1000 chars per message for stability
    senderId,
    senderName: senderName.trim().slice(0, 50),
    senderColor: senderColor || "indigo",
    senderAvatar: senderAvatar || "HelpCircle",
    timestamp: Date.now(),
    reactions: {}
  };

  messages.push(newMessage);

  // Keep max 150 messages in the store to keep it clean and fast
  if (messages.length > 150) {
    messages = messages.slice(-150);
  }

  saveMessages();

  // Clear typing status for this user immediately after sending
  delete typingUsers[senderId];

  res.status(201).json(newMessage);
});

// 3. React to a message
app.post("/api/messages/:id/react", (req, res) => {
  const msgId = req.params.id;
  const { emoji, senderId } = req.body;

  if (!emoji || !senderId) {
    return res.status(400).json({ error: "Emoji and senderId are required." });
  }

  const msg = messages.find((m) => m.id === msgId);
  if (!msg) {
    return res.status(404).json({ error: "Message not found." });
  }

  if (!msg.reactions) {
    msg.reactions = {};
  }

  const currentReactors = msg.reactions[emoji] || [];
  
  if (currentReactors.includes(senderId)) {
    // Toggle reaction off if clicked again
    msg.reactions[emoji] = currentReactors.filter((id) => id !== senderId);
    if (msg.reactions[emoji].length === 0) {
      delete msg.reactions[emoji];
    }
  } else {
    // Add reaction
    msg.reactions[emoji] = [...currentReactors, senderId];
  }

  saveMessages();
  res.json(msg);
});

// 4. Heartbeat pulse / user presence tracker
app.post("/api/pulse", (req, res) => {
  const { senderId, nickname, color, avatar } = req.body;
  if (!senderId || !nickname) {
    return res.status(400).json({ error: "senderId and nickname are required." });
  }

  activeUsers[senderId] = {
    id: senderId,
    nickname,
    color: color || "indigo",
    avatar: avatar || "HelpCircle",
    lastActive: Date.now()
  };

  const usersList = Object.values(activeUsers).map(u => ({
    nickname: u.nickname,
    color: u.color,
    avatar: u.avatar
  }));

  res.json({
    activeCount: Object.keys(activeUsers).length,
    activeUsers: usersList
  });
});

// 5. Update typing state
app.post("/api/typing", (req, res) => {
  const { senderId, nickname, isTyping } = req.body;
  if (!senderId || !nickname) {
    return res.status(400).json({ error: "senderId and nickname are required." });
  }

  if (isTyping) {
    typingUsers[senderId] = {
      nickname,
      timestamp: Date.now()
    };
  } else {
    delete typingUsers[senderId];
  }

  res.json({ success: true });
});

// 6. Get typing players list
app.get("/api/typing", (req, res) => {
  const list = Object.values(typingUsers).map(u => u.nickname);
  res.json({ typingNow: list });
});

// Clear entire chatroom history (System-Admin helper if needed, nice for users to start fresh)
app.post("/api/clear-chat", (req, res) => {
  messages = [];
  saveMessages();
  res.json({ success: true, message: "Chatroom reset successfully!" });
});


// Vite Dev Server / Prod Static client bundle setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Mount Vite Dev Server Middlewares
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA Fallback for production build
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Anonymous Chat Server listening on port ${PORT}`);
  });
}

startServer();
