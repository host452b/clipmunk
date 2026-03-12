// ==========================================================================
// clipmunk – chrome extension popup logic
// ==========================================================================

const STORAGE_KEY = 'clipmunk_templates';
const SAVE_DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------

let templates = [];
let activeTab = 'templates';
let expandedId = null;
let searchQuery = '';
let saveTimer = null;
let confirmingDeleteId = null;
let confirmDeleteTimer = null;

// ---------------------------------------------------------------------------
// DOM refs (resolved on init)
// ---------------------------------------------------------------------------

let $templateList;
let $searchInput;
let $btnAdd;
let $statusText;
let $statusLed;
let $templateCount;
let $toastContainer;
let $importFile;
let $settingsContent;

// ---------------------------------------------------------------------------
// storage
// ---------------------------------------------------------------------------

async function loadTemplates() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  templates = data[STORAGE_KEY] || [];
}

async function persistTemplates() {
  await chrome.storage.local.set({ [STORAGE_KEY]: templates });
}

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(async () => {
    await persistTemplates();
    updateStatusBar();
  }, SAVE_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// template CRUD
// ---------------------------------------------------------------------------

function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function addTemplate() {
  const now = Date.now();
  const t = {
    id: generateId(),
    title: '',
    content: '',
    createdAt: now,
    updatedAt: now,
  };
  templates.unshift(t);
  expandedId = t.id;
  scheduleSave();
  renderTemplateList();
  updateStatusBar();

  requestAnimationFrame(() => {
    const titleInput = document.querySelector(
      `.template-row[data-id="${t.id}"] .editor-input`
    );
    if (titleInput) {
      titleInput.focus();
    }
  });
}

function requestDelete(id) {
  if (confirmingDeleteId === id) {
    clearTimeout(confirmDeleteTimer);
    confirmingDeleteId = null;
    deleteTemplate(id);
    return;
  }

  if (confirmingDeleteId) {
    clearTimeout(confirmDeleteTimer);
    resetDeleteButton(confirmingDeleteId);
  }

  confirmingDeleteId = id;
  const btn = document.querySelector(`.template-row[data-id="${id}"] .btn-delete`);
  if (btn) {
    btn.textContent = 'SURE?';
    btn.classList.add('confirming');
  }

  confirmDeleteTimer = setTimeout(() => {
    resetDeleteButton(id);
    confirmingDeleteId = null;
  }, 3000);
}

function resetDeleteButton(id) {
  const btn = document.querySelector(`.template-row[data-id="${id}"] .btn-delete`);
  if (btn) {
    btn.textContent = 'DELETE';
    btn.classList.remove('confirming');
  }
}

function deleteTemplate(id) {
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) {
    return;
  }
  templates.splice(idx, 1);
  if (expandedId === id) {
    expandedId = null;
  }
  scheduleSave();
  renderTemplateList();
  updateStatusBar();
  showToast('DELETED');
}

const EDITABLE_FIELDS = new Set(['title', 'content']);

function updateTemplateField(id, field, value) {
  if (!EDITABLE_FIELDS.has(field)) {
    return;
  }
  const t = templates.find((t) => t.id === id);
  if (!t) {
    return;
  }
  t[field] = value;
  t.updatedAt = Date.now();
  scheduleSave();
}

