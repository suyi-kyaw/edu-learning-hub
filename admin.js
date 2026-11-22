/**
 * =========================================================
 * JIEDEEDU - ADMIN CMS PORTAL CONTROLLER (admin.js)
 * Same-site Backend CMS for Verified Admin:
 * - Homepage Copy, Hero Banner, Contact Us & Featured Picks
 * - Stories & Story Scenes + Exercise Spreadsheets
 * - Short Reels (Direct Upload + URL)
 * - Adult/Kids Lessons (Free/Paid + Price + Vocab/Writing + Exercises)
 * - Wordwall Games (Add, Edit, Reorder, Active/Featured, Delete)
 * - Users, Per-Lesson Access & QR Payment Approvals
 * =========================================================
 */

(function () {
  'use strict';

  const TAB_LABELS = {
    home: 'Homepage & Contact',
    stories: 'Stories & Exercises',
    reels: 'Short Reels',
    lessons: 'Lessons & Exercises',
    games: 'Wordwall Games',
    users: 'Users & Memberships'
  };

  const state = {
    activeTab: 'home',
    loading: false,
    loadedOnce: false,
    authState: null,
    siteConfig: null,
    storiesData: { Lessons: [], Story: [], Vocabulary: [], Exercises: [] },
    reelsData: { Videos: [] },
    lessonsData: { Lessons: [], Vocabulary: [], Writing: [], Exercises: [], Games: [], Pronunciation: [] },
    filters: {
      storySearch: '',
      reelSearch: '',
      reelStatus: 'all',
      lessonCourse: 'all',
      lessonSearch: '',
      userSearch: ''
    },
    editingStoryScenes: [],
    editingStoryVocab: [],
    editingLessonVocab: [],
    editingLessonWriting: [],
    pendingExercisesRows: [],
    pendingExercisesMeta: { target: 'lessons', lessonId: '', mode: 'merge_lesson', fileName: '' },
    lastSyncNotice: null
  };

  // --- Utilities ---
  function cloneArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (item) {
      return item && typeof item === 'object' ? Object.assign({}, item) : item;
    });
  }

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(msg, type = 'success') {
    if (window.LinguaAuthUI && typeof window.LinguaAuthUI.showToast === 'function') {
      window.LinguaAuthUI.showToast(msg, type);
    }
  }

  function setSyncStatus(text) {
    const el = document.getElementById('adminSyncStatus');
    if (el) el.textContent = text;
  }

  function applySyncFeedback(res, syncedMsg, localMsg) {
    if (res && res.syncedToServer) {
      state.lastSyncNotice = null;
      setSyncStatus('Synced to Excel & DB');
      toast(syncedMsg);
    } else {
      state.lastSyncNotice = {
        syncedToServer: false,
        reason: (res && res.syncReason) || 'local-only',
        error: res && res.syncError
      };
      const needsAuth = res && res.syncReason === 'auth-required';
      setSyncStatus(needsAuth ? 'Sign in again to sync' : 'Saved locally (pending sync)');
      toast(
        needsAuth
          ? `${localMsg} (Sign out & sign back in once to auto-sync to Excel & DB.)`
          : localMsg,
        needsAuth ? 'info' : 'success'
      );
    }
  }

  function apiUrl(path) {
    if (window.LinguaBackend && typeof window.LinguaBackend.apiUrl === 'function') {
      return window.LinguaBackend.apiUrl(path);
    }
    return path;
  }

  function assetUrl(url) {
    if (window.LinguaBackend && typeof window.LinguaBackend.assetUrl === 'function') {
      return window.LinguaBackend.assetUrl(url);
    }
    return url;
  }

  function hasBackend() {
    if (window.LinguaBackend && typeof window.LinguaBackend.hasBackend === 'function') {
      return window.LinguaBackend.hasBackend();
    }
    return true;
  }

  async function updateBackendBadge() {
    const badge = document.getElementById('adminBackendBadge');
    if (!badge) return;
    badge.classList.remove('is-warning');
    badge.classList.add('is-connected');
    try {
      const res = await fetch(apiUrl('/api/database/status'));
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        badge.textContent = `Cloudflare D1 & Excel (${json.database || 'edu-hub-db'})`;
        return;
      }
    } catch (_) {}
    badge.textContent = 'Cloudflare D1 & Excel (edu-hub-db)';
  }

  function isSameId(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function normalizeCourseName(val) {
    if (window.LinguaAuth && typeof window.LinguaAuth.normalizeCourseName === 'function') {
      return window.LinguaAuth.normalizeCourseName(val);
    }
    const raw = String(val || '').trim();
    if (!raw) return 'HSK 2';
    const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
    if (compact === 'hsk1') return 'HSK 1';
    if (compact === 'hsk2') return 'HSK 2';
    if (compact === 'hsk3') return 'HSK 3';
    if (compact === 'hsk4') return 'HSK 4';
    return raw.slice(0, 80);
  }

  function courseSlug(val) {
    return String(val || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
  }

  function getLessonCourse(lesson) {
    if (window.LinguaAuth && typeof window.LinguaAuth.getLessonCourseName === 'function') {
      return window.LinguaAuth.getLessonCourseName(lesson);
    }
    if (!lesson || typeof lesson !== 'object') return 'HSK 2';
    const raw = String(lesson.course || lesson.courseName || lesson.category || '').trim();
    if (raw) return normalizeCourseName(raw);
    return 'HSK 2';
  }

  function getAdminCoursesList() {
    const out = [];
    const seen = new Set();
    const pushCourse = (name) => {
      const raw = String(name || '').trim();
      if (!raw) return;
      const norm = normalizeCourseName(raw);
      const slug = courseSlug(norm);
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        out.push(norm);
      }
    };
    const cfg = state.siteConfig || {};
    if (Array.isArray(cfg.courses)) {
      cfg.courses.forEach(pushCourse);
    }
    if (cfg.coursePrices && typeof cfg.coursePrices === 'object') {
      Object.keys(cfg.coursePrices).forEach(pushCourse);
    }
    (state.lessonsData.Lessons || []).forEach((l) => pushCourse(getLessonCourse(l)));
    if (!out.length && !Array.isArray(cfg.courses)) {
      pushCourse('HSK 2');
    }
    return out;
  }

  function parseCsvList(str) {
    return String(str || '')
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function extractIframeUrl(input) {
    const val = String(input || '').trim();
    if (!val) return '';
    if (val.toLowerCase().includes('<iframe')) {
      const m = val.match(/src\s*=\s*["']([^"']+)["']/i);
      return m ? m[1].trim() : '';
    }
    return val;
  }

  function buildIframeHtml(embedUrl, width = 500, height = 380) {
    const safeUrl = extractIframeUrl(embedUrl);
    if (!safeUrl) return '';
    return `<iframe style="max-width:100%" src="${safeUrl}" width="${Number(width) || 500}" height="${
      Number(height) || 380
    }" frameborder="0" allowfullscreen></iframe>`;
  }

  function getContentStore() {
    if (!window.LinguaContentStore) {
      throw new Error('Static Excel content store is not loaded.');
    }
    return window.LinguaContentStore;
  }

  function renderWorkbookSyncToolbar(domain, fileName) {
    const store = window.LinguaContentStore;
    const hasDraft = store && typeof store.hasDraft === 'function' ? store.hasDraft(domain) : false;
    const dsInfo = store && typeof store.getDataSourceStatus === 'function' ? store.getDataSourceStatus(domain) : { source: 'xlsx-fallback', database: 'edu-hub-db' };
    const isSynced = dsInfo.source === 'cloudflare-d1' || dsInfo.source === 'auto-synced' || dsInfo.source === 'cloudflare-d1-ahead';
    const needsAuthNotice = hasDraft && state.lastSyncNotice && state.lastSyncNotice.reason === 'auth-required';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; background:${
        hasDraft ? '#fef9c3' : '#f0fdf4'
      }; border:1px solid ${hasDraft ? '#fde047' : '#bbf7d0'}; border-radius:12px; padding:10px 14px; margin-bottom:14px;">
        <div style="font-size:0.84rem; color:${hasDraft ? '#854d0e' : '#166534'}; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="display:inline-flex; align-items:center; gap:5px; font-weight:600; color:${
            hasDraft ? '#b45309' : isSynced ? '#059669' : '#0284c7'
          };">
            ${
              hasDraft
                ? '● Pending Server Sync (Browser Draft)'
                : dsInfo.source === 'auto-synced'
                ? '● Auto-Synced: Reconciled Excel (data/' + escapeHTML(fileName) + ') & DB (' + escapeHTML(dsInfo.database || 'edu-hub-db') + ')'
                : dsInfo.source === 'cloudflare-d1-ahead'
                ? '● Live Cloudflare D1 (' + escapeHTML(dsInfo.database || 'edu-hub-db') + ')'
                : isSynced
                ? '● Auto-Synced: Excel (data/' + escapeHTML(fileName) + ') & DB (' + escapeHTML(dsInfo.database || 'edu-hub-db') + ')'
                : '● Loaded: Excel (data/' + escapeHTML(fileName) + ')'
            }
          </span>
          <span style="color:#94a3b8;">|</span>
          <span>
            ${
              needsAuthNotice
                ? `<strong>Session refresh needed:</strong> Sign out &amp; sign in once (or click <strong>Sync to Excel &amp; DB</strong>) to save browser changes into <code>data/${escapeHTML(
                    fileName
                  )}</code>.`
                : hasDraft
                ? `<strong>Local browser draft active:</strong> Click <strong>Sync to Excel &amp; DB</strong> or <strong>Export ${escapeHTML(
                    fileName
                  )}</strong> to publish.`
                : `All edits &amp; deletions auto-sync immediately to <code>data/${escapeHTML(fileName)}</code> and database.`
            }
          </span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${
            hasDraft
              ? `<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-cms-sync="${escapeHTML(
                  domain
                )}">Sync to Excel &amp; DB</button>`
              : ''
          }
          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-cms-test-db="true" title="Verify connection to Cloudflare D1 edu-hub-db">Test D1 DB</button>
          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-cms-export="${escapeHTML(
            domain
          )}">Export ${escapeHTML(fileName)}</button>
          <label class="admin-btn admin-btn-secondary admin-btn-sm" style="margin:0; cursor:pointer;">
            <span>Import ${escapeHTML(fileName)}</span>
            <input type="file" accept=".xlsx,.xls" data-cms-import="${escapeHTML(domain)}" hidden />
          </label>
          ${
            hasDraft
              ? `<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-cms-reset="${escapeHTML(
                  domain
                )}">Reset Draft</button>`
              : ''
          }
        </div>
      </div>
    `;
  }

  function wireWorkbookSyncToolbar(viewport) {
    if (!viewport) return;

    viewport.querySelectorAll('[data-cms-sync]').forEach((btn) => {
      btn.onclick = async () => {
        const domain = btn.getAttribute('data-cms-sync');
        const sheets =
          domain === 'stories'
            ? state.storiesData
            : domain === 'reels'
            ? state.reelsData
            : state.lessonsData;
        btn.disabled = true;
        btn.textContent = 'Syncing…';
        try {
          const store = getContentStore();
          const syncRes = await store.syncDomainToServer(domain, sheets);
          if (syncRes && syncRes.syncedToServer) {
            if (domain === 'stories' && syncRes.sheets) state.storiesData = syncRes.sheets;
            else if (domain === 'reels' && syncRes.sheets) state.reelsData = syncRes.sheets;
            else if (domain === 'lessons' && syncRes.sheets) state.lessonsData = syncRes.sheets;
            state.lastSyncNotice = null;
            updateNavCounts();
            renderActiveTab();
            setSyncStatus('Synced to Excel & DB');
            toast(`Synced ${domain} workbook with Excel & Database!`);
          } else {
            state.lastSyncNotice = {
              syncedToServer: false,
              reason: (syncRes && syncRes.syncReason) || 'error',
              error: syncRes && syncRes.error
            };
            renderActiveTab();
            toast(
              (syncRes && syncRes.error) || 'Could not sync with server. Please sign out and sign in as Admin.',
              'error'
            );
          }
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Sync failed.', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Sync to Excel & DB';
        }
      };
    });

    viewport.querySelectorAll('[data-cms-test-db]').forEach((btn) => {
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Testing D1…';
        try {
          const res = await fetch('/api/database/status?t=' + Date.now());
          const json = await res.json();
          if (json.success) {
            toast(`Connected to Cloudflare D1 (${json.database})! Found ${json.tables ? json.tables.length : 12} tables.`);
          } else {
            toast(`D1 status: ${json.message || 'offline'}. Using Excel sheets fallback.`, 'info');
          }
        } catch (err) {
          toast(`D1 test: ${err.message || 'Server error'}. Using Excel fallback.`, 'info');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Test D1 DB';
        }
      };
    });

    viewport.querySelectorAll('[data-cms-export]').forEach((btn) => {
      btn.onclick = async () => {
        const domain = btn.getAttribute('data-cms-export');
        try {
          const res = await getContentStore().exportWorkbook(domain);
          toast(`Downloaded ${res.fileName}.`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Could not export Excel workbook.', 'error');
        }
      };
    });
    viewport.querySelectorAll('[data-cms-import]').forEach((input) => {
      input.onchange = async () => {
        const file = input.files && input.files[0];
        const domain = input.getAttribute('data-cms-import');
        if (!file) return;
        try {
          setSyncStatus(`Importing ${file.name}…`);
          const buf = await file.arrayBuffer();
          const res = await getContentStore().importWorkbookFile(domain, buf);
          if (domain === 'stories') state.storiesData = res.sheets;
          else if (domain === 'reels') state.reelsData = res.sheets;
          else if (domain === 'lessons') state.lessonsData = res.sheets;
          updateNavCounts();
          applySyncFeedback(
            res,
            `Imported ${file.name} and synced to Excel & DB.`,
            `Imported ${file.name} into local preview.`
          );
          renderActiveTab();
        } catch (err) {
          setSyncStatus('Import failed');
          toast(err instanceof Error ? err.message : 'Failed to import Excel workbook.', 'error');
        } finally {
          input.value = '';
        }
      };
    });
    viewport.querySelectorAll('[data-cms-reset]').forEach((btn) => {
      btn.onclick = () => {
        const domain = btn.getAttribute('data-cms-reset');
        openConfirmDialog({
          title: 'Reset local browser edits?',
          message: 'This clears pending browser changes for this section and reloads directly from the server Excel workbook.',
          confirmLabel: 'Reset to Repo File',
          onConfirm: async () => {
            try {
              const res = await getContentStore().clearDraft(domain);
              if (domain === 'stories') state.storiesData = res.sheets;
              else if (domain === 'reels') state.reelsData = res.sheets;
              else if (domain === 'lessons') state.lessonsData = res.sheets;
              state.lastSyncNotice = null;
              updateNavCounts();
              renderActiveTab();
              toast('Reverted to server Excel workbook.');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Failed to reset draft.', 'error');
            }
          }
        });
      };
    });
  }

  // --- Data Loading ---
  async function loadAllContentData(force = false) {
    if (state.loading && !force) return;
    state.loading = true;
    setSyncStatus('Loading workbooks…');
    updateBackendBadge();
    try {
      const store = getContentStore();
      const [storiesRes, reelsRes, lessonsRes] = await Promise.all([
        store.loadStoriesWorkbook(),
        store.loadReelsWorkbook(),
        store.loadLessonsWorkbook()
      ]);

      const authSiteCfg =
        window.LinguaAuth && typeof window.LinguaAuth.getSiteConfig === 'function'
          ? window.LinguaAuth.getSiteConfig()
          : null;
      state.siteConfig = authSiteCfg || state.siteConfig || {};

      if (storiesRes && storiesRes.sheets) {
        state.storiesData = {
          Lessons: Array.isArray(storiesRes.sheets.Lessons) ? storiesRes.sheets.Lessons : [],
          Story: Array.isArray(storiesRes.sheets.Story) ? storiesRes.sheets.Story : [],
          Vocabulary: Array.isArray(storiesRes.sheets.Vocabulary) ? storiesRes.sheets.Vocabulary : [],
          Exercises: Array.isArray(storiesRes.sheets.Exercises) ? storiesRes.sheets.Exercises : []
        };
      }
      if (reelsRes && reelsRes.sheets) {
        state.reelsData = {
          Videos: Array.isArray(reelsRes.sheets.Videos) ? reelsRes.sheets.Videos : []
        };
      }
      if (lessonsRes && lessonsRes.sheets) {
        state.lessonsData = {
          Lessons: Array.isArray(lessonsRes.sheets.Lessons) ? lessonsRes.sheets.Lessons : [],
          Vocabulary: Array.isArray(lessonsRes.sheets.Vocabulary) ? lessonsRes.sheets.Vocabulary : [],
          Writing: Array.isArray(lessonsRes.sheets.Writing) ? lessonsRes.sheets.Writing : [],
          Exercises: Array.isArray(lessonsRes.sheets.Exercises) ? lessonsRes.sheets.Exercises : [],
          Games: Array.isArray(lessonsRes.sheets.Games) ? lessonsRes.sheets.Games : [],
          Pronunciation: Array.isArray(lessonsRes.sheets.Pronunciation) ? lessonsRes.sheets.Pronunciation : []
        };
      }

      state.loadedOnce = true;
      const draftSummary = store.getDraftStatusSummary();
      const hasAnyDraft = draftSummary.lessons || draftSummary.stories || draftSummary.reels;
      setSyncStatus(hasAnyDraft ? 'Local Drafts + Excel' : 'Static Excel Loaded');
      updateNavCounts();
      renderActiveTab();
    } catch (err) {
      setSyncStatus('Load warning');
      toast(err instanceof Error ? err.message : 'Could not load content workbooks.', 'error');
    } finally {
      state.loading = false;
    }
  }

  function updateNavCounts() {
    const cStories = document.getElementById('countStories');
    const cReels = document.getElementById('countReels');
    const cLessons = document.getElementById('countLessons');
    const cGames = document.getElementById('countGames');
    const cUsers = document.getElementById('countUsers');
    if (cStories) cStories.textContent = String(state.storiesData.Lessons.length);
    if (cReels) cReels.textContent = String(state.reelsData.Videos.length);
    if (cLessons) cLessons.textContent = String(state.lessonsData.Lessons.length);
    if (cGames) cGames.textContent = String(state.lessonsData.Games.length);
    if (cUsers) {
      const pending = (state.authState?.allRequests || []).filter((r) => r.status === 'pending').length;
      const totalU = (state.authState?.allUsers || []).length;
      cUsers.textContent = pending > 0 ? `${pending} req · ${totalU}` : String(totalU);
    }
  }

  // --- Reusable Media Picker Helper (File Upload + URL Input + Preview) ---
  function renderMediaPickerField(opts) {
    const { id, label, value, accept, kind, placeholder } = opts;
    const val = String(value || '');
    return `
      <div class="admin-field">
        <label for="${escapeHTML(id)}">${escapeHTML(label)}</label>
        <div class="admin-media-picker" data-picker-root="${escapeHTML(id)}">
          <div class="admin-media-row">
            <input type="text" class="admin-input" id="${escapeHTML(id)}" value="${escapeHTML(val)}" placeholder="${escapeHTML(
              placeholder || 'assets/... or https://...'
            )}" />
            <label class="admin-btn admin-btn-secondary admin-btn-sm" style="margin:0; cursor:pointer;">
              <span>Upload</span>
              <input type="file" accept="${escapeHTML(accept)}" data-media-upload-for="${escapeHTML(id)}" data-media-kind="${escapeHTML(
                kind
              )}" hidden />
            </label>
          </div>
          <div class="admin-media-preview" id="${escapeHTML(id)}Preview">
            ${renderMediaPreviewInner(val, kind)}
          </div>
        </div>
      </div>
    `;
  }

  function formatMediaPreviewLabel(url, kind) {
    const clean = String(url || '').trim();
    if (!clean) return '';
    if (/^data:/i.test(clean)) {
      const mimeMatch = clean.match(/^data:([^;,]+)/i);
      const mime = (mimeMatch && mimeMatch[1] ? mimeMatch[1] : `${kind || 'media'}`).toLowerCase();
      const subtypeRaw = mime.includes('/') ? mime.split('/')[1] : mime;
      const subtype = subtypeRaw.replace(/\+.*$/, '').toUpperCase() || 'MEDIA';
      const commaIdx = clean.indexOf(',');
      const payloadLen = commaIdx >= 0 ? Math.max(0, clean.length - commaIdx - 1) : clean.length;
      const approxBytes = clean.includes(';base64,') ? Math.round((payloadLen * 3) / 4) : payloadLen;
      const sizeLabel =
        approxBytes >= 1024 * 1024
          ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`
          : approxBytes >= 1024
          ? `${Math.max(1, Math.round(approxBytes / 1024))} KB`
          : `${approxBytes} B`;
      const kindLabel = kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : 'image';
      return `Inline ${subtype} ${kindLabel} (~${sizeLabel})`;
    }
    return clean;
  }

  function renderMediaPreviewInner(url, kind) {
    const clean = String(url || '').trim();
    if (!clean) {
      return `<span class="admin-media-preview-label">No ${escapeHTML(kind)} selected</span>`;
    }
    const resolved = assetUrl(clean);
    const labelText = formatMediaPreviewLabel(clean, kind);
    const titleText = /^data:/i.test(clean) ? labelText : clean;
    if (kind === 'video') {
      return `
        <video src="${escapeHTML(resolved)}" muted playsinline controls preload="metadata"></video>
        <span class="admin-media-preview-label" title="${escapeHTML(titleText)}">${escapeHTML(labelText)}</span>
      `;
    }
    if (kind === 'audio') {
      return `
        <audio src="${escapeHTML(resolved)}" controls preload="none" style="height:32px; max-width:220px; flex-shrink:0;"></audio>
        <span class="admin-media-preview-label" title="${escapeHTML(titleText)}">${escapeHTML(labelText)}</span>
      `;
    }
    return `
      <img src="${escapeHTML(resolved)}" alt="Preview" onerror="this.style.opacity='0.3'; this.nextElementSibling && (this.nextElementSibling.textContent='Image could not be decoded — please re-upload or Reset to Default');" />
      <span class="admin-media-preview-label" title="${escapeHTML(titleText)}">${escapeHTML(labelText)}</span>
    `;
  }

  async function uploadAdminMediaFile(file) {
    const token =
      window.LinguaAuth && typeof window.LinguaAuth.getIdToken === 'function'
        ? await window.LinguaAuth.getIdToken()
        : '';
    if (token) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(apiUrl('/api/admin/upload-media'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success && json.url) {
          return { url: json.url, uploadedToServer: true };
        }
      } catch (_) {}
    }
    const inline = await getContentStore().readFileAsInlineMedia(file);
    return { url: inline.url, uploadedToServer: false };
  }

  function wireMediaPickers(container) {
    if (!container) return;
    container.querySelectorAll('[data-picker-root]').forEach((root) => {
      const targetId = root.getAttribute('data-picker-root');
      const textInput = root.querySelector(`#${CSS.escape(targetId)}`);
      const fileInput = root.querySelector(`[data-media-upload-for="${CSS.escape(targetId)}"]`);
      const previewEl = root.querySelector(`#${CSS.escape(targetId)}Preview`);
      const kind = fileInput ? fileInput.getAttribute('data-media-kind') : 'image';

      if (textInput && previewEl) {
        textInput.addEventListener('input', () => {
          previewEl.innerHTML = renderMediaPreviewInner(textInput.value, kind);
        });
      }

      if (fileInput) {
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;
          setSyncStatus(`Uploading ${file.name}…`);
          try {
            const result = await uploadAdminMediaFile(file);
            if (textInput) {
              textInput.value = result.url;
              textInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (previewEl) {
              previewEl.innerHTML = renderMediaPreviewInner(result.url, kind);
            }
            if (result.uploadedToServer) {
              setSyncStatus('Media uploaded');
              toast(`Uploaded ${file.name} to server (${result.url}).`);
            } else {
              setSyncStatus('Media attached locally');
              toast(`Attached ${file.name} locally. For large files, commit to assets/ and paste path.`);
            }
          } catch (err) {
            setSyncStatus('Media note');
            toast(err instanceof Error ? err.message : 'Could not attach media file.', 'error');
          } finally {
            fileInput.value = '';
          }
        });
      }
    });
  }

  // --- Modal Helpers (No window.alert / window.confirm / window.prompt) ---
  function openModal(html) {
    const backdrop = document.getElementById('adminModalBackdrop');
    const dialog = document.getElementById('adminModalDialog');
    if (!backdrop || !dialog) return;
    dialog.innerHTML = html;
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    wireMediaPickers(dialog);
  }

  function closeModal() {
    closeSubModal();
    const backdrop = document.getElementById('adminModalBackdrop');
    const dialog = document.getElementById('adminModalDialog');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (dialog) dialog.innerHTML = '';
  }

  function ensureSubModalDOM() {
    let backdrop = document.getElementById('adminSubModalBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'adminSubModalBackdrop';
      backdrop.className = 'admin-submodal-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.innerHTML = '<div class="admin-submodal-dialog" id="adminSubModalDialog" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeSubModal();
      });
    }
    return {
      backdrop,
      dialog: document.getElementById('adminSubModalDialog')
    };
  }

  function openSubModal(html) {
    const { backdrop, dialog } = ensureSubModalDOM();
    if (!backdrop || !dialog) return;
    dialog.innerHTML = html;
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    wireMediaPickers(dialog);
  }

  function closeSubModal() {
    const backdrop = document.getElementById('adminSubModalBackdrop');
    const dialog = document.getElementById('adminSubModalDialog');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (dialog) dialog.innerHTML = '';
  }

  function openConfirmDialog({ title, message, confirmLabel, onConfirm }) {
    openModal(`
      <div class="admin-panel-head" style="margin-bottom:12px;">
        <div>
          <h2>${escapeHTML(title)}</h2>
          <p>${escapeHTML(message)}</p>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="admin-btn admin-btn-secondary" id="adminConfirmCancelBtn">Cancel</button>
        <button type="button" class="admin-btn admin-btn-danger" id="adminConfirmProceedBtn">${escapeHTML(
          confirmLabel || 'Delete'
        )}</button>
      </div>
    `);
    document.getElementById('adminConfirmCancelBtn').onclick = closeModal;
    document.getElementById('adminConfirmProceedBtn').onclick = async () => {
      closeModal();
      await onConfirm();
    };
  }

  function generateCopyId(baseId, existingIds) {
    const cleanBase = String(baseId || 'item')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
    const taken = new Set((existingIds || []).map((x) => String(x || '').trim().toLowerCase()));
    let candidate = `${cleanBase}-copy`;
    let n = 2;
    while (taken.has(candidate.toLowerCase())) {
      candidate = `${cleanBase}-copy-${n}`;
      n += 1;
    }
    return candidate;
  }

  function openDuplicateModal({
    entityLabel,
    sourceTitle,
    sourceId,
    existingIds,
    hideIdField,
    showTargetLessonSelect,
    lessonOptions,
    defaultLessonId,
    helpText,
    useSubModal,
    onConfirm
  }) {
    const openFn = useSubModal ? openSubModal : openModal;
    const closeFn = useSubModal ? closeSubModal : closeModal;
    const defaultTitle = String(sourceTitle || '').trim() ? `${String(sourceTitle).trim()} (Copy)` : `New ${entityLabel} Copy`;
    const defaultId = hideIdField ? '' : generateCopyId(sourceId || 'copy', existingIds || []);
    const takenSet = new Set((existingIds || []).map((x) => String(x || '').trim().toLowerCase()));

    openFn(`
      <div class="admin-panel-head" style="margin-bottom:12px;">
        <div>
          <h2>Duplicate ${escapeHTML(entityLabel)}</h2>
          <p>${escapeHTML(helpText || `Enter a title for the duplicated ${entityLabel.toLowerCase()}. All other details will be copied and remain editable.`)}</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="dupCloseBtn">✕</button>
      </div>
      <form id="dupConfirmForm">
        <div class="admin-field">
          <label for="dupNewTitle">New ${escapeHTML(entityLabel)} Title *</label>
          <input type="text" class="admin-input" id="dupNewTitle" value="${escapeHTML(defaultTitle)}" required />
        </div>
        ${
          hideIdField
            ? ''
            : `
          <div class="admin-field" style="margin-top:10px;">
            <label for="dupNewId">New Unique ID *</label>
            <input type="text" class="admin-input" id="dupNewId" value="${escapeHTML(defaultId)}" required />
            <div style="font-size:0.76rem; color:#64748b; margin-top:4px;">Auto-generated unique slug (you can customize it before creating).</div>
          </div>
        `
        }
        ${
          showTargetLessonSelect
            ? `
          <div class="admin-field" style="margin-top:10px;">
            <label for="dupTargetLesson">Target Lesson</label>
            <select class="admin-select" id="dupTargetLesson">
              ${(lessonOptions || [])
                .map(
                  (l) =>
                    `<option value="${escapeHTML(l.id)}" ${isSameId(l.id, defaultLessonId) ? 'selected' : ''}>${escapeHTML(
                      l.id
                    )} — ${escapeHTML(l.title || l.id)}</option>`
                )
                .join('')}
            </select>
          </div>
        `
            : ''
        }
        <div id="dupErrorBox" class="admin-backend-status is-error" hidden style="margin-top:10px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="dupCancelBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary" id="dupSubmitBtn">Create Duplicate</button>
        </div>
      </form>
    `);

    const titleInp = document.getElementById('dupNewTitle');
    if (titleInp) {
      titleInp.focus();
      titleInp.select();
    }
    document.getElementById('dupCloseBtn').onclick = closeFn;
    document.getElementById('dupCancelBtn').onclick = closeFn;
    document.getElementById('dupConfirmForm').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('dupErrorBox');
      const submitBtn = document.getElementById('dupSubmitBtn');
      const newTitle = (document.getElementById('dupNewTitle')?.value || '').trim();
      const newId = hideIdField ? '' : (document.getElementById('dupNewId')?.value || '').trim();
      const targetLessonId = showTargetLessonSelect ? (document.getElementById('dupTargetLesson')?.value || '').trim() : '';

      if (!newTitle) {
        errBox.hidden = false;
        errBox.textContent = 'Please enter a title for the duplicate.';
        return;
      }
      if (!hideIdField) {
        if (!newId) {
          errBox.hidden = false;
          errBox.textContent = 'Please enter a unique ID.';
          return;
        }
        if (takenSet.has(newId.toLowerCase())) {
          errBox.hidden = false;
          errBox.textContent = `ID "${newId}" already exists. Please choose another ID.`;
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Duplicating…';
      errBox.hidden = true;
      try {
        await onConfirm({ newTitle, newId, targetLessonId });
        closeFn();
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err instanceof Error ? err.message : 'Failed to duplicate item.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Duplicate';
      }
    };
  }

  // --- Tab 1: Homepage & Contact ---
  function renderBrandLogoPreviewMarkup(logoUrl, darkSurface) {
    const clean = String(logoUrl || '').trim();
    if (clean) {
      const resolved = assetUrl(clean);
      return `
        <span class="logo has-custom-logo" style="${darkSurface ? 'background:rgba(255,255,255,0.96); padding:4px 10px; border-radius:10px;' : ''}">
          <img src="${escapeHTML(resolved)}" alt="Custom Brand Logo" class="site-brand-logo-img" onerror="this.style.display='none'; this.parentElement && this.parentElement.insertAdjacentHTML('beforeend', '<span style=&quot;font-size:0.8rem;color:#dc2626;font-weight:600;&quot;>Unable to load image — please re-upload</span>');" />
        </span>
      `;
    }
    return `
      <span class="logo" style="pointer-events:none;">
        <span class="logo-chinese">语</span>
        <span class="logo-text" style="${darkSurface ? 'color:#f8fafc;' : ''}">JiedeEdu</span>
      </span>
    `;
  }

  function renderHomeTab(viewport) {
    const cfg = state.siteConfig || {};
    const stories = state.storiesData.Lessons || [];
    const reels = state.reelsData.Videos || [];
    const games = state.lessonsData.Games || [];
    const coursesList = getAdminCoursesList();
    const coursePricesMap = cfg.coursePrices && typeof cfg.coursePrices === 'object' ? cfg.coursePrices : {};
    const currentLogoUrl = String(cfg.siteLogoUrl || '').trim();

    const featStories = new Set((cfg.featuredStoryIds || []).map((x) => x.toLowerCase()));
    const featReels = new Set((cfg.featuredReelIds || []).map((x) => x.toLowerCase()));
    const featGames = new Set((cfg.featuredGameIds || []).map((x) => x.toLowerCase()));

    viewport.innerHTML = `
      <form id="adminHomeForm">
        <div class="admin-panel-card">
          <div class="admin-panel-head">
            <div>
              <h2>Site Branding &amp; Custom Logo</h2>
              <p>Upload a custom logo lockup to replace the <code>语 JiedeEdu</code> brand mark in both header and footer sitewide.</p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnUseSampleLogo">Use Attached Sample</button>
              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnResetSiteLogo">Reset to Default</button>
              <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="btnSaveLogoOnly">Save Logo</button>
            </div>
          </div>

          ${renderMediaPickerField({
            id: 'cfgSiteLogoUrl',
            label: 'Site Brand Logo Image (Upload PNG/SVG/WebP or Paste URL)',
            value: currentLogoUrl,
            accept: 'image/*',
            kind: 'image',
            placeholder: 'Leave blank for default 语 JiedeEdu lockup, or upload custom logo...'
          })}

          <div class="admin-logo-preview-grid" id="cfgLogoDualPreview">
            <div class="admin-logo-preview-card">
              <span class="admin-logo-preview-label">Header Bar Preview (Light)</span>
              <div class="admin-logo-preview-stage" id="cfgLogoPreviewLight">
                ${renderBrandLogoPreviewMarkup(currentLogoUrl, false)}
              </div>
            </div>
            <div class="admin-logo-preview-card is-dark">
              <span class="admin-logo-preview-label">Footer &amp; Dark Header Preview</span>
              <div class="admin-logo-preview-stage" id="cfgLogoPreviewDark">
                ${renderBrandLogoPreviewMarkup(currentLogoUrl, true)}
              </div>
            </div>
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="admin-panel-head">
            <div>
              <h2>Hero Section Copy &amp; Banner Image</h2>
              <p>Controls the top headline, CTA buttons, and main hero illustration on index.html. Saves locally and lets you export <code>site-config.json</code>.</p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="admin-btn admin-btn-secondary" id="btnExportSiteConfig">Export site-config.json</button>
              <button type="submit" class="admin-btn admin-btn-primary">Save All Homepage Settings</button>
            </div>
          </div>

          <div class="admin-grid-2">
            <div class="admin-field">
              <label for="cfgHeroEyebrow">Eyebrow Label</label>
              <input type="text" class="admin-input" id="cfgHeroEyebrow" value="${escapeHTML(cfg.heroEyebrow || '')}" required />
            </div>
            <div class="admin-field">
              <label for="cfgHeroTitle1">Headline Line 1</label>
              <input type="text" class="admin-input" id="cfgHeroTitle1" value="${escapeHTML(cfg.heroTitleLine1 || '')}" required />
            </div>
            <div class="admin-field">
              <label for="cfgHeroTitleHi">Headline Highlight</label>
              <input type="text" class="admin-input" id="cfgHeroTitleHi" value="${escapeHTML(cfg.heroTitleHighlight || '')}" required />
            </div>
            <div class="admin-grid-2">
              <div class="admin-field">
                <label for="cfgHeroCta1">Primary CTA Button</label>
                <input type="text" class="admin-input" id="cfgHeroCta1" value="${escapeHTML(cfg.heroPrimaryCta || '')}" required />
              </div>
              <div class="admin-field">
                <label for="cfgHeroCta2">Secondary CTA Button</label>
                <input type="text" class="admin-input" id="cfgHeroCta2" value="${escapeHTML(cfg.heroSecondaryCta || '')}" required />
              </div>
            </div>
          </div>

          <div class="admin-field" style="margin-top:12px;">
            <label for="cfgHeroSubtitle">Hero Subtitle</label>
            <textarea class="admin-textarea" id="cfgHeroSubtitle" required>${escapeHTML(cfg.heroSubtitle || '')}</textarea>
          </div>

          <div style="margin-top:12px;">
            ${renderMediaPickerField({
              id: 'cfgHeroBannerUrl',
              label: 'Hero Banner Image (Upload File or Paste URL)',
              value: cfg.heroBannerUrl || 'assets/hero-banner.png',
              accept: 'image/*',
              kind: 'image'
            })}
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="admin-panel-head">
            <div>
              <h2>Homepage Section Headings</h2>
              <p>Customize every standalone section label, title, and description shown on the home page.</p>
            </div>
          </div>

          <div class="admin-grid-2">
            <div class="admin-subrow">
              <strong style="font-size:0.86rem;">Chinese Stories Section</strong>
              <div class="admin-field">
                <label for="cfgStoriesLabel">Eyebrow Label</label>
                <input type="text" class="admin-input" id="cfgStoriesLabel" value="${escapeHTML(cfg.storiesLabel || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgStoriesTitle">Section Title</label>
                <input type="text" class="admin-input" id="cfgStoriesTitle" value="${escapeHTML(cfg.storiesTitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgStoriesSub">Section Description</label>
                <textarea class="admin-textarea" id="cfgStoriesSub">${escapeHTML(cfg.storiesSubtitle || '')}</textarea>
              </div>
            </div>

            <div class="admin-subrow">
              <strong style="font-size:0.86rem;">Short Mandarin Reels Section</strong>
              <div class="admin-field">
                <label for="cfgReelsLabel">Eyebrow Label</label>
                <input type="text" class="admin-input" id="cfgReelsLabel" value="${escapeHTML(cfg.reelsLabel || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgReelsTitle">Section Title</label>
                <input type="text" class="admin-input" id="cfgReelsTitle" value="${escapeHTML(cfg.reelsTitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgReelsSub">Section Description</label>
                <textarea class="admin-textarea" id="cfgReelsSub">${escapeHTML(cfg.reelsSubtitle || '')}</textarea>
              </div>
            </div>

            <div class="admin-subrow">
              <strong style="font-size:0.86rem;">Play &amp; Practice Games Section</strong>
              <div class="admin-field">
                <label for="cfgGamesLabel">Eyebrow Label</label>
                <input type="text" class="admin-input" id="cfgGamesLabel" value="${escapeHTML(cfg.gamesLabel || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgGamesTitle">Section Title</label>
                <input type="text" class="admin-input" id="cfgGamesTitle" value="${escapeHTML(cfg.gamesTitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgGamesSub">Section Description</label>
                <textarea class="admin-textarea" id="cfgGamesSub">${escapeHTML(cfg.gamesSubtitle || '')}</textarea>
              </div>
            </div>

            <div class="admin-subrow">
              <strong style="font-size:0.86rem;">Mandarin Lessons Section</strong>
              <div class="admin-field">
                <label for="cfgLessonsLabel">Eyebrow Label</label>
                <input type="text" class="admin-input" id="cfgLessonsLabel" value="${escapeHTML(cfg.lessonsLabel || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgLessonsTitle">Section Title</label>
                <input type="text" class="admin-input" id="cfgLessonsTitle" value="${escapeHTML(cfg.lessonsTitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgLessonsSub">Section Description</label>
                <textarea class="admin-textarea" id="cfgLessonsSub">${escapeHTML(cfg.lessonsSubtitle || '')}</textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="admin-panel-head">
            <div>
              <h2>Homepage Lessons Card &amp; Course Pass Pricing (Kyat)</h2>
              <p>Edit the unified Lessons gateway card on index.html and set Course Pass prices in Kyat (unlocking all lessons in each course).</p>
            </div>
          </div>

          <div class="admin-grid-2">
            <div class="admin-subrow">
              <strong>Unified Lessons Card</strong>
              <div class="admin-grid-2">
                <div class="admin-field">
                  <label for="cfgLessonsBadge">Badge</label>
                  <input type="text" class="admin-input" id="cfgLessonsBadge" value="${escapeHTML(cfg.lessonsBadge || '')}" />
                </div>
                <div class="admin-field">
                  <label for="cfgLessonsCta">Button Label</label>
                  <input type="text" class="admin-input" id="cfgLessonsCta" value="${escapeHTML(cfg.lessonsCta || '')}" />
                </div>
              </div>
              <div class="admin-field">
                <label for="cfgLessonsCardTitle">Card Title</label>
                <input type="text" class="admin-input" id="cfgLessonsCardTitle" value="${escapeHTML(cfg.lessonsCardTitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgLessonsCardSub">Chinese Subtitle</label>
                <input type="text" class="admin-input" id="cfgLessonsCardSub" value="${escapeHTML(cfg.lessonsCardSubtitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgLessonsCardDesc">Description</label>
                <textarea class="admin-textarea" id="cfgLessonsCardDesc">${escapeHTML(cfg.lessonsCardDesc || '')}</textarea>
              </div>
              <div class="admin-field">
                <label for="cfgLessonsBullets">Bullet Highlights (one per line)</label>
                <textarea class="admin-textarea" id="cfgLessonsBullets">${escapeHTML(
                  (cfg.lessonsBullets || []).join('\n')
                )}</textarea>
              </div>
            </div>

            <div class="admin-subrow">
              <strong>Course Pass Pricing (Kyat)</strong>
              <p style="font-size:0.82rem; color:#64748b; margin:4px 0 12px;">
                Set the full-course unlock price in Kyat for each course. Manage courses in the <strong>Lessons &amp; Exercises</strong> tab.
              </p>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${
                  coursesList.length
                    ? coursesList
                        .map((cName) => {
                          const fallbackVal = courseSlug(cName) === 'hsk2' ? 120 : 100;
                          const curPrice = Number(coursePricesMap[cName]) || fallbackVal;
                          return `
                      <div class="admin-field" style="display:grid; grid-template-columns: 1fr 140px; gap:10px; align-items:center;">
                        <label style="margin:0; font-weight:700;">${escapeHTML(cName)}</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <input type="number" min="0" max="9999999" class="admin-input" data-cfg-course-price="${escapeHTML(
                            cName
                          )}" value="${escapeHTML(curPrice)}" />
                          <span style="font-size:0.82rem; color:#64748b; font-weight:600;">Kyat</span>
                        </div>
                      </div>
                    `;
                        })
                        .join('')
                    : `<span style="font-size:0.84rem; color:#64748b;">No courses defined yet. Add a course in the Lessons tab.</span>`
                }
              </div>
            </div>
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="admin-panel-head">
            <div>
              <h2>Contact Us Details</h2>
              <p>Updates the footer across all pages, QR payment instructions, and lesson review email destination.</p>
            </div>
          </div>

          <div class="admin-grid-3">
            <div class="admin-field">
              <label for="cfgContactEmail">Contact &amp; Review Email *</label>
              <input type="email" class="admin-input" id="cfgContactEmail" value="${escapeHTML(cfg.contactEmail || '')}" required />
            </div>
            <div class="admin-field">
              <label for="cfgContactPhone">Phone Number *</label>
              <input type="text" class="admin-input" id="cfgContactPhone" value="${escapeHTML(cfg.contactPhone || '')}" required />
            </div>
            <div class="admin-field">
              <label for="cfgContactViber">Viber Number *</label>
              <input type="text" class="admin-input" id="cfgContactViber" value="${escapeHTML(cfg.contactViber || '')}" required />
            </div>
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="admin-panel-head">
            <div>
              <h2>Featured on Homepage (Check Items to Showcase)</h2>
              <p>Checked Stories, Short Reels, and Wordwall Games appear immediately on the home page.</p>
            </div>
            <button type="submit" class="admin-btn admin-btn-primary">Save Homepage &amp; Featured</button>
          </div>

          <div style="margin-bottom:16px;">
            <strong style="display:block; font-size:0.86rem; margin-bottom:8px;">Featured Stories (${stories.length})</strong>
            <div class="admin-featured-checklist">
              ${
                stories.length
                  ? stories
                      .map(
                        (s) => `
                  <label class="admin-featured-item">
                    <input type="checkbox" name="featStory" value="${escapeHTML(s.id)}" ${
                          featStories.has(String(s.id || '').toLowerCase()) ? 'checked' : ''
                        } />
                    <span>${escapeHTML(s.title || s.id)} (${escapeHTML(s.chineseTitle || '')})</span>
                  </label>
                `
                      )
                      .join('')
                  : `<span style="font-size:0.84rem; color:#64748b;">No stories uploaded yet.</span>`
              }
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <strong style="display:block; font-size:0.86rem; margin-bottom:8px;">Featured Short Reels (${reels.length})</strong>
            <div class="admin-featured-checklist">
              ${
                reels.length
                  ? reels
                      .map(
                        (r) => `
                  <label class="admin-featured-item">
                    <input type="checkbox" name="featReel" value="${escapeHTML(r.id)}" ${
                          featReels.has(String(r.id || '').toLowerCase()) ? 'checked' : ''
                        } />
                    <span>${escapeHTML(r.title || r.id)}</span>
                  </label>
                `
                      )
                      .join('')
                  : `<span style="font-size:0.84rem; color:#64748b;">No reels uploaded yet.</span>`
              }
            </div>
          </div>

          <div>
            <strong style="display:block; font-size:0.86rem; margin-bottom:8px;">Featured Wordwall Games (${games.length})</strong>
            <div class="admin-featured-checklist">
              ${
                games.length
                  ? games
                      .map(
                        (g) => `
                  <label class="admin-featured-item">
                    <input type="checkbox" name="featGame" value="${escapeHTML(g.id)}" ${
                          featGames.has(String(g.id || '').toLowerCase()) ? 'checked' : ''
                        } />
                    <span>${escapeHTML(g.title || g.id)}</span>
                  </label>
                `
                      )
                      .join('')
                  : `<span style="font-size:0.84rem; color:#64748b;">No games added yet.</span>`
              }
            </div>
          </div>
        </div>
      </form>
    `;

    wireMediaPickers(viewport);

    const logoInput = document.getElementById('cfgSiteLogoUrl');
    const syncLogoDualPreview = () => {
      const urlVal = (logoInput?.value || '').trim();
      const lightBox = document.getElementById('cfgLogoPreviewLight');
      const darkBox = document.getElementById('cfgLogoPreviewDark');
      if (lightBox) lightBox.innerHTML = renderBrandLogoPreviewMarkup(urlVal, false);
      if (darkBox) darkBox.innerHTML = renderBrandLogoPreviewMarkup(urlVal, true);
    };
    if (logoInput) {
      logoInput.addEventListener('input', syncLogoDualPreview);
    }

    const useSampleBtn = document.getElementById('btnUseSampleLogo');
    if (useSampleBtn && logoInput) {
      useSampleBtn.onclick = () => {
        logoInput.value = 'public/assets/aistudio/Screenshot_2026-11-22_at_2.58.21_PM_045e7a40.png';
        logoInput.dispatchEvent(new Event('input', { bubbles: true }));
      };
    }

    const resetLogoBtn = document.getElementById('btnResetSiteLogo');
    if (resetLogoBtn && logoInput) {
      resetLogoBtn.onclick = () => {
        logoInput.value = '';
        logoInput.dispatchEvent(new Event('input', { bubbles: true }));
        toast('Logo field cleared — click Save Logo to restore default 语 JiedeEdu lockup.');
      };
    }

    const saveLogoOnlyBtn = document.getElementById('btnSaveLogoOnly');
    if (saveLogoOnlyBtn && logoInput) {
      saveLogoOnlyBtn.onclick = async () => {
        saveLogoOnlyBtn.disabled = true;
        saveLogoOnlyBtn.textContent = 'Saving…';
        try {
          setSyncStatus('Saving brand logo…');
          const nextLogoUrl = logoInput.value.trim();
          const saved = await window.LinguaAuth.saveSiteConfig({ siteLogoUrl: nextLogoUrl });
          state.siteConfig = saved;
          setSyncStatus('Logo saved');
          toast(nextLogoUrl ? 'Custom site logo saved & applied sitewide.' : 'Restored default 语 JiedeEdu brand lockup.');
        } catch (err) {
          setSyncStatus('Save failed');
          toast(err instanceof Error ? err.message : 'Failed to save logo.', 'error');
        } finally {
          saveLogoOnlyBtn.disabled = false;
          saveLogoOnlyBtn.textContent = 'Save Logo';
        }
      };
    }

    const exportSiteCfgBtn = document.getElementById('btnExportSiteConfig');
    if (exportSiteCfgBtn) {
      exportSiteCfgBtn.onclick = () => {
        if (window.LinguaAuth && typeof window.LinguaAuth.exportSiteConfigJson === 'function') {
          window.LinguaAuth.exportSiteConfigJson();
          toast('Downloaded site-config.json — replace data/site-config.json to publish globally.');
        }
      };
    }

    const form = document.getElementById('adminHomeForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const val = (id) => (document.getElementById(id)?.value || '').trim();
      const lines = (id) =>
        (document.getElementById(id)?.value || '')
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);

      const coursePrices = Object.assign({}, coursePricesMap);
      form.querySelectorAll('[data-cfg-course-price]').forEach((inp) => {
        const cname = inp.getAttribute('data-cfg-course-price');
        if (cname) {
          coursePrices[cname] = Math.max(0, Number(inp.value) || 0);
        }
      });

      const featuredStoryIds = Array.from(form.querySelectorAll('input[name="featStory"]:checked')).map((c) => c.value);
      const featuredReelIds = Array.from(form.querySelectorAll('input[name="featReel"]:checked')).map((c) => c.value);
      const featuredGameIds = Array.from(form.querySelectorAll('input[name="featGame"]:checked')).map((c) => c.value);

      const nextPayload = {
        siteLogoUrl: val('cfgSiteLogoUrl'),
        courses: coursesList,
        heroEyebrow: val('cfgHeroEyebrow'),
        heroTitleLine1: val('cfgHeroTitle1'),
        heroTitleHighlight: val('cfgHeroTitleHi'),
        heroSubtitle: val('cfgHeroSubtitle'),
        heroPrimaryCta: val('cfgHeroCta1'),
        heroSecondaryCta: val('cfgHeroCta2'),
        heroBannerUrl: val('cfgHeroBannerUrl'),
        storiesLabel: val('cfgStoriesLabel'),
        storiesTitle: val('cfgStoriesTitle'),
        storiesSubtitle: val('cfgStoriesSub'),
        reelsLabel: val('cfgReelsLabel'),
        reelsTitle: val('cfgReelsTitle'),
        reelsSubtitle: val('cfgReelsSub'),
        gamesLabel: val('cfgGamesLabel'),
        gamesTitle: val('cfgGamesTitle'),
        gamesSubtitle: val('cfgGamesSub'),
        lessonsLabel: val('cfgLessonsLabel'),
        lessonsTitle: val('cfgLessonsTitle'),
        lessonsSubtitle: val('cfgLessonsSub'),
        lessonsBadge: val('cfgLessonsBadge'),
        lessonsCardTitle: val('cfgLessonsCardTitle'),
        lessonsCardSubtitle: val('cfgLessonsCardSub'),
        lessonsCardDesc: val('cfgLessonsCardDesc'),
        lessonsBullets: lines('cfgLessonsBullets'),
        lessonsCta: val('cfgLessonsCta'),
        coursePrices,
        contactEmail: val('cfgContactEmail'),
        contactPhone: val('cfgContactPhone'),
        contactViber: val('cfgContactViber'),
        featuredStoryIds,
        featuredReelIds,
        featuredGameIds
      };

      try {
        setSyncStatus('Saving…');
        const saved = await window.LinguaAuth.saveSiteConfig(nextPayload);
        state.siteConfig = saved;
        setSyncStatus('Saved');
        toast('Branding logo, Homepage settings, Course prices, Contact Us & Featured items saved.');
      } catch (err) {
        setSyncStatus('Save failed');
        toast(err instanceof Error ? err.message : 'Failed to save homepage settings.', 'error');
      }
    };
  }

  // --- Shared Featured Toggle Helper ---
  async function toggleFeaturedId(listKey, itemId, checked) {
    const cfg = state.siteConfig || {};
    const current = Array.isArray(cfg[listKey]) ? [...cfg[listKey]] : [];
    const next = checked
      ? Array.from(new Set([...current, itemId]))
      : current.filter((x) => !isSameId(x, itemId));
    try {
      setSyncStatus('Updating featured…');
      const saved = await window.LinguaAuth.saveSiteConfig({ [listKey]: next });
      state.siteConfig = saved;
      setSyncStatus('Synced');
      toast(checked ? `Pinned "${itemId}" to Homepage.` : `Removed "${itemId}" from Homepage featured.`);
    } catch (err) {
      setSyncStatus('Update error');
      toast(err instanceof Error ? err.message : 'Could not update featured state.', 'error');
    }
  }

  // --- Reusable Exercise Spreadsheet Importer Modal ---
  function openExerciseSpreadsheetModal(target = 'lessons', presetLessonId = '') {
    try {
      const isStories = target === 'stories';
      const dataObj = isStories ? (state.storiesData || {}) : (state.lessonsData || {});
      const safeClone = typeof cloneArray === 'function' ? cloneArray : (arr) => (Array.isArray(arr) ? arr.slice() : []);
      const allExercises = safeClone(dataObj.Exercises || []);
      const lessonsList = safeClone(dataObj.Lessons || []);

      state.editingExercisesTarget = target;
      state.editingExercisesLessonId = presetLessonId || (lessonsList[0] ? lessonsList[0].id : '');
      state.editingExercisesList = allExercises;

      openModal(`
        <div class="admin-panel-head" style="margin-bottom:14px;">
          <div>
            <h2>Interactive Exercise Editor &amp; Importer (${String(target || 'lessons').toUpperCase()})</h2>
            <p>View, edit, add, or delete quiz exercises for lessons. Use Excel import/export as an optional helper.</p>
          </div>
          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="exCloseModalBtn">✕</button>
        </div>

        <div id="exEditorContent"></div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; border-top:1px solid #e2e8f0; padding-top:14px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="exCancelBtn">Cancel</button>
          <button type="button" class="admin-btn admin-btn-primary" id="exCommitBtn">💾 Save All Exercises</button>
        </div>
      `);

      const renderEditorBody = () => {
        const activeLessonId = state.editingExercisesLessonId;
        const filtered = (state.editingExercisesList || []).filter(
          (e) => !activeLessonId || isSameId(e.lessonId, activeLessonId)
        );

        const container = document.getElementById('exEditorContent');
        if (!container) return;

        const renderOptionCardHTML = (ex, globalIndex, letter, showImageControls) => {
          const optKey = `option${letter}`;
          const imgKey = `option${letter}Image`;
          const imgVal = String(ex[imgKey] || '').trim();
          const resolvedImg = imgVal ? assetUrl(imgVal) : '';
          return `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                <strong style="font-size:0.78rem; color:#334155;">Option ${letter}</strong>
                ${
                  showImageControls && resolvedImg
                    ? `<img src="${escapeHTML(resolvedImg)}" alt="Option ${letter}" style="width:44px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #cbd5e1;" onerror="this.style.display='none'" />`
                    : ''
                }
              </div>
              <input type="text" class="admin-input" placeholder="Caption / Option ${letter} text ${showImageControls ? '(optional)' : ''}" data-ex-field="${globalIndex}:${optKey}" value="${escapeHTML(
            ex[optKey] || ''
          )}" />
              ${
                showImageControls
                  ? `
                <div style="display:flex; gap:6px; align-items:center;">
                  <input type="text" class="admin-input" style="font-size:0.78rem;" placeholder="Image URL or assets/..." data-ex-field="${globalIndex}:${imgKey}" value="${escapeHTML(
                      imgVal
                    )}" />
                  <label class="admin-btn admin-btn-secondary admin-btn-sm" style="margin:0; cursor:pointer; white-space:nowrap;">
                    <span>Upload</span>
                    <input type="file" accept="image/*" data-ex-upload="${globalIndex}:${imgKey}" hidden />
                  </label>
                </div>
              `
                  : ''
              }
            </div>
          `;
        };

        container.innerHTML = `
          <div style="margin-bottom:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <strong style="font-size:0.86rem;">Optional: Bulk Excel Spreadsheet Import / Export</strong>
                <div style="font-size:0.78rem; color:#64748b;">Upload or download exercises as an Excel (.xlsx) file (supports image &amp; audio columns).</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="exDownloadTplBtn">Download Template</button>
                <label class="admin-btn admin-btn-secondary admin-btn-sm" style="margin:0; cursor:pointer;">
                  <span>Import .xlsx</span>
                  <input type="file" id="exFileInput" accept=".xlsx,.xls,.csv" hidden />
                </label>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong>Exercises for:</strong>
              <select id="exModalLessonSelect" class="admin-select" style="max-width:280px;">
                <option value="">All Lessons / Stories (${(state.editingExercisesList || []).length} total)</option>
                ${lessonsList
                  .map(
                    (l) =>
                      `<option value="${escapeHTML(l.id)}" ${isSameId(l.id, activeLessonId) ? 'selected' : ''}>${escapeHTML(
                        l.id
                      )} — ${escapeHTML(l.title)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="exAddImgBtn">+ Image Choice</button>
              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="exAddSharedBtn">+ Shared Top Bank</button>
              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="exAddFillBtn">+ Write Character (Pinyin)</button>
              <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="exAddRowBtn">+ Add Text Exercise</button>
            </div>
          </div>

          <div style="max-height:460px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-right:4px;">
            ${
              filtered.length
                ? filtered
                    .map((ex, idx) => {
                      const globalIndex = state.editingExercisesList.indexOf(ex);
                      const qType = String(ex.type || 'multiple-choice').trim().toLowerCase();
                      const isImageChoice = qType === 'image-choice';
                      const isSharedImage = qType === 'shared-image-match';
                      const isSharedText = qType === 'shared-text-match';
                      const isSharedBank = isSharedImage || isSharedText;
                      const isFillBlank = qType === 'fill-blank' || qType === 'pinyin-write' || qType === 'write-hanzi';
                      const showImageControls =
                        isImageChoice ||
                        isSharedImage ||
                        Boolean(
                          ex.optionAImage ||
                            ex.optionBImage ||
                            ex.optionCImage ||
                            ex.optionDImage ||
                            ex.optionEImage
                        );
                      const audioVal = String(ex.audioUrl || '').trim();
                      const ansVal = String(ex.answer || '').trim();
                      const ansUpper = ansVal.toUpperCase();

                      return `
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:10px;">
                          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                              <label style="font-size:0.78rem; font-weight:700; color:#475569;">#
                                <input type="number" class="admin-input" style="width:58px; display:inline-block; margin-left:4px;" data-ex-field="${globalIndex}:order" value="${escapeHTML(
                        ex.order || idx + 1
                      )}" />
                              </label>
                              <input type="text" class="admin-input" style="width:140px;" placeholder="Lesson ID" data-ex-field="${globalIndex}:lessonId" value="${escapeHTML(
                        ex.lessonId || activeLessonId || ''
                      )}" />
                              <select class="admin-select" style="width:245px;" data-ex-type="${globalIndex}">
                                <option value="multiple-choice" ${qType === 'multiple-choice' ? 'selected' : ''}>Multiple Choice (Text)</option>
                                <option value="image-choice" ${qType === 'image-choice' ? 'selected' : ''}>Image Choice (Per Question)</option>
                                <option value="shared-image-match" ${qType === 'shared-image-match' ? 'selected' : ''}>Shared Top Bank (Images or Text)</option>
                                <option value="shared-text-match" ${qType === 'shared-text-match' ? 'selected' : ''}>Shared Top Text Bank (Words / Sentences)</option>
                                <option value="fill-blank" ${isFillBlank ? 'selected' : ''}>Write Chinese / Fill Blank (Pinyin)</option>
                              </select>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center;">
                              ${
                                isSharedBank
                                  ? `<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-ex-clone-group="${globalIndex}" title="Add another question below that uses the exact same top A–E choices">+ Question in Group</button>`
                                  : ''
                              }
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-ex-dup="${globalIndex}">Duplicate</button>
                              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-ex-del="${globalIndex}">Delete</button>
                            </div>
                          </div>

                          ${
                            isSharedBank
                              ? `
                            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:6px;">
                              <div style="display:grid; grid-template-columns:160px 1fr; gap:8px; align-items:center;">
                                <div>
                                  <label style="display:block; font-size:0.74rem; font-weight:700; color:#1e40af; margin-bottom:2px;">Group ID *</label>
                                  <input type="text" class="admin-input" placeholder="e.g. part-2" data-ex-field="${globalIndex}:groupId" value="${escapeHTML(
                                    ex.groupId || 'part-2'
                                  )}" />
                                </div>
                                <div>
                                  <label style="display:block; font-size:0.74rem; font-weight:700; color:#1e40af; margin-bottom:2px;">Top Section Instruction (shared above A–E choices)</label>
                                  <input type="text" class="admin-input" placeholder="e.g. Questions 14–17: Choose the correct word or sentence for each question." data-ex-field="${globalIndex}:groupTitle" value="${escapeHTML(
                                    ex.groupTitle || ''
                                  )}" />
                                </div>
                              </div>
                              <div style="font-size:0.74rem; color:#1e40af;">
                                Tip: Leave Option Image fields empty to display a text-only shared Word Bank or Sentence Matching bank at the top (supports A–E).
                              </div>
                            </div>
                          `
                              : ''
                          }

                          <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:8px; align-items:start;">
                            <div>
                              <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">${
                                isFillBlank
                                  ? 'Sentence with Blank (use ( ) or ____ where character goes)'
                                  : 'Question Text / Dialogue Prompt'
                              }</label>
                              <input type="text" class="admin-input" placeholder="${
                                isFillBlank
                                  ? 'e.g. 他 ( ) 时候 不 吃 晚饭。'
                                  : 'Enter question text or dialogue prompt...'
                              }" data-ex-field="${globalIndex}:question" value="${escapeHTML(
                        ex.question || ''
                      )}" />
                            </div>
                            <div>
                              <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Optional Audio (Listening Exercise)</label>
                              <div style="display:flex; gap:6px; align-items:center;">
                                <input type="text" class="admin-input" style="font-size:0.8rem;" placeholder="assets/audio/... or https://..." data-ex-field="${globalIndex}:audioUrl" value="${escapeHTML(
                        audioVal
                      )}" />
                                <label class="admin-btn admin-btn-secondary admin-btn-sm" style="margin:0; cursor:pointer; white-space:nowrap;">
                                  <span>Upload Audio</span>
                                  <input type="file" accept="audio/*" data-ex-upload="${globalIndex}:audioUrl" hidden />
                                </label>
                              </div>
                              ${
                                audioVal
                                  ? `<audio src="${escapeHTML(assetUrl(audioVal))}" controls preload="none" style="height:28px; width:100%; margin-top:4px;"></audio>`
                                  : ''
                              }
                            </div>
                          </div>

                          ${
                            isFillBlank || isSharedBank
                              ? `
                            <div>
                              <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">${
                                isFillBlank
                                  ? 'Pinyin Cue for Blank / Full Sentence Pinyin *'
                                  : 'Optional Pinyin Line (shown above/with question)'
                              }</label>
                              <input type="text" class="admin-input" placeholder="${
                                isFillBlank
                                  ? 'e.g. yǒu  (or full pinyin: Tā yǒu shíhou bù chī wǎnfàn.)'
                                  : 'e.g. Nǐ shì lái lǚyóu de ba?'
                              }" data-ex-field="${globalIndex}:pinyin" value="${escapeHTML(
                                  ex.pinyin || ''
                                )}" />
                            </div>
                          `
                              : ''
                          }

                          ${
                            isFillBlank
                              ? ''
                              : `
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                              ${renderOptionCardHTML(ex, globalIndex, 'A', showImageControls)}
                              ${renderOptionCardHTML(ex, globalIndex, 'B', showImageControls)}
                              ${renderOptionCardHTML(ex, globalIndex, 'C', showImageControls)}
                              ${renderOptionCardHTML(ex, globalIndex, 'D', showImageControls)}
                              ${renderOptionCardHTML(ex, globalIndex, 'E', showImageControls)}
                            </div>
                          `
                          }

                          <div style="display:grid; grid-template-columns:280px 1fr; gap:8px; align-items:start;">
                            <div>
                              <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">${
                                isFillBlank
                                  ? 'Correct Chinese Character(s) (separate alternatives with /)'
                                  : 'Correct Answer (Letter A–E or Exact Text)'
                              }</label>
                              <div style="display:flex; gap:4px; align-items:center;">
                                ${
                                  isFillBlank
                                    ? ''
                                    : `
                                  <select class="admin-select" style="width:82px;" data-ex-ans-letter="${globalIndex}" title="Quick select correct letter A, B, C, D, or E">
                                    <option value="">Pick</option>
                                    <option value="A" ${ansUpper === 'A' ? 'selected' : ''}>A</option>
                                    <option value="B" ${ansUpper === 'B' ? 'selected' : ''}>B</option>
                                    <option value="C" ${ansUpper === 'C' ? 'selected' : ''}>C</option>
                                    <option value="D" ${ansUpper === 'D' ? 'selected' : ''}>D</option>
                                    <option value="E" ${ansUpper === 'E' ? 'selected' : ''}>E</option>
                                  </select>
                                `
                                }
                                <input type="text" class="admin-input" placeholder="${
                                  isFillBlank ? 'e.g. 有' : 'e.g. D or Option text'
                                }" data-ex-field="${globalIndex}:answer" value="${escapeHTML(
                        ansVal
                      )}" />
                              </div>
                            </div>
                            <div>
                              <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Explanation (Shown After Answer Check)</label>
                              <input type="text" class="admin-input" placeholder="Why is this the correct answer?" data-ex-field="${globalIndex}:explanation" value="${escapeHTML(
                        ex.explanation || ''
                      )}" />
                            </div>
                          </div>
                        </div>
                      `;
                    })
                    .join('')
                : `<div style="text-align:center; color:#64748b; padding:28px; border:1px dashed #cbd5e1; border-radius:12px;">No exercises found for this lesson. Click <strong>+ Add Text Exercise</strong>, <strong>+ Image Choice</strong>, <strong>+ Shared Top Bank</strong>, or <strong>+ Write Character (Pinyin)</strong> above.</div>`
            }
          </div>
        `;

        const lessonDropdown = document.getElementById('exModalLessonSelect');
        if (lessonDropdown) {
          lessonDropdown.onchange = (e) => {
            state.editingExercisesLessonId = e.target.value;
            renderEditorBody();
          };
        }

        const pushNewExercise = (typePreset, extra = {}) => {
          const targetLesson = state.editingExercisesLessonId || (lessonsList[0] ? lessonsList[0].id : 'lesson-01');
          const lessonCount = state.editingExercisesList.filter((x) => isSameId(x.lessonId, targetLesson)).length;
          const isSharedPreset = typePreset === 'shared-image-match' || typePreset === 'shared-text-match';
          state.editingExercisesList.push({
            lessonId: targetLesson,
            order: lessonCount + 1,
            type: typePreset,
            groupId: isSharedPreset ? 'part-2' : '',
            groupTitle: isSharedPreset
              ? 'Choose the matching option (A–E) from the choices above for each question.'
              : '',
            pinyin: '',
            question: typePreset === 'fill-blank' ? '他 ( ) 时候 不 吃 晚饭。' : '',
            audioUrl: '',
            optionA: '',
            optionB: '',
            optionC: '',
            optionD: '',
            optionE: '',
            optionAImage: '',
            optionBImage: '',
            optionCImage: '',
            optionDImage: '',
            optionEImage: '',
            answer: typePreset === 'image-choice' || isSharedPreset ? 'A' : '',
            explanation: '',
            ...extra
          });
          renderEditorBody();
        };

        const addBtn = document.getElementById('exAddRowBtn');
        if (addBtn) addBtn.onclick = () => pushNewExercise('multiple-choice');

        const addImgBtn = document.getElementById('exAddImgBtn');
        if (addImgBtn) addImgBtn.onclick = () => pushNewExercise('image-choice');

        const addSharedBtn = document.getElementById('exAddSharedBtn');
        if (addSharedBtn) addSharedBtn.onclick = () => pushNewExercise('shared-image-match');

        const addFillBtn = document.getElementById('exAddFillBtn');
        if (addFillBtn) addFillBtn.onclick = () => pushNewExercise('fill-blank');

        container.querySelectorAll('[data-ex-clone-group]').forEach((btn) => {
          btn.onclick = () => {
            const srcIdx = Number(btn.getAttribute('data-ex-clone-group'));
            const src = state.editingExercisesList[srcIdx];
            if (!src) return;
            pushNewExercise(src.type || 'shared-image-match', {
              lessonId: src.lessonId,
              groupId: src.groupId || 'part-2',
              groupTitle: src.groupTitle || '',
              optionA: src.optionA || '',
              optionB: src.optionB || '',
              optionC: src.optionC || '',
              optionD: src.optionD || '',
              optionE: src.optionE || '',
              optionAImage: src.optionAImage || '',
              optionBImage: src.optionBImage || '',
              optionCImage: src.optionCImage || '',
              optionDImage: src.optionDImage || '',
              optionEImage: src.optionEImage || '',
              answer: 'A'
            });
          };
        });

        container.querySelectorAll('[data-ex-type]').forEach((sel) => {
          sel.onchange = () => {
            const gIdx = Number(sel.getAttribute('data-ex-type'));
            if (state.editingExercisesList[gIdx]) {
              state.editingExercisesList[gIdx].type = sel.value;
              if (
                (sel.value === 'shared-image-match' || sel.value === 'shared-text-match') &&
                !state.editingExercisesList[gIdx].groupId
              ) {
                state.editingExercisesList[gIdx].groupId = 'part-2';
              }
              renderEditorBody();
            }
          };
        });

        container.querySelectorAll('[data-ex-ans-letter]').forEach((sel) => {
          sel.onchange = () => {
            const gIdx = Number(sel.getAttribute('data-ex-ans-letter'));
            if (state.editingExercisesList[gIdx] && sel.value) {
              state.editingExercisesList[gIdx].answer = sel.value;
              const inp = container.querySelector(`[data-ex-field="${gIdx}:answer"]`);
              if (inp) inp.value = sel.value;
            }
          };
        });

        container.querySelectorAll('[data-ex-upload]').forEach((fileInp) => {
          fileInp.onchange = async () => {
            const file = fileInp.files && fileInp.files[0];
            if (!file) return;
            const [gIdxStr, fieldKey] = fileInp.getAttribute('data-ex-upload').split(':');
            const gIdx = Number(gIdxStr);
            try {
              setSyncStatus(`Uploading ${file.name}…`);
              const result = await uploadAdminMediaFile(file);
              if (state.editingExercisesList[gIdx]) {
                state.editingExercisesList[gIdx][fieldKey] = result.url;
                // If uploading an image for a shared-image-match group, also propagate empty slots to matching groupId siblings
                if (
                  (state.editingExercisesList[gIdx].type === 'shared-image-match' ||
                    state.editingExercisesList[gIdx].type === 'shared-text-match') &&
                  state.editingExercisesList[gIdx].groupId &&
                  fieldKey.endsWith('Image')
                ) {
                  const gId = String(state.editingExercisesList[gIdx].groupId).trim().toLowerCase();
                  const lId = String(state.editingExercisesList[gIdx].lessonId || '').trim().toLowerCase();
                  state.editingExercisesList.forEach((row) => {
                    if (
                      (row.type === 'shared-image-match' || row.type === 'shared-text-match') &&
                      String(row.lessonId || '').trim().toLowerCase() === lId &&
                      String(row.groupId || '').trim().toLowerCase() === gId &&
                      !row[fieldKey]
                    ) {
                      row[fieldKey] = result.url;
                    }
                  });
                }
              }
              renderEditorBody();
              setSyncStatus(result.uploadedToServer ? 'Media uploaded' : 'Media attached');
              toast(result.uploadedToServer ? `Uploaded ${file.name} (${result.url}).` : `Attached ${file.name} successfully.`);
            } catch (err) {
              setSyncStatus('Media error');
              toast(err instanceof Error ? err.message : 'Failed to attach media.', 'error');
            } finally {
              fileInp.value = '';
            }
          };
        });

        container.querySelectorAll('[data-ex-field]').forEach((inp) => {
          inp.oninput = () => {
            const [gIdxStr, fieldKey] = inp.getAttribute('data-ex-field').split(':');
            const gIdx = Number(gIdxStr);
            if (state.editingExercisesList[gIdx]) {
              state.editingExercisesList[gIdx][fieldKey] = inp.value;
            }
          };
        });

        container.querySelectorAll('[data-ex-dup]').forEach((btn) => {
          btn.onclick = () => {
            const gIdx = Number(btn.getAttribute('data-ex-dup'));
            const src = state.editingExercisesList[gIdx];
            if (!src) return;
            const currentLsnId = src.lessonId || state.editingExercisesLessonId || (lessonsList[0] ? lessonsList[0].id : '');
            openDuplicateModal({
              useSubModal: true,
              entityLabel: 'Exercise',
              sourceTitle: src.question || src.pinyin || 'Exercise Question',
              hideIdField: true,
              showTargetLessonSelect: lessonsList.length > 0,
              lessonOptions: lessonsList,
              defaultLessonId: currentLsnId,
              helpText: 'Enter the new question/title. Copies type, options A–E, images, audio, pinyin, answer & explanation into the chosen lesson.',
              onConfirm: async ({ newTitle, targetLessonId }) => {
                const destLesson = targetLessonId || currentLsnId;
                const sameLesson = isSameId(destLesson, currentLsnId);
                const destOrders = (state.editingExercisesList || [])
                  .filter((x) => isSameId(x.lessonId, destLesson))
                  .map((x) => Number(x.order) || 0);
                const nextOrder = (destOrders.length ? Math.max(...destOrders) : 0) + 1;
                const clone = {
                  ...src,
                  lessonId: destLesson,
                  question: newTitle,
                  order: nextOrder
                };
                if (sameLesson) {
                  state.editingExercisesList.splice(gIdx + 1, 0, clone);
                } else {
                  state.editingExercisesList.push(clone);
                }
                const cleaned = (state.editingExercisesList || [])
                  .map((r, i) => ({
                    lessonId: String(r.lessonId || '').trim(),
                    order: Number(r.order) || i + 1,
                    type: String(r.type || 'multiple-choice').trim(),
                    groupId: String(r.groupId || '').trim(),
                    groupTitle: String(r.groupTitle || '').trim(),
                    pinyin: String(r.pinyin || '').trim(),
                    question: String(r.question || '').trim(),
                    audioUrl: String(r.audioUrl || '').trim(),
                    optionA: String(r.optionA || '').trim(),
                    optionB: String(r.optionB || '').trim(),
                    optionC: String(r.optionC || '').trim(),
                    optionD: String(r.optionD || '').trim(),
                    optionE: String(r.optionE || '').trim(),
                    optionAImage: String(r.optionAImage || '').trim(),
                    optionBImage: String(r.optionBImage || '').trim(),
                    optionCImage: String(r.optionCImage || '').trim(),
                    optionDImage: String(r.optionDImage || '').trim(),
                    optionEImage: String(r.optionEImage || '').trim(),
                    answer: String(r.answer || '').trim(),
                    explanation: String(r.explanation || '').trim()
                  }))
                  .filter(
                    (r) =>
                      r.question ||
                      r.pinyin ||
                      r.audioUrl ||
                      r.optionAImage ||
                      r.optionBImage ||
                      r.optionCImage ||
                      r.optionDImage ||
                      r.optionEImage
                  );
                const res = await getContentStore().importExercisesLocal({
                  target: target,
                  mode: 'replace_all',
                  rows: cleaned
                });
                if (target === 'stories') {
                  state.storiesData.Exercises = res.exercises || cleaned;
                } else {
                  state.lessonsData.Exercises = res.exercises || cleaned;
                }
                state.editingExercisesList = cloneArray(res.exercises || cleaned);
                renderEditorBody();
                updateNavCounts();
                renderActiveTab();
                applySyncFeedback(
                  res,
                  `Duplicated exercise into "${destLesson}" & synced.`,
                  `Duplicated exercise into "${destLesson}" locally.`
                );
              }
            });
          };
        });

        container.querySelectorAll('[data-ex-del]').forEach((btn) => {
          btn.onclick = () => {
            const gIdx = Number(btn.getAttribute('data-ex-del'));
            state.editingExercisesList.splice(gIdx, 1);
            renderEditorBody();
          };
        });

        const fileInput = document.getElementById('exFileInput');
        if (fileInput) {
          fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (typeof window.XLSX === 'undefined') {
              toast('Excel library is still loading.', 'error');
              return;
            }
            try {
              const buf = await file.arrayBuffer();
              const wb = window.XLSX.read(buf, { type: 'array' });
              const sheetName = wb.SheetNames.includes('Exercises') ? 'Exercises' : wb.SheetNames[0];
              if (!sheetName) {
                toast('No worksheet found in file.', 'error');
                return;
              }
              const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
              const parsed = rows.map((r, i) => ({
                lessonId: String(r.lessonId || r.LessonId || r['Lesson ID'] || state.editingExercisesLessonId || '').trim(),
                order: Number(r.order || r.Order) || i + 1,
                type: String(r.type || r.Type || 'multiple-choice').trim(),
                groupId: String(r.groupId || r.GroupId || r.group_id || '').trim(),
                groupTitle: String(r.groupTitle || r.GroupTitle || r.group_title || '').trim(),
                pinyin: String(r.pinyin || r.Pinyin || r.pinyinHint || r.pinyin_hint || '').trim(),
                question: String(r.question || r.Question || '').trim(),
                audioUrl: String(r.audioUrl || r.AudioUrl || r.audio_url || r.audio || '').trim(),
                optionA: String(r.optionA ?? r.OptionA ?? '').trim(),
                optionB: String(r.optionB ?? r.OptionB ?? '').trim(),
                optionC: String(r.optionC ?? r.OptionC ?? '').trim(),
                optionD: String(r.optionD ?? r.OptionD ?? '').trim(),
                optionE: String(r.optionE ?? r.OptionE ?? '').trim(),
                optionAImage: String(r.optionAImage || r.option_a_image || '').trim(),
                optionBImage: String(r.optionBImage || r.option_b_image || '').trim(),
                optionCImage: String(r.optionCImage || r.option_c_image || '').trim(),
                optionDImage: String(r.optionDImage || r.option_d_image || '').trim(),
                optionEImage: String(r.optionEImage || r.option_e_image || '').trim(),
                answer: String(r.answer || r.Answer || r.correct || '').trim(),
                explanation: String(r.explanation || r.Explanation || '').trim()
              }));
              state.editingExercisesList = state.editingExercisesList.concat(parsed);
              renderEditorBody();
              toast(`Imported ${parsed.length} exercise rows from ${file.name}. Review and click Save All Exercises to persist.`);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Failed to parse Excel file.', 'error');
            } finally {
              fileInput.value = '';
            }
          };
        }

        const tplBtn = document.getElementById('exDownloadTplBtn');
        if (tplBtn) {
          tplBtn.onclick = () => {
            if (typeof window.XLSX === 'undefined') {
              toast('Excel library is still loading.', 'error');
              return;
            }
            const sampleRows = filtered.length ? filtered : [
              {
                lessonId: state.editingExercisesLessonId || 'lesson-01',
                order: 1,
                type: 'image-choice',
                groupId: '',
                groupTitle: '',
                pinyin: '',
                question: '我每天坐公交车去上班。(I take the bus to work every day.)',
                audioUrl: '',
                optionA: 'Bus',
                optionB: 'Airplane',
                optionC: 'Bicycle',
                optionD: '',
                optionE: '',
                optionAImage: 'assets/images/bus.jpg',
                optionBImage: 'assets/images/plane.jpg',
                optionCImage: 'assets/images/bike.jpg',
                optionDImage: '',
                optionEImage: '',
                answer: 'A',
                explanation: '公交车 (gōngjiāochē) means bus.'
              },
              {
                lessonId: state.editingExercisesLessonId || 'lesson-01',
                order: 2,
                type: 'fill-blank',
                groupId: '',
                groupTitle: '',
                pinyin: 'yǒu',
                question: '他 ( ) 时候 不 吃 晚饭。',
                audioUrl: '',
                optionA: '',
                optionB: '',
                optionC: '',
                optionD: '',
                optionE: '',
                optionAImage: '',
                optionBImage: '',
                optionCImage: '',
                optionDImage: '',
                optionEImage: '',
                answer: '有',
                explanation: '有时候 (yǒu shíhou) means sometimes.'
              }
            ];
            const ws = window.XLSX.utils.json_to_sheet(sampleRows);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Exercises');
            window.XLSX.writeFile(wb, `jiedeedu-${target}-exercises-template.xlsx`);
            toast('Downloaded exercise template (.xlsx).');
          };
        }
      };

      renderEditorBody();

      const closeBtn = document.getElementById('exCloseModalBtn');
      if (closeBtn) closeBtn.onclick = closeModal;
      const cancelBtn = document.getElementById('exCancelBtn');
      if (cancelBtn) cancelBtn.onclick = closeModal;

      const commitBtn = document.getElementById('exCommitBtn');
      if (commitBtn) {
        commitBtn.onclick = async () => {
          commitBtn.disabled = true;
          commitBtn.textContent = 'Saving…';
          try {
            const cleaned = (state.editingExercisesList || [])
              .map((r, i) => ({
                lessonId: String(r.lessonId || '').trim(),
                order: Number(r.order) || i + 1,
                type: String(r.type || 'multiple-choice').trim(),
                groupId: String(r.groupId || '').trim(),
                groupTitle: String(r.groupTitle || '').trim(),
                pinyin: String(r.pinyin || '').trim(),
                question: String(r.question || '').trim(),
                audioUrl: String(r.audioUrl || '').trim(),
                optionA: String(r.optionA || '').trim(),
                optionB: String(r.optionB || '').trim(),
                optionC: String(r.optionC || '').trim(),
                optionD: String(r.optionD || '').trim(),
                optionE: String(r.optionE || '').trim(),
                optionAImage: String(r.optionAImage || '').trim(),
                optionBImage: String(r.optionBImage || '').trim(),
                optionCImage: String(r.optionCImage || '').trim(),
                optionDImage: String(r.optionDImage || '').trim(),
                optionEImage: String(r.optionEImage || '').trim(),
                answer: String(r.answer || '').trim(),
                explanation: String(r.explanation || '').trim()
              }))
              .filter(
                (r) =>
                  r.question ||
                  r.pinyin ||
                  r.audioUrl ||
                  r.optionAImage ||
                  r.optionBImage ||
                  r.optionCImage ||
                  r.optionDImage ||
                  r.optionEImage
              );

            const res = await getContentStore().importExercisesLocal({
              target: target,
              mode: 'replace_all',
              rows: cleaned
            });

            if (target === 'stories') {
              state.storiesData.Exercises = res.exercises || cleaned;
            } else {
              state.lessonsData.Exercises = res.exercises || cleaned;
            }

            closeModal();
            applySyncFeedback(
              res,
              `Saved ${cleaned.length} exercise(s) to Excel & DB!`,
              `Saved ${cleaned.length} exercise(s) locally.`
            );
            renderActiveTab();
          } catch (err) {
            commitBtn.disabled = false;
            commitBtn.textContent = '💾 Save All Exercises';
            toast(err instanceof Error ? err.message : 'Failed to save exercises.', 'error');
          }
        };
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open exercise editor modal.', 'error');
    }
  }

  // --- Tab 2: Stories & Exercises ---
  function renderStoriesTab(viewport) {
    const stories = state.storiesData.Lessons || [];
    const scenes = state.storiesData.Story || [];
    const exercises = state.storiesData.Exercises || [];
    const featSet = new Set(((state.siteConfig && state.siteConfig.featuredStoryIds) || []).map((x) => x.toLowerCase()));
    const q = state.filters.storySearch.toLowerCase();
    const filtered = stories.filter(
      (s) =>
        !q ||
        String(s.title || '').toLowerCase().includes(q) ||
        String(s.chineseTitle || '').toLowerCase().includes(q) ||
        String(s.id || '').toLowerCase().includes(q)
    );

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Stories &amp; Reading Lessons (${stories.length})</h2>
            <p>Create, edit, or delete Mandarin stories, reading scenes, vocabulary, featured status, and exercises.</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="admin-btn admin-btn-secondary" id="btnUploadStoryExercises">Upload Exercises (.xlsx)</button>
            <button type="button" class="admin-btn admin-btn-primary" id="btnAddStory">+ New Story</button>
          </div>
        </div>
        ${renderWorkbookSyncToolbar('stories', 'stories.xlsx')}

        <div style="margin-bottom:14px; max-width:340px;">
          <input type="search" class="admin-input" id="storySearchInput" value="${escapeHTML(
            state.filters.storySearch
          )}" placeholder="Search story title or ID…" />
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Featured</th>
                <th>ID</th>
                <th>Story Title</th>
                <th>Level</th>
                <th class="num">Scenes</th>
                <th class="num">Exercises</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length
                  ? filtered
                      .map((s) => {
                        const sScenes = scenes.filter((r) => isSameId(r.lessonId, s.id)).length;
                        const sEx = exercises.filter((r) => isSameId(r.lessonId, s.id)).length;
                        const isFeat = featSet.has(String(s.id || '').toLowerCase());
                        return `
                        <tr>
                          <td>
                            <input type="checkbox" data-feat-story="${escapeHTML(s.id)}" ${isFeat ? 'checked' : ''} aria-label="Feature ${escapeHTML(
                          s.title
                        )} on home" />
                          </td>
                          <td><code>${escapeHTML(s.id)}</code></td>
                          <td>
                            <strong>${escapeHTML(s.title || '')}</strong>
                            <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(s.chineseTitle || '')} · ${escapeHTML(
                          s.pinyin || ''
                        )}</div>
                          </td>
                          <td>${escapeHTML(s.level || 'Beginner')}</td>
                          <td class="num">${sScenes}</td>
                          <td class="num">${sEx}</td>
                          <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-story="${escapeHTML(
                                s.id
                              )}">Edit</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-dup-story="${escapeHTML(
                                s.id
                              )}">Duplicate</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-ex-story="${escapeHTML(
                                s.id
                              )}">Exercises</button>
                              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-del-story="${escapeHTML(
                                s.id
                              )}">Delete</button>
                            </div>
                          </td>
                        </tr>
                      `;
                      })
                      .join('')
                  : `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:24px;">No matching stories found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    wireWorkbookSyncToolbar(viewport);
    document.getElementById('storySearchInput').oninput = (e) => {
      state.filters.storySearch = e.target.value;
      renderStoriesTab(viewport);
    };
    document.getElementById('btnAddStory').onclick = () => openStoryEditorModal(null);
    document.getElementById('btnUploadStoryExercises').onclick = () => openExerciseSpreadsheetModal('stories', '');

    viewport.querySelectorAll('[data-feat-story]').forEach((cb) => {
      cb.onchange = () => toggleFeaturedId('featuredStoryIds', cb.getAttribute('data-feat-story'), cb.checked);
    });
    viewport.querySelectorAll('[data-edit-story]').forEach((btn) => {
      btn.onclick = () => {
        const s = stories.find((x) => isSameId(x.id, btn.getAttribute('data-edit-story')));
        openStoryEditorModal(s || null);
      };
    });
    viewport.querySelectorAll('[data-dup-story]').forEach((btn) => {
      btn.onclick = () => {
        const src = stories.find((x) => isSameId(x.id, btn.getAttribute('data-dup-story')));
        if (!src) return;
        openDuplicateModal({
          entityLabel: 'Story',
          sourceTitle: src.title || src.id,
          sourceId: src.id,
          existingIds: stories.map((x) => x.id),
          helpText: 'Copies story metadata, video & poster, all reading scenes, vocabulary rows, and exercises into a new editable story.',
          onConfirm: async ({ newTitle, newId }) => {
            const copiedStory = { ...src, id: newId, title: newTitle };
            const copiedScenes = (state.storiesData.Story || [])
              .filter((r) => isSameId(r.lessonId, src.id))
              .map((r) => ({ ...r, lessonId: newId }));
            const copiedVocab = (state.storiesData.Vocabulary || [])
              .filter((r) => isSameId(r.lessonId, src.id))
              .map((r) => ({ ...r, lessonId: newId }));
            const copiedExercises = (state.storiesData.Exercises || [])
              .filter((r) => isSameId(r.lessonId, src.id))
              .map((r) => ({ ...r, lessonId: newId }));

            const res = await getContentStore().saveStoriesSheets({
              Lessons: [...stories, copiedStory],
              Story: [...(state.storiesData.Story || []), ...copiedScenes],
              Vocabulary: [...(state.storiesData.Vocabulary || []), ...copiedVocab],
              Exercises: [...(state.storiesData.Exercises || []), ...copiedExercises]
            });
            state.storiesData = { ...state.storiesData, ...res.sheets };
            updateNavCounts();
            applySyncFeedback(
              res,
              `Duplicated story "${newTitle}" (${newId}) & synced to Excel & DB.`,
              `Duplicated story "${newTitle}" (${newId}) locally.`
            );
            renderActiveTab();
          }
        });
      };
    });
    viewport.querySelectorAll('[data-ex-story]').forEach((btn) => {
      btn.onclick = () => openExerciseSpreadsheetModal('stories', btn.getAttribute('data-ex-story'));
    });
    viewport.querySelectorAll('[data-del-story]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-del-story');
        openConfirmDialog({
          title: `Delete story "${id}"?`,
          message: 'This permanently deletes the story, its reading scenes, vocabulary, and exercises from Excel and the database.',
          confirmLabel: 'Delete Story',
          onConfirm: async () => {
            const nextLessons = stories.filter((x) => !isSameId(x.id, id));
            const nextScenes = state.storiesData.Story.filter((x) => !isSameId(x.lessonId, id));
            const nextVocab = state.storiesData.Vocabulary.filter((x) => !isSameId(x.lessonId, id));
            const nextExercises = (state.storiesData.Exercises || []).filter((x) => !isSameId(x.lessonId, id));
            try {
              const res = await getContentStore().saveStoriesSheets({
                Lessons: nextLessons,
                Story: nextScenes,
                Vocabulary: nextVocab,
                Exercises: nextExercises
              });
              state.storiesData = { ...state.storiesData, ...res.sheets };
              updateNavCounts();
              applySyncFeedback(
                res,
                `Deleted story ${id} and synced to Excel & DB.`,
                `Deleted story ${id} locally.`
              );
              renderActiveTab();
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Failed to delete story.', 'error');
            }
          }
        });
      };
    });
  }

  function openStoryEditorModal(story) {
    const isNew = !story;
    const base = story || {
      id: `lesson-${String(state.storiesData.Lessons.length + 1).padStart(2, '0')}`,
      title: '',
      chineseTitle: '',
      pinyin: '',
      meaning: '',
      level: 'Beginner',
      description: '',
      video: 'assets/video/lesson-01.mp4',
      poster: 'assets/images/story-poster.jpg'
    };

    state.editingStoryScenes = story
      ? state.storiesData.Story.filter((r) => isSameId(r.lessonId, story.id)).map((r) => ({ ...r }))
      : [{ lessonId: base.id, order: 1, chinese: '', pinyin: '', english: '', image: 'assets/images/story-01.jpg', audio: '' }];

    state.editingStoryVocab = story
      ? state.storiesData.Vocabulary.filter((r) => isSameId(r.lessonId, story.id)).map((r) => ({ ...r }))
      : [{ lessonId: base.id, order: 1, character: '', pinyin: '', meaning: '', audio: '' }];

    const featSet = new Set(((state.siteConfig && state.siteConfig.featuredStoryIds) || []).map((x) => x.toLowerCase()));
    const isFeatured = featSet.has(String(base.id).toLowerCase());

    const renderSubLists = () => {
      const scenesBox = document.getElementById('storyScenesList');
      if (scenesBox) {
        scenesBox.innerHTML = state.editingStoryScenes
          .map(
            (sc, i) => `
          <div class="admin-subrow">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>Scene #${i + 1}</strong>
              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-rm-scene="${i}">Remove</button>
            </div>
            <div class="admin-grid-3">
              <div class="admin-field">
                <label>Chinese Sentence</label>
                <input type="text" class="admin-input" data-sc="${i}:chinese" value="${escapeHTML(sc.chinese || '')}" />
              </div>
              <div class="admin-field">
                <label>Pinyin</label>
                <input type="text" class="admin-input" data-sc="${i}:pinyin" value="${escapeHTML(sc.pinyin || '')}" />
              </div>
              <div class="admin-field">
                <label>English Meaning</label>
                <input type="text" class="admin-input" data-sc="${i}:english" value="${escapeHTML(sc.english || '')}" />
              </div>
            </div>
            <div class="admin-grid-2">
              ${renderMediaPickerField({
                id: `scImg_${i}`,
                label: 'Scene Image (Upload or URL)',
                value: sc.image || '',
                accept: 'image/*',
                kind: 'image'
              })}
              ${renderMediaPickerField({
                id: `scAud_${i}`,
                label: 'Scene Audio (Upload or URL)',
                value: sc.audio || '',
                accept: 'audio/*',
                kind: 'audio'
              })}
            </div>
          </div>
        `
          )
          .join('');
        wireMediaPickers(scenesBox);
        scenesBox.querySelectorAll('[data-sc]').forEach((inp) => {
          inp.oninput = () => {
            const [idx, key] = inp.getAttribute('data-sc').split(':');
            state.editingStoryScenes[Number(idx)][key] = inp.value;
          };
        });
        scenesBox.querySelectorAll('[id^="scImg_"], [id^="scAud_"]').forEach((inp) => {
          inp.addEventListener('input', () => {
            const [prefix, idx] = inp.id.split('_');
            const key = prefix === 'scImg' ? 'image' : 'audio';
            if (state.editingStoryScenes[Number(idx)]) {
              state.editingStoryScenes[Number(idx)][key] = inp.value;
            }
          });
        });
        scenesBox.querySelectorAll('[data-rm-scene]').forEach((b) => {
          b.onclick = () => {
            state.editingStoryScenes.splice(Number(b.getAttribute('data-rm-scene')), 1);
            renderSubLists();
          };
        });
      }

      const vocabBox = document.getElementById('storyVocabList');
      if (vocabBox) {
        vocabBox.innerHTML = state.editingStoryVocab
          .map(
            (v, i) => `
          <div class="admin-subrow">
            <div class="admin-grid-3">
              <div class="admin-field">
                <label>Character</label>
                <input type="text" class="admin-input" data-sv="${i}:character" value="${escapeHTML(v.character || '')}" />
              </div>
              <div class="admin-field">
                <label>Pinyin</label>
                <input type="text" class="admin-input" data-sv="${i}:pinyin" value="${escapeHTML(v.pinyin || '')}" />
              </div>
              <div class="admin-field">
                <label>Meaning</label>
                <input type="text" class="admin-input" data-sv="${i}:meaning" value="${escapeHTML(v.meaning || '')}" />
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:end; gap:10px;">
              <div style="flex:1;">
                ${renderMediaPickerField({
                  id: `svAud_${i}`,
                  label: 'Audio Path / Upload (Optional)',
                  value: v.audio || '',
                  accept: 'audio/*',
                  kind: 'audio'
                })}
              </div>
              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-rm-sv="${i}">Remove</button>
            </div>
          </div>
        `
          )
          .join('');
        wireMediaPickers(vocabBox);
        vocabBox.querySelectorAll('[data-sv]').forEach((inp) => {
          inp.oninput = () => {
            const [idx, key] = inp.getAttribute('data-sv').split(':');
            state.editingStoryVocab[Number(idx)][key] = inp.value;
          };
        });
        vocabBox.querySelectorAll('[id^="svAud_"]').forEach((inp) => {
          inp.addEventListener('input', () => {
            const idx = Number(inp.id.split('_')[1]);
            if (state.editingStoryVocab[idx]) state.editingStoryVocab[idx].audio = inp.value;
          });
        });
        vocabBox.querySelectorAll('[data-rm-sv]').forEach((b) => {
          b.onclick = () => {
            state.editingStoryVocab.splice(Number(b.getAttribute('data-rm-sv')), 1);
            renderSubLists();
          };
        });
      }
    };

    openModal(`
      <div class="admin-panel-head" style="margin-bottom:14px;">
        <div>
          <h2>${isNew ? 'Create New Story' : `Edit Story: ${escapeHTML(base.title)}`}</h2>
          <p>Edit story metadata, upload video/poster files or URLs, and manage reading scenes &amp; vocabulary.</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="stCloseModalBtn">✕</button>
      </div>

      <form id="storyEditForm">
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="stId">Story ID *</label>
            <input type="text" class="admin-input" id="stId" value="${escapeHTML(base.id)}" ${isNew ? '' : 'readonly'} required />
          </div>
          <div class="admin-field">
            <label for="stTitle">English Title *</label>
            <input type="text" class="admin-input" id="stTitle" value="${escapeHTML(base.title || '')}" required />
          </div>
          <div class="admin-field">
            <label for="stLevel">Level</label>
            <input type="text" class="admin-input" id="stLevel" value="${escapeHTML(base.level || 'Beginner')}" />
          </div>
          <div class="admin-field">
            <label for="stChinese">Chinese Title</label>
            <input type="text" class="admin-input" id="stChinese" value="${escapeHTML(base.chineseTitle || '')}" />
          </div>
          <div class="admin-field">
            <label for="stPinyin">Pinyin</label>
            <input type="text" class="admin-input" id="stPinyin" value="${escapeHTML(base.pinyin || '')}" />
          </div>
          <div class="admin-field">
            <label for="stMeaning">Meaning</label>
            <input type="text" class="admin-input" id="stMeaning" value="${escapeHTML(base.meaning || '')}" />
          </div>
        </div>

        <div class="admin-field" style="margin-top:10px;">
          <label for="stDesc">Description</label>
          <textarea class="admin-textarea" id="stDesc">${escapeHTML(base.description || '')}</textarea>
        </div>

        <div class="admin-grid-2" style="margin-top:10px;">
          ${renderMediaPickerField({
            id: 'stVideo',
            label: 'Story Video (Upload or URL)',
            value: base.video || '',
            accept: 'video/*',
            kind: 'video'
          })}
          ${renderMediaPickerField({
            id: 'stPoster',
            label: 'Story Poster Image (Upload or URL)',
            value: base.poster || '',
            accept: 'image/*',
            kind: 'image'
          })}
        </div>

        <label class="admin-check-row" style="margin:12px 0;">
          <input type="checkbox" id="stFeatured" ${isFeatured ? 'checked' : ''} />
          <span>Feature this Story on Homepage</span>
        </label>

        <div style="margin:14px 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Reading Scenes (${state.editingStoryScenes.length})</strong>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnAddScene">+ Add Scene</button>
          </div>
          <div id="storyScenesList" class="admin-sublist-box"></div>
        </div>

        <div style="margin:14px 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Vocabulary (${state.editingStoryVocab.length})</strong>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnAddStoryVocab">+ Add Word</button>
          </div>
          <div id="storyVocabList" class="admin-sublist-box"></div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="stCancelBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary">Save Story</button>
        </div>
      </form>
    `);

    renderSubLists();
    document.getElementById('stCloseModalBtn').onclick = closeModal;
    document.getElementById('stCancelBtn').onclick = closeModal;
    document.getElementById('btnAddScene').onclick = () => {
      state.editingStoryScenes.push({
        lessonId: document.getElementById('stId').value.trim(),
        order: state.editingStoryScenes.length + 1,
        chinese: '',
        pinyin: '',
        english: '',
        image: '',
        audio: ''
      });
      renderSubLists();
    };
    document.getElementById('btnAddStoryVocab').onclick = () => {
      state.editingStoryVocab.push({
        lessonId: document.getElementById('stId').value.trim(),
        order: state.editingStoryVocab.length + 1,
        character: '',
        pinyin: '',
        meaning: '',
        audio: ''
      });
      renderSubLists();
    };

    document.getElementById('storyEditForm').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('stId').value.trim();
      const record = {
        id,
        title: document.getElementById('stTitle').value.trim(),
        chineseTitle: document.getElementById('stChinese').value.trim(),
        pinyin: document.getElementById('stPinyin').value.trim(),
        meaning: document.getElementById('stMeaning').value.trim(),
        level: document.getElementById('stLevel').value.trim() || 'Beginner',
        description: document.getElementById('stDesc').value.trim(),
        video: document.getElementById('stVideo').value.trim(),
        poster: document.getElementById('stPoster').value.trim()
      };

      const existingLessons = [...state.storiesData.Lessons];
      const idx = existingLessons.findIndex((x) => isSameId(x.id, id));
      if (idx >= 0) existingLessons[idx] = record;
      else existingLessons.push(record);

      const keptScenes = state.storiesData.Story.filter((x) => !isSameId(x.lessonId, id));
      const cleanScenes = state.editingStoryScenes
        .filter((sc) => sc.chinese || sc.english)
        .map((sc, i) => ({ ...sc, lessonId: id, order: i + 1 }));

      const keptVocab = state.storiesData.Vocabulary.filter((x) => !isSameId(x.lessonId, id));
      const cleanVocab = state.editingStoryVocab
        .filter((v) => v.character || v.meaning)
        .map((v, i) => ({ ...v, lessonId: id, order: i + 1 }));

      try {
        setSyncStatus('Saving story…');
        const res = await getContentStore().saveStoriesSheets({
          Lessons: existingLessons,
          Story: [...keptScenes, ...cleanScenes],
          Vocabulary: [...keptVocab, ...cleanVocab]
        });
        state.storiesData = { ...state.storiesData, ...res.sheets };
        await toggleFeaturedId('featuredStoryIds', id, document.getElementById('stFeatured').checked);
        closeModal();
        updateNavCounts();
        applySyncFeedback(
          res,
          `Saved story "${record.title}" to Excel & DB.`,
          `Saved story "${record.title}" locally.`
        );
        renderActiveTab();
      } catch (err) {
        setSyncStatus('Save failed');
        toast(err instanceof Error ? err.message : 'Failed to save story.', 'error');
      }
    };
  }

  // --- Tab 3: Short Reels ---
  function renderReelsTab(viewport) {
    const videos = state.reelsData.Videos || [];
    const featSet = new Set(((state.siteConfig && state.siteConfig.featuredReelIds) || []).map((x) => x.toLowerCase()));
    const q = state.filters.reelSearch.toLowerCase();
    const stFilter = state.filters.reelStatus;

    const filtered = videos.filter((v) => {
      const matchQ =
        !q ||
        String(v.title || '').toLowerCase().includes(q) ||
        String(v.id || '').toLowerCase().includes(q) ||
        String(v.holiday_id || '').toLowerCase().includes(q);
      const matchStatus = stFilter === 'all' || String(v.status || 'active').toLowerCase() === stFilter;
      return matchQ && matchStatus;
    });

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Short Video Reels (${videos.length})</h2>
            <p>Add, edit, or delete vertical Mandarin reels, subtitles (CN / Pinyin / EN / Myanmar), and homepage featured reels.</p>
          </div>
          <button type="button" class="admin-btn admin-btn-primary" id="btnAddReel">+ New Short Reel</button>
        </div>
        ${renderWorkbookSyncToolbar('reels', 'reels_stories.xlsx')}

        <div class="admin-grid-2" style="margin-bottom:14px; max-width:540px;">
          <input type="search" class="admin-input" id="reelSearchInput" value="${escapeHTML(
            state.filters.reelSearch
          )}" placeholder="Search title, ID, holiday…" />
          <select class="admin-select" id="reelStatusFilter">
            <option value="all" ${stFilter === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="active" ${stFilter === 'active' ? 'selected' : ''}>Active Only</option>
            <option value="inactive" ${stFilter === 'inactive' ? 'selected' : ''}>Inactive Only</option>
          </select>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Featured</th>
                <th>ID</th>
                <th>Title &amp; Category</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length
                  ? filtered
                      .map((v) => {
                        const isFeat = featSet.has(String(v.id || '').toLowerCase());
                        const isActive = String(v.status || 'active').toLowerCase() === 'active';
                        return `
                        <tr>
                          <td>
                            <input type="checkbox" data-feat-reel="${escapeHTML(v.id)}" ${isFeat ? 'checked' : ''} />
                          </td>
                          <td><code>${escapeHTML(v.id)}</code></td>
                          <td>
                            <strong>${escapeHTML(v.title || '')}</strong>
                            <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(v.type || 'reel')} · ${escapeHTML(
                          v.holiday_id || 'daily'
                        )}</div>
                          </td>
                          <td>${escapeHTML(v.duration_sec || 15)}s</td>
                          <td><span class="${isActive ? 'admin-status-active' : 'admin-status-free'}">${
                          isActive ? 'Active' : 'Inactive'
                        }</span></td>
                          <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-reel="${escapeHTML(
                                v.id
                              )}">Edit</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-dup-reel="${escapeHTML(
                                v.id
                              )}">Duplicate</button>
                              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-del-reel="${escapeHTML(
                                v.id
                              )}">Delete</button>
                            </div>
                          </td>
                        </tr>
                      `;
                      })
                      .join('')
                  : `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:24px;">No reels match your filter.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    wireWorkbookSyncToolbar(viewport);
    document.getElementById('reelSearchInput').oninput = (e) => {
      state.filters.reelSearch = e.target.value;
      renderReelsTab(viewport);
    };
    document.getElementById('reelStatusFilter').onchange = (e) => {
      state.filters.reelStatus = e.target.value;
      renderReelsTab(viewport);
    };
    document.getElementById('btnAddReel').onclick = () => openReelEditorModal(null);

    viewport.querySelectorAll('[data-feat-reel]').forEach((cb) => {
      cb.onchange = () => toggleFeaturedId('featuredReelIds', cb.getAttribute('data-feat-reel'), cb.checked);
    });
    viewport.querySelectorAll('[data-edit-reel]').forEach((btn) => {
      btn.onclick = () => {
        const r = videos.find((x) => isSameId(x.id, btn.getAttribute('data-edit-reel')));
        openReelEditorModal(r || null);
      };
    });
    viewport.querySelectorAll('[data-dup-reel]').forEach((btn) => {
      btn.onclick = () => {
        const src = videos.find((x) => isSameId(x.id, btn.getAttribute('data-dup-reel')));
        if (!src) return;
        openDuplicateModal({
          entityLabel: 'Short Reel',
          sourceTitle: src.title || src.id,
          sourceId: src.id,
          existingIds: videos.map((x) => x.id),
          helpText: 'Copies video path, thumbnail, duration, status, and all subtitle tracks (CN / Pinyin / EN / Myanmar).',
          onConfirm: async ({ newTitle, newId }) => {
            const copiedReel = { ...src, id: newId, title: newTitle };
            const res = await getContentStore().saveReelsSheets({ Videos: [...videos, copiedReel] });
            state.reelsData = { ...state.reelsData, ...res.sheets };
            updateNavCounts();
            applySyncFeedback(
              res,
              `Duplicated reel "${newTitle}" (${newId}) & synced to Excel & DB.`,
              `Duplicated reel "${newTitle}" (${newId}) locally.`
            );
            renderActiveTab();
          }
        });
      };
    });
    viewport.querySelectorAll('[data-del-reel]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-del-reel');
        openConfirmDialog({
          title: `Delete reel "${id}"?`,
          message: 'This permanently deletes the video reel from Excel and the database.',
          confirmLabel: 'Delete Reel',
          onConfirm: async () => {
            const nextVideos = videos.filter((x) => !isSameId(x.id, id));
            try {
              const res = await getContentStore().saveReelsSheets({ Videos: nextVideos });
              state.reelsData = { ...state.reelsData, ...res.sheets };
              updateNavCounts();
              applySyncFeedback(
                res,
                `Deleted reel ${id} and synced to Excel & DB.`,
                `Deleted reel ${id} locally.`
              );
              renderActiveTab();
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Failed to delete reel.', 'error');
            }
          }
        });
      };
    });
  }

  function openReelEditorModal(reel) {
    const isNew = !reel;
    const base = reel || {
      id: `reel_${Date.now().toString().slice(-4)}`,
      type: 'reel',
      holiday_id: 'daily',
      title: '',
      video_path: '',
      thumbnail_path: 'assets/images/story-poster.jpg',
      duration_sec: 15,
      status: 'active',
      text_cn: '',
      text_pinyin: '',
      text_en: '',
      text_my: ''
    };
    const featSet = new Set(((state.siteConfig && state.siteConfig.featuredReelIds) || []).map((x) => x.toLowerCase()));
    const isFeatured = featSet.has(String(base.id).toLowerCase());

    openModal(`
      <div class="admin-panel-head" style="margin-bottom:14px;">
        <div>
          <h2>${isNew ? 'Add Short Reel' : `Edit Reel: ${escapeHTML(base.title)}`}</h2>
          <p>Upload video/thumbnail files directly or enter a media URL.</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="rlCloseModalBtn">✕</button>
      </div>

      <form id="reelEditForm">
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="rlId">Reel ID *</label>
            <input type="text" class="admin-input" id="rlId" value="${escapeHTML(base.id)}" ${isNew ? '' : 'readonly'} required />
          </div>
          <div class="admin-field">
            <label for="rlType">Type</label>
            <select class="admin-select" id="rlType">
              <option value="reel" ${base.type === 'reel' ? 'selected' : ''}>reel</option>
              <option value="story" ${base.type === 'story' ? 'selected' : ''}>story</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="rlHoliday">Category / Holiday ID</label>
            <input type="text" class="admin-input" id="rlHoliday" value="${escapeHTML(base.holiday_id || 'daily')}" placeholder="daily, cny, kids..." />
          </div>
        </div>

        <div class="admin-grid-3" style="margin-top:10px;">
          <div class="admin-field" style="grid-column: span 2;">
            <label for="rlTitle">Title *</label>
            <input type="text" class="admin-input" id="rlTitle" value="${escapeHTML(base.title || '')}" required />
          </div>
          <div class="admin-grid-2">
            <div class="admin-field">
              <label for="rlDuration">Duration (s)</label>
              <input type="number" class="admin-input" id="rlDuration" min="1" max="600" value="${escapeHTML(
                base.duration_sec || 15
              )}" />
            </div>
            <div class="admin-field">
              <label for="rlStatus">Status</label>
              <select class="admin-select" id="rlStatus">
                <option value="active" ${base.status !== 'inactive' ? 'selected' : ''}>active</option>
                <option value="inactive" ${base.status === 'inactive' ? 'selected' : ''}>inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div class="admin-grid-2" style="margin-top:10px;">
          ${renderMediaPickerField({
            id: 'rlVideo',
            label: 'Reel Video (Upload or URL) *',
            value: base.video_path || '',
            accept: 'video/*',
            kind: 'video'
          })}
          ${renderMediaPickerField({
            id: 'rlThumb',
            label: 'Thumbnail Image (Upload or URL)',
            value: base.thumbnail_path || '',
            accept: 'image/*',
            kind: 'image'
          })}
        </div>

        <div class="admin-grid-2" style="margin-top:10px;">
          <div class="admin-field">
            <label for="rlCn">Chinese Script (text_cn)</label>
            <textarea class="admin-textarea" id="rlCn">${escapeHTML(base.text_cn || '')}</textarea>
          </div>
          <div class="admin-field">
            <label for="rlPy">Pinyin (text_pinyin)</label>
            <textarea class="admin-textarea" id="rlPy">${escapeHTML(base.text_pinyin || '')}</textarea>
          </div>
          <div class="admin-field">
            <label for="rlEn">English Translation (text_en)</label>
            <textarea class="admin-textarea" id="rlEn">${escapeHTML(base.text_en || '')}</textarea>
          </div>
          <div class="admin-field">
            <label for="rlMy">Myanmar Translation (text_my)</label>
            <textarea class="admin-textarea" id="rlMy">${escapeHTML(base.text_my || '')}</textarea>
          </div>
        </div>

        <label class="admin-check-row" style="margin:12px 0;">
          <input type="checkbox" id="rlFeatured" ${isFeatured ? 'checked' : ''} />
          <span>Feature this Reel on Homepage</span>
        </label>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="rlCancelBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary">Save Reel</button>
        </div>
      </form>
    `);

    document.getElementById('rlCloseModalBtn').onclick = closeModal;
    document.getElementById('rlCancelBtn').onclick = closeModal;

    document.getElementById('reelEditForm').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('rlId').value.trim();
      const rec = {
        id,
        type: document.getElementById('rlType').value,
        holiday_id: document.getElementById('rlHoliday').value.trim() || 'daily',
        title: document.getElementById('rlTitle').value.trim(),
        video_path: document.getElementById('rlVideo').value.trim(),
        thumbnail_path: document.getElementById('rlThumb').value.trim(),
        duration_sec: Number(document.getElementById('rlDuration').value) || 15,
        status: document.getElementById('rlStatus').value,
        text_cn: document.getElementById('rlCn').value.trim(),
        text_pinyin: document.getElementById('rlPy').value.trim(),
        text_en: document.getElementById('rlEn').value.trim(),
        text_my: document.getElementById('rlMy').value.trim()
      };

      const nextVideos = [...state.reelsData.Videos];
      const idx = nextVideos.findIndex((x) => isSameId(x.id, id));
      if (idx >= 0) nextVideos[idx] = rec;
      else nextVideos.push(rec);

      try {
        setSyncStatus('Saving reel…');
        const res = await getContentStore().saveReelsSheets({ Videos: nextVideos });
        state.reelsData = { ...state.reelsData, ...res.sheets };
        await toggleFeaturedId('featuredReelIds', id, document.getElementById('rlFeatured').checked);
        closeModal();
        updateNavCounts();
        applySyncFeedback(
          res,
          `Saved reel "${rec.title}" to Excel & DB.`,
          `Saved reel "${rec.title}" locally.`
        );
        renderActiveTab();
      } catch (err) {
        setSyncStatus('Save failed');
        toast(err instanceof Error ? err.message : 'Failed to save reel.', 'error');
      }
    };
  }

  // --- Tab 4: Lessons & Exercises ---
  function renderLessonsTab(viewport) {
    const lessons = state.lessonsData.Lessons || [];
    const exercises = state.lessonsData.Exercises || [];
    const writings = state.lessonsData.Writing || [];
    const pronunciations = state.lessonsData.Pronunciation || [];
    const coursesList = getAdminCoursesList();
    const courseFilter = state.filters.lessonCourse || 'all';
    const q = state.filters.lessonSearch.toLowerCase();
    const cfgCoursePrices = (state.siteConfig && state.siteConfig.coursePrices) || {};

    const filtered = lessons.filter((l) => {
      const cName = getLessonCourse(l);
      const matchCourse = courseFilter === 'all' || courseSlug(cName) === courseSlug(courseFilter);
      const matchQ =
        !q ||
        String(l.title || '').toLowerCase().includes(q) ||
        String(l.id || '').toLowerCase().includes(q) ||
        cName.toLowerCase().includes(q);
      return matchCourse && matchQ;
    });

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Courses &amp; Course Pass Pricing (${coursesList.length})</h2>
            <p>Create new courses, rename courses (automatically updates linked lessons &amp; learner subscriptions), and manage Course Pass pricing. Courses can only be deleted when 0 lessons belong to them.</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnSaveCoursePricesInline">Save Course Prices</button>
            <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="btnAddCourse">+ New Course</button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Course Name</th>
                <th class="num">Lessons</th>
                <th class="num">Course Pass (Kyat)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                coursesList.length
                  ? coursesList
                      .map((cName) => {
                        const countInCourse = lessons.filter((l) => courseSlug(getLessonCourse(l)) === courseSlug(cName)).length;
                        const fallbackPrice = courseSlug(cName) === 'hsk2' ? 120 : 100;
                        const priceVal = Number(cfgCoursePrices[cName]) || fallbackPrice;
                        const delDisabledAttr =
                          countInCourse > 0
                            ? `disabled title="Cannot delete '${escapeHTML(cName)}' while ${countInCourse} lesson(s) belong to it. Move or delete those lessons first."`
                            : '';
                        return `
                          <tr>
                            <td><strong>${escapeHTML(cName)}</strong></td>
                            <td class="num">${countInCourse}</td>
                            <td class="num">
                              <div style="display:inline-flex; align-items:center; justify-content:flex-end; gap:6px;">
                                <input type="number" min="0" max="9999999" class="admin-input" style="width:100px; text-align:right; padding:4px 8px;" data-ls-course-price="${escapeHTML(
                                  cName
                                )}" value="${escapeHTML(priceVal)}" />
                                <span style="color:#64748b; font-size:0.8rem;">Kyat</span>
                              </div>
                            </td>
                            <td>
                              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-course="${escapeHTML(
                                  cName
                                )}">Edit</button>
                                <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-del-course="${escapeHTML(
                                  cName
                                )}" ${delDisabledAttr}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      })
                      .join('')
                  : `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">No courses configured yet. Click <strong>+ New Course</strong> above to add one.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Curriculum Lessons (${lessons.length})</h2>
            <p>Assign lessons to courses, duplicate existing lessons with full child content, configure Free/Paid pricing (Kyat), media, Vocabulary/Writing, Pronunciation, and Exercises.</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="admin-btn admin-btn-secondary" id="btnUploadLessonExercises">Upload Exercises (.xlsx)</button>
            <button type="button" class="admin-btn admin-btn-primary" id="btnAddLesson">+ New Lesson</button>
          </div>
        </div>
        ${renderWorkbookSyncToolbar('lessons', 'lessons.xlsx')}

        <div class="admin-grid-2" style="margin-bottom:14px; max-width:560px;">
          <input type="search" class="admin-input" id="lessonSearchInput" value="${escapeHTML(
            state.filters.lessonSearch
          )}" placeholder="Search title, course, or ID…" />
          <select class="admin-select" id="lessonCourseFilter">
            <option value="all" ${courseFilter === 'all' ? 'selected' : ''}>All Courses</option>
            ${coursesList
              .map(
                (cName) =>
                  `<option value="${escapeHTML(cName)}" ${courseSlug(courseFilter) === courseSlug(cName) ? 'selected' : ''}>${escapeHTML(
                    cName
                  )}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Course</th>
                <th>Lesson Title</th>
                <th>Access / Price</th>
                <th class="num">Exercises</th>
                <th class="num">Writing</th>
                <th class="num">Pronunciation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length
                  ? filtered
                      .map((l) => {
                        const cName = getLessonCourse(l);
                        const pricing = window.LinguaAuth
                          ? window.LinguaAuth.getLessonPricing(l)
                          : { accessType: 'free', price: 0 };
                        const exCount = exercises.filter((x) => isSameId(x.lessonId, l.id)).length;
                        const writingCount = writings.filter((x) => isSameId(x.lessonId, l.id)).length;
                        const pronCount = pronunciations.filter((x) => isSameId(x.lessonId, l.id)).length;
                        return `
                        <tr>
                          <td><code>${escapeHTML(l.id)}</code></td>
                          <td><strong>${escapeHTML(cName)}</strong></td>
                          <td>
                            <strong>${escapeHTML(l.title || '')}</strong>
                            <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(l.chineseTitle || '')} · ${escapeHTML(
                          l.level || cName
                        )}</div>
                          </td>
                          <td>
                            <span class="${pricing.accessType === 'paid' ? 'admin-status-pending' : 'admin-status-active'}">
                              ${pricing.accessType === 'paid' ? `Paid (${pricing.price} Kyat)` : 'Free'}
                            </span>
                          </td>
                          <td class="num">${exCount}</td>
                          <td class="num">${writingCount}</td>
                          <td class="num">${pronCount}</td>
                          <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-lesson="${escapeHTML(
                                l.id
                              )}">Edit</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-dup-lesson="${escapeHTML(
                                l.id
                              )}">Duplicate</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-ex-lesson="${escapeHTML(
                                l.id
                              )}">Exercises</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-writing-lesson="${escapeHTML(
                                l.id
                              )}">Writing</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-pron-lesson="${escapeHTML(
                                l.id
                              )}">Pronunciation</button>
                              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-del-lesson="${escapeHTML(
                                l.id
                              )}">Delete</button>
                            </div>
                          </td>
                        </tr>
                      `;
                      })
                      .join('')
                  : `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:24px;">No matching lessons found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    wireWorkbookSyncToolbar(viewport);

    const saveCoursePricesBtn = document.getElementById('btnSaveCoursePricesInline');
    if (saveCoursePricesBtn) {
      saveCoursePricesBtn.onclick = async () => {
        const nextPrices = Object.assign({}, cfgCoursePrices);
        viewport.querySelectorAll('[data-ls-course-price]').forEach((inp) => {
          const cname = inp.getAttribute('data-ls-course-price');
          if (cname) nextPrices[cname] = Math.max(0, Number(inp.value) || 0);
        });
        try {
          const saved = await window.LinguaAuth.saveSiteConfig({ courses: coursesList, coursePrices: nextPrices });
          state.siteConfig = saved;
          toast('Saved course pass prices in Kyat.');
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Failed to save course prices.', 'error');
        }
      };
    }

    const addCourseBtn = document.getElementById('btnAddCourse');
    if (addCourseBtn) {
      addCourseBtn.onclick = () => openCreateCourseModal();
    }

    viewport.querySelectorAll('[data-edit-course]').forEach((btn) => {
      btn.onclick = () => {
        const cname = btn.getAttribute('data-edit-course');
        const countInCourse = lessons.filter((l) => courseSlug(getLessonCourse(l)) === courseSlug(cname)).length;
        const fallbackPrice = courseSlug(cname) === 'hsk2' ? 120 : 100;
        const curPrice = Number(cfgCoursePrices[cname]) || fallbackPrice;
        openEditCourseModal(cname, curPrice, countInCourse);
      };
    });

    viewport.querySelectorAll('[data-del-course]').forEach((btn) => {
      btn.onclick = () => {
        const cname = btn.getAttribute('data-del-course');
        const countInCourse = lessons.filter((l) => courseSlug(getLessonCourse(l)) === courseSlug(cname)).length;
        if (countInCourse > 0) {
          toast(`Cannot delete "${cname}" because ${countInCourse} lesson(s) are under this course. Move or delete those lessons first.`, 'error');
          return;
        }
        openConfirmDialog({
          title: `Delete course "${cname}"?`,
          message: `This course has 0 lessons and will be removed from Courses and Course Pass Pricing.`,
          confirmLabel: 'Delete Course',
          onConfirm: async () => {
            try {
              const out = await window.LinguaAuth.deleteCourseAdmin(cname, state.lessonsData.Lessons || []);
              state.siteConfig = out.config;
              if (courseSlug(state.filters.lessonCourse) === courseSlug(cname)) {
                state.filters.lessonCourse = 'all';
              }
              toast(`Deleted empty course "${cname}".`);
              renderActiveTab();
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Failed to delete course.', 'error');
            }
          }
        });
      };
    });

    document.getElementById('lessonSearchInput').oninput = (e) => {
      state.filters.lessonSearch = e.target.value;
      renderLessonsTab(viewport);
    };
    document.getElementById('lessonCourseFilter').onchange = (e) => {
      state.filters.lessonCourse = e.target.value;
      renderLessonsTab(viewport);
    };
    document.getElementById('btnAddLesson').onclick = () => openLessonEditorModal(null);
    document.getElementById('btnUploadLessonExercises').onclick = () => openExerciseSpreadsheetModal('lessons', '');

    viewport.querySelectorAll('[data-edit-lesson]').forEach((btn) => {
      btn.onclick = () => {
        const l = lessons.find((x) => isSameId(x.id, btn.getAttribute('data-edit-lesson')));
        openLessonEditorModal(l || null);
      };
    });
    viewport.querySelectorAll('[data-dup-lesson]').forEach((btn) => {
      btn.onclick = () => {
        const src = lessons.find((x) => isSameId(x.id, btn.getAttribute('data-dup-lesson')));
        if (!src) return;
        const pricing = window.LinguaAuth ? window.LinguaAuth.getLessonPricing(src) : { accessType: 'free', price: 0 };
        openDuplicateModal({
          entityLabel: 'Lesson',
          sourceTitle: src.title || src.id,
          sourceId: src.id,
          existingIds: lessons.map((x) => x.id),
          helpText: 'Copies lesson metadata, pricing, video/audio/poster, vocabulary, writing characters, exercises, and pronunciation practice lines.',
          onConfirm: async ({ newTitle, newId }) => {
            const copiedLesson = { ...src, id: newId, title: newTitle };
            const copiedVocab = (state.lessonsData.Vocabulary || [])
              .filter((r) => isSameId(r.lessonId, src.id))
              .map((r) => ({ ...r, lessonId: newId }));
            const copiedWriting = (state.lessonsData.Writing || [])
              .filter((r) => isSameId(r.lessonId, src.id))
              .map((r) => ({ ...r, lessonId: newId }));
            const copiedExercises = (state.lessonsData.Exercises || [])
              .filter((r) => isSameId(r.lessonId, src.id))
              .map((r) => ({ ...r, lessonId: newId }));
            const copiedPron = (state.lessonsData.Pronunciation || [])
              .filter((r) => isSameId(r.lessonId, src.id))
              .map((r) => ({ ...r, lessonId: newId }));

            const res = await getContentStore().saveLessonsSheets({
              Lessons: [...lessons, copiedLesson],
              Vocabulary: [...(state.lessonsData.Vocabulary || []), ...copiedVocab],
              Writing: [...(state.lessonsData.Writing || []), ...copiedWriting],
              Exercises: [...(state.lessonsData.Exercises || []), ...copiedExercises],
              Pronunciation: [...(state.lessonsData.Pronunciation || []), ...copiedPron]
            });
            state.lessonsData = { ...state.lessonsData, ...res.sheets };
            const cName = getLessonCourse(copiedLesson);
            if (window.LinguaAuth && typeof window.LinguaAuth.saveLessonCatalogItems === 'function') {
              await window.LinguaAuth.saveLessonCatalogItems([
                {
                  lessonId: newId,
                  title: newTitle,
                  course: cName,
                  accessType: pricing.accessType,
                  price: pricing.price
                }
              ]);
            }
            updateNavCounts();
            applySyncFeedback(
              res,
              `Duplicated lesson "${newTitle}" (${newId}) with full content & synced to Excel & DB.`,
              `Duplicated lesson "${newTitle}" (${newId}) locally.`
            );
            renderActiveTab();
          }
        });
      };
    });
    viewport.querySelectorAll('[data-ex-lesson]').forEach((btn) => {
      btn.onclick = () => openExerciseSpreadsheetModal('lessons', btn.getAttribute('data-ex-lesson'));
    });
    viewport.querySelectorAll('[data-writing-lesson]').forEach((btn) => {
      btn.onclick = () => openWritingEditorModal(btn.getAttribute('data-writing-lesson'));
    });
    viewport.querySelectorAll('[data-pron-lesson]').forEach((btn) => {
      btn.onclick = () => openPronunciationEditorModal(btn.getAttribute('data-pron-lesson'));
    });
    viewport.querySelectorAll('[data-del-lesson]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-del-lesson');
        openConfirmDialog({
          title: `Delete lesson "${id}"?`,
          message: 'This permanently deletes the lesson, its exercises, vocabulary, writing, and pronunciation entries from Excel and the database.',
          confirmLabel: 'Delete Lesson',
          onConfirm: async () => {
            const nextLessons = lessons.filter((x) => !isSameId(x.id, id));
            const nextVocab = (state.lessonsData.Vocabulary || []).filter((x) => !isSameId(x.lessonId, id));
            const nextWriting = (state.lessonsData.Writing || []).filter((x) => !isSameId(x.lessonId, id));
            const nextExercises = (state.lessonsData.Exercises || []).filter((x) => !isSameId(x.lessonId, id));
            const nextPron = (state.lessonsData.Pronunciation || []).filter((x) => !isSameId(x.lessonId, id));
            try {
              const res = await getContentStore().saveLessonsSheets({
                Lessons: nextLessons,
                Vocabulary: nextVocab,
                Writing: nextWriting,
                Exercises: nextExercises,
                Pronunciation: nextPron
              });
              state.lessonsData = { ...state.lessonsData, ...res.sheets };
              if (window.LinguaAuth && typeof window.LinguaAuth.removeLessonCatalogItems === 'function') {
                await window.LinguaAuth.removeLessonCatalogItems([id]);
              }
              try {
                const pricingRaw = localStorage.getItem('linguapath_local_lesson_pricing');
                if (pricingRaw) {
                  const pricingMap = JSON.parse(pricingRaw);
                  delete pricingMap[id];
                  localStorage.setItem('linguapath_local_lesson_pricing', JSON.stringify(pricingMap));
                }
                localStorage.removeItem('linguapath_custom_lessons');
              } catch (_) {}
              updateNavCounts();
              applySyncFeedback(
                res,
                `Deleted lesson ${id} and synced to Excel & DB.`,
                `Deleted lesson ${id} locally.`
              );
              renderActiveTab();
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Failed to delete lesson.', 'error');
            }
          }
        });
      };
    });
  }

  function openCreateCourseModal() {
    openModal(`
      <div class="admin-panel-head" style="margin-bottom:12px;">
        <div>
          <h2>Create New Course</h2>
          <p>Add a new course name and set its full Course Pass price in Kyat.</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="ccCloseBtn">✕</button>
      </div>
      <form id="createCourseForm">
        <div class="admin-grid-2">
          <div class="admin-field">
            <label for="ccName">Course Name *</label>
            <input type="text" class="admin-input" id="ccName" placeholder="e.g. HSK 3 or Business Mandarin" required />
          </div>
          <div class="admin-field">
            <label for="ccPrice">Course Pass Price (Kyat) *</label>
            <input type="number" class="admin-input" id="ccPrice" min="0" max="9999999" value="120" required />
          </div>
        </div>
        <div id="ccErrorBox" class="admin-backend-status is-error" hidden style="margin-top:10px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="ccCancelBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary" id="ccSubmitBtn">Create Course</button>
        </div>
      </form>
    `);
    document.getElementById('ccCloseBtn').onclick = closeModal;
    document.getElementById('ccCancelBtn').onclick = closeModal;
    document.getElementById('ccName').focus();
    document.getElementById('createCourseForm').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('ccErrorBox');
      const submitBtn = document.getElementById('ccSubmitBtn');
      const name = (document.getElementById('ccName').value || '').trim();
      const price = Math.max(0, Number(document.getElementById('ccPrice').value) || 0);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating…';
      errBox.hidden = true;
      try {
        const out = await window.LinguaAuth.createCourseAdmin(name, price, state.lessonsData.Lessons || []);
        state.siteConfig = out.config;
        closeModal();
        toast(`Created course "${normalizeCourseName(name)}" (${price.toLocaleString()} Kyat).`);
        renderActiveTab();
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err instanceof Error ? err.message : 'Failed to create course.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Course';
      }
    };
  }

  function openEditCourseModal(courseName, curPrice, lessonCount) {
    openModal(`
      <div class="admin-panel-head" style="margin-bottom:12px;">
        <div>
          <h2>Edit Course: ${escapeHTML(courseName)}</h2>
          <p>${
            lessonCount > 0
              ? `Renaming this course automatically updates ${lessonCount} linked lesson(s), catalog items, and active learner course passes.`
              : 'Update the course name or Course Pass price in Kyat.'
          }</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="ecCloseBtn">✕</button>
      </div>
      <form id="editCourseForm">
        <div class="admin-grid-2">
          <div class="admin-field">
            <label for="ecName">Course Name *</label>
            <input type="text" class="admin-input" id="ecName" value="${escapeHTML(courseName)}" required />
          </div>
          <div class="admin-field">
            <label for="ecPrice">Course Pass Price (Kyat) *</label>
            <input type="number" class="admin-input" id="ecPrice" min="0" max="9999999" value="${escapeHTML(curPrice)}" required />
          </div>
        </div>
        <div id="ecErrorBox" class="admin-backend-status is-error" hidden style="margin-top:10px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="ecCancelBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary" id="ecSubmitBtn">Save Course Changes</button>
        </div>
      </form>
    `);
    document.getElementById('ecCloseBtn').onclick = closeModal;
    document.getElementById('ecCancelBtn').onclick = closeModal;
    document.getElementById('editCourseForm').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('ecErrorBox');
      const submitBtn = document.getElementById('ecSubmitBtn');
      const rawNewName = (document.getElementById('ecName').value || '').trim();
      const newName = normalizeCourseName(rawNewName);
      const price = Math.max(0, Number(document.getElementById('ecPrice').value) || 0);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
      errBox.hidden = true;
      try {
        const oldSlug = courseSlug(courseName);
        const newSlug = courseSlug(newName);
        const out = await window.LinguaAuth.renameCourseAdmin(
          courseName,
          newName,
          price,
          state.lessonsData.Lessons || []
        );
        state.siteConfig = out.config;
        if (out.lessonsSheets && Array.isArray(out.lessonsSheets.Lessons)) {
          state.lessonsData = { ...state.lessonsData, ...out.lessonsSheets };
        } else if (newSlug !== oldSlug || newName !== courseName) {
          // Local fallback: cascade course rename into Lessons sheet & persist
          const nextLessons = (state.lessonsData.Lessons || []).map((l) => {
            if (courseSlug(getLessonCourse(l)) !== oldSlug) return l;
            const upd = {
              ...l,
              course: newName,
              category: newName,
              categoryKey: newSlug || 'course',
              categoryNum: newName
            };
            if (!l.level || courseSlug(l.level) === oldSlug) {
              upd.level = newName;
            }
            return upd;
          });
          const res = await getContentStore().saveLessonsSheets({ Lessons: nextLessons });
          state.lessonsData = { ...state.lessonsData, ...res.sheets };
        }
        if (courseSlug(state.filters.lessonCourse) === oldSlug) {
          state.filters.lessonCourse = newName;
        }
        closeModal();
        toast(`Updated course "${newName}" (${price.toLocaleString()} Kyat)${newSlug !== oldSlug ? ' & cascaded to lessons and subscriptions' : ''}.`);
        renderActiveTab();
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err instanceof Error ? err.message : 'Failed to update course.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Course Changes';
      }
    };
  }

  function openLessonEditorModal(lesson) {
    const isNew = !lesson;
    const coursesList = getAdminCoursesList();
    const defaultCourse = state.filters.lessonCourse !== 'all' ? state.filters.lessonCourse : 'HSK 2';
    const base = lesson || {
      id: `hsk-${Date.now().toString().slice(-4)}`,
      course: defaultCourse,
      category: defaultCourse,
      categoryKey: courseSlug(defaultCourse),
      categoryNum: 'Course 1',
      title: '',
      chineseTitle: '',
      pinyin: '',
      meaning: '',
      level: defaultCourse,
      description: '',
      videoUrl: 'assets/video/lesson-01.mp4',
      posterUrl: 'assets/images/story-01.jpg',
      fullAudio: '',
      keywords: ''
    };
    const baseCourse = getLessonCourse(base);
    const pricing = window.LinguaAuth ? window.LinguaAuth.getLessonPricing(base) : { accessType: 'free', price: 0 };

    state.editingLessonVocab = lesson
      ? state.lessonsData.Vocabulary.filter((r) => isSameId(r.lessonId, lesson.id)).map((r) => ({ ...r }))
      : [];
    state.editingLessonWriting = lesson
      ? state.lessonsData.Writing.filter((r) => isSameId(r.lessonId, lesson.id)).map((r) => ({ ...r }))
      : [];

    const renderSubLists = () => {
      const vocabBox = document.getElementById('lsVocabList');
      if (vocabBox) {
        vocabBox.innerHTML = state.editingLessonVocab.length
          ? state.editingLessonVocab
              .map(
                (v, i) => `
            <div class="admin-subrow">
              <div class="admin-grid-3">
                <div class="admin-field">
                  <label>Character</label>
                  <input type="text" class="admin-input" data-lv="${i}:character" value="${escapeHTML(v.character || '')}" />
                </div>
                <div class="admin-field">
                  <label>Pinyin</label>
                  <input type="text" class="admin-input" data-lv="${i}:pinyin" value="${escapeHTML(v.pinyin || '')}" />
                </div>
                <div class="admin-field">
                  <label>Meaning</label>
                  <input type="text" class="admin-input" data-lv="${i}:meaning" value="${escapeHTML(v.meaning || '')}" />
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:end; gap:10px;">
                <div style="flex:1;">
                  ${renderMediaPickerField({
                    id: `lvAud_${i}`,
                    label: 'Audio (Optional)',
                    value: v.audio || '',
                    accept: 'audio/*',
                    kind: 'audio'
                  })}
                </div>
                <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-rm-lv="${i}">Remove</button>
              </div>
            </div>
          `
              )
              .join('')
          : `<span style="font-size:0.82rem; color:#64748b;">No vocabulary rows added yet.</span>`;
        wireMediaPickers(vocabBox);
        vocabBox.querySelectorAll('[data-lv]').forEach((inp) => {
          inp.oninput = () => {
            const [idx, key] = inp.getAttribute('data-lv').split(':');
            state.editingLessonVocab[Number(idx)][key] = inp.value;
          };
        });
        vocabBox.querySelectorAll('[id^="lvAud_"]').forEach((inp) => {
          inp.addEventListener('input', () => {
            const idx = Number(inp.id.split('_')[1]);
            if (state.editingLessonVocab[idx]) state.editingLessonVocab[idx].audio = inp.value;
          });
        });
        vocabBox.querySelectorAll('[data-rm-lv]').forEach((b) => {
          b.onclick = () => {
            state.editingLessonVocab.splice(Number(b.getAttribute('data-rm-lv')), 1);
            renderSubLists();
          };
        });
      }

      const writingBox = document.getElementById('lsWritingList');
      if (writingBox) {
        writingBox.innerHTML = state.editingLessonWriting.length
          ? state.editingLessonWriting
              .map(
                (w, i) => `
            <div class="admin-subrow">
              <div class="admin-grid-3">
                <div class="admin-field">
                  <label>Hanzi</label>
                  <input type="text" class="admin-input" data-lw="${i}:character" value="${escapeHTML(w.character || '')}" />
                </div>
                <div class="admin-field">
                  <label>Pinyin</label>
                  <input type="text" class="admin-input" data-lw="${i}:pinyin" value="${escapeHTML(w.pinyin || '')}" />
                </div>
                <div class="admin-field">
                  <label>Meaning</label>
                  <input type="text" class="admin-input" data-lw="${i}:meaning" value="${escapeHTML(w.meaning || '')}" />
                </div>
              </div>
              <div class="admin-grid-3">
                <div class="admin-field">
                  <label>Strokes</label>
                  <input type="number" class="admin-input" data-lw="${i}:strokeCount" value="${escapeHTML(
                  w.strokeCount || ''
                )}" />
                </div>
                <div class="admin-field">
                  <label>Radical</label>
                  <input type="text" class="admin-input" data-lw="${i}:radical" value="${escapeHTML(w.radical || '')}" />
                </div>
                <div style="display:flex; align-items:end; justify-content:flex-end;">
                  <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-rm-lw="${i}">Remove</button>
                </div>
              </div>
            </div>
          `
              )
              .join('')
          : `<span style="font-size:0.82rem; color:#64748b;">No writing characters added yet.</span>`;
        writingBox.querySelectorAll('[data-lw]').forEach((inp) => {
          inp.oninput = () => {
            const [idx, key] = inp.getAttribute('data-lw').split(':');
            state.editingLessonWriting[Number(idx)][key] = inp.value;
          };
        });
        writingBox.querySelectorAll('[data-rm-lw]').forEach((b) => {
          b.onclick = () => {
            state.editingLessonWriting.splice(Number(b.getAttribute('data-rm-lw')), 1);
            renderSubLists();
          };
        });
      }
    };

    openModal(`
      <div class="admin-panel-head" style="margin-bottom:14px;">
        <div>
          <h2>${isNew ? 'Create Lesson' : `Edit Lesson: ${escapeHTML(base.title)}`}</h2>
          <p>Configure metadata, Free/Paid access price, video/poster/audio files, Vocabulary, and Writing characters.</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="lsCloseModalBtn">✕</button>
      </div>

      <form id="lessonEditForm">
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="lsId">Lesson ID *</label>
            <input type="text" class="admin-input" id="lsId" value="${escapeHTML(base.id)}" ${isNew ? '' : 'readonly'} required />
          </div>
          <div class="admin-field">
            <label for="lsCourse">Course Name * (e.g. HSK 2)</label>
            <input type="text" class="admin-input" id="lsCourse" list="lsCourseOptions" value="${escapeHTML(baseCourse)}" placeholder="HSK 2" required />
            <datalist id="lsCourseOptions">
              ${coursesList.map((c) => `<option value="${escapeHTML(c)}"></option>`).join('')}
            </datalist>
          </div>
          <div class="admin-field">
            <label for="lsLevel">Level Label</label>
            <input type="text" class="admin-input" id="lsLevel" value="${escapeHTML(base.level || baseCourse)}" />
          </div>
          <div class="admin-field">
            <label for="lsTitle">Title *</label>
            <input type="text" class="admin-input" id="lsTitle" value="${escapeHTML(base.title || '')}" required />
          </div>
          <div class="admin-field">
            <label for="lsCn">Chinese Title</label>
            <input type="text" class="admin-input" id="lsCn" value="${escapeHTML(base.chineseTitle || '')}" />
          </div>
          <div class="admin-field">
            <label for="lsPinyin">Pinyin</label>
            <input type="text" class="admin-input" id="lsPinyin" value="${escapeHTML(base.pinyin || '')}" />
          </div>
        </div>

        <div class="admin-grid-3" style="margin-top:10px;">
          <div class="admin-field">
            <label for="lsAccess">Access Tier *</label>
            <select class="admin-select" id="lsAccess">
              <option value="free" ${pricing.accessType === 'free' ? 'selected' : ''}>Free Lesson</option>
              <option value="paid" ${pricing.accessType === 'paid' ? 'selected' : ''}>Paid Subscription</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="lsPrice">Single-Lesson Price (Kyat)</label>
            <input type="number" class="admin-input" id="lsPrice" min="0" max="10000000" value="${escapeHTML(
              pricing.accessType === 'free' ? 0 : (pricing.price ?? 75000)
            )}" />
          </div>
          <div class="admin-field">
            <label for="lsMeaning">Meaning</label>
            <input type="text" class="admin-input" id="lsMeaning" value="${escapeHTML(base.meaning || '')}" />
          </div>
        </div>

        <div class="admin-grid-2" style="margin-top:10px;">
          <div class="admin-field">
            <label for="lsDesc">Description</label>
            <textarea class="admin-textarea" id="lsDesc">${escapeHTML(base.description || '')}</textarea>
          </div>
          <div class="admin-field">
            <label for="lsKeywords">Keywords (comma separated)</label>
            <textarea class="admin-textarea" id="lsKeywords">${escapeHTML(base.keywords || '')}</textarea>
          </div>
        </div>

        <div class="admin-grid-3" style="margin-top:10px;">
          ${renderMediaPickerField({
            id: 'lsVideo',
            label: 'Video (Upload or URL)',
            value: base.videoUrl || '',
            accept: 'video/*',
            kind: 'video'
          })}
          ${renderMediaPickerField({
            id: 'lsPoster',
            label: 'Poster Image (Upload or URL)',
            value: base.posterUrl || '',
            accept: 'image/*',
            kind: 'image'
          })}
          ${renderMediaPickerField({
            id: 'lsAudio',
            label: 'Full Audio (Upload or URL)',
            value: base.fullAudio || '',
            accept: 'audio/*',
            kind: 'audio'
          })}
        </div>

        <div style="margin:14px 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Vocabulary (${state.editingLessonVocab.length})</strong>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnAddLessonVocab">+ Add Word</button>
          </div>
          <div id="lsVocabList" class="admin-sublist-box"></div>
        </div>

        <div style="margin:14px 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Writing Practice Characters (${state.editingLessonWriting.length})</strong>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnAddLessonWriting">+ Add Character</button>
          </div>
          <div id="lsWritingList" class="admin-sublist-box"></div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="lsCancelBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary">Save Lesson</button>
        </div>
      </form>
    `);

    renderSubLists();
    document.getElementById('lsCloseModalBtn').onclick = closeModal;
    document.getElementById('lsCancelBtn').onclick = closeModal;
    document.getElementById('btnAddLessonVocab').onclick = () => {
      state.editingLessonVocab.push({
        lessonId: document.getElementById('lsId').value.trim(),
        order: state.editingLessonVocab.length + 1,
        character: '',
        pinyin: '',
        meaning: '',
        audio: ''
      });
      renderSubLists();
    };
    document.getElementById('btnAddLessonWriting').onclick = () => {
      state.editingLessonWriting.push({
        lessonId: document.getElementById('lsId').value.trim(),
        order: state.editingLessonWriting.length + 1,
        character: '',
        pinyin: '',
        meaning: '',
        strokeCount: 6,
        radical: ''
      });
      renderSubLists();
    };

    document.getElementById('lessonEditForm').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('lsId').value.trim();
      const courseName = normalizeCourseName(document.getElementById('lsCourse').value);
      const accessType = document.getElementById('lsAccess').value === 'paid' ? 'paid' : 'free';
      const price = accessType === 'free' ? 0 : Math.max(0, Number(document.getElementById('lsPrice').value) || 0);

      const rec = {
        id,
        course: courseName,
        category: courseName,
        categoryKey: courseSlug(courseName) || 'hsk2',
        categoryNum: courseName,
        title: document.getElementById('lsTitle').value.trim(),
        chineseTitle: document.getElementById('lsCn').value.trim(),
        pinyin: document.getElementById('lsPinyin').value.trim(),
        meaning: document.getElementById('lsMeaning').value.trim(),
        level: document.getElementById('lsLevel').value.trim() || courseName,
        description: document.getElementById('lsDesc').value.trim(),
        videoUrl: document.getElementById('lsVideo').value.trim(),
        posterUrl: document.getElementById('lsPoster').value.trim(),
        fullAudio: document.getElementById('lsAudio').value.trim(),
        keywords: document.getElementById('lsKeywords').value.trim(),
        accessType,
        price
      };

      const nextLessons = [...state.lessonsData.Lessons];
      const idx = nextLessons.findIndex((x) => isSameId(x.id, id));
      if (idx >= 0) nextLessons[idx] = rec;
      else nextLessons.push(rec);

      const keptVocab = state.lessonsData.Vocabulary.filter((x) => !isSameId(x.lessonId, id));
      const cleanVocab = state.editingLessonVocab
        .filter((v) => v.character || v.meaning)
        .map((v, i) => ({ ...v, lessonId: id, order: i + 1 }));

      const keptWriting = state.lessonsData.Writing.filter((x) => !isSameId(x.lessonId, id));
      const cleanWriting = state.editingLessonWriting
        .filter((w) => w.character)
        .map((w, i) => ({ ...w, lessonId: id, order: i + 1 }));

      try {
        setSyncStatus('Saving lesson…');
        const res = await getContentStore().saveLessonsSheets({
          Lessons: nextLessons,
          Vocabulary: [...keptVocab, ...cleanVocab],
          Writing: [...keptWriting, ...cleanWriting]
        });
        state.lessonsData = { ...state.lessonsData, ...res.sheets };
        // Ensure any custom course typed in the Lesson Editor is registered in Courses Manager
        const knownCourses = getAdminCoursesList();
        if (!knownCourses.some((c) => courseSlug(c) === courseSlug(courseName))) {
          try {
            const cOut = await window.LinguaAuth.createCourseAdmin(courseName, 120, state.lessonsData.Lessons || []);
            if (cOut && cOut.config) state.siteConfig = cOut.config;
          } catch (_) {}
        }
        if (window.LinguaAuth && typeof window.LinguaAuth.saveLessonCatalogItems === 'function') {
          await window.LinguaAuth.saveLessonCatalogItems([
            { lessonId: id, title: rec.title, course: courseName, accessType, price }
          ]);
        }
        try {
          if (!res.syncedToServer) {
            const pricingRaw = localStorage.getItem('linguapath_local_lesson_pricing');
            const pricingMap = pricingRaw ? JSON.parse(pricingRaw) : {};
            pricingMap[id] = { accessType, price };
            localStorage.setItem('linguapath_local_lesson_pricing', JSON.stringify(pricingMap));
          } else {
            localStorage.removeItem('linguapath_custom_lessons');
          }
        } catch (_) {}
        closeModal();
        updateNavCounts();
        const priceLabel = accessType === 'paid' ? `${Number(price).toLocaleString()} Kyat` : 'Free';
        applySyncFeedback(
          res,
          `Saved "${rec.title}" under ${courseName} (${priceLabel}) and synced to Excel & DB.`,
          `Saved "${rec.title}" under ${courseName} (${priceLabel}) locally.`
        );
        renderActiveTab();
      } catch (err) {
        setSyncStatus('Save failed');
        toast(err instanceof Error ? err.message : 'Failed to save lesson.', 'error');
      }
    };
  }

  // --- Writing & Stroke Order Editor Modal ---
  function openWritingEditorModal(lessonId) {
    const lessons = state.lessonsData.Lessons || [];
    let currentLessonId = lessonId || (lessons[0] ? lessons[0].id : 'hsk2-01');

    const renderWritingModalContent = () => {
      const lesson = lessons.find((x) => isSameId(x.id, currentLessonId)) || { id: currentLessonId, title: currentLessonId };
      let lessonWriting = (state.lessonsData.Writing || [])
        .filter((w) => isSameId(w.lessonId, currentLessonId))
        .map((w) => ({ ...w }));

      const renderWritingList = () => {
        const container = document.getElementById('wmWritingTableContainer');
        if (!container) return;

        container.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong>Lesson:</strong>
              <select id="wmLessonSwitcher" class="admin-select" style="max-width:280px;">
                ${lessons
                  .map(
                    (l) =>
                      `<option value="${escapeHTML(l.id)}" ${isSameId(l.id, currentLessonId) ? 'selected' : ''}>${escapeHTML(
                        l.id
                      )} — ${escapeHTML(l.title)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="wmAddCharBtn">+ Add Character</button>
          </div>

          <div class="admin-table-wrap" style="max-height:420px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px;">
            <table class="admin-table" style="font-size:0.85rem;">
              <thead>
                <tr>
                  <th style="width:55px;">#</th>
                  <th style="width:120px;">Hanzi Character</th>
                  <th style="width:130px;">Pinyin</th>
                  <th>English Meaning</th>
                  <th style="width:85px;">Strokes</th>
                  <th style="width:125px;">Radical</th>
                  <th style="width:70px;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${
                  lessonWriting.length
                    ? lessonWriting
                        .map(
                          (w, idx) => `
                        <tr>
                          <td>
                            <input type="number" class="admin-input" style="width:48px;" data-wm-field="${idx}:order" value="${escapeHTML(
                            w.order || idx + 1
                          )}" />
                          </td>
                          <td>
                            <div style="display:flex; align-items:center; gap:6px;">
                              <input type="text" class="admin-input" style="width:55px; text-align:center; font-size:1.15rem; font-weight:700;" data-wm-field="${idx}:character" value="${escapeHTML(
                            w.character || ''
                          )}" placeholder="字" />
                              <span class="chinese-kaiti" style="font-size:1.35rem; min-width:24px; color:#1e293b;">${escapeHTML(
                            w.character || ''
                          )}</span>
                            </div>
                          </td>
                          <td>
                            <input type="text" class="admin-input" data-wm-field="${idx}:pinyin" value="${escapeHTML(
                            w.pinyin || ''
                          )}" placeholder="e.g. zǎo" />
                          </td>
                          <td>
                            <input type="text" class="admin-input" data-wm-field="${idx}:meaning" value="${escapeHTML(
                            w.meaning || ''
                          )}" placeholder="e.g. morning / early" />
                          </td>
                          <td>
                            <input type="number" class="admin-input" style="width:65px;" data-wm-field="${idx}:strokeCount" value="${escapeHTML(
                            w.strokeCount || 6
                          )}" min="1" max="64" />
                          </td>
                          <td>
                            <input type="text" class="admin-input" data-wm-field="${idx}:radical" value="${escapeHTML(
                            w.radical || ''
                          )}" placeholder="e.g. 日 (Sun)" />
                          </td>
                          <td>
                            <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-wm-del="${idx}">Delete</button>
                          </td>
                        </tr>
                      `
                        )
                        .join('')
                    : `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:24px;">No characters configured for this lesson yet. Click "+ Add Character" to add one.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `;

        const switcher = document.getElementById('wmLessonSwitcher');
        if (switcher) {
          switcher.onchange = (e) => {
            currentLessonId = e.target.value;
            renderWritingModalContent();
          };
        }

        container.querySelectorAll('[data-wm-field]').forEach((inp) => {
          inp.oninput = () => {
            const [idxStr, fieldKey] = inp.getAttribute('data-wm-field').split(':');
            const idx = Number(idxStr);
            if (lessonWriting[idx]) {
              lessonWriting[idx][fieldKey] = inp.value;
              if (fieldKey === 'character') {
                const row = inp.closest('tr');
                const preview = row ? row.querySelector('.chinese-kaiti') : null;
                if (preview) preview.textContent = inp.value;
              }
            }
          };
        });

        container.querySelectorAll('[data-wm-del]').forEach((btn) => {
          btn.onclick = () => {
            const idx = Number(btn.getAttribute('data-wm-del'));
            lessonWriting.splice(idx, 1);
            renderWritingList();
          };
        });

        const addBtn = document.getElementById('wmAddCharBtn');
        if (addBtn) {
          addBtn.onclick = () => {
            lessonWriting.push({
              lessonId: currentLessonId,
              order: lessonWriting.length + 1,
              character: '',
              pinyin: '',
              meaning: '',
              strokeCount: 6,
              radical: ''
            });
            renderWritingList();
          };
        }
      };

      openModal(`
        <div class="admin-panel-head" style="margin-bottom:14px;">
          <div>
            <h2>Writing &amp; Stroke Order Characters: ${escapeHTML(lesson.title || currentLessonId)}</h2>
            <p>Add and edit which Hanzi characters learners practice writing with animated stroke order for lesson <code>${escapeHTML(
              currentLessonId
            )}</code>.</p>
          </div>
          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="wmCloseBtn">✕</button>
        </div>

        <div id="wmWritingTableContainer"></div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; border-top:1px solid #e2e8f0; padding-top:14px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="wmCancelBtn">Cancel</button>
          <button type="button" class="admin-btn admin-btn-primary" id="wmSaveBtn">💾 Save Writing Characters</button>
        </div>
      `);

      renderWritingList();

      document.getElementById('wmCloseBtn').onclick = closeModal;
      document.getElementById('wmCancelBtn').onclick = closeModal;

      document.getElementById('wmSaveBtn').onclick = async () => {
        const saveBtn = document.getElementById('wmSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
          const cleaned = lessonWriting
            .filter((w) => String(w.character || '').trim())
            .map((w, i) => ({
              lessonId: currentLessonId,
              order: Number(w.order) || i + 1,
              character: String(w.character || '').trim(),
              pinyin: String(w.pinyin || '').trim(),
              meaning: String(w.meaning || '').trim(),
              strokeCount: Number(w.strokeCount) || 6,
              radical: String(w.radical || '').trim()
            }));

          const otherWriting = (state.lessonsData.Writing || []).filter((w) => !isSameId(w.lessonId, currentLessonId));
          const nextWriting = [...otherWriting, ...cleaned];

          setSyncStatus('Saving writing characters…');
          const res = await getContentStore().saveLessonsSheets({
            Writing: nextWriting
          });
          state.lessonsData = { ...state.lessonsData, ...res.sheets };
          closeModal();
          applySyncFeedback(
            res,
            `Saved ${cleaned.length} writing character(s) for "${lesson.title}" to Excel & DB.`,
            `Saved ${cleaned.length} writing character(s) for "${lesson.title}" locally.`
          );
          renderActiveTab();
        } catch (err) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save Writing Characters';
          toast(err instanceof Error ? err.message : 'Failed to save writing characters.', 'error');
        }
      };
    };

    renderWritingModalContent();
  }

  // --- Pronunciation Check Practice Lines Editor Modal ---
  const DEFAULT_PRONUNCIATION_TEMPLATES = {
    'adult-basics-01': [
      { order: 1, chinese: '早上好！今天天气真好。', pinyin: 'Zǎoshang hǎo! Jīntiān tiānqì zhēn hǎo.', meaning: 'Good morning! The weather is really nice today.', focus: 'Morning greetings & daily pleasantries' },
      { order: 2, chinese: '您好，请问洗手间在哪里？', pinyin: 'Nín hǎo, qǐngwèn xǐshǒujiān zài nǎlǐ?', meaning: 'Hello, excuse me, where is the restroom?', focus: 'Polite inquiries (您好 / 请问)' },
      { order: 3, chinese: '非常感谢您的热心帮助。', pinyin: 'Fēicháng gǎnxiè nín de rèxīn bāngzhù.', meaning: 'Thank you very much for your kind help.', focus: 'Gratitude & formal etiquette' },
      { order: 4, chinese: '不客气，明天见！', pinyin: 'Bú kèqi, míngtiān jiàn!', meaning: "You're welcome, see you tomorrow!", focus: 'Closing pleasantries' }
    ],
    'adult-basics-02': [
      { order: 1, chinese: '你好，我叫大卫，很高兴认识你。', pinyin: 'Nǐ hǎo, wǒ jiào Dàwèi, hěn gāoxìng rènshí nǐ.', meaning: 'Hello, my name is David, nice to meet you.', focus: 'Self-introduction & greetings' },
      { order: 2, chinese: '我是美国人，目前在北京工作。', pinyin: 'Wǒ shì Měiguó rén, mùqián zài Běijīng gōngzuò.', meaning: 'I am American, currently working in Beijing.', focus: 'Nationality & location' },
      { order: 3, chinese: '我的手机号码是一三八零零一二。', pinyin: 'Wǒ de shǒujī hàomǎ shì yīsānbā línglíng yī\'èr.', meaning: 'My cell phone number is 138-0012.', focus: 'Digits & phone number rhythm' },
      { order: 4, chinese: '请问这个一件多少钱？', pinyin: 'Qǐngwèn zhège yí jiàn duōshao qián?', meaning: 'Excuse me, how much is this one piece?', focus: 'Basic prices & measure words' }
    ],
    'adult-travel-01': [
      { order: 1, chinese: '服务员，请给我们一份菜单。', pinyin: 'Fúwùyuán, qǐng gěi wǒmen yí fèn càidān.', meaning: 'Waiter, please bring us a menu.', focus: 'Restaurant etiquette' },
      { order: 2, chinese: '我们点一份宫保鸡丁和水饺。', pinyin: 'Wǒmen diǎn yí fèn gōngbǎo jīdīng hé shuǐjiǎo.', meaning: "We'd like to order Kung Pao chicken and dumplings.", focus: 'Ordering signature dishes' },
      { order: 3, chinese: '请不要放辣椒，我们不吃辣。', pinyin: 'Qǐng búyào fàng làjiāo, wǒmen bù chī là.', meaning: "Please don't put chili, we don't eat spicy.", focus: 'Dietary preferences' },
      { order: 4, chinese: '你好买单，可以用微信支付吗？', pinyin: 'Nǐ hǎo mǎidān, kěyǐ yòng Wēixìn zhīfù ma?', meaning: 'Hello, check please, can I pay using WeChat?', focus: 'Digital payments & bill settlement' }
    ],
    'adult-travel-02': [
      { order: 1, chinese: '请问去最近的地铁站怎么走？', pinyin: 'Qǐngwèn qù zuìjìn de dìtiězhàn zěnme zǒu?', meaning: 'Excuse me, how do I walk to the nearest subway station?', focus: 'Asking directions' },
      { order: 2, chinese: '向前一直走，在十字路口向右转。', pinyin: 'Xiàng qián yìzhí zǒu, zài shízì lùkǒu xiàng yòu zhuǎn.', meaning: 'Walk straight ahead, then turn right at the crossroads.', focus: 'Navigation directions' },
      { order: 3, chinese: '我要买一张去上海的高铁二等座。', pinyin: 'Wǒ yào mǎi yì zhāng qù Shànghǎi de gāotiě èrděngzuò.', meaning: "I'd like to buy a second-class bullet train ticket to Shanghai.", focus: 'Train tickets & transit' }
    ]
  };

  function openPronunciationEditorModal(lessonId) {
    const lessons = state.lessonsData.Lessons || [];
    let currentLessonId = lessonId || (lessons[0] ? lessons[0].id : 'hsk2-01');

    const renderPronModalContent = () => {
      const lesson = lessons.find((x) => isSameId(x.id, currentLessonId)) || { id: currentLessonId, title: currentLessonId };

      let lessonPron = (state.lessonsData.Pronunciation || [])
        .filter((p) => isSameId(p.lessonId, currentLessonId))
        .map((p) => ({ ...p }));

      // If no pronunciation lines currently in state, prefill with defaults
      if (!lessonPron.length) {
        const template = DEFAULT_PRONUNCIATION_TEMPLATES[currentLessonId.toLowerCase()] || [];
        if (template.length) {
          lessonPron = template.map((t, idx) => ({ ...t, lessonId: currentLessonId, order: idx + 1 }));
        } else if (lesson.chineseTitle) {
          lessonPron = [
            {
              lessonId: currentLessonId,
              order: 1,
              chinese: lesson.chineseTitle,
              pinyin: lesson.pinyin || '',
              meaning: lesson.meaning || lesson.title,
              focus: 'Lesson Core Phrase'
            },
            {
              lessonId: currentLessonId,
              order: 2,
              chinese: '你好！很高兴学中文。',
              pinyin: 'Nǐ hǎo! Hěn gāoxìng xué Zhōngwén.',
              meaning: 'Hello! Very happy to learn Chinese.',
              focus: 'General Greeting Practice'
            }
          ];
        }
      }

      const renderPronList = () => {
        const container = document.getElementById('pmPronTableContainer');
        if (!container) return;

        container.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong>Lesson:</strong>
              <select id="pmLessonSwitcher" class="admin-select" style="max-width:280px;">
                ${lessons
                  .map(
                    (l) =>
                      `<option value="${escapeHTML(l.id)}" ${isSameId(l.id, currentLessonId) ? 'selected' : ''}>${escapeHTML(
                        l.id
                      )} — ${escapeHTML(l.title)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="pmAddLineBtn">+ Add Practice Line</button>
          </div>

          <div class="admin-table-wrap" style="max-height:420px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px;">
            <table class="admin-table" style="font-size:0.85rem;">
              <thead>
                <tr>
                  <th style="width:55px;">#</th>
                  <th style="width:240px;">Chinese Speech Target</th>
                  <th style="width:200px;">Pinyin &amp; Tones</th>
                  <th>English Translation</th>
                  <th style="width:160px;">Focus / Topic Tag</th>
                  <th style="width:70px;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${
                  lessonPron.length
                    ? lessonPron
                        .map(
                          (p, idx) => `
                        <tr>
                          <td>
                            <input type="number" class="admin-input" style="width:48px;" data-pm-field="${idx}:order" value="${escapeHTML(
                            p.order || idx + 1
                          )}" />
                          </td>
                          <td>
                            <textarea class="admin-textarea" style="height:58px; font-size:0.95rem; font-weight:600;" data-pm-field="${idx}:chinese" placeholder="e.g. 早上好！今天天气真好。">${escapeHTML(
                            p.chinese || ''
                          )}</textarea>
                          </td>
                          <td>
                            <textarea class="admin-textarea" style="height:58px;" data-pm-field="${idx}:pinyin" placeholder="e.g. Zǎoshang hǎo! Jīntiān tiānqì zhēn hǎo.">${escapeHTML(
                            p.pinyin || ''
                          )}</textarea>
                          </td>
                          <td>
                            <textarea class="admin-textarea" style="height:58px;" data-pm-field="${idx}:meaning" placeholder="e.g. Good morning! The weather is really nice today.">${escapeHTML(
                            p.meaning || ''
                          )}</textarea>
                          </td>
                          <td>
                            <input type="text" class="admin-input" data-pm-field="${idx}:focus" value="${escapeHTML(
                            p.focus || ''
                          )}" placeholder="e.g. Greetings" />
                          </td>
                          <td>
                            <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-pm-del="${idx}">Delete</button>
                          </td>
                        </tr>
                      `
                        )
                        .join('')
                    : `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:24px;">No pronunciation practice lines configured yet. Click "+ Add Practice Line" above.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `;

        const switcher = document.getElementById('pmLessonSwitcher');
        if (switcher) {
          switcher.onchange = (e) => {
            currentLessonId = e.target.value;
            renderPronModalContent();
          };
        }

        container.querySelectorAll('[data-pm-field]').forEach((inp) => {
          inp.oninput = () => {
            const [idxStr, fieldKey] = inp.getAttribute('data-pm-field').split(':');
            const idx = Number(idxStr);
            if (lessonPron[idx]) {
              lessonPron[idx][fieldKey] = inp.value;
            }
          };
        });

        container.querySelectorAll('[data-pm-del]').forEach((btn) => {
          btn.onclick = () => {
            const idx = Number(btn.getAttribute('data-pm-del'));
            lessonPron.splice(idx, 1);
            renderPronList();
          };
        });

        const addBtn = document.getElementById('pmAddLineBtn');
        if (addBtn) {
          addBtn.onclick = () => {
            lessonPron.push({
              lessonId: currentLessonId,
              order: lessonPron.length + 1,
              chinese: '',
              pinyin: '',
              meaning: '',
              focus: lesson.title || 'Mandarin Speech'
            });
            renderPronList();
          };
        }
      };

      openModal(`
        <div class="admin-panel-head" style="margin-bottom:14px;">
          <div>
            <h2>Pronunciation Check Lines: ${escapeHTML(lesson.title || currentLessonId)}</h2>
            <p>Configure speech recognition practice lines for lesson <code>${escapeHTML(
              currentLessonId
            )}</code>. Stored in <code>Pronunciation</code> sheet of <code>lessons.xlsx</code>.</p>
          </div>
          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="pmCloseBtn">✕</button>
        </div>

        <div id="pmPronTableContainer"></div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; border-top:1px solid #e2e8f0; padding-top:14px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="pmCancelBtn">Cancel</button>
          <button type="button" class="admin-btn admin-btn-primary" id="pmSaveBtn">💾 Save Pronunciation Lines</button>
        </div>
      `);

      renderPronList();

      document.getElementById('pmCloseBtn').onclick = closeModal;
      document.getElementById('pmCancelBtn').onclick = closeModal;

      document.getElementById('pmSaveBtn').onclick = async () => {
        const saveBtn = document.getElementById('pmSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
          const cleaned = lessonPron
            .filter((p) => String(p.chinese || '').trim())
            .map((p, i) => ({
              lessonId: currentLessonId,
              order: Number(p.order) || i + 1,
              chinese: String(p.chinese || '').trim(),
              pinyin: String(p.pinyin || '').trim(),
              meaning: String(p.meaning || '').trim(),
              focus: String(p.focus || '').trim() || lesson.title
            }));

          const otherPron = (state.lessonsData.Pronunciation || []).filter((p) => !isSameId(p.lessonId, currentLessonId));
          const nextPron = [...otherPron, ...cleaned];

          setSyncStatus('Saving pronunciation lines…');
          const res = await getContentStore().saveLessonsSheets({
            Pronunciation: nextPron
          });
          state.lessonsData = { ...state.lessonsData, ...res.sheets };
          closeModal();
          applySyncFeedback(
            res,
            `Saved ${cleaned.length} pronunciation practice line(s) for "${lesson.title}" to Excel & DB.`,
            `Saved ${cleaned.length} pronunciation practice line(s) for "${lesson.title}" locally.`
          );
          renderActiveTab();
        } catch (err) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save Pronunciation Lines';
          toast(err instanceof Error ? err.message : 'Failed to save pronunciation lines.', 'error');
        }
      };
    };

    renderPronModalContent();
  }

  // --- Tab 5: Wordwall Games ---
  function renderGamesTab(viewport) {
    const games = [...(state.lessonsData.Games || [])].sort(
      (a, b) => (Number(a.order) || 999) - (Number(b.order) || 999)
    );
    const featSet = new Set(((state.siteConfig && state.siteConfig.featuredGameIds) || []).map((x) => x.toLowerCase()));

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Wordwall Interactive Games (${games.length})</h2>
            <p>Add, edit, reorder, activate/deactivate, delete Wordwall links, and choose games featured on the homepage.</p>
          </div>
          <button type="button" class="admin-btn admin-btn-primary" id="btnAddGame">+ Add Wordwall Game</button>
        </div>
        ${renderWorkbookSyncToolbar('lessons', 'lessons.xlsx')}

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Featured</th>
                <th>Order</th>
                <th>Title &amp; Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                games.length
                  ? games
                      .map((g, idx) => {
                        const isFeat = featSet.has(String(g.id || '').toLowerCase());
                        const isActive = String(g.active || 'TRUE').toUpperCase() !== 'FALSE';
                        return `
                        <tr>
                          <td>
                            <input type="checkbox" data-feat-game="${escapeHTML(g.id)}" ${isFeat ? 'checked' : ''} />
                          </td>
                          <td>
                            <div style="display:flex; align-items:center; gap:4px;">
                              <strong>#${idx + 1}</strong>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-move-game="${idx}:-1" ${
                                idx === 0 ? 'disabled' : ''
                              } aria-label="Move up">↑</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-move-game="${idx}:1" ${
                                idx === games.length - 1 ? 'disabled' : ''
                              } aria-label="Move down">↓</button>
                            </div>
                          </td>
                          <td>
                            <strong>${escapeHTML(g.title || g.id)}</strong>
                            <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(g.category || '')} · ${escapeHTML(
                          g.embed_url || extractIframeUrl(g.embed_code)
                        )}</div>
                          </td>
                          <td>
                            <label class="admin-check-row">
                              <input type="checkbox" data-toggle-game-active="${escapeHTML(g.id)}" ${isActive ? 'checked' : ''} />
                              <span class="${isActive ? 'admin-status-active' : 'admin-status-free'}">${
                          isActive ? 'Active' : 'Hidden'
                        }</span>
                            </label>
                          </td>
                          <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-game="${escapeHTML(
                                g.id
                              )}">Edit</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-dup-game="${escapeHTML(
                                g.id
                              )}">Duplicate</button>
                              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-del-game="${escapeHTML(
                                g.id
                              )}">Delete</button>
                            </div>
                          </td>
                        </tr>
                      `;
                      })
                      .join('')
                  : `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:24px;">No Wordwall games added yet.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    wireWorkbookSyncToolbar(viewport);

    const persistGames = async (nextList, message) => {
      const normalized = nextList.map((g, i) => ({ ...g, order: i + 1 }));
      try {
        setSyncStatus('Saving games…');
        const res = await getContentStore().saveLessonsSheets({ Games: normalized });
        state.lessonsData = { ...state.lessonsData, ...res.sheets };
        updateNavCounts();
        if (message) {
          applySyncFeedback(res, `${message} Synced to Excel & DB.`, `${message} Saved locally.`);
        } else {
          setSyncStatus(res && res.syncedToServer ? 'Synced to Excel & DB' : 'Saved locally');
        }
        renderActiveTab();
      } catch (err) {
        setSyncStatus('Save error');
        toast(err instanceof Error ? err.message : 'Failed to save games.', 'error');
      }
    };

    document.getElementById('btnAddGame').onclick = () => openGameEditorModal(null, persistGames);

    viewport.querySelectorAll('[data-feat-game]').forEach((cb) => {
      cb.onchange = () => toggleFeaturedId('featuredGameIds', cb.getAttribute('data-feat-game'), cb.checked);
    });

    viewport.querySelectorAll('[data-move-game]').forEach((btn) => {
      btn.onclick = () => {
        const [idxStr, deltaStr] = btn.getAttribute('data-move-game').split(':');
        const idx = Number(idxStr);
        const swapIdx = idx + Number(deltaStr);
        if (swapIdx < 0 || swapIdx >= games.length) return;
        const copy = [...games];
        const [moved] = copy.splice(idx, 1);
        copy.splice(swapIdx, 0, moved);
        persistGames(copy, 'Updated game display order.');
      };
    });

    viewport.querySelectorAll('[data-toggle-game-active]').forEach((cb) => {
      cb.onchange = () => {
        const id = cb.getAttribute('data-toggle-game-active');
        const nextList = games.map((g) => (isSameId(g.id, id) ? { ...g, active: cb.checked ? 'TRUE' : 'FALSE' } : g));
        persistGames(nextList, `Game ${id} is now ${cb.checked ? 'Active' : 'Hidden'}.`);
      };
    });

    viewport.querySelectorAll('[data-edit-game]').forEach((btn) => {
      btn.onclick = () => {
        const g = games.find((x) => isSameId(x.id, btn.getAttribute('data-edit-game')));
        openGameEditorModal(g || null, persistGames);
      };
    });

    viewport.querySelectorAll('[data-dup-game]').forEach((btn) => {
      btn.onclick = () => {
        const src = games.find((x) => isSameId(x.id, btn.getAttribute('data-dup-game')));
        if (!src) return;
        openDuplicateModal({
          entityLabel: 'Wordwall Game',
          sourceTitle: src.title || src.id,
          sourceId: src.id,
          existingIds: games.map((x) => x.id),
          helpText: 'Copies category, badge, Wordwall embed URL, iframe code, dimensions, description & active status.',
          onConfirm: async ({ newTitle, newId }) => {
            const copiedGame = { ...src, id: newId, title: newTitle, order: games.length + 1 };
            await persistGames([...games, copiedGame], `Duplicated game "${newTitle}" (${newId}).`);
          }
        });
      };
    });

    viewport.querySelectorAll('[data-del-game]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-del-game');
        openConfirmDialog({
          title: `Delete game "${id}"?`,
          message: 'This permanently removes this Wordwall embed from the Games Arcade.',
          confirmLabel: 'Delete Game',
          onConfirm: () => persistGames(games.filter((x) => !isSameId(x.id, id)), `Deleted game ${id}.`)
        });
      };
    });
  }

  function openGameEditorModal(game, persistGames) {
    const isNew = !game;
    const base = game || {
      id: `game-${String((state.lessonsData.Games || []).length + 1).padStart(2, '0')}`,
      order: (state.lessonsData.Games || []).length + 1,
      title: '',
      category: 'Interactive Practice',
      badge: 'Wordwall Challenge',
      description: '',
      embed_code: '',
      embed_url: '',
      width: 500,
      height: 380,
      active: 'TRUE'
    };
    const featSet = new Set(((state.siteConfig && state.siteConfig.featuredGameIds) || []).map((x) => x.toLowerCase()));
    const isFeatured = featSet.has(String(base.id).toLowerCase());

    openModal(`
      <div class="admin-panel-head" style="margin-bottom:14px;">
        <div>
          <h2>${isNew ? 'Add Wordwall Game' : `Edit Game: ${escapeHTML(base.title)}`}</h2>
          <p>Paste either a Wordwall embed URL or full &lt;iframe&gt; embed code — URLs are extracted automatically.</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="gmCloseModalBtn">✕</button>
      </div>

      <form id="gameEditForm">
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="gmId">Game ID *</label>
            <input type="text" class="admin-input" id="gmId" value="${escapeHTML(base.id)}" ${isNew ? '' : 'readonly'} required />
          </div>
          <div class="admin-field">
            <label for="gmTitle">Title *</label>
            <input type="text" class="admin-input" id="gmTitle" value="${escapeHTML(base.title || '')}" required />
          </div>
          <div class="admin-field">
            <label for="gmCat">Category</label>
            <input type="text" class="admin-input" id="gmCat" value="${escapeHTML(base.category || '')}" />
          </div>
          <div class="admin-field">
            <label for="gmBadge">Badge Label</label>
            <input type="text" class="admin-input" id="gmBadge" value="${escapeHTML(base.badge || '')}" />
          </div>
          <div class="admin-field">
            <label for="gmHeight">Height (px)</label>
            <input type="number" class="admin-input" id="gmHeight" min="250" max="900" value="${escapeHTML(base.height || 380)}" />
          </div>
          <div class="admin-field">
            <label for="gmActive">Visibility</label>
            <select class="admin-select" id="gmActive">
              <option value="TRUE" ${String(base.active || 'TRUE').toUpperCase() !== 'FALSE' ? 'selected' : ''}>Active</option>
              <option value="FALSE" ${String(base.active || 'TRUE').toUpperCase() === 'FALSE' ? 'selected' : ''}>Hidden</option>
            </select>
          </div>
        </div>

        <div class="admin-field" style="margin-top:10px;">
          <label for="gmUrl">Wordwall Embed URL or Paste Full &lt;iframe&gt; Code *</label>
          <input type="text" class="admin-input" id="gmUrl" value="${escapeHTML(
            base.embed_url || extractIframeUrl(base.embed_code)
          )}" placeholder="https://wordwall.net/embed/..." required />
        </div>

        <div class="admin-field" style="margin-top:10px;">
          <label for="gmDesc">Description</label>
          <textarea class="admin-textarea" id="gmDesc">${escapeHTML(base.description || '')}</textarea>
        </div>

        <label class="admin-check-row" style="margin:12px 0;">
          <input type="checkbox" id="gmFeatured" ${isFeatured ? 'checked' : ''} />
          <span>Feature this Game on Homepage</span>
        </label>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button type="button" class="admin-btn admin-btn-secondary" id="gmCancelBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary">Save Game</button>
        </div>
      </form>
    `);

    document.getElementById('gmCloseModalBtn').onclick = closeModal;
    document.getElementById('gmCancelBtn').onclick = closeModal;

    document.getElementById('gameEditForm').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('gmId').value.trim();
      const rawUrlInput = document.getElementById('gmUrl').value.trim();
      const cleanUrl = extractIframeUrl(rawUrlInput);
      const height = Number(document.getElementById('gmHeight').value) || 380;
      const rec = {
        id,
        order: base.order || 1,
        title: document.getElementById('gmTitle').value.trim(),
        category: document.getElementById('gmCat').value.trim() || 'Interactive Game',
        badge: document.getElementById('gmBadge').value.trim() || 'Wordwall Challenge',
        description: document.getElementById('gmDesc').value.trim(),
        embed_url: cleanUrl,
        embed_code: rawUrlInput.toLowerCase().includes('<iframe')
          ? rawUrlInput
          : buildIframeHtml(cleanUrl, 500, height),
        width: 500,
        height,
        active: document.getElementById('gmActive').value
      };

      const nextList = [...(state.lessonsData.Games || [])];
      const idx = nextList.findIndex((x) => isSameId(x.id, id));
      if (idx >= 0) nextList[idx] = rec;
      else nextList.push(rec);

      await persistGames(nextList, `Saved Wordwall game "${rec.title}".`);
      await toggleFeaturedId('featuredGameIds', id, document.getElementById('gmFeatured').checked);
      closeModal();
    };
  }

  function openUserDetailModal(user) {
    if (!user) return;
    openModal(`
      <div class="admin-panel-head" style="margin-bottom:14px;">
        <div>
          <h2>User Profile &amp; Membership · ${escapeHTML(user.username || user.email)}</h2>
          <p>View and edit profile information, role, subscription status, and expiration.</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="udCloseBtn">✕</button>
      </div>

      <form id="userDetailForm">
        <div class="admin-grid-2">
          <div class="admin-field">
            <label for="udUsername">Username *</label>
            <input type="text" class="admin-input" id="udUsername" value="${escapeHTML(user.username || '')}" required />
          </div>
          <div class="admin-field">
            <label for="udEmail">Email Address *</label>
            <input type="email" class="admin-input" id="udEmail" value="${escapeHTML(user.email || '')}" required />
          </div>
          <div class="admin-field">
            <label for="udPhone">Phone Number</label>
            <input type="text" class="admin-input" id="udPhone" value="${escapeHTML(user.phoneNumber || '')}" />
          </div>
          <div class="admin-field">
            <label for="udDob">Date of Birth</label>
            <input type="date" class="admin-input" id="udDob" value="${escapeHTML(user.dob || '')}" />
          </div>
          <div class="admin-field">
            <label for="udRole">System Role</label>
            <select class="admin-select" id="udRole">
              <option value="student" ${user.role !== 'admin' ? 'selected' : ''}>student</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="udStatus">Membership Status</label>
            <select class="admin-select" id="udStatus">
              <option value="free" ${user.membershipStatus === 'free' ? 'selected' : ''}>free</option>
              <option value="pending" ${user.membershipStatus === 'pending' ? 'selected' : ''}>pending</option>
              <option value="active" ${user.membershipStatus === 'active' ? 'selected' : ''}>active</option>
              <option value="expired" ${user.membershipStatus === 'expired' ? 'selected' : ''}>expired</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="udPlan">Membership Plan</label>
            <select class="admin-select" id="udPlan">
              <option value="none" ${user.membershipPlan === 'none' ? 'selected' : ''}>none</option>
              <option value="per_lesson" ${user.membershipPlan === 'per_lesson' ? 'selected' : ''}>per_lesson (Full Lesson Pass)</option>
              <option value="practice_lesson" ${user.membershipPlan === 'practice_lesson' ? 'selected' : ''}>practice_lesson (55,000 Kyat · Practice Only)</option>
              <option value="course" ${user.membershipPlan === 'course' ? 'selected' : ''}>course (Full Course Pass)</option>
              <option value="practice_course" ${user.membershipPlan === 'practice_course' ? 'selected' : ''}>practice_course (55,000 Kyat · Practice Only)</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="udExpiry">Membership Expiry Date</label>
            <input type="date" class="admin-input" id="udExpiry" value="${escapeHTML(user.membershipExpiresAt || '')}" />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; border-top:1px solid #e2e8f0; padding-top:14px;">
          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="udResetPwBtn">🔑 Reset Temporary Password</button>
          <div style="display:flex; gap:10px;">
            <button type="button" class="admin-btn admin-btn-secondary" id="udCancelBtn">Cancel</button>
            <button type="submit" class="admin-btn admin-btn-primary">Save Changes</button>
          </div>
        </div>
      </form>
    `);

    document.getElementById('udCloseBtn').onclick = closeModal;
    document.getElementById('udCancelBtn').onclick = closeModal;

    document.getElementById('udResetPwBtn').onclick = () => {
      closeModal();
      const resetBtn = document.querySelector(`[data-u-resetpw="${CSS.escape(user.uid)}"]`);
      if (resetBtn) resetBtn.click();
    };

    document.getElementById('userDetailForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        username: document.getElementById('udUsername').value.trim(),
        email: document.getElementById('udEmail').value.trim().toLowerCase(),
        phoneNumber: document.getElementById('udPhone').value.trim(),
        dob: document.getElementById('udDob').value.trim(),
        role: document.getElementById('udRole').value,
        membershipStatus: document.getElementById('udStatus').value,
        membershipPlan: document.getElementById('udPlan').value,
        membershipExpiresAt: document.getElementById('udExpiry').value.trim()
      };
      try {
        await window.LinguaAuth.adminUpdateUserDetails(user.uid, payload);
        closeModal();
        toast(`Updated profile for "${payload.username || payload.email}".`);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to update user profile.', 'error');
      }
    };
  }

  // --- Tab 6: Users & Memberships ---
  function renderUsersTab(viewport) {
    const authState = state.authState || { allRequests: [], allUsers: [] };
    const requests = authState.allRequests || [];
    const pendingReqs = requests.filter((r) => r.status === 'pending');
    const users = authState.allUsers || [];
    const q = state.filters.userSearch.toLowerCase();
    const filteredUsers = users.filter(
      (u) =>
        !q ||
        String(u.username || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.phoneNumber || '').toLowerCase().includes(q)
    );

    const excelSummary = authState.excelSummary || {
      baseUsersCount: 0,
      overlayDeltaCount: 0,
      totalMergedUsers: users.length,
      workbookLoaded: false
    };

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Users Excel Workbook (<code>data/users.xlsx</code>)</h2>
            <p>
              All sign-ins verify email &amp; password against <code>data/users.xlsx</code> merged with browser registrations.
              Export <code>users.xlsx</code> after approving members or registering learners and replace <code>data/users.xlsx</code> in your repository to share across all devices.
            </p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <button type="button" class="admin-btn admin-btn-primary btn-sm" id="btnExportUsersXlsx">Export users.xlsx</button>
            <label class="admin-btn admin-btn-secondary admin-btn-sm" style="margin:0; cursor:pointer;">
              <span>Import users.xlsx</span>
              <input type="file" id="inputImportUsersXlsx" accept=".xlsx,.xls" hidden />
            </label>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="btnReloadRepoUsersXlsx">Reload Repo File</button>
          </div>
        </div>
        <div class="admin-backend-status is-success" style="margin-top:0;">
          Merged Users: <strong>${excelSummary.totalMergedUsers}</strong>
          · Repo <code>data/users.xlsx</code> Rows: <strong>${excelSummary.baseUsersCount}</strong>
          · Browser Edits / New Signups: <strong>${excelSummary.overlayDeltaCount}</strong>
        </div>
      </div>

      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Pending QR Payment Subscription Requests (${pendingReqs.length})</h2>
            <p>Approve verified Viber/Email QR payments (Kyat) to immediately unlock single-lesson or full-course access.</p>
          </div>
        </div>

        ${
          pendingReqs.length === 0
            ? `<p style="font-size:0.86rem; color:#64748b; margin:0;">No pending subscription requests right now.</p>`
            : `<div class="admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Requested Plan</th>
                      <th>Contact Channel</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pendingReqs
                      .map(
                        (r) => `
                      <tr>
                        <td>
                          <strong>${escapeHTML(r.username || 'Learner')}</strong>
                          <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(r.userEmail || '')}${
                          r.userPhone ? ` · ${escapeHTML(r.userPhone)}` : ''
                        }</div>
                        </td>
                        <td>
                          <strong>${escapeHTML(r.lessonTitle || r.planType)}</strong>
                          <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(r.amountLabel || '')}</div>
                        </td>
                        <td>
                          ${escapeHTML((r.contactChannel || 'viber').toUpperCase())}: ${escapeHTML(r.contactHandle || '')}
                          ${r.note ? `<div style="font-size:0.78rem; color:#64748b;">"${escapeHTML(r.note)}"</div>` : ''}
                        </td>
                        <td>
                          <div style="display:flex; gap:6px;">
                            <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-adm-approve="${escapeHTML(
                              r.requestId
                            )}">Approve &amp; Activate</button>
                            <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-adm-reject="${escapeHTML(
                              r.requestId
                            )}">Reject</button>
                          </div>
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>

      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Registered Learner Accounts &amp; Memberships (${users.length})</h2>
            <p>Update user membership status, plan, expiration date, and individual unlocked lessons.</p>
          </div>
        </div>

        <div style="margin-bottom:14px; max-width:360px;">
          <input type="search" class="admin-input" id="userSearchInput" value="${escapeHTML(
            state.filters.userSearch
          )}" placeholder="Search username, email, or phone…" />
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Expiry Date</th>
                <th>Unlocked Lessons</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredUsers.length
                  ? filteredUsers
                      .map((u) => {
                        const unlockedCount = Array.isArray(u.subscribedLessonIds) ? u.subscribedLessonIds.length : 0;
                        const unlockedCoursesCount = Array.isArray(u.subscribedCourses) ? u.subscribedCourses.length : 0;
                        const pracCount = Array.isArray(u.practiceLessonIds) ? u.practiceLessonIds.length : 0;
                        const pracCoursesCount = Array.isArray(u.practiceCourses) ? u.practiceCourses.length : 0;
                        const roleTag = u.role === 'admin' ? ' · Admin' : '';
                        const tempTag = u.mustChangePassword ? ' · Temp PW active' : '';
                        return `
                        <tr>
                          <td>
                            <strong>${escapeHTML(u.username || 'Learner')}</strong>${escapeHTML(roleTag)}
                            <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(u.email || '')}${
                          u.phoneNumber ? ` · ${escapeHTML(u.phoneNumber)}` : ''
                        }${escapeHTML(tempTag)}</div>
                          </td>
                          <td>
                            <select class="admin-select" data-u-status="${escapeHTML(u.uid)}">
                              <option value="free" ${u.membershipStatus === 'free' ? 'selected' : ''}>free</option>
                              <option value="pending" ${u.membershipStatus === 'pending' ? 'selected' : ''}>pending</option>
                              <option value="active" ${u.membershipStatus === 'active' ? 'selected' : ''}>active</option>
                              <option value="expired" ${u.membershipStatus === 'expired' ? 'selected' : ''}>expired</option>
                            </select>
                          </td>
                          <td>
                            <select class="admin-select" data-u-plan="${escapeHTML(u.uid)}">
                              <option value="none" ${u.membershipPlan === 'none' ? 'selected' : ''}>none</option>
                              <option value="per_lesson" ${u.membershipPlan === 'per_lesson' ? 'selected' : ''}>per_lesson</option>
                              <option value="practice_lesson" ${u.membershipPlan === 'practice_lesson' ? 'selected' : ''}>practice_lesson (55,000)</option>
                              <option value="course" ${u.membershipPlan === 'course' ? 'selected' : ''}>course</option>
                              <option value="practice_course" ${u.membershipPlan === 'practice_course' ? 'selected' : ''}>practice_course (55,000)</option>
                            </select>
                          </td>
                          <td>
                            <input type="date" class="admin-input" data-u-expiry="${escapeHTML(u.uid)}" value="${escapeHTML(
                          u.membershipExpiresAt || ''
                        )}" />
                          </td>
                          <td>
                            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-u-lessons="${escapeHTML(
                              u.uid
                            )}">Full: C(${unlockedCoursesCount}) L(${unlockedCount}) · Practice: C(${pracCoursesCount}) L(${pracCount})</button>
                          </td>
                          <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-u-edit="${escapeHTML(
                                u.uid
                              )}">View / Edit</button>
                              <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-u-save="${escapeHTML(
                                u.uid
                              )}">Update</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-u-resetpw="${escapeHTML(
                                u.uid
                              )}">Reset PW</button>
                            </div>
                          </td>
                        </tr>
                      `;
                      })
                      .join('')
                  : `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:24px;">No registered users match your search.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    const btnExportUsers = document.getElementById('btnExportUsersXlsx');
    if (btnExportUsers) {
      btnExportUsers.onclick = async () => {
        try {
          const out = await window.LinguaAuth.exportUsersWorkbook();
          toast(`Exported ${out.fileName} (${out.userCount} user rows). Replace data/users.xlsx to publish.`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Export failed.', 'error');
        }
      };
    }

    const inputImportUsers = document.getElementById('inputImportUsersXlsx');
    if (inputImportUsers) {
      inputImportUsers.onchange = async () => {
        const file = inputImportUsers.files && inputImportUsers.files[0];
        if (!file) return;
        try {
          const buf = await file.arrayBuffer();
          const out = await window.LinguaAuth.importUsersWorkbook(buf);
          toast(`Imported ${out.userCount} users from ${file.name}.`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Import failed.', 'error');
        } finally {
          inputImportUsers.value = '';
        }
      };
    }

    const btnReloadRepoUsers = document.getElementById('btnReloadRepoUsersXlsx');
    if (btnReloadRepoUsers) {
      btnReloadRepoUsers.onclick = async () => {
        try {
          const summary = await window.LinguaAuth.reloadUsersWorkbookFromRepo();
          toast(`Reloaded data/users.xlsx (${summary.baseUsersCount} repo user rows).`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Reload failed.', 'error');
        }
      };
    }

    document.getElementById('userSearchInput').oninput = (e) => {
      state.filters.userSearch = e.target.value;
      renderUsersTab(viewport);
    };

    viewport.querySelectorAll('[data-adm-approve]').forEach((btn) => {
      btn.onclick = async () => {
        const req = pendingReqs.find((r) => r.requestId === btn.getAttribute('data-adm-approve'));
        if (!req) return;
        try {
          await window.LinguaAuth.approveSubscriptionRequest(req);
          toast(`Approved subscription for ${req.username || req.userEmail}.`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Approval failed.', 'error');
        }
      };
    });

    viewport.querySelectorAll('[data-adm-reject]').forEach((btn) => {
      btn.onclick = async () => {
        const reqId = btn.getAttribute('data-adm-reject');
        try {
          await window.LinguaAuth.rejectSubscriptionRequest(reqId);
          toast('Subscription request rejected.');
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Rejection failed.', 'error');
        }
      };
    });

    viewport.querySelectorAll('[data-u-edit]').forEach((btn) => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-u-edit');
        const user = users.find((x) => x.uid === uid);
        openUserDetailModal(user);
      };
    });

    viewport.querySelectorAll('[data-u-save]').forEach((btn) => {
      btn.onclick = async () => {
        const uid = btn.getAttribute('data-u-save');
        const status = viewport.querySelector(`[data-u-status="${CSS.escape(uid)}"]`)?.value || 'free';
        const plan = viewport.querySelector(`[data-u-plan="${CSS.escape(uid)}"]`)?.value || 'none';
        const expiry = viewport.querySelector(`[data-u-expiry="${CSS.escape(uid)}"]`)?.value || '';
        try {
          await window.LinguaAuth.updateUserMembershipAdmin(uid, {
            membershipStatus: status,
            membershipPlan: plan,
            membershipExpiresAt: expiry
          });
          toast('Updated user membership.');
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Update failed.', 'error');
        }
      };
    });

    viewport.querySelectorAll('[data-u-lessons]').forEach((btn) => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-u-lessons');
        const user = users.find((x) => x.uid === uid);
        if (!user) return;
        const unlocked = new Set(user.subscribedLessonIds || []);
        const unlockedCourses = new Set((user.subscribedCourses || []).map((c) => courseSlug(c)));
        const practiceLessons = new Set(user.practiceLessonIds || []);
        const practiceCourses = new Set((user.practiceCourses || []).map((c) => courseSlug(c)));
        const allLessons = state.lessonsData.Lessons || [];
        const coursesList = getAdminCoursesList();

        openModal(`
          <div class="admin-panel-head" style="margin-bottom:12px;">
            <div>
              <h2>Unlocked Courses &amp; Lessons · ${escapeHTML(user.username || user.email)}</h2>
              <p>Grant Full Access (Video + Exercises, Writing, Pronunciation) or 55,000 Kyat Practice-Only Access (No Video) per course or per lesson.</p>
            </div>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="ulCloseBtn">✕</button>
          </div>

          <strong style="display:block; font-size:0.84rem; margin-bottom:6px;">Full Course Pass (Video + Practice)</strong>
          <div class="admin-featured-checklist" style="margin-bottom:12px;">
            ${coursesList
              .map(
                (cName) => `
              <label class="admin-featured-item">
                <input type="checkbox" name="ulCourse" value="${escapeHTML(cName)}" ${
                  unlockedCourses.has(courseSlug(cName)) ? 'checked' : ''
                } />
                <span>${escapeHTML(cName)}</span>
              </label>
            `
              )
              .join('')}
          </div>

          <strong style="display:block; font-size:0.84rem; margin-bottom:6px;">Practice-Only Courses · 55,000 Kyat (Exercises, Writing &amp; Pronunciation · No Video)</strong>
          <div class="admin-featured-checklist" style="margin-bottom:14px;">
            ${coursesList
              .map(
                (cName) => `
              <label class="admin-featured-item">
                <input type="checkbox" name="ulPracticeCourse" value="${escapeHTML(cName)}" ${
                  practiceCourses.has(courseSlug(cName)) ? 'checked' : ''
                } />
                <span>${escapeHTML(cName)} (Practice Only)</span>
              </label>
            `
              )
              .join('')}
          </div>

          <strong style="display:block; font-size:0.84rem; margin-bottom:6px;">Individual Unlocked Lessons · Full Access (Video + Practice)</strong>
          <div class="admin-featured-checklist" style="max-height:180px; overflow-y:auto; margin-bottom:14px;">
            ${allLessons
              .map(
                (l) => `
              <label class="admin-featured-item">
                <input type="checkbox" name="ulLesson" value="${escapeHTML(l.id)}" ${unlocked.has(l.id) ? 'checked' : ''} />
                <span>${escapeHTML(l.title || l.id)} (${escapeHTML(getLessonCourse(l))})</span>
              </label>
            `
              )
              .join('')}
          </div>

          <strong style="display:block; font-size:0.84rem; margin-bottom:6px;">Individual Unlocked Lessons · Practice Only · 55,000 Kyat (No Video)</strong>
          <div class="admin-featured-checklist" style="max-height:180px; overflow-y:auto;">
            ${allLessons
              .map(
                (l) => `
              <label class="admin-featured-item">
                <input type="checkbox" name="ulPracticeLesson" value="${escapeHTML(l.id)}" ${
                  practiceLessons.has(l.id) ? 'checked' : ''
                } />
                <span>${escapeHTML(l.title || l.id)} (${escapeHTML(getLessonCourse(l))})</span>
              </label>
            `
              )
              .join('')}
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
            <button type="button" class="admin-btn admin-btn-secondary" id="ulCancelBtn">Cancel</button>
            <button type="button" class="admin-btn admin-btn-primary" id="ulSaveBtn">Save Access</button>
          </div>
        `);

        document.getElementById('ulCloseBtn').onclick = closeModal;
        document.getElementById('ulCancelBtn').onclick = closeModal;
        document.getElementById('ulSaveBtn').onclick = async () => {
          const checkedIds = Array.from(document.querySelectorAll('input[name="ulLesson"]:checked')).map((c) => c.value);
          const checkedCourses = Array.from(document.querySelectorAll('input[name="ulCourse"]:checked')).map((c) => c.value);
          const checkedPracticeIds = Array.from(document.querySelectorAll('input[name="ulPracticeLesson"]:checked')).map((c) => c.value);
          const checkedPracticeCourses = Array.from(document.querySelectorAll('input[name="ulPracticeCourse"]:checked')).map((c) => c.value);
          const hasAny = checkedIds.length > 0 || checkedCourses.length > 0 || checkedPracticeIds.length > 0 || checkedPracticeCourses.length > 0;
          const nextPlan = checkedCourses.length
            ? 'course'
            : checkedPracticeCourses.length
            ? 'practice_course'
            : checkedIds.length
            ? 'per_lesson'
            : checkedPracticeIds.length
            ? 'practice_lesson'
            : 'none';
          try {
            await window.LinguaAuth.updateUserMembershipAdmin(uid, {
              membershipStatus: user.membershipStatus && user.membershipStatus !== 'free' ? user.membershipStatus : hasAny ? 'active' : 'free',
              membershipPlan: user.membershipPlan && user.membershipPlan !== 'none' ? user.membershipPlan : nextPlan,
              membershipExpiresAt: user.membershipExpiresAt || '',
              subscribedLessonIds: checkedIds,
              subscribedCourses: checkedCourses,
              practiceLessonIds: checkedPracticeIds,
              practiceCourses: checkedPracticeCourses
            });
            closeModal();
            toast(`Saved access (${checkedCourses.length} full courses, ${checkedPracticeCourses.length} practice courses, ${checkedIds.length} full lessons, ${checkedPracticeIds.length} practice lessons).`);
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Failed to save access.', 'error');
          }
        };
      };
    });

    viewport.querySelectorAll('[data-u-resetpw]').forEach((btn) => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-u-resetpw');
        const user = users.find((x) => x.uid === uid);
        if (!user) return;

        openModal(`
          <div class="admin-panel-head" style="margin-bottom:12px;">
            <div>
              <h2>Reset Password · ${escapeHTML(user.username || user.email)}</h2>
              <p>Set a temporary password for ${escapeHTML(user.email)} (leave blank to auto-generate a strong 12-character temporary password). Export <code>users.xlsx</code> afterward to sync to GitHub.</p>
            </div>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="rpCloseBtn">✕</button>
          </div>

          <form id="adminResetPwForm">
            <div class="admin-field">
              <label for="rpCustomPw">Custom Temporary Password (Optional, min. 6 chars)</label>
              <input type="text" class="admin-input" id="rpCustomPw" minlength="6" placeholder="Leave blank to auto-generate random password" />
            </div>
            <div id="rpResultBox" class="admin-backend-status" hidden></div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
              <button type="button" class="admin-btn admin-btn-secondary" id="rpCancelBtn">Close</button>
              <button type="submit" class="admin-btn admin-btn-primary" id="rpSubmitBtn">Reset User Password</button>
            </div>
          </form>
        `);

        document.getElementById('rpCloseBtn').onclick = closeModal;
        document.getElementById('rpCancelBtn').onclick = closeModal;
        document.getElementById('adminResetPwForm').onsubmit = async (e) => {
          e.preventDefault();
          const customPw = (document.getElementById('rpCustomPw')?.value || '').trim();
          const submitBtn = document.getElementById('rpSubmitBtn');
          const resBox = document.getElementById('rpResultBox');
          if (customPw && customPw.length < 6) {
            toast('Custom password must be at least 6 characters.', 'error');
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Resetting…';
          }
          try {
            const out = await window.LinguaAuth.adminResetUserPassword(uid, {
              newPassword: customPw || undefined
            });
            if (resBox) {
              resBox.hidden = false;
              resBox.className = 'admin-backend-status is-success';
              resBox.innerHTML = `
                <div>Password updated! Share this temporary password with the learner (and click <strong>Export users.xlsx</strong> to publish to your repo):</div>
                <div style="margin-top:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <code style="font-size:0.95rem; font-weight:800; padding:4px 8px; background:rgba(15,23,42,0.08); border-radius:6px;">${escapeHTML(
                    out.temporaryPassword
                  )}</code>
                  <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="rpCopyTempBtn">Copy Password</button>
                </div>
              `;
              const copyBtn = document.getElementById('rpCopyTempBtn');
              if (copyBtn) {
                copyBtn.onclick = () => {
                  navigator.clipboard?.writeText(out.temporaryPassword).then(
                    () => toast('Temporary password copied.'),
                    () => toast('Copy failed — select manually.', 'info')
                  );
                };
              }
            }
            toast(`Temporary password updated for ${user.email}.`);
          } catch (err) {
            if (resBox) {
              resBox.hidden = false;
              resBox.className = 'admin-backend-status is-error';
              resBox.textContent = err instanceof Error ? err.message : 'Failed to reset password.';
            }
            toast(err instanceof Error ? err.message : 'Failed to reset password.', 'error');
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Reset User Password';
            }
          }
        };
      };
    });
  }

  // --- Tab Routing & Auth Gate ---
  function renderActiveTab() {
    const viewport = document.getElementById('adminViewport');
    const breadcrumb = document.getElementById('adminBreadcrumbLabel');
    if (!viewport) return;

    if (breadcrumb) {
      breadcrumb.textContent = TAB_LABELS[state.activeTab] || 'Admin Portal';
    }

    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-admin-tab') === state.activeTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (state.activeTab === 'home') renderHomeTab(viewport);
    else if (state.activeTab === 'stories') renderStoriesTab(viewport);
    else if (state.activeTab === 'reels') renderReelsTab(viewport);
    else if (state.activeTab === 'lessons') renderLessonsTab(viewport);
    else if (state.activeTab === 'games') renderGamesTab(viewport);
    else if (state.activeTab === 'users') renderUsersTab(viewport);
  }

  function updateAuthGateUI(s) {
    state.authState = s;
    const gate = document.getElementById('adminAuthGate');
    const workspace = document.getElementById('adminWorkspace');
    const gateTitle = document.getElementById('adminGateTitle');
    const gateMsg = document.getElementById('adminGateMessage');
    const gateActions = document.getElementById('adminGateActions');

    if (!gate || !workspace) return;

    if (!s || !s.ready) {
      gate.hidden = false;
      workspace.hidden = true;
      return;
    }

    if (s.user && s.isAdmin) {
      gate.hidden = true;
      workspace.hidden = false;
      if (s.siteConfig && !state.siteConfig) {
        state.siteConfig = s.siteConfig;
      }
      updateNavCounts();
      if (!state.loadedOnce) {
        loadAllContentData(false);
      } else if (state.activeTab === 'users') {
        renderActiveTab();
      }
      return;
    }

    gate.hidden = false;
    workspace.hidden = true;

    if (!s.user) {
      const unclaimed = !s.adminClaimed;
      if (gateTitle) {
        gateTitle.textContent = unclaimed ? 'First-Time Admin Setup' : 'Administrator Sign-In Required';
      }
      if (gateMsg) {
        gateMsg.textContent = unclaimed
          ? 'No administrator account exists yet. Create your Admin account with syndkyaw@gmail.com to claim the CMS Portal.'
          : 'Sign in with your administrator email and password (verified against data/users.xlsx) to manage users, memberships, and site settings.';
      }
      if (gateActions) {
        gateActions.innerHTML = unclaimed
          ? `
            <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap; width:100%;">
              <button type="button" class="admin-btn admin-btn-primary" id="adminGateRegisterBtn">Create Admin Account (syndkyaw@gmail.com)</button>
              <button type="button" class="admin-btn admin-btn-secondary" id="adminGateSignInBtn">Sign In</button>
              <a href="index.html" class="admin-btn admin-btn-secondary">Back to Home</a>
            </div>
          `
          : `
            <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap; width:100%;">
              <button type="button" class="admin-btn admin-btn-primary" id="adminGateSignInBtn">Sign In as Admin</button>
              <a href="index.html" class="admin-btn admin-btn-secondary">Back to Home</a>
            </div>
          `;
        const regBtn = document.getElementById('adminGateRegisterBtn');
        if (regBtn) {
          regBtn.onclick = () => {
            if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openAuthModal === 'function') {
              window.LinguaAuthUI.openAuthModal('register');
            }
          };
        }
        const signInBtn = document.getElementById('adminGateSignInBtn');
        if (signInBtn) {
          signInBtn.onclick = () => {
            if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openAuthModal === 'function') {
              window.LinguaAuthUI.openAuthModal('signin');
            }
          };
        }
      }
    } else {
      if (gateTitle) {
        gateTitle.textContent = 'Access Restricted';
      }
      if (gateMsg) {
        gateMsg.textContent = `Signed in as ${s.user.email}. This workspace is restricted to the site administrator account.`;
      }
      if (gateActions) {
        gateActions.innerHTML = `
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap; width:100%;">
            <a href="index.html" class="admin-btn admin-btn-primary">Back to Home</a>
            <button type="button" class="admin-btn admin-btn-secondary" id="adminGateSignOutBtn">Sign Out</button>
          </div>
        `;
        document.getElementById('adminGateSignOutBtn').onclick = () => {
          if (window.LinguaAuth && typeof window.LinguaAuth.logout === 'function') {
            window.LinguaAuth.logout();
          }
        };
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const hashTab = (window.location.hash || '').replace('#', '').trim();
    if (hashTab && TAB_LABELS[hashTab]) {
      state.activeTab = hashTab;
    }

    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
      btn.onclick = () => {
        state.activeTab = btn.getAttribute('data-admin-tab');
        window.history.replaceState(null, '', `#${state.activeTab}`);
        renderActiveTab();
      };
    });

    const refreshBtn = document.getElementById('adminRefreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = () => loadAllContentData(true);
    }

    const backendBadgeBtn = document.getElementById('adminBackendBadge');
    if (backendBadgeBtn) {
      backendBadgeBtn.onclick = () => {
        state.activeTab = 'users';
        window.history.replaceState(null, '', '#users');
        renderActiveTab();
      };
    }

    updateBackendBadge();

    const modalBackdrop = document.getElementById('adminModalBackdrop');
    if (modalBackdrop) {
      modalBackdrop.onclick = (e) => {
        if (e.target === modalBackdrop) closeModal();
      };
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const subBackdrop = document.getElementById('adminSubModalBackdrop');
      if (subBackdrop && subBackdrop.classList.contains('is-open')) {
        closeSubModal();
        return;
      }
      if (modalBackdrop && modalBackdrop.classList.contains('is-open')) {
        closeModal();
      }
    });

    if (window.LinguaAuth && typeof window.LinguaAuth.subscribe === 'function') {
      window.LinguaAuth.subscribe((s) => updateAuthGateUI(s));
    }

    window.addEventListener('lingua-site-config-change', (e) => {
      if (e.detail) state.siteConfig = e.detail;
    });
  });
})();
