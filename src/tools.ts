import { exec } from "node:child_process";
import { promisify } from "node:util";
import { osName, arch } from "./sys.js";

const run = promisify(exec);

export interface ToolParam {
  type: string;
  description?: string;
  enum?: string[];
  default?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  required?: string[];
  run: (args: Record<string, unknown>) => Promise<string>;
}

function dayName(offset: number): string {
  return new Date(Date.now() + offset * 86400000).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

async function findApp(name: string): Promise<string> {
  const { stdout } = await run(`ls -1 /Applications "$HOME/Applications" 2>/dev/null || true`);
  const apps = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\.app\/?$/.test(l))
    .map((l) => l.replace(/\/$/, "").slice(0, -4));
  const match = apps.find((a) => a.toLowerCase() === name.toLowerCase());
  return match ?? name;
}

export const tools: Tool[] = [
  {
    name: "get_time",
    description: "Get the current local time on this Mac.",
    parameters: {},
    run: async () => new Date().toLocaleTimeString("en-US"),
  },
  {
    name: "get_date",
    description: "Get today's date.",
    parameters: {},
    run: async () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
  },
  {
    name: "get_battery",
    description: "Get the Mac's battery level and charging state.",
    parameters: {},
    run: async () => {
      try {
        const { stdout } = await run("pmset -g batt");
        const m = stdout.match(/(\d+)%/);
        const charging = stdout.includes("charging") || stdout.includes("AC attached");
        return `${m ? m[1] + "%" : "unknown"}${charging ? " (charging)" : ""}`;
      } catch {
        return "Battery status unavailable.";
      }
    },
  },
  {
    name: "system_info",
    description: "Get OS and hardware info about this Mac.",
    parameters: {},
    run: async () => `${osName()} ${arch}`,
  },
  {
    name: "open_app",
    description: "Open or activate a macOS application by name (e.g. 'Safari', 'Finder', 'Music').",
    parameters: {
      app: { type: "string", description: "The application name as it appears in /Applications" },
    },
    required: ["app"],
    run: async ({ app }) => {
      const name = String(app).replace(/"/g, "");
      const target = await findApp(name);
      try {
        await run(`open -a "${target}"`);
        return `Opened ${target}.`;
      } catch {
        const url = `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`;
        await run(`open "${url}"`);
        return `I couldn't find an app named ${name}, so I opened ${url} in your browser instead.`;
      }
    },
  },
  {
    name: "open_url",
    description: "Open a URL in the default web browser.",
    parameters: {
      url: { type: "string", description: "The full URL to open (e.g. https://example.com)" },
    },
    required: ["url"],
    run: async ({ url }) => {
      await run(`open "${String(url).replace(/"/g, "")}"`);
      return `Opened ${url}.`;
    },
  },
  {
    name: "search_web",
    description: "Search the web. Opens results in the browser and returns a summary.",
    parameters: {
      query: { type: "string", description: "The search query" },
    },
    required: ["query"],
    run: async ({ query }) => {
      const q = encodeURIComponent(String(query));
      await run(`open "https://duckduckgo.com/?q=${q}"`);
      return `Searched the web for "${query}".`;
    },
  },
  {
    name: "set_volume",
    description: "Set the Mac output volume (0-100).",
    parameters: {
      level: { type: "string", description: "Volume level 0-100" },
    },
    required: ["level"],
    run: async ({ level }) => {
      const n = Math.max(0, Math.min(100, parseInt(String(level), 10)));
      await run(`osascript -e 'set volume output volume ${n}'`);
      return `Volume set to ${n}%.`;
    },
  },
  {
    name: "say_text",
    description: "Speak some text aloud using text-to-speech.",
    parameters: {
      text: { type: "string", description: "The text to speak" },
    },
    required: ["text"],
    run: async ({ text }) => String(text),
  },
  {
    name: "day_name",
    description: "Get which day of the week a day from today is.",
    parameters: {
      offset: { type: "string", description: "Days from today (0 = today, 1 = tomorrow, -1 = yesterday)" },
    },
    run: async ({ offset }) => dayName(parseInt(String(offset ?? 0), 10)),
  },
];

export const toolMap: Map<string, Tool> = new Map(tools.map((t) => [t.name, t]));

export function toolSchemas() {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.parameters,
        required: t.required ?? [],
      },
    },
  }));
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = toolMap.get(name);
  if (!tool) return `Tool "${name}" not found.`;
  try {
    return await tool.run(args);
  } catch (e) {
    return `Error running ${name}: ${e instanceof Error ? e.message : String(e)}`;
  }
}
