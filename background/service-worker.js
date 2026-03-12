// ==========================================================================
// clipmunk – background service worker
// handles context menus and keyboard shortcut commands
// ==========================================================================

const STORAGE_KEY = 'clipmunk_templates';
const MENU_PREFIX = 'clipmunk-template-';

// ---------------------------------------------------------------------------
// context menus
// ---------------------------------------------------------------------------

async function rebuildContextMenus() {
  await chrome.contextMenus.removeAll();

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const templates = data[STORAGE_KEY] || [];

  if (templates.length === 0) {
    return;
  }

  chrome.contextMenus.create({
    id: 'clipmunk-parent',
    title: 'Clipmunk – Paste',
    contexts: ['editable'],
  });

  const maxMenuItems = 20;
  const count = Math.min(templates.length, maxMenuItems);

  for (let i = 0; i < count; i++) {
    const t = templates[i];
    const label = t.title || `Template ${i + 1}`;
    chrome.contextMenus.create({
      id: MENU_PREFIX + t.id,
      parentId: 'clipmunk-parent',
      title: `${i + 1}. ${label}`,
      contexts: ['editable'],
    });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.menuItemId.startsWith(MENU_PREFIX)) {
    return;
  }

  const templateId = info.menuItemId.slice(MENU_PREFIX.length);
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const templates = data[STORAGE_KEY] || [];
  const t = templates.find((t) => t.id === templateId);

  if (!t || !t.content || !tab || !tab.id) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertText,
      args: [t.content],
    });
  } catch {
    // fallback: copy to clipboard via scripting
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: copyToClipboard,
        args: [t.content],
      });
    } catch {
      // silently fail if tab is not scriptable (e.g. chrome:// pages)
    }
  }
});

// injected into the active tab to insert text at cursor
function insertText(text) {
  const el = document.activeElement;
  if (!el) {
    return;
  }

  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.selectionStart = start + text.length;
    el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (el.isContentEditable) {
    document.execCommand('insertText', false, text);
    return;
  }

  navigator.clipboard.writeText(text);
}

// injected into the active tab as clipboard fallback
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

// ---------------------------------------------------------------------------
// keyboard commands
// ---------------------------------------------------------------------------

chrome.commands.onCommand.addListener(async (command) => {
  const match = command.match(/^copy-template-(\d+)$/);
  if (!match) {
    return;
  }

  const index = parseInt(match[1], 10) - 1;
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const templates = data[STORAGE_KEY] || [];

  if (index < 0 || index >= templates.length) {
    return;
  }

  const t = templates[index];
  if (!t || !t.content) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyToClipboard,
      args: [t.content],
    });
  } catch {
    // silently fail for non-scriptable pages
  }
});

// ---------------------------------------------------------------------------
// preset templates (seeded on first install only)
// ---------------------------------------------------------------------------

const PRESET_TEMPLATES = [
  {
    title: 'Polite Reply',
    content: 'Hi,\n\nThank you for reaching out. I appreciate your message and will get back to you shortly.\n\nBest regards',
  },
  {
    title: 'Meeting Follow-up',
    content: 'Hi team,\n\nThanks for the productive meeting today. Here is a quick summary:\n\n- Action items:\n  1. \n  2. \n\n- Next steps:\n  \n\nPlease let me know if I missed anything.',
  },
  {
    title: 'Bug Report',
    content: '## Bug Report\n\n**Environment:** \n**Version:** \n\n**Steps to reproduce:**\n1. \n2. \n3. \n\n**Expected behavior:**\n\n**Actual behavior:**\n\n**Screenshots:**\n',
  },
  {
    title: 'Shipping Address',
    content: '[Your Name]\n[Street Address]\n[City, State ZIP]\n[Country]\n[Phone]',
  },
];

async function seedPresets() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (data[STORAGE_KEY] && data[STORAGE_KEY].length > 0) {
    return;
  }

  const now = Date.now();
  const seeded = PRESET_TEMPLATES.map((t, i) => ({
    id: crypto.randomUUID(),
    title: t.title,
    content: t.content,
    createdAt: now + i,
    updatedAt: now + i,
  }));

  await chrome.storage.local.set({ [STORAGE_KEY]: seeded });
}

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await seedPresets();
  }
  rebuildContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  rebuildContextMenus();
});

// rebuild context menus when templates change
chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) {
    rebuildContextMenus();
  }
});
