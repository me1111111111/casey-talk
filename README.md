# CASEY (VS Code project)
## WARNING this is a fanmade project

## Run Casey with Gemini

Casey uses Gemini through the local Node server so the API key is never sent to the browser.

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to a new key.
4. Start Casey with `npm start`.
5. Open `http://localhost:3000`.

The key must only be stored in `.env`, which is ignored by git. If an API key has been shared publicly, revoke it and create a replacement before running Casey.

Casey chooses a normal, excited, sad, or urgent delivery style for each Gemini response. She also receives your browser's local time and timezone. If you allow location access, the server retrieves current weather from Open-Meteo and includes it in her context.

Run Casey through `npm start` at `http://localhost:3000`; opening `index.html` directly will not provide the `/api/chat` server endpoint.

If PowerShell says `npm` is not recognized after installing Node.js, reopen PowerShell. You can also run the commands directly with:

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
cd "C:\Users\solso\Downloads\casey talk"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" start
```

Run each command separately. Do not paste `npm start` and `Copy-Item` on the same line.