<img width="846" height="885" alt="Screenshot 2026-08-18 at 4 42 24 PM" src="https://github.com/user-attachments/assets/93b0f572-7a6b-4d0f-84ba-5eadf231a7e7" />
# JARVIS

A real-time AI voice assistant for macOS featuring a 3D holographic interface, natural language conversations, and full system control.

![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-3D-blueviolet?logo=three.js)
![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Demo

> Screenshot coming soon — run `npm start` and open http://127.0.0.1:4173 to see it live.

## Features

- **Natural Conversations** — powered by Groq's LLM API (gpt-oss-120b) with tool-calling support
- **Voice Recognition** — always-on listening with wake-word detection ("Hey Jarvis") and push-to-talk
- **3D Holographic UI** — wireframe icosahedrons, orbiting rings, 3,000+ reactive particles, GLSL portrait shader
- **macOS System Control** — open apps, check battery, set volume, web search, system info
- **Dark Glassmorphism Design** — frosted glass panels, animated scanlines, floating particles
- **Text-to-Speech** — replies spoken aloud via macOS `say` command
- **Echo Prevention** — blocks mic input while assistant is speaking to prevent feedback loops

## Architecture

```
Browser (Client)                    Server (Node.js)
┌─────────────────────┐            ┌──────────────────────┐
│  Web Speech API     │◄──WS──────►│  WebSocket Handler   │
│  Three.js 3D Scene  │            │  Brain (Groq LLM)    │
│  Glassmorphism UI   │            │  Tool Executor       │
│  TTS (macOS say)    │            │  TTS Engine          │
└─────────────────────┘            └──────────────────────┘
```

## Quick Start

```bash
# Clone the repo
git clone https://github.com/Raziiii777/Jarvis.git
cd Jarvis

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# Add your Groq API key (free at console.groq.com)

# Start Jarvis
npm start
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173) in Safari or Chrome.

## Configuration

Create a `.env` file in the project root:

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
├── index.ts        # Entry point — boots server + tools
├── config.ts       # Environment config loader
├── brain.ts        # LLM brain (Groq) + local fallback
├── server.ts       # HTTP + WebSocket server
├── tts.ts          # Text-to-speech (macOS say / OpenAI)
├── tools.ts        # macOS system tools (8 commands)
├── sys.ts          # OS detection
└── public/
    ├── index.html  # Dashboard layout
    ├── styles.css  # Dark glass UI + animations
    ├── app.js      # Client voice + WebSocket + controls
    ├── scene.js    # 3D hologram (Three.js + GLSL)
    └── model.jpg   # Holographic portrait image
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
| **TypeScript / Node.js** | Server runtime |
| **Groq API** | LLM brain (free tier) |
| **Three.js** | 3D holographic rendering |
| **Web Speech API** | Browser voice recognition |
| **macOS `say`** | Text-to-speech |
| **WebSocket** | Real-time client-server |
| **CSS3** | Glassmorphism + animations |

## License

MIT
