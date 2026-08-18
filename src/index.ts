import { config } from "./config.js";
import { Brain } from "./brain.js";
import { startServer } from "./server.js";
import { speak } from "./tts.js";

const brain = new Brain();

console.log(`${config.name} v0.1.0`);
console.log(`LLM: ${brain.hasLLM ? config.openai.model : "OFF (local commands only)"}`);
console.log(`TTS: ${config.tts.backend} (voice: ${config.tts.voice})`);
console.log(`Wake words: ${config.wakeWords.join(", ")}`);

void speak(`Hello sir. ${config.name} at your service.`);

startServer(brain);
