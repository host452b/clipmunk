# Clipmunk

```
               CLIPMUNK
            ░░██████████░░
         ░██▓▓▓▓▓▓▓▓▓▓▓▓██░
       ░██▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓██░
      ░██▓▓▓▓▓▓░░░░░░░░▓▓▓▓██░
     ░██▓▓▓▓░░░░░░░░░░░░░░▓▓██░
     ██▓▓▓░░░░░●░░░░░●░░░░░░▓▓██
     ██▓▓░░░░░░░░░░▓▓░░░░░░░░▓▓██
     ██▓▓░░░░░░░░▓▓▓▓▓▓░░░░░░▓▓██
      ██▓▓░░░░░░▓▓▓▓▓▓▓▓░░░░▓▓██
      ░██▓▓░░░░░░░▓▓▓▓░░░░░░▓▓██░
       ░██▓▓▓░░░░░░░░░░░░░░▓▓██░
         ░██▓▓▓▓▓▓▓▓▓▓▓▓▓▓██░
           ░░████████████░░

     ◆ clip(board) + chip(munk)
     ◆ store in cheeks, paste on key
```

A chipmunk-fast Chrome extension paste toolbox with retro-futuristic 16-bit UI.

Store text templates, paste them anywhere with a click or hotkey.

**100% Local-First. Zero network. Zero tracking. Your data never leaves your machine.**

## Features

- **Unlimited templates** — add as many as you need
- **Preset templates** — ships with ready-to-use templates (polite reply, meeting follow-up, bug report, address) so you can start pasting immediately
- **One-click copy** — CPY button copies template to clipboard
- **Global hotkeys** — `Ctrl+Shift+1/2/3/4` (or `⌘⇧1/2/3/4` on macOS) for the first 4 templates
- **Right-click paste** — context menu inserts templates directly into text fields
- **Search** — filter templates by title or content (`Ctrl+F` / `⌘F`)
- **Import / Export** — backup and transfer templates as JSON
- **Retro-futurism 16-bit** dot-matrix CRT interface

## Privacy & Local-First

Clipmunk is built on a strict local-first principle:

- **No server, no cloud, no sync** — all data lives in `chrome.storage.local` on your device
- **No account, no sign-up** — install and use, nothing else required
- **No analytics, no telemetry** — zero tracking code, zero network requests
- **No remote dependencies** — the extension works fully offline
- **Open source** — every line of code is auditable in this repo

Your templates are yours. Period.

## Install (Developer Mode)

1. Generate icons:
   - Open `icons/generate.html` in Chrome
   - Click **DOWNLOAD** for each size (16, 32, 48, 128)
   - Save them as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` in the `icons/` folder

2. Load the extension:
   ```
   1. Open chrome://extensions
   2. Enable "Developer mode" (top right)
   3. Click "Load unpacked"
   4. Select this project folder
   ```

3. Pin the Clipmunk icon in the toolbar for quick access.

## How It Works

1. Click the Clipmunk icon to open the popup
2. Click **+ ADD** to create a template (title + content)
3. Click **CPY** to copy a template to clipboard, then `Ctrl+V` to paste
4. Or use hotkeys `Ctrl+Shift+1–4` to copy the first 4 templates without opening the popup
5. Or right-click a text field → **Clipmunk – Paste** → select a template to insert directly

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+1` / `⌘⇧1` | Copy template #1 |
| `Ctrl+Shift+2` / `⌘⇧2` | Copy template #2 |
| `Ctrl+Shift+3` / `⌘⇧3` | Copy template #3 |
| `Ctrl+Shift+4` / `⌘⇧4` | Copy template #4 |
| `Ctrl+F` / `⌘F` | Focus search (in popup) |
| `Escape` | Collapse editor (in popup) |

Customize shortcuts at `chrome://extensions/shortcuts`.

## Project Structure

```
clipmunk/
├── manifest.json              # Chrome extension manifest (V3)
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Retro-futurism design system
│   └── popup.js               # Popup logic (CRUD, search, clipboard)
├── background/
│   └── service-worker.js      # Context menus, keyboard commands
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Privacy Policy

Clipmunk does **not** collect, transmit, or share any user data. All templates you create are stored exclusively in your browser's local storage (`chrome.storage.local`) and never leave your device.

- **Data collected:** None.
- **Data transmitted:** None. The extension makes zero network requests.
- **Third-party services:** None. No analytics, no telemetry, no ads.
- **Permissions used:** `storage` (save templates locally), `clipboardWrite` (copy templates), `contextMenus` (right-click paste), `activeTab` + `scripting` (insert text into the active page when you use a hotkey or context menu).

If you uninstall Clipmunk, all stored data is automatically deleted by Chrome.

## License

MIT
