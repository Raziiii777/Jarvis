<img width="1704" height="1023" alt="Screenshot 2026-09-09 at 12 13 41 AM" src="https://github.com/user-attachments/assets/f02bb7af-727f-42ed-85f9-fe755adbcab7" />


# JARVIS

A real-time AI voice assistant for macOS featuring a 3D holographic command center, natural language conversations, and integrated system control.

![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-3D-blueviolet?logo=three.js)
![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Demo

> Screenshot coming soon — run `npm start` and open http://127.0.0.1:4173 to see it live.

## Features

- **Natural Language Conversations** — powered by Groq's LLM API (`gpt-oss-120b`) with structured tool-calling support for task execution.
- **Voice Recognition** — always-on listening with wake-word detection ("Hey Jarvis") and push-to-talk functionality.
- **3D Holographic Interface** — real-time Matrix-style particle rain with connecting neural lines, orbiting nodes, and voice-reactive animation, rendered via Three.js.
- **Global Dashboard** — integrated world map, live weather across major cities, US market data, tech news aggregation, and breaking news feeds.
- **macOS System Control** — open applications, check battery status, adjust volume, perform web searches, and retrieve system diagnostics.
- **Dark Glassmorphism Design** — frosted glass panels, animated scanlines, and ambient particle effects.
- **Text-to-Speech** — responses spoken aloud via macOS `say` command with configurable voice and rate.
- **Multi-Language Support** — interface available in English, Hindi, Urdu, Chinese, and Japanese.
- **Echo Prevention** — intelligent input blocking during assistant speech to prevent feedback loops.

## Architecture

```
Browser (Client)                    Server (Node.js)
┌─────────────────────┐            ┌──────────────────────┐
│  Web Speech API     │◄──WS──────►│  WebSocket Handler   │
│  Three.js 3D Scene  │            │  Brain (Groq LLM)    │
│  Leaflet.js Map     │            │  Tool Executor       │
│  Glassmorphism UI   │            │  RSS News Aggregator │
│  TTS (macOS say)    │            │  TTS Engine          │
└─────────────────────┘            └──────────────────────┘
```

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Raziiii777/Jarvis.git
cd Jarvis

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Add your Groq API key (free tier available at console.groq.com)

# Start the assistant
npm start
```

Then navigate to [http://127.0.0.1:4173](http://127.0.0.1:4173) in Safari or Chrome.

## Configuration

Create a `.env` file in the project root with the following variables:

```env
JARVIS_NAME=Jarvis
JARVIS_TTS=say
JARVIS_TTS_VOICE=Daniel
JARVIS_TTS_RATE=172
JARVIS_AUDIO_REPLY=true

OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=your_groq_api_key_here
OPENAI_MODEL=openai/gpt-oss-120b
```

## Project Structure

```
src/
├── index.ts        # Entry point — initializes server and tools
├── config.ts       # Environment configuration loader
├── brain.ts        # LLM integration (Groq) with local fallback logic
├── server.ts       # HTTP and WebSocket server with API endpoints
├── tts.ts          # Text-to-speech engine (macOS say / OpenAI)
├── tools.ts        # macOS system tool implementations (8 commands)
├── sys.ts          # OS detection utilities
└── public/
    ├── index.html  # Dashboard layout and markup
    ├── styles.css  # Dark glassmorphism UI and animations
    ├── app.js      # Client-side voice, WebSocket, and UI logic
    ├── scene.js    # 3D holographic renderer (Three.js)
    └── model.jpg   # Holographic portrait asset
```

## Available Voice Commands

| Command | Example |
|---------|---------|
| Time | "What time is it?" |
| Date | "What's the date today?" |
| Battery | "How's my battery?" |
| Open App | "Open Safari" / "Open YouTube" |
| Search | "Search the web for weather" |
| Volume | "Set volume to 40" |
| System Info | "Who are you?" |
| Goodbye | "Goodbye" / "Go to sleep" |

## Built With

| Technology | Purpose |
|-----------|---------|
| **TypeScript / Node.js** | Server runtime and type safety |
| **Groq API** | LLM brain with free-tier access |
| **Three.js** | 3D holographic rendering engine |
| **Leaflet.js** | Interactive world map |
| **Web Speech API** | Browser-based voice recognition |
| **macOS `say`** | Native text-to-speech |
| **WebSocket** | Real-time bidirectional communication |
| **RSS Feeds** | News and market data aggregation |
| **CSS3** | Glassmorphism effects and animations |

## License

MIT
