<img width="846" height="885" alt="Screenshot 2026-08-18 at 4 42 24 PM" src="https://github.com/user-attachments/assets/93b0f572-7a6b-4d0f-84ba-5eadf231a7e7" />
# JARVIS

A real-time AI voice assistant for macOS with a 3D holographic interface.

![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-3D-blueviolet?logo=three.js)

## Features

- **Natural Conversations** — powered by Groq's LLM API (llama/gpt-oss-120b)
- **Voice Recognition** — always-on listening with wake-word detection ("Hey Jarvis")
- **3D Holographic UI** — wireframe entity, orbiting rings, 3,000+ particles, all reactive to voice
- **macOS System Control** — open apps, check battery, set volume, web search
- **Dark Glassmorphism Design** — frosted glass panels, animated particles, scanlines
- **Push-to-Talk** — hold the mic button for manual control
- **Text-to-Speech** — replies spoken aloud via macOS `say` command

## Quick Start

```bash
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
├── index.ts        # Entry point
├── config.ts       # Environment config
├── brain.ts        # LLM integration + local fallback
├── server.ts       # HTTP + WebSocket server
├── tts.ts          # Text-to-speech (macOS say / OpenAI)
├── tools.ts        # macOS system tools
├── sys.ts          # OS detection
└── public/
    ├── index.html  # Dashboard
    ├── styles.css  # Dark glass UI
    ├── app.js      # Client voice + WebSocket
    ├── scene.js    # 3D hologram (Three.js)
    └── model.jpg   # Holographic portrait
```

## Built With

- **TypeScript / Node.js** — server runtime
- **Groq API** — LLM brain (free tier available)
- **Three.js** — 3D holographic rendering
- **Web Speech API** — browser voice recognition
- **macOS `say` command** — text-to-speech
- **WebSocket** — real-time client-server communication

## License

MIT
