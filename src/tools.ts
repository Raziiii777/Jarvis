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
  {
    name: "scan_network",
    description: "Scan the local network for connected devices (computers, phones, cameras, routers).",
    parameters: {},
    run: async () => {
      try {
        const { stdout: ifconfig } = await run("ifconfig | grep 'inet ' | grep -v 127.0.0.1 | head -1");
        const ipMatch = ifconfig.match(/inet\s+(\d+\.\d+\.\d+)\./);
        if (!ipMatch) return "Could not detect local network.";
        const subnet = ipMatch[1];
        
        const devices: string[] = [];
        const scanPromises = [];
        
        for (let i = 1; i <= 254; i++) {
          const ip = `${subnet}.${i}`;
          scanPromises.push(
            run(`ping -c 1 -W 100 ${ip} 2>/dev/null && echo "ALIVE:${ip}" || true`)
              .catch(() => null)
          );
        }
        
        const results = await Promise.all(scanPromises);
        for (const result of results) {
          if (result?.stdout?.includes("ALIVE:")) {
            const ip = result.stdout.match(/ALIVE:(\S+)/)?.[1];
            if (ip) {
              try {
                const { stdout: mac } = await run(`arp -n ${ip} 2>/dev/null | tail -1 | awk '{print $3}'`);
                const { stdout: host } = await run(`nslookup ${ip} 2>/dev/null | grep name | awk '{print $NF}'`);
                devices.push(`${ip} | MAC: ${mac.trim() || 'unknown'} | Host: ${host.trim() || 'unknown'}`);
              } catch {
                devices.push(`${ip}`);
              }
            }
          }
        }
        
        return devices.length > 0 
          ? `Found ${devices.length} devices:\n${devices.join('\n')}`
          : "No devices found on network.";
      } catch (e) {
        return `Network scan error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    name: "ping_host",
    description: "Ping a host to check if it's online and get response time.",
    parameters: {
      host: { type: "string", description: "IP address or hostname to ping" },
    },
    required: ["host"],
    run: async ({ host }) => {
      try {
        const { stdout } = await run(`ping -c 4 ${host} 2>/dev/null`);
        const avg = stdout.match(/avg.*=.*\/(\d+\.?\d*)/)?.[1];
        return `${host} is online. Average latency: ${avg || 'unknown'}ms`;
      } catch {
        return `${host} is offline or unreachable.`;
      }
    },
  },
  {
    name: "get_public_ip",
    description: "Get the public IP address of this machine.",
    parameters: {},
    run: async () => {
      try {
        const { stdout } = await run("curl -s ifconfig.me");
        return `Public IP: ${stdout.trim()}`;
      } catch {
        return "Could not retrieve public IP.";
      }
    },
  },
  {
    name: "add_camera",
    description: "Add a CCTV/RTSP camera to the surveillance system.",
    parameters: {
      name: { type: "string", description: "Camera name (e.g., Front Door)" },
      url: { type: "string", description: "RTSP stream URL (e.g., rtsp://192.168.1.100:554/stream)" },
    },
    required: ["name", "url"],
    run: async ({ name, url }) => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const camerasFile = path.join(process.cwd(), "cameras.json");
      
      let cameras: {name: string; url: string; addedAt: string}[] = [];
      try {
        const data = await fs.readFile(camerasFile, "utf8");
        cameras = JSON.parse(data);
      } catch {}
      
      cameras.push({ name: String(name), url: String(url), addedAt: new Date().toISOString() });
      await fs.writeFile(camerasFile, JSON.stringify(cameras, null, 2));
      return `Camera "${name}" added successfully.`;
    },
  },
  {
    name: "list_cameras",
    description: "List all configured CCTV cameras.",
    parameters: {},
    run: async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const camerasFile = path.join(process.cwd(), "cameras.json");
      
      try {
        const data = await fs.readFile(camerasFile, "utf8");
        const cameras = JSON.parse(data);
        if (cameras.length === 0) return "No cameras configured.";
        return cameras.map((c: {name: string; url: string}, i: number) => `${i+1}. ${c.name} — ${c.url}`).join("\n");
      } catch {
        return "No cameras configured.";
      }
    },
  },
  {
    name: "check_camera",
    description: "Check if a camera stream is reachable.",
    parameters: {
      url: { type: "string", description: "RTSP stream URL to check" },
    },
    required: ["url"],
    run: async ({ url }) => {
      try {
        await run(`curl -s --max-time 5 "${url}" 2>/dev/null`);
        return `Camera at ${url} is reachable.`;
      } catch {
        return `Camera at ${url} is unreachable or timed out.`;
      }
    },
  },
  {
    name: "trace_route",
    description: "Trace the route to a host to see network hops.",
    parameters: {
      host: { type: "string", description: "IP address or hostname to trace" },
    },
    required: ["host"],
    run: async ({ host }) => {
      try {
        const { stdout } = await run(`traceroute -m 10 ${host} 2>/dev/null`);
        return `Route to ${host}:\n${stdout}`;
      } catch (e) {
        return `Trace failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    name: "wiki_search",
    description: "Search Wikipedia for any topic and get a summary.",
    parameters: {
      query: { type: "string", description: "Topic to search on Wikipedia" },
    },
    required: ["query"],
    run: async ({ query }) => {
      try {
        const q = encodeURIComponent(String(query));
        const { stdout } = await run(`curl -s "https://en.wikipedia.org/api/rest_v1/page/summary/${q}" 2>/dev/null`);
        const data = JSON.parse(stdout);
        return data.extract ? `**${data.title}**: ${data.extract}` : `No Wikipedia article found for "${query}".`;
      } catch {
        return `Could not fetch Wikipedia data for "${query}".`;
      }
    },
  },
  {
    name: "calculate",
    description: "Calculate math expressions. Supports +, -, *, /, ^, sqrt, sin, cos, tan, log, etc.",
    parameters: {
      expression: { type: "string", description: "Math expression to evaluate (e.g., '2+2', 'sqrt(144)', 'sin(3.14)')" },
    },
    required: ["expression"],
    run: async ({ expression }) => {
      try {
        const expr = String(expression)
          .replace(/\^/g, '**')
          .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
          .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
          .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
          .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
          .replace(/log\(([^)]+)\)/g, 'Math.log($1)')
          .replace(/pi/gi, 'Math.PI')
          .replace(/e(?![a-z])/gi, 'Math.E');
        const result = new Function(`return ${expr}`)();
        return `${expression} = ${result}`;
      } catch {
        return `Could not calculate "${expression}". Check the syntax.`;
      }
    },
  },
  {
    name: "web_fetch",
    description: "Fetch and read content from any URL.",
    parameters: {
      url: { type: "string", description: "URL to fetch content from" },
    },
    required: ["url"],
    run: async ({ url }) => {
      try {
        const { stdout } = await run(`curl -sL --max-time 10 "${String(url).replace(/"/g, "")}" 2>/dev/null | head -c 3000`);
        return stdout || "Could not fetch content from URL.";
      } catch {
        return "Failed to fetch URL content.";
      }
    },
  },
  {
    name: "run_code",
    description: "Execute JavaScript code and return the result.",
    parameters: {
      code: { type: "string", description: "JavaScript code to execute" },
    },
    required: ["code"],
    run: async ({ code }) => {
      try {
        const { stdout, stderr } = await run(`node -e "${String(code).replace(/"/g, '\\"').replace(/\n/g, '\\n')}" 2>&1`);
        return stdout || stderr || "Code executed with no output.";
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    name: "get_weather_detail",
    description: "Get detailed weather for any city worldwide.",
    parameters: {
      city: { type: "string", description: "City name (e.g., 'London', 'New York', 'Tokyo')" },
    },
    required: ["city"],
    run: async ({ city }) => {
      try {
        const { stdout: geoData } = await run(`curl -s "https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(String(city))}&count=1" 2>/dev/null`);
        const geo = JSON.parse(geoData);
        if (!geo.results?.[0]) return `City "${city}" not found.`;
        const { latitude, longitude, name, country } = geo.results[0];
        const { stdout: wxData } = await run(`curl -s "https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto" 2>/dev/null`);
        const wx = JSON.parse(wxData);
        const c = wx.current;
        const WMO = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 51: "Light drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 71: "Slight snow", 80: "Showers", 95: "Thunderstorm" };
        return `**${name}, ${country}**\n🌡️ ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C)\n☁️ ${WMO[c.weather_code] || "Unknown"}\n💧 Humidity: ${c.relative_humidity_2m}%\n💨 Wind: ${c.wind_speed_10m} km/h\n🌧️ Precipitation: ${c.precipitation}mm`;
      } catch {
        return `Could not fetch weather for "${city}".`;
      }
    },
  },
  {
    name: "screenshot",
    description: "Take a screenshot of the current screen.",
    parameters: {},
    run: async () => {
      try {
        const path = `/tmp/jarvis-screenshot-${Date.now()}.png`;
        await run(`screencapture -x "${path}"`);
        return `Screenshot saved to ${path}`;
      } catch {
        return "Could not take screenshot.";
      }
    },
  },
  {
    name: "list_files",
    description: "List files in a directory.",
    parameters: {
      path: { type: "string", description: "Directory path (default: home)" },
    },
    run: async ({ path: dir }) => {
      try {
        const target = String(dir || "~").replace(/"/g, "");
        const { stdout } = await run(`ls -la "${target}" 2>/dev/null | head -30`);
        return stdout || "Directory not found or empty.";
      } catch {
        return "Could not list directory.";
      }
    },
  },
  {
    name: "disk_usage",
    description: "Check disk usage for a path.",
    parameters: {
      path: { type: "string", description: "Path to check (default: /)" },
    },
    run: async ({ path: dir }) => {
      try {
        const target = String(dir || "/").replace(/"/g, "");
        const { stdout } = await run(`df -h "${target}" 2>/dev/null | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        return `Disk: ${parts[0]} | Total: ${parts[1]} | Used: ${parts[2]} (${parts[4]}) | Avail: ${parts[3]}`;
      } catch {
        return "Could not check disk usage.";
      }
    },
  },
  {
    name: "process_list",
    description: "List running processes sorted by CPU or memory usage.",
    parameters: {
      sort: { type: "string", description: "Sort by: 'cpu' or 'memory' (default: cpu)", enum: ["cpu", "memory"] },
    },
    run: async ({ sort }) => {
      try {
        const sortBy = sort === "memory" ? "-m" : "-r";
        const { stdout } = await run(`ps aux --sort=${sortBy === "-m" ? "%mem" : "%cpu"} 2>/dev/null | head -11 || top -l 1 -o cpu -n 10 2>/dev/null`);
        return stdout || "Could not list processes.";
      } catch {
        return "Could not list processes.";
      }
    },
  },
  {
    name: "translate_text",
    description: "Translate text between languages using a free API.",
    parameters: {
      text: { type: "string", description: "Text to translate" },
      to: { type: "string", description: "Target language code (e.g., 'es', 'fr', 'de', 'ja', 'zh', 'hi', 'ar')" },
    },
    required: ["text", "to"],
    run: async ({ text, to }) => {
      try {
        const { stdout } = await run(`curl -s "https://api.mymemory.translated.net/get?q=${encodeURIComponent(String(text))}&langpair=en|${String(to)}" 2>/dev/null`);
        const data = JSON.parse(stdout);
        return data.responseData?.translatedText ? `Translation (${to}): ${data.responseData.translatedText}` : "Translation failed.";
      } catch {
        return "Translation service unavailable.";
      }
    },
  },
  {
    name: "stock_price",
    description: "Get current stock price for any ticker symbol.",
    parameters: {
      symbol: { type: "string", description: "Stock ticker (e.g., 'AAPL', 'GOOGL', 'TSLA', 'BTC-USD')" },
    },
    required: ["symbol"],
    run: async ({ symbol }) => {
      try {
        const { stdout } = await run(`curl -s "https://query1.finance.yahoo.com/v8/finance/chart/${String(symbol).toUpperCase()}?range=1d&interval=1d" -H "User-Agent: Mozilla/5.0" 2>/dev/null`);
        const data = JSON.parse(stdout);
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return `Could not fetch price for ${symbol}.`;
        const price = meta.regularMarketPrice?.toFixed(2);
        const prev = meta.chartPreviousClose || meta.previousClose;
        const change = prev ? (((price - prev) / prev) * 100).toFixed(2) : "0";
        return `**${symbol.toUpperCase()}**: $${price} (${change >= 0 ? "+" : ""}${change}%)`;
      } catch {
        return `Could not fetch price for ${symbol}.`;
      }
    },
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
