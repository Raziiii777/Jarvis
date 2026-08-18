import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config.js";
import { Brain, ConvoMsg } from "./brain.js";
import { speak } from "./tts.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const vendorDir = join(__dirname, "..", "node_modules");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function sanitizePath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const p = decoded === "/" ? "/index.html" : decoded;
  return normalize(join(publicDir, p));
}

export function startServer(brain: Brain): void {
  const server = createServer(async (req, res) => {
    try {
      const rawPath = req.url ?? "/";
      if (rawPath.startsWith("/vendor/")) {
        const vp = normalize(join(vendorDir, rawPath.slice("/vendor/".length)));
        if (vp.startsWith(vendorDir)) {
          const data = await readFile(vp);
          res.writeHead(200, {
            "Content-Type": MIME[extname(vp)] ?? "application/octet-stream",
            "Cache-Control": "no-store",
          });
          res.end(data);
          return;
        }
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const filePath = sanitizePath(rawPath);
      if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("[ws] client connected");
    let audioReply = config.audioReply;

    ws.send(
      JSON.stringify({
        type: "config",
        name: config.name,
        wakeWords: config.wakeWords,
        audioReply,
      })
    );

    ws.on("message", async (raw) => {
      let msg: { type: string; text?: string; enabled?: boolean };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (msg.type === "voice") {
        audioReply = msg.enabled !== false;
        return;
      }

      if (msg.type === "speech" && msg.text) {
        const text = msg.text.trim();
        console.log(`[in]  ${text}`);
        ws.send(JSON.stringify({ type: "thinking" }));
        try {
          const replyMsg: ConvoMsg = await brain.respond(text, []);
          const reply = replyMsg.content ?? "";
          if (reply.trim()) {
            console.log(`[out] ${reply}`);
            ws.send(JSON.stringify({ type: "reply", text: reply, source: brain.hasLLM ? "llm" : "local" }));
            if (audioReply) {
              void speak(reply);
            }
          } else {
            ws.send(JSON.stringify({ type: "reply", text: "", silent: true }));
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          ws.send(JSON.stringify({ type: "reply", text: `I hit an error: ${err}` }));
        }
      }
    });

    ws.on("close", () => console.log("[ws] client disconnected"));
  });

  server.listen(config.port, "127.0.0.1", () => {
    console.log(`\n  ${config.name} is online.`);
    console.log(`  Open  http://127.0.0.1:${config.port}  in Safari or Chrome to talk.\n`);
  });
}