async function copyTemplateContent(id) {
  const t = templates.find((t) => t.id === id);
  if (!t || !t.content) {
    showToast('EMPTY', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(t.content);
    showToast('COPIED');
  } catch {
    showToast('COPY FAILED', true);
  }
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

function getFilteredTemplates() {
  if (!searchQuery) {
    return templates;
  }
  const q = searchQuery.toLowerCase();
  return templates.filter((t) => {
    const titleMatch = t.title.toLowerCase().includes(q);
    const contentMatch = t.content.toLowerCase().includes(q);
    return titleMatch || contentMatch;
  });
}

// ---------------------------------------------------------------------------
// rendering – template list
// ---------------------------------------------------------------------------

function renderTemplateList() {
  const filtered = getFilteredTemplates();

  if (filtered.length === 0) {
    if (searchQuery) {
      $templateList.innerHTML = `
        <div class="template-list-empty">
          <div class="empty-icon">×</div>
          <div class="empty-text">NO MATCHES FOR "${escapeHtml(searchQuery.toUpperCase())}"</div>
        </div>`;
    } else {
      $templateList.innerHTML = `
        <div class="template-list-empty">
          <div class="empty-icon">◆</div>
          <div class="empty-text">NO TEMPLATES YET</div>
          <div class="empty-hint">CLICK [+ ADD] TO CREATE YOUR FIRST TEMPLATE</div>
        </div>`;
    }
    return;
  }

  $templateList.innerHTML = filtered.map((t, i) => renderTemplateRow(t, i)).join('');
  attachRowListeners();
}

function renderTemplateRow(t, index) {
  const isExpanded = expandedId === t.id;
  const hasContent = t.content.length > 0;
  const displayTitle = t.title || '---';
  const titleClass = t.title ? '' : ' empty';
  const expandedClass = isExpanded ? ' expanded' : '';

  const globalIndex = templates.indexOf(t);
  const hotkeyLabel = globalIndex < 4 ? getHotkeyLabel(globalIndex) : '';

  let preview = '';
  if (!isExpanded && hasContent) {
    preview = `
      <div class="row-preview">
        <div class="row-preview-inner">${escapeHtml(t.content)}</div>
      </div>`;
  }

  let editor = '';
  if (isExpanded) {
    editor = `
      <div class="row-editor">
        <div class="editor-field">
          <div class="editor-title-row">
            <span class="editor-label">TITLE</span>
            <input type="text" class="editor-input" data-field="title"
                   value="${escapeAttr(t.title)}" placeholder="enter title..."
                   spellcheck="false">
          </div>
        </div>
        <div class="editor-field">
          <span class="editor-label">CONTENT</span>
          <textarea class="editor-textarea" data-field="content"
                    placeholder="enter template content..."
                    spellcheck="false">${escapeHtml(t.content)}</textarea>
        </div>
        <div class="editor-actions">
          <button class="retro-btn danger compact btn-delete">DELETE</button>
        </div>
      </div>`;
  }

  return `
    <div class="template-row${expandedClass}" data-id="${t.id}">
      <div class="row-header">
        <span class="row-expand">${isExpanded ? '▾' : '▸'}</span>
        <span class="badge${hasContent ? ' active' : ''}">${globalIndex + 1}</span>
        <span class="row-title${titleClass}">${escapeHtml(displayTitle)}</span>
        <div class="row-actions">
          ${hotkeyLabel ? `<span class="hotkey-chip">${hotkeyLabel}</span>` : ''}
          <button class="retro-btn compact btn-copy"${hasContent ? '' : ' disabled'}>CPY</button>
        </div>
      </div>
      ${preview}
      ${editor}
    </div>`;
}

function isMacPlatform() {
  if (navigator.userAgentData && navigator.userAgentData.platform) {
    return navigator.userAgentData.platform === 'macOS';
  }
  return /mac/i.test(navigator.platform || '');
}

function getHotkeyLabel(index) {
  const mod = isMacPlatform() ? '⌘⇧' : 'Ctrl+Shift+';
  return mod + (index + 1);
}

function attachRowListeners() {
  document.querySelectorAll('.template-row').forEach((row) => {
    const id = row.dataset.id;

    row.querySelector('.row-header').addEventListener('click', (e) => {
      if (e.target.closest('.btn-copy')) {
        return;
      }
      toggleExpand(id);
    });

    const copyBtn = row.querySelector('.btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTemplateContent(id);
      });
    }

    const deleteBtn = row.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => requestDelete(id));
    }

    const titleInput = row.querySelector('.editor-input[data-field="title"]');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        updateTemplateField(id, 'title', e.target.value);
        const titleSpan = row.querySelector('.row-title');
        if (titleSpan) {
          titleSpan.textContent = e.target.value || '---';
          if (e.target.value) {
            titleSpan.classList.remove('empty');
          } else {
            titleSpan.classList.add('empty');
          }
        }
      });
    }

    const contentArea = row.querySelector('.editor-textarea[data-field="content"]');
    if (contentArea) {
      contentArea.addEventListener('input', (e) => {
        updateTemplateField(id, 'content', e.target.value);
        const copyBtnRef = row.querySelector('.btn-copy');
        if (copyBtnRef) {
          copyBtnRef.disabled = !e.target.value;
        }
        const badgeEl = row.querySelector('.badge');
        if (badgeEl) {
          if (e.target.value) {
            badgeEl.classList.add('active');
          } else {
            badgeEl.classList.remove('active');
          }
        }
      });
    }
  });
}

