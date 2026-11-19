/**
 * =========================================================
 * LINGUAPATH - ADMIN CMS PORTAL CONTROLLER (admin.js)
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
    lessonsData: { Lessons: [], Vocabulary: [], Writing: [], Exercises: [], Games: [] },
    filters: {
      storySearch: '',
      reelSearch: '',
      reelStatus: 'all',
      lessonAudience: 'all',
      lessonSearch: '',
      userSearch: ''
    },
    editingStoryScenes: [],
    editingStoryVocab: [],
    editingLessonVocab: [],
    editingLessonWriting: [],
    pendingExercisesRows: [],
    pendingExercisesMeta: { target: 'lessons', lessonId: '', mode: 'merge_lesson', fileName: '' }
  };

  // --- Utilities ---
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

  function updateBackendBadge() {
    const badge = document.getElementById('adminBackendBadge');
    if (!badge) return;
    const base = window.LinguaBackend && typeof window.LinguaBackend.getApiBase === 'function'
      ? window.LinguaBackend.getApiBase()
      : '';
    const isStatic = window.LinguaBackend && typeof window.LinguaBackend.isStaticGithubHost === 'function'
      ? window.LinguaBackend.isStaticGithubHost()
      : false;
    badge.classList.remove('is-connected', 'is-warning');
    if (base) {
      let labelHost = base;
      try {
        labelHost = new URL(base).host;
      } catch (_) {}
      badge.textContent = `Connected: ${labelHost}`;
      badge.classList.add('is-connected');
    } else if (isStatic) {
      badge.textContent = 'Static Mode — Backend URL Needed';
      badge.classList.add('is-warning');
    } else {
      badge.textContent = 'Same-Origin Node Server';
      badge.classList.add('is-connected');
    }
  }

  function isSameId(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
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

  async function adminFetch(url, options = {}) {
    if (!hasBackend()) {
      throw new Error(
        'Static GitHub Pages cannot save Excel sheets or media uploads directly. Enter your hosted HTTPS Node server URL in Homepage & Contact -> Hosted Node Backend Connection.'
      );
    }
    const authApi = window.LinguaAuth;
    if (!authApi || typeof authApi.getIdToken !== 'function') {
      throw new Error('Authentication SDK is not initialized.');
    }
    const token = await authApi.getIdToken(false);
    if (!token) {
      throw new Error('Administrator session expired. Please sign in again.');
    }
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    const resolvedUrl = apiUrl(url);
    const res = await fetch(resolvedUrl, { ...options, mode: 'cors', headers });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok || (data && data.success === false)) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  }

  // --- Data Loading ---
  async function loadAllContentData(force = false) {
    if (state.loading && !force) return;
    state.loading = true;
    setSyncStatus('Loading data…');
    updateBackendBadge();
    try {
      const stamp = Date.now();
      const backendActive = hasBackend();
      let cfgRes = null;
      let storiesRes = null;
      let reelsRes = null;
      let lessonsRes = null;
      let usedStaticFallback = false;

      if (backendActive) {
        [cfgRes, storiesRes, reelsRes, lessonsRes] = await Promise.all([
          fetch(apiUrl(`/api/site-config?t=${stamp}`), { mode: 'cors' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(apiUrl(`/api/stories-data?t=${stamp}`), { mode: 'cors' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(apiUrl(`/api/reels-stories-data?t=${stamp}`), { mode: 'cors' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(apiUrl(`/api/lessons-data?t=${stamp}`), { mode: 'cors' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ]);
      }

      if (!storiesRes || !storiesRes.sheets || !reelsRes || !reelsRes.sheets || !lessonsRes || !lessonsRes.sheets) {
        usedStaticFallback = !backendActive || (!storiesRes && !reelsRes && !lessonsRes);
        const [fbStories, fbReels, fbLessons] = await Promise.all([
          storiesRes && storiesRes.sheets ? Promise.resolve(storiesRes) : fetch(`data/stories.json?t=${stamp}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          reelsRes && reelsRes.sheets ? Promise.resolve(reelsRes) : fetch(`data/reels_stories.json?t=${stamp}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          lessonsRes && lessonsRes.sheets ? Promise.resolve(lessonsRes) : fetch(`data/lessons.json?t=${stamp}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ]);
        storiesRes = fbStories || storiesRes;
        reelsRes = fbReels || reelsRes;
        lessonsRes = fbLessons || lessonsRes;
      }

      const authSiteCfg =
        window.LinguaAuth && typeof window.LinguaAuth.getSiteConfig === 'function'
          ? window.LinguaAuth.getSiteConfig()
          : null;
      state.siteConfig = authSiteCfg || (cfgRes && cfgRes.config) || {};

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
          Games: Array.isArray(lessonsRes.sheets.Games) ? lessonsRes.sheets.Games : []
        };
      }

      state.loadedOnce = true;
      setSyncStatus(
        usedStaticFallback ? 'Static snapshot (Connect Node URL to save)' : 'Synced'
      );
      updateNavCounts();
      renderActiveTab();
    } catch (err) {
      setSyncStatus('Sync warning');
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

  function renderMediaPreviewInner(url, kind) {
    const clean = String(url || '').trim();
    if (!clean) {
      return `<span style="font-size:0.78rem; color:#64748b;">No ${escapeHTML(kind)} selected</span>`;
    }
    const resolved = assetUrl(clean);
    if (kind === 'video') {
      return `
        <video src="${escapeHTML(resolved)}" muted playsinline controls preload="metadata"></video>
        <span style="font-size:0.78rem; color:#64748b; word-break:break-all;">${escapeHTML(clean)}</span>
      `;
    }
    if (kind === 'audio') {
      return `
        <audio src="${escapeHTML(resolved)}" controls preload="none" style="height:32px; max-width:220px;"></audio>
        <span style="font-size:0.78rem; color:#64748b; word-break:break-all;">${escapeHTML(clean)}</span>
      `;
    }
    return `
      <img src="${escapeHTML(resolved)}" alt="Preview" onerror="this.style.opacity='0.3'" />
      <span style="font-size:0.78rem; color:#64748b; word-break:break-all;">${escapeHTML(clean)}</span>
    `;
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
            const fd = new FormData();
            fd.append('file', file);
            const result = await adminFetch('/api/admin/upload-media', {
              method: 'POST',
              body: fd
            });
            if (textInput) {
              textInput.value = result.url;
              textInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (previewEl) {
              previewEl.innerHTML = renderMediaPreviewInner(result.url, kind);
            }
            setSyncStatus('Uploaded');
            toast(`Uploaded ${file.name} → ${result.url}`);
          } catch (err) {
            setSyncStatus('Upload error');
            toast(err instanceof Error ? err.message : 'Upload failed.', 'error');
          } finally {
            fileInput.value = '';
          }
        });
      }
    });
  }

  // --- Modal Helpers (No window.alert / window.confirm) ---
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
    const backdrop = document.getElementById('adminModalBackdrop');
    const dialog = document.getElementById('adminModalDialog');
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

  // --- Tab 1: Homepage & Contact ---
  function renderHomeTab(viewport) {
    const cfg = state.siteConfig || {};
    const stories = state.storiesData.Lessons || [];
    const reels = state.reelsData.Videos || [];
    const games = state.lessonsData.Games || [];

    const featStories = new Set((cfg.featuredStoryIds || []).map((x) => x.toLowerCase()));
    const featReels = new Set((cfg.featuredReelIds || []).map((x) => x.toLowerCase()));
    const featGames = new Set((cfg.featuredGameIds || []).map((x) => x.toLowerCase()));

    const currentApiBase =
      window.LinguaBackend && typeof window.LinguaBackend.getApiBase === 'function'
        ? window.LinguaBackend.getApiBase()
        : '';
    const isStaticHost =
      window.LinguaBackend && typeof window.LinguaBackend.isStaticGithubHost === 'function'
        ? window.LinguaBackend.isStaticGithubHost()
        : false;
    const probeClass = currentApiBase || !isStaticHost ? 'is-success' : '';
    const probeSummary = currentApiBase
      ? `Connected external Node server: ${currentApiBase} (Origin: ${window.location.origin})`
      : isStaticHost
      ? `Running on static host (${window.location.hostname}). Enter your hosted HTTPS Node server URL below to enable Excel saves, uploads, and live API reads.`
      : `Using same-origin Node server at ${window.location.origin}.`;

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Hosted Node Backend Connection (GitHub Pages &amp; External Server)</h2>
            <p>
              GitHub Pages (${escapeHTML(window.location.hostname || 'static host')}) only serves static files.
              Point this Admin Portal to your deployed HTTPS Node server (e.g. Render, Railway, or Fly.io) so Excel saves, uploads, and user membership APIs run live.
            </p>
          </div>
        </div>

        <div class="admin-field" style="margin-bottom:8px;">
          <label for="cfgBackendApiUrl">Hosted Node Server HTTPS URL</label>
          <div class="admin-backend-row">
            <input
              type="url"
              class="admin-input"
              id="cfgBackendApiUrl"
              value="${escapeHTML(currentApiBase)}"
              placeholder="https://your-linguapath-server.onrender.com"
            />
            <button type="button" class="admin-btn admin-btn-secondary" id="btnTestBackendUrl">Test Connection</button>
            <button type="button" class="admin-btn admin-btn-primary" id="btnSaveBackendUrl">Save Backend URL</button>
            <button type="button" class="admin-btn admin-btn-secondary" id="btnResetBackendUrl">Reset to Local Origin</button>
          </div>
        </div>

        <div id="backendProbeStatus" class="admin-backend-status ${probeClass}">${escapeHTML(probeSummary)}</div>
        <p style="margin:8px 0 0; font-size:0.78rem; color:#64748b; line-height:1.45;">
          Tip: Saving sets this browser override in <code>localStorage</code> and lets you share links with <code>?apiBase=https://...</code>.
          To connect all public GitHub Pages visitors automatically, paste the URL into <code>DEFAULT_PRODUCTION_BACKEND_URL</code> in <code>backend-config.js</code> and redeploy GitHub Pages.
        </p>
      </div>

      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Forgot Password Email Delivery (SMTP)</h2>
            <p>
              When learners click <strong>Forgot password?</strong>, the server generates a new temporary password and emails it via SMTP
              (configured via <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, and <code>SMTP_PASS</code> environment variables on your Node host).
            </p>
          </div>
        </div>

        <div class="admin-backend-row" style="grid-template-columns: 1fr auto;">
          <input
            type="email"
            class="admin-input"
            id="cfgSmtpTestEmail"
            value="${escapeHTML(state.authState?.user?.email || cfg.contactEmail || 'syndkyaw@gmail.com')}"
            placeholder="Recipient email for SMTP test"
          />
          <button type="button" class="admin-btn admin-btn-secondary" id="btnTestSmtp">Send Test Email</button>
        </div>

        <div id="smtpStatusBox" class="admin-backend-status ${state.authState?.smtpConfigured ? 'is-success' : ''}">
          ${
            state.authState?.smtpConfigured
              ? 'SMTP environment variables detected on server. Click Send Test Email to verify inbox delivery.'
              : 'SMTP is not configured yet on the Node server. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable automatic Forgot Password emails.'
          }
        </div>
      </div>

      <form id="adminHomeForm">
        <div class="admin-panel-card">
          <div class="admin-panel-head">
            <div>
              <h2>Hero Section Copy &amp; Banner Image</h2>
              <p>Controls the top headline, CTA buttons, and main hero illustration on index.html.</p>
            </div>
            <button type="submit" class="admin-btn admin-btn-primary">Save All Homepage Settings</button>
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
              <p>Customize every section label, title, and description shown on the home page.</p>
            </div>
          </div>

          <div class="admin-grid-3">
            <div class="admin-subrow">
              <strong style="font-size:0.86rem;">Stories &amp; Reels Section</strong>
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
              <strong style="font-size:0.86rem;">Curriculum Lessons Section</strong>
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
              <h2>Adult &amp; Kids Learning Track Cards</h2>
              <p>Edit pathway titles, subtitles, descriptions, bullet lists (one per line), and CTA labels.</p>
            </div>
          </div>

          <div class="admin-grid-2">
            <div class="admin-subrow">
              <strong>Adults Pathway Card</strong>
              <div class="admin-grid-2">
                <div class="admin-field">
                  <label for="cfgAdultBadge">Badge</label>
                  <input type="text" class="admin-input" id="cfgAdultBadge" value="${escapeHTML(cfg.adultBadge || '')}" />
                </div>
                <div class="admin-field">
                  <label for="cfgAdultCta">Button Label</label>
                  <input type="text" class="admin-input" id="cfgAdultCta" value="${escapeHTML(cfg.adultCta || '')}" />
                </div>
              </div>
              <div class="admin-field">
                <label for="cfgAdultTitle">Title</label>
                <input type="text" class="admin-input" id="cfgAdultTitle" value="${escapeHTML(cfg.adultTitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgAdultSub">Chinese Subtitle</label>
                <input type="text" class="admin-input" id="cfgAdultSub" value="${escapeHTML(cfg.adultSubtitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgAdultDesc">Description</label>
                <textarea class="admin-textarea" id="cfgAdultDesc">${escapeHTML(cfg.adultDesc || '')}</textarea>
              </div>
              <div class="admin-field">
                <label for="cfgAdultBullets">Bullet Highlights (one per line)</label>
                <textarea class="admin-textarea" id="cfgAdultBullets">${escapeHTML(
                  (cfg.adultBullets || []).join('\n')
                )}</textarea>
              </div>
            </div>

            <div class="admin-subrow">
              <strong>Kids Pathway Card</strong>
              <div class="admin-grid-2">
                <div class="admin-field">
                  <label for="cfgKidsBadge">Badge</label>
                  <input type="text" class="admin-input" id="cfgKidsBadge" value="${escapeHTML(cfg.kidsBadge || '')}" />
                </div>
                <div class="admin-field">
                  <label for="cfgKidsCta">Button Label</label>
                  <input type="text" class="admin-input" id="cfgKidsCta" value="${escapeHTML(cfg.kidsCta || '')}" />
                </div>
              </div>
              <div class="admin-field">
                <label for="cfgKidsTitle">Title</label>
                <input type="text" class="admin-input" id="cfgKidsTitle" value="${escapeHTML(cfg.kidsTitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgKidsSub">Chinese Subtitle</label>
                <input type="text" class="admin-input" id="cfgKidsSub" value="${escapeHTML(cfg.kidsSubtitle || '')}" />
              </div>
              <div class="admin-field">
                <label for="cfgKidsDesc">Description</label>
                <textarea class="admin-textarea" id="cfgKidsDesc">${escapeHTML(cfg.kidsDesc || '')}</textarea>
              </div>
              <div class="admin-field">
                <label for="cfgKidsBullets">Bullet Highlights (one per line)</label>
                <textarea class="admin-textarea" id="cfgKidsBullets">${escapeHTML(
                  (cfg.kidsBullets || []).join('\n')
                )}</textarea>
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

    const urlInput = document.getElementById('cfgBackendApiUrl');
    const probeEl = document.getElementById('backendProbeStatus');
    const btnTest = document.getElementById('btnTestBackendUrl');
    const btnSave = document.getElementById('btnSaveBackendUrl');
    const btnReset = document.getElementById('btnResetBackendUrl');

    const setProbeUI = (msg, kind) => {
      if (!probeEl) return;
      probeEl.textContent = msg;
      probeEl.classList.remove('is-success', 'is-error');
      if (kind === 'success') probeEl.classList.add('is-success');
      if (kind === 'error') probeEl.classList.add('is-error');
    };

    if (btnTest && window.LinguaBackend) {
      btnTest.onclick = async () => {
        const candidate = (urlInput ? urlInput.value : '').trim();
        btnTest.disabled = true;
        btnTest.textContent = 'Testing…';
        setProbeUI('Checking /api/site-config over HTTPS/CORS…', '');
        const res = await window.LinguaBackend.testConnection(candidate);
        btnTest.disabled = false;
        btnTest.textContent = 'Test Connection';
        if (res.ok) {
          setProbeUI(`Connected! /api/site-config responded in ${res.latencyMs}ms.`, 'success');
          toast(`Backend reachable (${res.latencyMs}ms).`);
        } else {
          setProbeUI(res.error || 'Connection test failed.', 'error');
          toast(res.error || 'Connection test failed.', 'error');
        }
      };
    }

    if (btnSave && window.LinguaBackend) {
      btnSave.onclick = async () => {
        const candidate = (urlInput ? urlInput.value : '').trim();
        if (!candidate) {
          window.LinguaBackend.clearApiBase();
          updateBackendBadge();
          setProbeUI('Cleared custom backend override. Using local origin.', '');
          await loadAllContentData(true);
          return;
        }
        try {
          btnSave.disabled = true;
          const saved = window.LinguaBackend.setApiBase(candidate);
          if (urlInput) urlInput.value = saved;
          updateBackendBadge();
          setProbeUI(`Saved ${saved}. Verifying live data sync…`, 'success');
          const probe = await window.LinguaBackend.testConnection(saved);
          if (probe.ok) {
            setProbeUI(`Saved & connected to ${saved} (${probe.latencyMs}ms). Syncing workbooks…`, 'success');
            await loadAllContentData(true);
            toast('Hosted Node backend connected!');
          } else {
            setProbeUI(`Saved ${saved}, but server check failed: ${probe.error}`, 'error');
            toast(probe.error || 'Saved URL, but could not reach server.', 'error');
          }
        } catch (err) {
          setProbeUI(err instanceof Error ? err.message : 'Invalid backend URL.', 'error');
          toast(err instanceof Error ? err.message : 'Invalid backend URL.', 'error');
        } finally {
          btnSave.disabled = false;
        }
      };
    }

    if (btnReset && window.LinguaBackend) {
      btnReset.onclick = async () => {
        window.LinguaBackend.clearApiBase();
        if (urlInput) urlInput.value = window.LinguaBackend.getApiBase();
        updateBackendBadge();
        setProbeUI('Reset to default local origin behavior.', '');
        await loadAllContentData(true);
        toast('Backend URL override cleared.');
      };
    }

    const smtpTestBtn = document.getElementById('btnTestSmtp');
    const smtpStatusBox = document.getElementById('smtpStatusBox');
    if (smtpTestBtn && window.LinguaAuth && typeof window.LinguaAuth.getSmtpStatus === 'function') {
      window.LinguaAuth
        .getSmtpStatus()
        .then((info) => {
          if (!smtpStatusBox) return;
          if (info.configured) {
            smtpStatusBox.className = 'admin-backend-status is-success';
            smtpStatusBox.textContent = `SMTP configured (${info.host}:${info.port} · ${info.userMasked || 'user'}). Click Send Test Email to verify delivery.`;
          } else {
            smtpStatusBox.className = 'admin-backend-status';
            smtpStatusBox.textContent =
              'SMTP not configured on server yet (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Forgot Password emails require SMTP credentials.';
          }
        })
        .catch(() => {});

      smtpTestBtn.onclick = async () => {
        const to = (document.getElementById('cfgSmtpTestEmail')?.value || '').trim();
        smtpTestBtn.disabled = true;
        smtpTestBtn.textContent = 'Sending…';
        if (smtpStatusBox) {
          smtpStatusBox.className = 'admin-backend-status';
          smtpStatusBox.textContent = 'Sending SMTP verification email…';
        }
        try {
          const res = await window.LinguaAuth.sendTestSmtpEmail(to);
          if (smtpStatusBox) {
            smtpStatusBox.className = 'admin-backend-status is-success';
            smtpStatusBox.textContent = res.message || `Test email sent to ${to}.`;
          }
          toast(res.message || 'SMTP test email sent!');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'SMTP test failed.';
          if (smtpStatusBox) {
            smtpStatusBox.className = 'admin-backend-status is-error';
            smtpStatusBox.textContent = msg;
          }
          toast(msg, 'error');
        } finally {
          smtpTestBtn.disabled = false;
          smtpTestBtn.textContent = 'Send Test Email';
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

      const featuredStoryIds = Array.from(form.querySelectorAll('input[name="featStory"]:checked')).map((c) => c.value);
      const featuredReelIds = Array.from(form.querySelectorAll('input[name="featReel"]:checked')).map((c) => c.value);
      const featuredGameIds = Array.from(form.querySelectorAll('input[name="featGame"]:checked')).map((c) => c.value);

      const nextPayload = {
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
        gamesLabel: val('cfgGamesLabel'),
        gamesTitle: val('cfgGamesTitle'),
        gamesSubtitle: val('cfgGamesSub'),
        lessonsLabel: val('cfgLessonsLabel'),
        lessonsTitle: val('cfgLessonsTitle'),
        lessonsSubtitle: val('cfgLessonsSub'),
        adultBadge: val('cfgAdultBadge'),
        adultTitle: val('cfgAdultTitle'),
        adultSubtitle: val('cfgAdultSub'),
        adultDesc: val('cfgAdultDesc'),
        adultBullets: lines('cfgAdultBullets'),
        adultCta: val('cfgAdultCta'),
        kidsBadge: val('cfgKidsBadge'),
        kidsTitle: val('cfgKidsTitle'),
        kidsSubtitle: val('cfgKidsSub'),
        kidsDesc: val('cfgKidsDesc'),
        kidsBullets: lines('cfgKidsBullets'),
        kidsCta: val('cfgKidsCta'),
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
        toast('Homepage settings, Contact Us & Featured items saved.');
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
    state.pendingExercisesRows = [];
    state.pendingExercisesMeta = {
      target: target === 'stories' ? 'stories' : 'lessons',
      lessonId: presetLessonId,
      mode: 'merge_lesson',
      fileName: ''
    };

    const lessonsList =
      state.pendingExercisesMeta.target === 'stories' ? state.storiesData.Lessons : state.lessonsData.Lessons;

    openModal(`
      <div class="admin-panel-head" style="margin-bottom:14px;">
        <div>
          <h2>Upload Exercises via Spreadsheet</h2>
          <p>Upload an Excel (.xlsx / .xls) or CSV file with exercises, preview parsed rows, and apply to Lessons or Stories.</p>
        </div>
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="exCloseModalBtn">✕</button>
      </div>

      <div class="admin-grid-3" style="margin-bottom:14px;">
        <div class="admin-field">
          <label for="exTargetSelect">Destination Workbook</label>
          <select id="exTargetSelect" class="admin-select">
            <option value="lessons" ${state.pendingExercisesMeta.target === 'lessons' ? 'selected' : ''}>Curriculum Lessons (lessons.xlsx)</option>
            <option value="stories" ${state.pendingExercisesMeta.target === 'stories' ? 'selected' : ''}>Stories (stories.xlsx)</option>
          </select>
        </div>

        <div class="admin-field">
          <label for="exScopeLesson">Default / Filter Lesson ID (Optional)</label>
          <select id="exScopeLesson" class="admin-select">
            <option value="">All / Use spreadsheet lessonId column</option>
            ${lessonsList
              .map(
                (l) =>
                  `<option value="${escapeHTML(l.id)}" ${isSameId(l.id, presetLessonId) ? 'selected' : ''}>${escapeHTML(
                    l.id
                  )} — ${escapeHTML(l.title)}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="admin-field">
          <label for="exImportMode">Import Mode</label>
          <select id="exImportMode" class="admin-select">
            <option value="merge_lesson">Replace only matching lessonIds (Recommended)</option>
            <option value="replace_all">Replace entire Exercises sheet</option>
          </select>
        </div>
      </div>

      <div class="admin-panel-card" style="padding:14px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <strong style="font-size:0.86rem;">Step 1: Choose Spreadsheet (.xlsx, .xls, .csv)</strong>
            <div style="font-size:0.78rem; color:#64748b;">Columns: lessonId, order, type, question, optionA, optionB, optionC, optionD, answer, explanation</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="exDownloadTplBtn">Download Template (.xlsx)</button>
            <label class="admin-btn admin-btn-primary admin-btn-sm" style="margin:0; cursor:pointer;">
              <span>Choose Spreadsheet</span>
              <input type="file" id="exFileInput" accept=".xlsx,.xls,.csv" hidden />
            </label>
          </div>
        </div>
      </div>

      <div id="exPreviewContainer" style="margin-bottom:16px;">
        <p style="font-size:0.84rem; color:#64748b;">Select a spreadsheet file above to preview and validate exercises before importing.</p>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="admin-btn admin-btn-secondary" id="exCancelBtn">Cancel</button>
        <button type="button" class="admin-btn admin-btn-primary" id="exCommitBtn" disabled>Import Exercises</button>
      </div>
    `);

    document.getElementById('exCloseModalBtn').onclick = closeModal;
    document.getElementById('exCancelBtn').onclick = closeModal;

    const targetSelect = document.getElementById('exTargetSelect');
    const lessonSelect = document.getElementById('exScopeLesson');
    const modeSelect = document.getElementById('exImportMode');
    const fileInput = document.getElementById('exFileInput');
    const previewContainer = document.getElementById('exPreviewContainer');
    const commitBtn = document.getElementById('exCommitBtn');

    targetSelect.onchange = () => {
      openExerciseSpreadsheetModal(targetSelect.value, '');
    };

    document.getElementById('exDownloadTplBtn').onclick = () => {
      if (typeof window.XLSX === 'undefined') {
        toast('Excel library is still loading.', 'error');
        return;
      }
      const sampleId = lessonSelect.value || (targetSelect.value === 'stories' ? 'lesson-01' : 'adult-basics-01');
      const existingRows = (
        targetSelect.value === 'stories' ? state.storiesData.Exercises : state.lessonsData.Exercises
      ).filter((r) => !lessonSelect.value || isSameId(r.lessonId, lessonSelect.value));

      const templateRows = existingRows.length
        ? existingRows
        : [
            {
              lessonId: sampleId,
              order: 1,
              type: 'multiple-choice',
              question: 'How do you say "Good morning" in Mandarin?',
              optionA: '早上好 (Zǎoshang hǎo)',
              optionB: '晚安 (Wǎn’ān)',
              optionC: '再见 (Zàijiàn)',
              optionD: '谢谢 (Xièxie)',
              answer: '早上好 (Zǎoshang hǎo)',
              explanation: '早上好 (zǎoshang hǎo) means good morning.'
            }
          ];
      const ws = window.XLSX.utils.json_to_sheet(templateRows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Exercises');
      window.XLSX.writeFile(wb, `linguapath-${targetSelect.value}-exercises-template.xlsx`);
      toast('Downloaded exercises template (.xlsx).');
    };

    const reparseRows = (rawRows) => {
      const defaultLid = lessonSelect.value.trim();
      const normalized = rawRows.map((r, i) => {
        const lid = String(r.lessonId || r.LessonId || r['Lesson ID'] || defaultLid || '').trim();
        const question = String(r.question || r.Question || '').trim();
        const optionA = String(r.optionA ?? r.OptionA ?? '').trim();
        const optionB = String(r.optionB ?? r.OptionB ?? '').trim();
        const optionC = String(r.optionC ?? r.OptionC ?? '').trim();
        const optionD = String(r.optionD ?? r.OptionD ?? '').trim();
        const answer = String(r.answer || r.Answer || r.correct || optionA || '').trim();
        const valid = Boolean(lid && question && (optionA || optionB || answer));
        return {
          lessonId: lid,
          order: Number(r.order || r.Order) || i + 1,
          type: String(r.type || r.Type || 'multiple-choice').trim(),
          question,
          optionA,
          optionB,
          optionC,
          optionD,
          answer,
          explanation: String(r.explanation || r.Explanation || '').trim(),
          _valid: valid
        };
      });

      const validRows = normalized.filter((r) => r._valid);
      state.pendingExercisesRows = validRows.map(({ _valid, ...rest }) => rest);
      commitBtn.disabled = validRows.length === 0;

      previewContainer.innerHTML = `
        <div style="font-size:0.84rem; margin-bottom:8px;">
          <strong>Parsed ${normalized.length} row(s):</strong>
          <span class="admin-status-active">${validRows.length} valid</span>
          ${normalized.length - validRows.length > 0 ? ` · <span class="admin-status-expired">${normalized.length - validRows.length} missing required lessonId/question</span>` : ''}
        </div>
        <div class="admin-table-wrap" style="max-height:260px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Lesson ID</th>
                <th>#</th>
                <th>Question</th>
                <th>Answer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${normalized
                .slice(0, 40)
                .map(
                  (r) => `
                <tr>
                  <td>${escapeHTML(r.lessonId || '—')}</td>
                  <td>${escapeHTML(r.order)}</td>
                  <td>${escapeHTML(r.question || 'Missing question')}</td>
                  <td>${escapeHTML(r.answer || '—')}</td>
                  <td><span class="${r._valid ? 'admin-status-active' : 'admin-status-expired'}">${
                    r._valid ? 'Valid' : 'Invalid'
                  }</span></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    };

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
        state.pendingExercisesMeta.rawRows = rows;
        reparseRows(rows);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to parse spreadsheet.', 'error');
      }
    };

    lessonSelect.onchange = () => {
      if (Array.isArray(state.pendingExercisesMeta.rawRows)) {
        reparseRows(state.pendingExercisesMeta.rawRows);
      }
    };

    commitBtn.onclick = async () => {
      if (!state.pendingExercisesRows.length) return;
      commitBtn.disabled = true;
      commitBtn.textContent = 'Importing…';
      try {
        const res = await adminFetch('/api/admin/upload-exercises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: targetSelect.value,
            mode: modeSelect.value,
            lessonId: lessonSelect.value.trim(),
            rows: state.pendingExercisesRows
          })
        });
        if (targetSelect.value === 'stories') {
          state.storiesData.Exercises = res.exercises || [];
        } else {
          state.lessonsData.Exercises = res.exercises || [];
        }
        closeModal();
        renderActiveTab();
        toast(`Imported ${res.importedCount} exercise(s) into ${targetSelect.value}.`);
      } catch (err) {
        commitBtn.disabled = false;
        commitBtn.textContent = 'Import Exercises';
        toast(err instanceof Error ? err.message : 'Failed to import exercises.', 'error');
      }
    };
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
            <p>Create or edit Mandarin stories, story scenes, key vocabulary, homepage featured status, and exercises.</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="admin-btn admin-btn-secondary" id="btnUploadStoryExercises">Upload Exercises (.xlsx)</button>
            <button type="button" class="admin-btn admin-btn-primary" id="btnAddStory">+ New Story</button>
          </div>
        </div>

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
    viewport.querySelectorAll('[data-ex-story]').forEach((btn) => {
      btn.onclick = () => openExerciseSpreadsheetModal('stories', btn.getAttribute('data-ex-story'));
    });
    viewport.querySelectorAll('[data-del-story]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-del-story');
        openConfirmDialog({
          title: `Delete story "${id}"?`,
          message: 'This removes the story, its reading scenes, and vocabulary from data/stories.xlsx.',
          confirmLabel: 'Delete Story',
          onConfirm: async () => {
            const nextLessons = stories.filter((x) => !isSameId(x.id, id));
            const nextScenes = state.storiesData.Story.filter((x) => !isSameId(x.lessonId, id));
            const nextVocab = state.storiesData.Vocabulary.filter((x) => !isSameId(x.lessonId, id));
            try {
              const res = await adminFetch('/api/admin/content/stories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lessons: nextLessons, story: nextScenes, vocabulary: nextVocab })
              });
              state.storiesData = { ...state.storiesData, ...res.sheets };
              updateNavCounts();
              renderActiveTab();
              toast(`Deleted story ${id}.`);
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
        const res = await adminFetch('/api/admin/content/stories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessons: existingLessons,
            story: [...keptScenes, ...cleanScenes],
            vocabulary: [...keptVocab, ...cleanVocab]
          })
        });
        state.storiesData = { ...state.storiesData, ...res.sheets };
        await toggleFeaturedId('featuredStoryIds', id, document.getElementById('stFeatured').checked);
        closeModal();
        updateNavCounts();
        renderActiveTab();
        toast(`Saved story "${record.title}".`);
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
            <p>Upload or link vertical Mandarin reels, subtitles (CN / Pinyin / EN / Myanmar), and pick featured homepage reels.</p>
          </div>
          <button type="button" class="admin-btn admin-btn-primary" id="btnAddReel">+ New Short Reel</button>
        </div>

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
                            <div style="display:flex; gap:6px;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-reel="${escapeHTML(
                                v.id
                              )}">Edit</button>
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
    viewport.querySelectorAll('[data-del-reel]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-del-reel');
        openConfirmDialog({
          title: `Delete reel "${id}"?`,
          message: 'This will remove the video reel from data/reels_stories.xlsx.',
          confirmLabel: 'Delete Reel',
          onConfirm: async () => {
            const nextVideos = videos.filter((x) => !isSameId(x.id, id));
            try {
              const res = await adminFetch('/api/admin/content/reels', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videos: nextVideos })
              });
              state.reelsData = { ...state.reelsData, ...res.sheets };
              updateNavCounts();
              renderActiveTab();
              toast(`Deleted reel ${id}.`);
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
        const res = await adminFetch('/api/admin/content/reels', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videos: nextVideos })
        });
        state.reelsData = { ...state.reelsData, ...res.sheets };
        await toggleFeaturedId('featuredReelIds', id, document.getElementById('rlFeatured').checked);
        closeModal();
        updateNavCounts();
        renderActiveTab();
        toast(`Saved reel "${rec.title}".`);
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
    const aud = state.filters.lessonAudience;
    const q = state.filters.lessonSearch.toLowerCase();

    const filtered = lessons.filter((l) => {
      const a = String(l.audience || 'Adult').toLowerCase();
      const matchAud = aud === 'all' || a === aud;
      const matchQ =
        !q ||
        String(l.title || '').toLowerCase().includes(q) ||
        String(l.id || '').toLowerCase().includes(q) ||
        String(l.category || '').toLowerCase().includes(q);
      return matchAud && matchQ;
    });

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Adult &amp; Kids Curriculum Lessons (${lessons.length})</h2>
            <p>Manage lessons, Free/Paid access pricing (synced to Firestore), media uploads, Vocabulary/Writing, and Excel Exercises.</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="admin-btn admin-btn-secondary" id="btnUploadLessonExercises">Upload Exercises (.xlsx)</button>
            <button type="button" class="admin-btn admin-btn-primary" id="btnAddLesson">+ New Lesson</button>
          </div>
        </div>

        <div class="admin-grid-2" style="margin-bottom:14px; max-width:560px;">
          <input type="search" class="admin-input" id="lessonSearchInput" value="${escapeHTML(
            state.filters.lessonSearch
          )}" placeholder="Search title, category, or ID…" />
          <select class="admin-select" id="lessonAudienceFilter">
            <option value="all" ${aud === 'all' ? 'selected' : ''}>All Audiences</option>
            <option value="adult" ${aud === 'adult' ? 'selected' : ''}>Adult Track</option>
            <option value="kids" ${aud === 'kids' ? 'selected' : ''}>Kids Track</option>
          </select>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Track</th>
                <th>Lesson Title</th>
                <th>Access / Price</th>
                <th class="num">Exercises</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length
                  ? filtered
                      .map((l) => {
                        const pricing = window.LinguaAuth
                          ? window.LinguaAuth.getLessonPricing(l)
                          : { accessType: 'free', price: 0 };
                        const exCount = exercises.filter((x) => isSameId(x.lessonId, l.id)).length;
                        return `
                        <tr>
                          <td><code>${escapeHTML(l.id)}</code></td>
                          <td>${escapeHTML(l.audience || 'Adult')} · ${escapeHTML(l.category || '')}</td>
                          <td>
                            <strong>${escapeHTML(l.title || '')}</strong>
                            <div style="font-size:0.78rem; color:#64748b;">${escapeHTML(l.chineseTitle || '')} · ${escapeHTML(
                          l.level || ''
                        )}</div>
                          </td>
                          <td>
                            <span class="${pricing.accessType === 'paid' ? 'admin-status-pending' : 'admin-status-active'}">
                              ${pricing.accessType === 'paid' ? `Paid ($${pricing.price})` : 'Free'}
                            </span>
                          </td>
                          <td class="num">${exCount}</td>
                          <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-lesson="${escapeHTML(
                                l.id
                              )}">Edit</button>
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-ex-lesson="${escapeHTML(
                                l.id
                              )}">Exercises</button>
                              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-del-lesson="${escapeHTML(
                                l.id
                              )}">Delete</button>
                            </div>
                          </td>
                        </tr>
                      `;
                      })
                      .join('')
                  : `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:24px;">No matching lessons found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('lessonSearchInput').oninput = (e) => {
      state.filters.lessonSearch = e.target.value;
      renderLessonsTab(viewport);
    };
    document.getElementById('lessonAudienceFilter').onchange = (e) => {
      state.filters.lessonAudience = e.target.value;
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
    viewport.querySelectorAll('[data-ex-lesson]').forEach((btn) => {
      btn.onclick = () => openExerciseSpreadsheetModal('lessons', btn.getAttribute('data-ex-lesson'));
    });
    viewport.querySelectorAll('[data-del-lesson]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-del-lesson');
        openConfirmDialog({
          title: `Delete lesson "${id}"?`,
          message: 'This deletes the lesson, its vocabulary, and its writing entries from data/lessons.xlsx.',
          confirmLabel: 'Delete Lesson',
          onConfirm: async () => {
            const nextLessons = lessons.filter((x) => !isSameId(x.id, id));
            const nextVocab = state.lessonsData.Vocabulary.filter((x) => !isSameId(x.lessonId, id));
            const nextWriting = state.lessonsData.Writing.filter((x) => !isSameId(x.lessonId, id));
            try {
              const res = await adminFetch('/api/admin/content/lessons', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lessons: nextLessons, vocabulary: nextVocab, writing: nextWriting })
              });
              state.lessonsData = { ...state.lessonsData, ...res.sheets };
              updateNavCounts();
              renderActiveTab();
              toast(`Deleted lesson ${id}.`);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Failed to delete lesson.', 'error');
            }
          }
        });
      };
    });
  }

  function openLessonEditorModal(lesson) {
    const isNew = !lesson;
    const base = lesson || {
      id: `lesson-new-${Date.now().toString().slice(-4)}`,
      audience: 'Adult',
      category: 'Beginner & Everyday Basics',
      categoryKey: 'basics',
      categoryNum: 'Category 1',
      title: '',
      chineseTitle: '',
      pinyin: '',
      meaning: '',
      level: 'Beginner',
      description: '',
      videoUrl: 'assets/video/lesson-01.mp4',
      posterUrl: 'assets/images/story-01.jpg',
      fullAudio: '',
      keywords: ''
    };
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
            <label for="lsAudience">Audience *</label>
            <select class="admin-select" id="lsAudience">
              <option value="Adult" ${String(base.audience).toLowerCase() !== 'kids' ? 'selected' : ''}>Adult</option>
              <option value="Kids" ${String(base.audience).toLowerCase() === 'kids' ? 'selected' : ''}>Kids</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="lsLevel">Level</label>
            <input type="text" class="admin-input" id="lsLevel" value="${escapeHTML(base.level || 'Beginner')}" />
          </div>
          <div class="admin-field">
            <label for="lsCat">Category Name</label>
            <input type="text" class="admin-input" id="lsCat" value="${escapeHTML(base.category || '')}" />
          </div>
          <div class="admin-field">
            <label for="lsCatKey">Category Key</label>
            <input type="text" class="admin-input" id="lsCatKey" value="${escapeHTML(base.categoryKey || 'basics')}" />
          </div>
          <div class="admin-field">
            <label for="lsCatNum">Category Order Label</label>
            <input type="text" class="admin-input" id="lsCatNum" value="${escapeHTML(base.categoryNum || 'Category 1')}" />
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
            <label for="lsPrice">Single-Lesson Price ($ USD)</label>
            <input type="number" class="admin-input" id="lsPrice" min="0" max="9999" value="${escapeHTML(
              pricing.price || 9
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
      const audience = document.getElementById('lsAudience').value;
      const accessType = document.getElementById('lsAccess').value === 'paid' ? 'paid' : 'free';
      const price = accessType === 'free' ? 0 : Math.max(0, Number(document.getElementById('lsPrice').value) || 9);

      const rec = {
        id,
        audience,
        category: document.getElementById('lsCat').value.trim() || 'General',
        categoryKey: document.getElementById('lsCatKey').value.trim() || 'basics',
        categoryNum: document.getElementById('lsCatNum').value.trim() || 'Category 1',
        title: document.getElementById('lsTitle').value.trim(),
        chineseTitle: document.getElementById('lsCn').value.trim(),
        pinyin: document.getElementById('lsPinyin').value.trim(),
        meaning: document.getElementById('lsMeaning').value.trim(),
        level: document.getElementById('lsLevel').value.trim() || 'Beginner',
        description: document.getElementById('lsDesc').value.trim(),
        videoUrl: document.getElementById('lsVideo').value.trim(),
        posterUrl: document.getElementById('lsPoster').value.trim(),
        fullAudio: document.getElementById('lsAudio').value.trim(),
        keywords: document.getElementById('lsKeywords').value.trim()
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
        const res = await adminFetch('/api/admin/content/lessons', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessons: nextLessons,
            vocabulary: [...keptVocab, ...cleanVocab],
            writing: [...keptWriting, ...cleanWriting]
          })
        });
        state.lessonsData = { ...state.lessonsData, ...res.sheets };
        if (window.LinguaAuth && typeof window.LinguaAuth.saveLessonCatalogItems === 'function') {
          await window.LinguaAuth.saveLessonCatalogItems([
            { lessonId: id, title: rec.title, audience, accessType, price }
          ]);
        }
        closeModal();
        updateNavCounts();
        renderActiveTab();
        toast(`Saved lesson "${rec.title}" (${accessType === 'paid' ? `$${price}` : 'Free'}).`);
      } catch (err) {
        setSyncStatus('Save failed');
        toast(err instanceof Error ? err.message : 'Failed to save lesson.', 'error');
      }
    };
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
                            <div style="display:flex; gap:6px;">
                              <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-game="${escapeHTML(
                                g.id
                              )}">Edit</button>
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

    const persistGames = async (nextList, message) => {
      const normalized = nextList.map((g, i) => ({ ...g, order: i + 1 }));
      try {
        setSyncStatus('Saving games…');
        const res = await adminFetch('/api/admin/content/games', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ games: normalized })
        });
        state.lessonsData = { ...state.lessonsData, ...res.sheets };
        setSyncStatus('Saved');
        updateNavCounts();
        renderActiveTab();
        if (message) toast(message);
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

    viewport.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-panel-head">
          <div>
            <h2>Pending QR Payment Subscription Requests (${pendingReqs.length})</h2>
            <p>Approve verified Viber/Email QR payments to immediately unlock Monthly, Annual, or By-Lesson access.</p>
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
                              <option value="monthly" ${u.membershipPlan === 'monthly' ? 'selected' : ''}>monthly</option>
                              <option value="annual" ${u.membershipPlan === 'annual' ? 'selected' : ''}>annual</option>
                              <option value="per_lesson" ${u.membershipPlan === 'per_lesson' ? 'selected' : ''}>per_lesson</option>
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
                            )}">Lessons (${unlockedCount})</button>
                          </td>
                          <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
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
        const allLessons = state.lessonsData.Lessons || [];

        openModal(`
          <div class="admin-panel-head" style="margin-bottom:12px;">
            <div>
              <h2>Unlocked Lessons · ${escapeHTML(user.username || user.email)}</h2>
              <p>Select individual lessons unlocked on this learner profile.</p>
            </div>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="ulCloseBtn">✕</button>
          </div>
          <div class="admin-featured-checklist" style="max-height:360px; overflow-y:auto;">
            ${allLessons
              .map(
                (l) => `
              <label class="admin-featured-item">
                <input type="checkbox" name="ulLesson" value="${escapeHTML(l.id)}" ${unlocked.has(l.id) ? 'checked' : ''} />
                <span>${escapeHTML(l.title || l.id)} (${escapeHTML(l.audience || 'Adult')})</span>
              </label>
            `
              )
              .join('')}
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
            <button type="button" class="admin-btn admin-btn-secondary" id="ulCancelBtn">Cancel</button>
            <button type="button" class="admin-btn admin-btn-primary" id="ulSaveBtn">Save Unlocked Lessons</button>
          </div>
        `);

        document.getElementById('ulCloseBtn').onclick = closeModal;
        document.getElementById('ulCancelBtn').onclick = closeModal;
        document.getElementById('ulSaveBtn').onclick = async () => {
          const checkedIds = Array.from(document.querySelectorAll('input[name="ulLesson"]:checked')).map((c) => c.value);
          try {
            await window.LinguaAuth.updateUserMembershipAdmin(uid, {
              membershipStatus: user.membershipStatus || (checkedIds.length ? 'active' : 'free'),
              membershipPlan: user.membershipPlan || (checkedIds.length ? 'per_lesson' : 'none'),
              membershipExpiresAt: user.membershipExpiresAt || '',
              subscribedLessonIds: checkedIds
            });
            closeModal();
            toast(`Saved ${checkedIds.length} unlocked lesson(s).`);
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Failed to save unlocked lessons.', 'error');
          }
        };
      };
    });

    viewport.querySelectorAll('[data-u-resetpw]').forEach((btn) => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-u-resetpw');
        const user = users.find((x) => x.uid === uid);
        if (!user) return;
        const smtpOn = Boolean(state.authState?.smtpConfigured);

        openModal(`
          <div class="admin-panel-head" style="margin-bottom:12px;">
            <div>
              <h2>Reset Password · ${escapeHTML(user.username || user.email)}</h2>
              <p>Set a temporary password for ${escapeHTML(user.email)} (leave blank to auto-generate a strong 12-character temporary password).</p>
            </div>
            <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" id="rpCloseBtn">✕</button>
          </div>

          <form id="adminResetPwForm">
            <div class="admin-field">
              <label for="rpCustomPw">Custom Temporary Password (Optional, min. 6 chars)</label>
              <input type="text" class="admin-input" id="rpCustomPw" minlength="6" placeholder="Leave blank to auto-generate random password" />
            </div>
            <label class="admin-check-row" style="margin:12px 0;">
              <input type="checkbox" id="rpSendEmail" ${smtpOn ? 'checked' : ''} ${smtpOn ? '' : 'disabled'} />
              <span>Email temporary password to ${escapeHTML(user.email)} ${smtpOn ? '(SMTP Ready)' : '(SMTP Not Configured)'}</span>
            </label>
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
          const sendEmail = Boolean(document.getElementById('rpSendEmail')?.checked);
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
              newPassword: customPw || undefined,
              sendEmail
            });
            if (resBox) {
              resBox.hidden = false;
              resBox.className = 'admin-backend-status is-success';
              resBox.innerHTML = `
                <div>Password updated! ${
                  out.emailed
                    ? `Temporary password emailed to <strong>${escapeHTML(user.email)}</strong>.`
                    : out.emailError
                    ? `Email note: ${escapeHTML(out.emailError)}. Share the password below directly:`
                    : 'Share this temporary password with the learner:'
                }</div>
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
          : 'Sign in with syndkyaw@gmail.com (email & password) to manage homepage content, stories, reels, lessons, exercises, Wordwall games, and learner memberships.';
      }
      if (gateActions) {
        gateActions.innerHTML = unclaimed
          ? `
            <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
              <button type="button" class="admin-btn admin-btn-primary" id="adminGateRegisterBtn">Create Admin Account (syndkyaw@gmail.com)</button>
              <button type="button" class="admin-btn admin-btn-secondary" id="adminGateSignInBtn">Sign In</button>
              <a href="index.html" class="admin-btn admin-btn-secondary">Back to Home</a>
            </div>
          `
          : `
            <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
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
          <a href="index.html" class="admin-btn admin-btn-primary">Back to Home</a>
          <button type="button" class="admin-btn admin-btn-secondary" id="adminGateSignOutBtn">Sign Out</button>
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
        state.activeTab = 'home';
        window.history.replaceState(null, '', '#home');
        renderActiveTab();
        const urlInput = document.getElementById('cfgBackendApiUrl');
        if (urlInput) {
          urlInput.focus();
          urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    }

    updateBackendBadge();
    window.addEventListener('linguapath-backend-change', () => updateBackendBadge());

    const modalBackdrop = document.getElementById('adminModalBackdrop');
    if (modalBackdrop) {
      modalBackdrop.onclick = (e) => {
        if (e.target === modalBackdrop) closeModal();
      };
    }

    if (window.LinguaAuth && typeof window.LinguaAuth.subscribe === 'function') {
      window.LinguaAuth.subscribe((s) => updateAuthGateUI(s));
    }

    window.addEventListener('lingua-site-config-change', (e) => {
      if (e.detail) state.siteConfig = e.detail;
    });
  });
})();
