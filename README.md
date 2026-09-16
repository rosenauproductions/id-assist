# ID Assist

Local instructional-design compiler. Brief → outline + filters + cost → human approval → artifacts + live tutor.

## Launch (embedded browser)

ID Assist can run as a **desktop window** (Electron) — no Chrome/Safari needed.

- Double-click **`ID Assist.app`** (or the Desktop shortcut)
- Or: `npm run desktop`
- Or double-click **`Launch ID Assist.command`**

The app starts the local server and opens the UI in its own window. Closing the window stops the server.

## Quick start (this machine = Ollama)

```bash
# 1. Ollama app running, with gpt-oss:20b already pulled
npm run ollama:setup

# 2. App (uses .env.local → id-assist-tutor)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Outline compiler: no LLM needed.
- Live tutor: local `id-assist-tutor` via Ollama (see `ollama/Modelfile`).
- `.env.local` stays on this machine and is gitignored.
- Wizard mode: [http://localhost:3000/wizard](http://localhost:3000/wizard)