function toggleExpand(id) {
  if (expandedId === id) {
    expandedId = null;
  } else {
    expandedId = id;
  }
  renderTemplateList();
}

// ---------------------------------------------------------------------------
// rendering – settings
// ---------------------------------------------------------------------------

function renderSettings() {
  const shortcutItems = templates.slice(0, 4).map((t, i) => {
    const title = t.title || `Slot ${i + 1}`;
    const label = getHotkeyLabel(i);
    return `
      <div class="shortcut-item">
        <span class="badge amber">${i + 1}</span>
        <span class="shortcut-title">${escapeHtml(title)}</span>
        <span class="hotkey-chip">${label}</span>
      </div>`;
  }).join('');

  const placeholders = [];
  for (let i = templates.length; i < 4; i++) {
    placeholders.push(`
      <div class="shortcut-item">
        <span class="badge">${i + 1}</span>
        <span class="shortcut-title" style="color:var(--text-tertiary)">---</span>
        <span class="hotkey-chip">${getHotkeyLabel(i)}</span>
      </div>`);
  }

  $settingsContent.innerHTML = `
    <!-- shortcuts -->
    <div class="settings-section">
      <div class="section-header">
        <span class="diamond">◆</span>
        <span class="section-title">Keyboard Shortcuts</span>
        <span class="section-trailing">FIRST 4 TEMPLATES</span>
      </div>
      <div class="panel">
        <div class="shortcuts-grid">
          ${shortcutItems}${placeholders.join('')}
        </div>
        <div class="divider"></div>
        <div class="info-text">
          Chrome supports up to 4 custom shortcuts.<br>
          Configure at <a href="#" id="link-shortcuts">chrome://extensions/shortcuts</a>
        </div>
      </div>
    </div>

    <!-- data -->
    <div class="settings-section">
      <div class="section-header">
        <span class="diamond">◆</span>
        <span class="section-title">Data</span>
      </div>
      <div class="panel">
        <div class="data-actions">
          <button class="retro-btn compact" id="btn-export">EXPORT JSON</button>
          <button class="retro-btn compact amber" id="btn-import">IMPORT JSON</button>
        </div>
      </div>
    </div>

    <!-- about -->
    <div class="settings-section">
      <div class="section-header">
        <span class="diamond">◆</span>
        <span class="section-title">About</span>
      </div>
      <div class="panel about-panel">
        <div class="about-header">
          <div class="about-icon">◆</div>
          <div class="about-info">
            <div class="about-name">CLIP·MUNK</div>
            <div class="about-version">VERSION ${chrome.runtime.getManifest().version} · CHROME EXTENSION</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="about-desc">
          A chipmunk-fast paste toolbox for quick text templates.<br>
          Retro-futurism 16-bit dot-matrix interface.
        </div>
      </div>
    </div>
  `;

  attachSettingsListeners();
}

