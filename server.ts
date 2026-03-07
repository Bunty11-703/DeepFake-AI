import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { createServer as createViteServer } from "vite";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3000;

// Database Setup
const db = new Database("deepfake.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY,
    type TEXT,
    filename TEXT,
    overall_score INTEGER,
    video_score INTEGER,
    audio_score INTEGER,
    verdict TEXT,
    explanation TEXT,
    timestamps TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Multer for uploads
const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.use(express.json({ limit: "50mb" }));

// --- Mock AI Logic ---
const HIGH_RISK_EXPLANATIONS = [
  "CRITICAL: Facial boundary blending artifacts detected in periorbital regions. Neural noise signatures identified in ocular micro-movements.",
  "CRITICAL: GAN-generated temporal inconsistencies found in ocular micro-movements. Frequency domain analysis reveals synthetic upsampling noise.",
  "CRITICAL: Neural texture synthesis detected in skin gradient transitions. Sub-pixel artifacts found in the nasolabial fold area.",
  "CRITICAL: Inconsistent specular highlights on facial surfaces suggest synthetic origin. Light source vectors do not align with environmental context.",
  "CRITICAL: Frequency domain analysis reveals high-frequency noise typical of GAN upsampling. Phase-vocoder artifacts detected in the audio stream."
];

const MEDIUM_RISK_EXPLANATIONS = [
  "WARNING: Minor inconsistencies in lighting and texture gradients detected. Potential GAN-assisted enhancement artifacts found.",
  "WARNING: Slight jitter in facial landmark tracking suggests potential overlay. Temporal stability is within 85% of biological baseline.",
  "WARNING: Subtle blurring around the jawline indicates possible blending artifacts. Neural texture smoothing detected in low-contrast areas.",
  "WARNING: Inconsistent eye-blink frequency detected over the last 5 seconds. Statistical deviation from natural human behavior identified.",
  "WARNING: Minor chromatic aberration found in the facial region. Spectral analysis suggests post-processing typical of deepfake synthesis."
];

const LOW_RISK_EXPLANATIONS = [
  "OPTIMAL: No significant neural artifacts detected in current frame sequence. Facial landmarks align with biological parameters.",
  "OPTIMAL: Facial landmark consistency within normal biological parameters. Temporal stability verified across 120 frames.",
  "OPTIMAL: Skin texture and lighting gradients appear consistent with environment. No synthetic noise signatures identified.",
  "OPTIMAL: Temporal stability of facial features suggests authentic capture. Ocular micro-movements are consistent with natural behavior.",
  "OPTIMAL: Ocular micro-movements align with natural human behavior. Spectral decomposition of audio stream shows no synthetic vocoder noise."
];

function runMockInference(data: string | Buffer, isFrame: boolean = false) {
  const score = Math.floor(Math.random() * 100);
  let risk = "Low";
  let explanation = "";

  if (score > 70) {
    risk = "High";
    explanation = isFrame 
      ? HIGH_RISK_EXPLANATIONS[Math.floor(Math.random() * HIGH_RISK_EXPLANATIONS.length)]
      : "GAN-generated temporal inconsistencies found in audio-visual sync.";
  } else if (score > 40) {
    risk = "Medium";
    explanation = isFrame
      ? MEDIUM_RISK_EXPLANATIONS[Math.floor(Math.random() * MEDIUM_RISK_EXPLANATIONS.length)]
      : "Minor inconsistencies in lighting and texture gradients.";
  } else {
    explanation = isFrame
      ? LOW_RISK_EXPLANATIONS[Math.floor(Math.random() * LOW_RISK_EXPLANATIONS.length)]
      : "No significant artifacts detected.";
  }

  return { score, risk, explanation };
}

// --- API Routes ---

// Upload & Analyze
app.post("/api/verify/upload", upload.single("media"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const id = Math.random().toString(36).substring(7);
  const type = req.body.type || "video";
  const { score, risk, explanation } = runMockInference(req.file.path);
  
  const verdict = score > 70 ? "Likely Fake" : score > 40 ? "Uncertain" : "Likely Real";
  const timestamps = JSON.stringify([
    { 
      start: 2.5, 
      end: 4.2, 
      reason: "Lip-sync mismatch", 
      detail: "The phoneme 'p' was detected in the audio stream while the visual lip movement remained in a neutral 'm' position. This 170ms lag is characteristic of low-quality deepfake synthesis." 
    },
    { 
      start: 8.1, 
      end: 10.5, 
      reason: "Eye-blink frequency anomaly", 
      detail: "Subject failed to perform a natural blink for over 120 frames. Statistical analysis shows a 99.2% deviation from the subject's baseline blink rate, suggesting GAN-generated ocular regions." 
    }
  ]);

  const stmt = db.prepare(`
    INSERT INTO results (id, type, filename, overall_score, video_score, audio_score, verdict, explanation, timestamps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, type, req.file.originalname, score, score - 5, score + 5, verdict, explanation, timestamps);

  const result = {
    id,
    type,
    filename: req.file.originalname,
    overall_score: score,
    video_score: score - 5,
    audio_score: score + 5,
    verdict,
    explanation,
    timestamps,
    created_at: new Date().toISOString()
  };

  res.json(result);
});

// History
app.get("/api/verify/history", (req, res) => {
  const { search, verdict } = req.query;
  let query = "SELECT * FROM results";
  const params: any[] = [];

  if (search || verdict) {
    query += " WHERE";
    if (search) {
      query += " filename LIKE ?";
      params.push(`%${search}%`);
    }
    if (verdict) {
      if (search) query += " AND";
      query += " verdict = ?";
      params.push(verdict);
    }
  }

  query += " ORDER BY created_at DESC";
  const results = db.prepare(query).all(...params);
  res.json(results);
});

// Export
app.get("/api/verify/export/:id", (req, res) => {
  const result = db.prepare("SELECT * FROM results WHERE id = ?").get(req.params.id);
  if (!result) return res.status(404).json({ error: "Not found" });
  
  const exportData = {
    ...result,
    timestamps: JSON.parse(result.timestamps as string),
    exported_at: new Date().toISOString(),
    system: "Glance Multimodal v4.2"
  };
  
  res.setHeader('Content-disposition', `attachment; filename=glance_report_${req.params.id}.json`);
  res.setHeader('Content-type', 'application/json');
  res.send(JSON.stringify(exportData, null, 2));
});

// Delete
app.delete("/api/verify/:id", (req, res) => {
  db.prepare("DELETE FROM results WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// --- WebSocket Real-Time Detection ---
wss.on("connection", (ws) => {
  console.log("Client connected to real-time detection");

  ws.on("message", (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "frame") {
        // Mock processing delay
        setTimeout(() => {
          const result = runMockInference(data.frame, true);
          const video_score = Math.max(0, Math.min(100, result.score + (Math.random() * 10 - 5)));
          const audio_score = Math.max(0, Math.min(100, result.score + (Math.random() * 10 - 5)));
          
          let anomaly = null;
          if (result.score > 40) {
            anomaly = {
              reason: result.score > 70 ? "Critical Neural Artifact" : "Subtle Inconsistency",
              detail: result.explanation
            };
          }

          ws.send(JSON.stringify({
            type: "detection_result",
            frame_score: result.score,
            video_score: Math.round(video_score),
            audio_score: Math.round(audio_score),
            risk_level: result.risk,
            explanation: result.explanation,
            anomaly: anomaly,
            timestamp: Date.now()
          }));
        }, 100);
      }
    } catch (e) {
      console.error("WS Error:", e);
    }
  });

  ws.on("close", () => console.log("Client disconnected"));
});

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Glance Multimodal Backend running on http://localhost:${PORT}`);
  });
}

startServer();
