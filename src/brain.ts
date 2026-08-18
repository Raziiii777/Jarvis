import { config } from "./config.js";
import { runTool, toolSchemas } from "./tools.js";

export interface ConvoMsg {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

const INTRO = `I'm ${config.name}. I can tell you the time and date, check your battery, open apps, search the web, and answer questions. Ask me "hey ${config.name}" anytime, or type in the box below.`;

const SEARCH_RE = /(?:search|google|look up|find)\s+(?:the\s+web|the\s+internet)?\s*(?:for\s+|me\s+)?(.+)/;

function searchQuery(text: string): string {
  const m = text.toLowerCase().match(SEARCH_RE);
  return m ? m[1].trim() : text;
}

function fallback(text: string): { reply: string; usedTool?: string } {
  const t = text.toLowerCase();

  if (/(what|which).*(time)|(time is it)|^time\b/.test(t)) {
    return { reply: new Date().toLocaleTimeString("en-US"), usedTool: "get_time" };
  }
  if (/(what|which).*(date)|(date is it)|today.*(day|date)/.test(t)) {
    return {
      reply: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      usedTool: "get_date",
    };
  }
  if (/battery|charge|power/.test(t)) {
    return { reply: "Let me check the battery.", usedTool: "get_battery" };
  }
  const vol = t.match(/volume\s+(?:to\s+|at\s+)?(\d{1,3})/);
  if (vol) {
    return { reply: `Turning the volume to ${vol[1]} percent.`, usedTool: "set_volume" };
  }
  const openM = t.match(/open\s+(?:the\s+)?([a-z0-9 .\-']+)/);
  if (/open|launch|start|activate/.test(t) && openM && !/url|website|page|browser/.test(t)) {
    const app = openM[1].replace(/\.app$/, "").trim();
    const stopWords = new Set(["it", "you", "your", "yours", "that", "this", "the", "and", "for", "me", "them"]);
    if (app && !stopWords.has(app)) {
      return { reply: `Opening ${app}.`, usedTool: "open_app" };
    }
  }
  const searchM = t.match(SEARCH_RE);
  if (searchM) {
    return { reply: `Searching the web for ${searchM[1].trim()}.`, usedTool: "search_web" };
  }
  const who = /who are you|what can you do|help|hi jarvis|hello jarvis|hey jarvis/.test(t);
  if (who) return { reply: INTRO };
  if (/goodbye|good night|go to sleep|stand by|shut down|bye/.test(t)) {
    return { reply: `Goodbye, sir. I'll be here if you need me.` };
  }

  return { reply: "" };
}

export class Brain {
  hasLLM: boolean;

  constructor() {
    this.hasLLM = Boolean(config.openai.apiKey);
  }

  async respond(text: string, history: ConvoMsg[]): Promise<ConvoMsg> {
    if (!this.hasLLM) {
      const f = fallback(text);
      if (f.usedTool) {
        const result = await runTool(f.usedTool, this.toolArgs(f.usedTool, text));
        return { role: "assistant", content: this.buildReply(f.usedTool, f.reply, result) };
      }
      return { role: "assistant", content: f.reply };
    }
    return this.llmRespond(text, history);
  }

  private toolArgs(name: string, text: string): Record<string, unknown> {
    if (name === "open_app") {
      const m = text.toLowerCase().match(/open\s+(?:the\s+)?([a-z0-9 .\-']+)/);
      return { app: m ? m[1].replace(/\.app$/, "").trim() : "Finder" };
    }
    if (name === "search_web") {
      return { query: searchQuery(text) };
    }
    if (name === "set_volume") {
      const v = text.toLowerCase().match(/volume\s+(?:to\s+|at\s+)?(\d{1,3})/);
      return { level: v ? v[1] : "50" };
    }
    return {};
  }

  private buildReply(tool: string, fallbackReply: string, result: string): string {
    switch (tool) {
      case "get_time":
        return `The time is ${result}.`;
      case "get_date":
        return `Today is ${result}.`;
      case "get_battery":
        return `Battery is at ${result}.`;
      case "set_volume":
      case "open_app":
      case "search_web":
        return result;
      default:
        return fallbackReply;
    }
  }

  private async llmRespond(text: string, history: ConvoMsg[]): Promise<ConvoMsg> {
    const messages: ConvoMsg[] = [
      { role: "system", content: config.systemPrompt },
      ...history.slice(-10),
      { role: "user", content: text },
    ];

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${config.openai.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.model,
          messages,
          tools: toolSchemas(),
          tool_choice: "auto",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { role: "assistant", content: `I ran into a problem talking to my language model (${res.status}). ${body.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        choices: { message: ConvoMsg }[];
      };
      const msg = data.choices[0]?.message;

      const calls = (msg.tool_calls as { id: string; function: { name: string; arguments: string } }[]) ?? [];
      if (calls.length === 0) {
        return { role: "assistant", content: msg.content ?? "" };
      }

      messages.push(msg);
      for (const call of calls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsed = {};
        }
        const result = await runTool(call.function.name, parsed);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: result,
        });
      }
    }
    return { role: "assistant", content: "I'm having trouble with that request." };
  }
}