function attachSettingsListeners() {
  const linkShortcuts = document.getElementById('link-shortcuts');
  if (linkShortcuts) {
    linkShortcuts.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => {
        navigator.clipboard.writeText('chrome://extensions/shortcuts');
        showToast('URL COPIED – PASTE IN ADDRESS BAR');
      });
    });
  }

  const btnExport = document.getElementById('btn-export');
  if (btnExport) {
    btnExport.addEventListener('click', exportTemplates);
  }

  const btnImport = document.getElementById('btn-import');
  if (btnImport) {
    btnImport.addEventListener('click', () => $importFile.click());
  }
}

// ---------------------------------------------------------------------------
// import / export
// ---------------------------------------------------------------------------

function exportTemplates() {
  if (templates.length === 0) {
    showToast('NOTHING TO EXPORT', true);
    return;
  }

  const data = JSON.stringify(templates, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clipmunk-templates-${formatDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('EXPORTED');
}

function importTemplates(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);

      if (!Array.isArray(imported)) {
        showToast('INVALID FILE', true);
        return;
      }

      const valid = imported.filter(
        (t) => t && typeof t.title === 'string' && typeof t.content === 'string'
      );

      if (valid.length === 0) {
        showToast('NO VALID TEMPLATES', true);
        return;
      }

      const now = Date.now();
      const existingIds = new Set(templates.map((t) => t.id));
      const normalized = valid.map((t) => {
        const hasConflict = t.id && existingIds.has(t.id);
        const id = (t.id && !hasConflict) ? t.id : generateId();
        return {
          id,
          title: t.title,
          content: t.content,
          createdAt: t.createdAt || now,
          updatedAt: t.updatedAt || now,
        };
      });

      templates = normalized.concat(templates);
      await persistTemplates();
      renderTemplateList();
      updateStatusBar();
      showToast(`IMPORTED ${normalized.length}`);
    } catch {
      showToast('PARSE ERROR', true);
    }
  };
  reader.readAsText(file);
}

// ---------------------------------------------------------------------------
// status bar
// ---------------------------------------------------------------------------

function updateStatusBar() {
  const count = templates.length;
  $templateCount.textContent = `${count} STORED`;
}

// ---------------------------------------------------------------------------
// toast
// ---------------------------------------------------------------------------

function showToast(message, isError = false) {
  while ($toastContainer.firstChild) {
    $toastContainer.firstChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.innerHTML = `
    <span class="led active${isError ? ' error' : ' cyan'}"></span>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;
  $toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 1300);
}

// ---------------------------------------------------------------------------
// tab switching
// ---------------------------------------------------------------------------

function switchTab(tabName) {
  if (activeTab === tabName) {
    return;
  }
  activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.getElementById('view-templates').classList.toggle('hidden', tabName !== 'templates');
  document.getElementById('view-settings').classList.toggle('hidden', tabName !== 'settings');

  if (tabName === 'settings') {
    renderSettings();
  }
}

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  $templateList = document.getElementById('template-list');
  $searchInput = document.getElementById('search-input');
  $btnAdd = document.getElementById('btn-add');
  $statusText = document.getElementById('status-text');
  $statusLed = document.getElementById('status-led');
  $templateCount = document.getElementById('template-count');
  $toastContainer = document.getElementById('toast-container');
  $importFile = document.getElementById('import-file');
  $settingsContent = document.getElementById('settings-content');

  document.getElementById('app-version').textContent =
    'v' + chrome.runtime.getManifest().version;

  await loadTemplates();

  renderTemplateList();
  updateStatusBar();

  // tab clicks
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // add button
  $btnAdd.addEventListener('click', addTemplate);

  // search input
  $searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTemplateList();
  });

  // import file change
  $importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importTemplates(file);
      $importFile.value = '';
    }
  });

  // flush pending saves when popup closes
  window.addEventListener('pagehide', () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      persistTemplates();
    }
  });

  // keyboard shortcuts inside popup
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (expandedId) {
        expandedId = null;
        renderTemplateList();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      $searchInput.focus();
      $searchInput.select();
    }
  });
});
