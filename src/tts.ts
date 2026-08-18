import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

const exec = promisify(execFile);

export async function sayLocal(text: string): Promise<void> {
  const args = ["-v", config.tts.voice, "-r", String(config.tts.rate), text];
  try {
    await exec("say", args);
  } catch (e) {
    console.error("[tts] say failed:", e);
  }
}

export async function sayOpenAI(text: string): Promise<void> {
  const res = await fetch(`${config.openai.baseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openai.ttsModel,
      voice: config.openai.ttsVoice,
      input: text,
    }),
  });
  if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = join(tmpdir(), `jarvis-${randomUUID()}.mp3`);
  await writeFile(file, buf);
  await exec("afplay", [file]);
}

export async function speak(text: string): Promise<void> {
  if (config.openai.apiKey && config.tts.backend === "openai") {
    await sayOpenAI(text);
  } else {
    await sayLocal(text);
  }
}
