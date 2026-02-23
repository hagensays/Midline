*non of this is written by hand*

# Midline

Midline is a browser-based horizontal auto-scroll reader.

## Features
- Paste text and stream it right to left
- Load `.txt` files from `./.txt sources`
- Adjustable speed and font size
- Loop mode
- Theme button with saved preference
- Space key toggles Start/Pause

## One-Click Launch (Windows)
1. Double-click `Open Midline.bat`
2. It starts the local server in the background and opens `http://127.0.0.1:5173`

To stop the background server, double-click `Stop Midline.bat`.

## Manual Run
1. Open terminal in `Midline`
2. Start server:

```powershell
node server.js
```

3. Open:

```text
http://127.0.0.1:5173
```

Or use `run_midline.bat` to run the server in a visible console window.

## Notes
- Place your text files in `Midline/.txt sources`.
- Use `Refresh` in the app to reload the file list.
