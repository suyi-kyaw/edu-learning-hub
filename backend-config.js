/**
 * =========================================================
 * JIEDEEDU - STATIC RUNTIME CONFIG, MEDIA RESOLVER & EXCEL CONTENT STORE
 * 100% static GitHub Pages runtime backed by repository Excel workbooks
 * (data/lessons.xlsx, data/stories.xlsx, data/reels_stories.xlsx, data/users.xlsx)
 * merged with browser-saved Admin CMS drafts.
 * =========================================================
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'linguapath_backend_url';
  var DEFAULT_PRODUCTION_BACKEND_URL = '';

  function normalizeBaseUrl(raw) {
    var trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '');
  }

  function isValidHttpUrl(url) {
    return /^https?:\/\/[^/\s]+/i.test(String(url || '').trim());
  }

  function isMixedContentUrl(url) {
    var clean = normalizeBaseUrl(url);
    if (!clean) return false;
    var isHttpsPage = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
    if (!isHttpsPage) return false;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(clean)) return false;
    return /^http:\/\//i.test(clean);
  }

  function isStaticGithubHost() {
    if (typeof window === 'undefined' || !window.location) return false;
    var host = String(window.location.hostname || '').toLowerCase();
    var proto = String(window.location.protocol || '').toLowerCase();
    return host.endsWith('.github.io') || host === 'github.io' || proto === 'file:';
  }

  var SITE_WORKER_BASE = '';

  function setSiteWorkerBase(rawUrl) {
    var clean = normalizeBaseUrl(rawUrl);
    if (clean && isValidHttpUrl(clean) && !isMixedContentUrl(clean)) {
      SITE_WORKER_BASE = clean;
    } else if (!clean) {
      SITE_WORKER_BASE = '';
    }
    return SITE_WORKER_BASE;
  }

  function getStoredOverride() {
    try {
      if (!global.localStorage) return '';
      var raw = String(global.localStorage.getItem(STORAGE_KEY) || '').trim();
      var clean = normalizeBaseUrl(raw);
      if (clean && isValidHttpUrl(clean) && !isMixedContentUrl(clean)) {
        return clean;
      }
    } catch (_) {}
    return '';
  }

  function getApiBase() {
    return getStoredOverride() || SITE_WORKER_BASE || normalizeBaseUrl(DEFAULT_PRODUCTION_BACKEND_URL) || '';
  }

  function hasBackend() {
    if (!isStaticGithubHost()) return true;
    return Boolean(getApiBase());
  }

  function setApiBase(rawUrl) {
    var clean = normalizeBaseUrl(rawUrl);
    if (!clean) {
      clearApiBase();
      return false;
    }
    if (!isValidHttpUrl(clean)) {
      throw new Error('Enter a valid Worker URL starting with https:// (or http://localhost:...).');
    }
    if (isMixedContentUrl(clean)) {
      throw new Error('HTTPS GitHub Pages requires an https:// Cloudflare Worker URL.');
    }
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, clean);
      }
    } catch (_) {}
    return true;
  }

  function clearApiBase() {
    SITE_WORKER_BASE = '';
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
    return '';
  }

  function apiUrl(path) {
    var raw = String(path || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    var rel = raw.charAt(0) === '/' ? raw : '/' + raw;
    var base = getApiBase();
    return base ? base + rel : rel;
  }

  function assetUrl(path) {
    var trimmed = String(path || '').trim();
    if (!trimmed) return trimmed;
    if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    var cleaned = trimmed.replace(/\\/g, '/').replace(/^\.\//, '');
    if (/^\/?api\/media\//i.test(cleaned)) {
      return apiUrl('/' + cleaned.replace(/^\/+/, ''));
    }
    if (cleaned.charAt(0) === '/' && /^\/(assets|public)\//i.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }
    return cleaned;
  }

  async function testConnection(candidateUrl) {
    var base = candidateUrl ? normalizeBaseUrl(candidateUrl) : getApiBase();
    if (!base && isStaticGithubHost()) {
      return {
        ok: false,
        error: 'Enter your Cloudflare Worker https:// URL to upload videos directly from GitHub Pages.'
      };
    }
    if (candidateUrl && !isValidHttpUrl(base)) {
      return { ok: false, error: 'Enter a valid https:// Cloudflare Worker URL.' };
    }
    if (candidateUrl && isMixedContentUrl(base)) {
      return { ok: false, error: 'HTTPS pages require an https:// Worker URL.' };
    }
    var endpoint = (base ? base : '') + '/api/database/status?t=' + Date.now();
    try {
      var res = await fetch(endpoint, { cache: 'no-store' });
      var data = await res.json().catch(function () {
        return null;
      });
      if (!res.ok || !data || !data.success) {
        return {
          ok: false,
          error: (data && data.error) || 'Worker health check returned HTTP ' + res.status
        };
      }
      return {
        ok: true,
        url: base || '',
        database: data.database || 'edu-hub-db',
        maxUploadBytes: Number(data.maxUploadBytes) || 50 * 1024 * 1024,
        storage: data.storage || { d1: true, r2: false }
      };
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : 'Could not reach the Cloudflare Worker URL.'
      };
    }
  }

  global.LinguaBackend = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_PRODUCTION_BACKEND_URL: DEFAULT_PRODUCTION_BACKEND_URL,
    isStaticGithubHost: isStaticGithubHost,
    isValidHttpUrl: isValidHttpUrl,
    isMixedContentUrl: isMixedContentUrl,
    setSiteWorkerBase: setSiteWorkerBase,
    getApiBase: getApiBase,
    getStoredOverride: getStoredOverride,
    hasBackend: hasBackend,
    setApiBase: setApiBase,
    clearApiBase: clearApiBase,
    apiUrl: apiUrl,
    assetUrl: assetUrl,
    testConnection: testConnection
  };

  // =========================================================
  // STATIC EXCEL CONTENT STORE (Lessons, Stories, Reels, Games)
  // Priority: Local Admin Draft (localStorage) -> Direct .xlsx -> .json fallback
  // =========================================================

  var DRAFT_KEYS = {
    lessons: 'linguapath_cms_lessons_v2',
    stories: 'linguapath_cms_stories_v2',
    reels: 'linguapath_cms_reels_v2'
  };

  var LEGACY_DRAFT_KEYS = [
    'linguapath_cms_lessons_v1',
    'linguapath_cms_stories_v1',
    'linguapath_cms_reels_v1'
  ];

  (function purgeLegacyDraftCaches() {
    try {
      if (!global.localStorage) return;
      LEGACY_DRAFT_KEYS.forEach(function (oldKey) {
        global.localStorage.removeItem(oldKey);
      });
    } catch (_) {}
  })();

  var WORKBOOK_META = {
    lessons: {
      xlsxPath: 'data/lessons.xlsx',
      jsonPath: 'data/lessons.json',
      fileName: 'lessons.xlsx',
      sheets: ['Lessons', 'Vocabulary', 'Writing', 'Exercises', 'Games', 'Pronunciation']
    },
    stories: {
      xlsxPath: 'data/stories.xlsx',
      jsonPath: 'data/stories.json',
      fileName: 'stories.xlsx',
      sheets: ['Lessons', 'Story', 'Vocabulary', 'Exercises']
    },
    reels: {
      xlsxPath: 'data/reels_stories.xlsx',
      jsonPath: 'data/reels_stories.json',
      fileName: 'reels_stories.xlsx',
      sheets: ['Videos']
    }
  };

  var DEFAULT_COLUMNS = {
    lessons: {
      Lessons: [
        'id', 'course', 'category', 'categoryKey', 'categoryNum', 'title',
        'chineseTitle', 'pinyin', 'meaning', 'level', 'description',
        'videoUrl', 'posterUrl', 'fullAudio', 'keywords', 'accessType', 'price'
      ],
      Vocabulary: ['lessonId', 'order', 'character', 'pinyin', 'meaning', 'audio'],
      Writing: [
        'lessonId', 'order', 'character', 'pinyin', 'meaning', 'strokeCount',
        'radical', 'strokeAnimationUrl', 'svgPath', 'strokeOrderSteps'
      ],
      Exercises: [
        'lessonId', 'order', 'type', 'groupId', 'groupTitle', 'pinyin', 'question', 'audioUrl',
        'optionA', 'optionB', 'optionC', 'optionD', 'optionE',
        'optionAImage', 'optionBImage', 'optionCImage', 'optionDImage', 'optionEImage',
        'answer', 'explanation'
      ],
      Games: ['id', 'order', 'title', 'category', 'badge', 'description', 'embed_code', 'embed_url', 'width', 'height', 'active'],
      Pronunciation: ['lessonId', 'order', 'chinese', 'pinyin', 'meaning', 'focus']
    },
    stories: {
      Lessons: ['id', 'title', 'chineseTitle', 'pinyin', 'meaning', 'level', 'description', 'video', 'poster'],
      Story: ['lessonId', 'order', 'chinese', 'pinyin', 'english', 'image', 'audio'],
      Vocabulary: ['lessonId', 'order', 'character', 'pinyin', 'meaning', 'audio'],
      Exercises: [
        'lessonId', 'order', 'type', 'groupId', 'groupTitle', 'pinyin', 'question', 'audioUrl',
        'optionA', 'optionB', 'optionC', 'optionD', 'optionE',
        'optionAImage', 'optionBImage', 'optionCImage', 'optionDImage', 'optionEImage',
        'answer', 'explanation'
      ]
    },
    reels: {
      Videos: [
        'id', 'type', 'holiday_id', 'title', 'video_path', 'thumbnail_path',
        'duration_sec', 'status', 'text_cn', 'text_pinyin', 'text_en', 'text_my'
      ]
    }
  };

  var MAX_INLINE_MEDIA_BYTES = Math.round(1.5 * 1024 * 1024);

  function cloneArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (item) {
      return item && typeof item === 'object' ? Object.assign({}, item) : item;
    });
  }

  function createEmptySheets(domain) {
    var meta = WORKBOOK_META[domain];
    var out = {};
    meta.sheets.forEach(function (name) {
      out[name] = [];
    });
    return out;
  }

  function isDeprecatedMediaPath(val) {
    if (typeof val !== 'string') return false;
    var clean = val.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!clean) return false;
    return /^\/?public\/assets\/aistudio\//i.test(clean) || /^\/?assets\/video\/media-[a-z0-9]+/i.test(clean);
  }

  function canonicalizeMediaPath(val, rowId) {
    if (typeof val !== 'string') return val;
    var clean = val.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!clean) return '';
    if (/^\/?public\/assets\/aistudio\//i.test(clean)) {
      if (/logo/i.test(clean)) return 'assets/images/logo.svg';
      if (/story[-_]?0?1/i.test(clean)) return 'assets/video/story-01.mp4';
      if (/story[-_]?0?2/i.test(clean)) return 'assets/video/story-02.mp4';
    }
    if (/^\/?assets\/video\/media-[a-z0-9]+/i.test(clean)) {
      var idLower = String(rowId || '').toLowerCase();
      if (idLower === 'lesson-01' || idLower === 'story_01' || idLower === 'story-01') {
        return 'assets/video/story-01.mp4';
      }
      if (idLower === 'lesson-02' || idLower === 'story_02' || idLower === 'story-02') {
        return 'assets/video/story-02.mp4';
      }
    }
    return clean;
  }

  function rowHasDeprecatedMedia(row) {
    if (!row || typeof row !== 'object') return false;
    var mediaFields = ['video', 'videoUrl', 'video_url', 'video_path', 'poster', 'posterUrl', 'poster_url', 'thumbnail_path', 'image'];
    for (var i = 0; i < mediaFields.length; i++) {
      if (isDeprecatedMediaPath(row[mediaFields[i]])) return true;
    }
    return false;
  }

  function sheetsHaveDeprecatedMedia(sheets) {
    if (!sheets || typeof sheets !== 'object') return false;
    var keys = Object.keys(sheets);
    for (var i = 0; i < keys.length; i++) {
      var rows = sheets[keys[i]];
      if (!Array.isArray(rows)) continue;
      for (var j = 0; j < rows.length; j++) {
        if (rowHasDeprecatedMedia(rows[j])) return true;
      }
    }
    return false;
  }

  function normalizeRecordRow(row) {
    if (!row || typeof row !== 'object') return row;
    var out = Object.assign({}, row);
    var lid = String(row.lessonId || row.lesson_id || row.LessonId || row['Lesson ID'] || row.id || '').trim();
    if (lid) {
      out.lessonId = lid;
      out.lesson_id = lid;
    }
    var ct = String(row.chineseTitle || row.chinese_title || row.chinese || row.Chinese || '').trim();
    if (ct) {
      out.chineseTitle = ct;
      out.chinese_title = ct;
    }
    var vUrl = canonicalizeMediaPath(
      String(row.videoUrl || row.video_url || row.VideoUrl || row.video || row.Video || row.video_path || row.videoPath || row.VideoPath || '').trim(),
      lid
    );
    if (vUrl) {
      out.videoUrl = vUrl;
      out.video_url = vUrl;
      if (out.video || row.video !== undefined) out.video = vUrl;
      if (!out.video) out.video = vUrl;
      if (out.video_path) out.video_path = vUrl;
    }
    var pUrl = canonicalizeMediaPath(
      String(row.posterUrl || row.poster_url || row.PosterUrl || row.poster || row.Poster || row.thumbnail_path || row.thumbnailPath || '').trim(),
      lid
    );
    if (pUrl) {
      out.posterUrl = pUrl;
      out.poster_url = pUrl;
      if (!out.poster || isDeprecatedMediaPath(out.poster)) out.poster = pUrl;
      if (out.thumbnail_path) out.thumbnail_path = pUrl;
    }
    var aUrl = String(row.audioUrl || row.audio_url || row.audio || '').trim();
    if (aUrl) {
      out.audioUrl = aUrl;
      out.audio_url = aUrl;
      out.audio = aUrl;
    }
    if (row.order !== undefined || row.order_num !== undefined || row.Order !== undefined) {
      var ord = Number(row.order || row.order_num || row.Order) || 1;
      out.order = ord;
      out.order_num = ord;
    }
    return out;
  }

  function normalizeSheetsForDomain(domain, rawSheets) {
    var meta = WORKBOOK_META[domain];
    var out = {};
    meta.sheets.forEach(function (name) {
      var arr = cloneArray(rawSheets && rawSheets[name]);
      out[name] = arr.map(normalizeRecordRow);
    });
    return out;
  }

  function readDraft(domain) {
    var key = DRAFT_KEYS[domain];
    if (!key) return null;
    try {
      var raw = global.localStorage && global.localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.sheets) return null;
      // Quarantine stale drafts that still reference removed legacy uploads or broken auto-generated media paths
      if (sheetsHaveDeprecatedMedia(parsed.sheets)) {
        global.localStorage.removeItem(key);
        return null;
      }
      return {
        sheets: normalizeSheetsForDomain(domain, parsed.sheets),
        updatedAt: String(parsed.updatedAt || ''),
        pendingSync: Boolean(parsed.pendingSync)
      };
    } catch (_) {
      return null;
    }
  }

  function findOversizedInlineMedia(sheets) {
    var offending = [];
    Object.keys(sheets || {}).forEach(function (sheetName) {
      var rows = sheets[sheetName];
      if (!Array.isArray(rows)) return;
      rows.forEach(function (row, idx) {
        if (!row || typeof row !== 'object') return;
        Object.keys(row).forEach(function (k) {
          var val = row[k];
          if (typeof val === 'string' && val.indexOf('data:') === 0 && val.length > 2000000) {
            offending.push(sheetName + ' #' + (idx + 1) + ' (' + k + ')');
          }
        });
      });
    });
    return offending;
  }

  function writeDraft(domain, sheets, options) {
    var key = DRAFT_KEYS[domain];
    if (!key) throw new Error('Unknown content domain: ' + domain);
    var normalized = normalizeSheetsForDomain(domain, sheets);
    var oversized = findOversizedInlineMedia(normalized);
    if (oversized.length > 0) {
      throw new Error(
        'Media in ' +
          oversized[0] +
          ' exceeds the 1.5 MB inline browser limit. Upload via the local server (saves to assets/uploads/...) or enter an assets/... or https:// URL.'
      );
    }
    var payload = {
      sheets: normalized,
      updatedAt: new Date().toISOString(),
      pendingSync: Boolean(options && options.pendingSync)
    };
    try {
      if (global.localStorage) {
        global.localStorage.setItem(key, JSON.stringify(payload));
      }
    } catch (err) {
      throw new Error(
        'Browser storage limit reached. Replace large embedded media with an assets/... repository path or hosted https:// URL, then save again.'
      );
    }
    dispatchContentChange(domain, normalized);
    return normalized;
  }

  function hasDraft(domain) {
    return Boolean(readDraft(domain));
  }

  function getDraftStatusSummary() {
    return {
      lessons: hasDraft('lessons'),
      stories: hasDraft('stories'),
      reels: hasDraft('reels')
    };
  }

  function dispatchContentChange(domain, sheets) {
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('linguapath-content-change', {
            detail: { domain: domain, sheets: sheets }
          })
        );
      }
    } catch (_) {}
  }

  function getXlsx() {
    return global.XLSX || (typeof window !== 'undefined' ? window.XLSX : null) || null;
  }

  function parseXlsxBuffer(domain, arrayBuffer) {
    var xlsx = getXlsx();
    if (!xlsx) {
      throw new Error('SheetJS (XLSX) library is not loaded.');
    }
    var wb = xlsx.read(arrayBuffer, { type: 'array' });
    var meta = WORKBOOK_META[domain];
    var out = createEmptySheets(domain);
    meta.sheets.forEach(function (targetName) {
      var foundName = (wb.SheetNames || []).find(function (s) {
        return String(s).toLowerCase() === targetName.toLowerCase();
      });
      if (foundName && wb.Sheets && wb.Sheets[foundName]) {
        out[targetName] = xlsx.utils.sheet_to_json(wb.Sheets[foundName], { defval: '' });
      }
    });
    return out;
  }

  function countRowsInSheets(sheets) {
    return Object.keys(sheets || {}).reduce(function (sum, key) {
      return sum + (Array.isArray(sheets[key]) ? sheets[key].length : 0);
    }, 0);
  }

  var activeDataSources = {
    lessons: { source: 'pending', database: 'edu-hub-db' },
    stories: { source: 'pending', database: 'edu-hub-db' },
    reels: { source: 'pending', database: 'edu-hub-db' }
  };

  function setDataSourceStatus(domain, source, dbName) {
    activeDataSources[domain] = {
      source: source,
      database: dbName || 'edu-hub-db',
      timestamp: Date.now()
    };
  }

  function getDataSourceStatus(domain) {
    return activeDataSources[domain] || { source: 'xlsx-fallback', database: 'edu-hub-db' };
  }

  async function getAuthBearerToken() {
    try {
      if (global.localStorage) {
        var directToken = String(global.localStorage.getItem('linguapath_api_token') || '').trim();
        if (directToken) return directToken;
      }
    } catch (_) {}
    try {
      if (global.LinguaAuth && typeof global.LinguaAuth.getIdToken === 'function') {
        var authTok = await global.LinguaAuth.getIdToken();
        if (authTok && String(authTok).indexOf('.') !== -1) return String(authTok).trim();
      }
    } catch (_) {}
    return '';
  }

  function evaluateDomainCompleteness(domain, sheets) {
    if (!sheets || typeof sheets !== 'object') return 0;
    var meta = WORKBOOK_META[domain];
    if (!meta) return 0;
    var totalRows = 0;
    var filledSheets = 0;
    meta.sheets.forEach(function (s) {
      var list = sheets[s];
      if (Array.isArray(list) && list.length > 0) {
        totalRows += list.length;
        filledSheets += 1;
      }
    });
    return totalRows + filledSheets * 10;
  }

  function reconcileD1AndRepoSheets(domain, d1Sheets, fileSheets) {
    var meta = WORKBOOK_META[domain];
    var out = {};
    var backfill = {};
    var hasBackfill = false;
    var primarySheets = { Lessons: true, Videos: true, Games: true };

    meta.sheets.forEach(function (name) {
      var d1Arr = Array.isArray(d1Sheets && d1Sheets[name]) ? d1Sheets[name] : [];
      var fileArr = Array.isArray(fileSheets && fileSheets[name]) ? fileSheets[name] : [];

      if (d1Arr.length > 0) {
        if (primarySheets[name] || d1Arr.length >= fileArr.length) {
          var repaired = false;
          var fileById = {};
          fileArr.forEach(function (fr) {
            var fid = String((fr && (fr.id || fr.lessonId)) || '').trim().toLowerCase();
            if (fid) fileById[fid] = fr;
          });
          var mergedArr = cloneArray(d1Arr).map(function (row) {
            if (!row || typeof row !== 'object') return row;
            if (rowHasDeprecatedMedia(row)) {
              repaired = true;
              var rid = String(row.id || row.lessonId || '').trim().toLowerCase();
              if (rid && fileById[rid]) {
                return Object.assign({}, row, fileById[rid]);
              }
              return normalizeRecordRow(row);
            }
            return row;
          });
          out[name] = mergedArr;
          if (repaired) {
            backfill[name] = mergedArr;
            hasBackfill = true;
          }
        } else {
          out[name] = cloneArray(fileArr);
          backfill[name] = cloneArray(fileArr);
          hasBackfill = true;
        }
      } else if (fileArr.length > 0) {
        out[name] = cloneArray(fileArr);
        backfill[name] = cloneArray(fileArr);
        hasBackfill = true;
      } else {
        out[name] = [];
      }
    });

    return {
      sheets: normalizeSheetsForDomain(domain, out),
      backfillSheets: normalizeSheetsForDomain(domain, backfill),
      hasBackfill: hasBackfill
    };
  }

  async function autoSyncToServerIfPossible(domain, sheets, forceFlag) {
    if (!hasBackend()) return;
    try {
      var token = await getAuthBearerToken();
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var syncEndpoint = apiUrl(forceFlag ? '/api/database/sync?force=1' : '/api/database/sync');
      await fetch(syncEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ domain: domain, sheets: sheets, force: Boolean(forceFlag) })
      }).catch(function () {});
    } catch (_) {}
  }

  async function syncDomainToServer(domain, sheets) {
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);
    var normalized = normalizeSheetsForDomain(domain, sheets);

    if (!hasBackend()) {
      return {
        syncedToServer: false,
        syncReason: 'static-host',
        error:
          'Saved to your browser draft on GitHub Pages. Connect a Cloudflare Worker URL or export ' +
          meta.fileName +
          ' and commit the file (plus any new assets/) to publish for all visitors.'
      };
    }

    var token = await getAuthBearerToken();
    var lastServerError = '';

    // 1. Try Admin API endpoint with auth token
    if (token) {
      try {
        var res = await fetch(apiUrl('/api/admin/workbook/' + encodeURIComponent(domain)), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ sheets: normalized })
        });
        var data = await res.json().catch(function () {
          return {};
        });
        if (res.ok && data && data.success) {
          var serverSheets = data.sheets ? normalizeSheetsForDomain(domain, data.sheets) : normalized;
          try {
            if (global.localStorage) {
              global.localStorage.removeItem(DRAFT_KEYS[domain]);
              if (domain === 'lessons') {
                global.localStorage.removeItem('linguapath_custom_lessons');
                global.localStorage.removeItem('linguapath_local_lesson_pricing');
              }
            }
          } catch (_) {}

          setDataSourceStatus(domain, 'cloudflare-d1', 'edu-hub-db');
          dispatchContentChange(domain, serverSheets);
          if (domain === 'lessons' && data.lessonCatalog && global.LinguaAuth && typeof global.LinguaAuth.init === 'function') {
            try {
              if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
                window.dispatchEvent(
                  new CustomEvent('linguapath-catalog-synced', {
                    detail: { lessonCatalog: data.lessonCatalog }
                  })
                );
              }
            } catch (_) {}
          }

          return {
            syncedToServer: true,
            sheets: serverSheets,
            counts: data.counts || {},
            lessonCatalog: data.lessonCatalog || null
          };
        }
        if (data && data.error) {
          lastServerError = String(data.error);
        }
      } catch (_) {}
    }

    // 2. Direct database sync endpoint (supported by Cloudflare Worker and Node server)
    try {
      var syncRes = await fetch(apiUrl('/api/database/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ domain: domain, sheets: normalized })
      });
      var syncData = await syncRes.json().catch(function () {
        return {};
      });
      if (syncRes.ok && syncData && syncData.success) {
        try {
          if (global.localStorage) {
            global.localStorage.removeItem(DRAFT_KEYS[domain]);
          }
        } catch (_) {}
        setDataSourceStatus(domain, 'cloudflare-d1', 'edu-hub-db');
        dispatchContentChange(domain, normalized);
        return {
          syncedToServer: true,
          sheets: normalized,
          counts: syncData.counts || {}
        };
      }
      if (syncData && syncData.error) {
        lastServerError = String(syncData.error);
      }
    } catch (_) {}

    return {
      syncedToServer: false,
      syncReason: lastServerError ? 'server-error' : (token ? 'server-error' : 'auth-required'),
      error:
        lastServerError ||
        (token
          ? 'Could not sync with database.'
          : 'Sign in as Admin to sync live edits to database & Excel.')
    };
  }

  async function loadRepositoryWorkbook(domain) {
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);

    // Fetch D1 Database bundle and static Excel/JSON workbook in parallel (only query D1 when backend exists)
    var d1Promise = (async function () {
      if (!hasBackend()) return null;
      try {
        var d1Url = apiUrl('/api/database/bundle?domain=' + encodeURIComponent(domain) + '&t=' + Date.now());
        var d1Res = await fetch(d1Url, { cache: 'no-store' });
        if (d1Res.ok) {
          var d1Data = await d1Res.json();
          if (d1Data && d1Data.success && d1Data.sheets) {
            return {
              sheets: normalizeSheetsForDomain(domain, d1Data.sheets),
              database: d1Data.database || 'edu-hub-db',
              syncedWithRepo: Boolean(d1Data.syncedWithRepo)
            };
          }
        }
      } catch (_) {}
      return null;
    })();

    var filePromise = (async function () {
      // 1. Direct binary Excel parsing via SheetJS (data/*.xlsx)
      if (getXlsx()) {
        try {
          var xlsxRes = await fetch(meta.xlsxPath + '?t=' + Date.now(), { cache: 'no-store' });
          if (xlsxRes.ok) {
            var buf = await xlsxRes.arrayBuffer();
            var parsed = parseXlsxBuffer(domain, buf);
            if (countRowsInSheets(parsed) > 0) {
              return { sheets: normalizeSheetsForDomain(domain, parsed), source: 'xlsx' };
            }
          }
        } catch (_) {}
      }

      // 2. Static JSON fallback if SheetJS unavailable or Excel missing
      try {
        var jsonRes = await fetch(meta.jsonPath + '?t=' + Date.now(), { cache: 'no-store' });
        if (jsonRes.ok) {
          var jsonData = await jsonRes.json();
          if (jsonData && jsonData.sheets && countRowsInSheets(jsonData.sheets) > 0) {
            return { sheets: normalizeSheetsForDomain(domain, jsonData.sheets), source: 'json' };
          }
        }
      } catch (_) {}

      return null;
    })();

    var results = await Promise.all([d1Promise, filePromise]);
    var d1Result = results[0];
    var fileResult = results[1];

    // Case 1: Both D1 and Excel loaded -> Preserve D1 rows, heal deprecated media paths & backfill missing sheets
    if (d1Result && fileResult) {
      var reconciled = reconcileD1AndRepoSheets(domain, d1Result.sheets, fileResult.sheets);
      var sourceLabel = reconciled.hasBackfill ? 'cloudflare-d1-reconciled' : 'cloudflare-d1';
      setDataSourceStatus(domain, sourceLabel, d1Result.database || 'edu-hub-db');
      if (reconciled.hasBackfill) {
        autoSyncToServerIfPossible(domain, reconciled.backfillSheets, true);
      }
      return {
        sheets: reconciled.sheets,
        source: sourceLabel,
        database: d1Result.database || 'edu-hub-db'
      };
    }

    // Case 2: Only D1 succeeded
    if (d1Result) {
      setDataSourceStatus(domain, 'cloudflare-d1', d1Result.database || 'edu-hub-db');
      return {
        sheets: d1Result.sheets,
        source: 'cloudflare-d1',
        database: d1Result.database || 'edu-hub-db'
      };
    }

    // Case 3: Only Excel succeeded (D1 offline or unreachable)
    if (fileResult) {
      setDataSourceStatus(domain, fileResult.source + '-fallback', 'edu-hub-db');
      return {
        sheets: fileResult.sheets,
        source: fileResult.source
      };
    }

    // Case 4: Neither succeeded
    setDataSourceStatus(domain, 'empty', 'edu-hub-db');
    return { sheets: createEmptySheets(domain), source: 'empty' };
  }

  async function loadWorkbook(domain, options) {
    var skipDraft = Boolean(options && options.skipDraft);
    var preferDraft = Boolean(options && options.preferDraft);
    var draft = !skipDraft ? readDraft(domain) : null;

    if (!hasBackend() && draft && draft.sheets) {
      return {
        sheets: draft.sheets,
        source: 'local-draft',
        hasDraft: true,
        updatedAt: draft.updatedAt
      };
    }

    var repo = await loadRepositoryWorkbook(domain);
    var hasLiveServer = Boolean(repo && repo.source && (repo.source.indexOf('cloudflare-d1') === 0 || repo.source === 'auto-synced'));

    // On Cloudflare/Node with live DB, direct DB edits should take effect immediately unless caller explicitly requested pending draft
    if (hasLiveServer && countRowsInSheets(repo.sheets) > 0 && !(preferDraft && draft && draft.pendingSync)) {
      if (draft && !draft.pendingSync) {
        try {
          if (global.localStorage) global.localStorage.removeItem(DRAFT_KEYS[domain]);
        } catch (_) {}
      }
      return {
        sheets: repo.sheets,
        source: repo.source,
        hasDraft: Boolean(draft && draft.pendingSync),
        updatedAt: ''
      };
    }

    if (draft && draft.sheets) {
      return {
        sheets: draft.sheets,
        source: 'local-draft',
        hasDraft: true,
        updatedAt: draft.updatedAt
      };
    }

    return {
      sheets: repo.sheets,
      source: repo.source,
      hasDraft: false,
      updatedAt: ''
    };
  }

  async function saveDomainSheets(domain, partialSheets) {
    var current = await loadWorkbook(domain, { preferDraft: true });
    var merged = normalizeSheetsForDomain(domain, current.sheets);
    Object.keys(partialSheets || {}).forEach(function (sheetName) {
      if (Object.prototype.hasOwnProperty.call(merged, sheetName)) {
        merged[sheetName] = cloneArray(partialSheets[sheetName]);
      }
    });
    var saved = writeDraft(domain, merged, { pendingSync: true });
    var syncRes = await syncDomainToServer(domain, saved);
    if (syncRes.syncedToServer) {
      return {
        success: true,
        sheets: syncRes.sheets || saved,
        hasDraft: false,
        syncedToServer: true,
        counts: syncRes.counts || {},
        lessonCatalog: syncRes.lessonCatalog || null
      };
    }
    return {
      success: true,
      sheets: saved,
      hasDraft: true,
      syncedToServer: false,
      syncReason: syncRes.syncReason || 'local-only',
      syncError: syncRes.error || ''
    };
  }

  async function importExercisesLocal(params) {
    var target = params && params.target === 'stories' ? 'stories' : 'lessons';
    var mode = (params && params.mode) || 'replace_lesson';
    var selectedLessonId = String((params && params.lessonId) || '').trim();
    var incomingRows = Array.isArray(params && params.rows) ? params.rows : [];
    if (!incomingRows.length) {
      throw new Error('No exercise rows provided to import.');
    }

    var current = await loadWorkbook(target);
    var existingExercises = cloneArray(current.sheets.Exercises);
    var cleanIncoming = incomingRows.map(function (r, idx) {
      var resolvedLessonId = String(r.lessonId || r.lesson_id || selectedLessonId || '').trim();
      var optA = String(r.optionA || r.option_a || '').trim();
      var resolvedAnswer = String(r.answer || r.correctAnswer || r.correct || optA || '').trim();
      return {
        lessonId: resolvedLessonId,
        order: Number(r.order || r.order_num) || idx + 1,
        type: String(r.type || 'multiple-choice').trim() || 'multiple-choice',
        groupId: String(r.groupId || r.group_id || '').trim(),
        groupTitle: String(r.groupTitle || r.group_title || '').trim(),
        pinyin: String(r.pinyin || r.Pinyin || r.pinyinHint || r.pinyin_hint || '').trim(),
        question: String(r.question || '').trim(),
        audioUrl: String(r.audioUrl || r.audio_url || r.audio || '').trim(),
        optionA: optA,
        optionB: String(r.optionB || r.option_b || '').trim(),
        optionC: String(r.optionC || r.option_c || '').trim(),
        optionD: String(r.optionD || r.option_d || '').trim(),
        optionE: String(r.optionE || r.option_e || '').trim(),
        optionAImage: String(r.optionAImage || r.option_a_image || '').trim(),
        optionBImage: String(r.optionBImage || r.option_b_image || '').trim(),
        optionCImage: String(r.optionCImage || r.option_c_image || '').trim(),
        optionDImage: String(r.optionDImage || r.option_d_image || '').trim(),
        optionEImage: String(r.optionEImage || r.option_e_image || '').trim(),
        answer: resolvedAnswer,
        explanation: String(r.explanation || '').trim()
      };
    });

    var nextExercises;
    if (mode === 'replace_all') {
      nextExercises = cleanIncoming;
    } else if (mode === 'append') {
      nextExercises = existingExercises.concat(cleanIncoming);
    } else {
      var targetIds = {};
      if (selectedLessonId) {
        targetIds[selectedLessonId.toLowerCase()] = true;
      }
      cleanIncoming.forEach(function (r) {
        if (r.lessonId) targetIds[String(r.lessonId).toLowerCase()] = true;
      });
      nextExercises = existingExercises
        .filter(function (ex) {
          return !targetIds[String(ex.lessonId || '').trim().toLowerCase()];
        })
        .concat(cleanIncoming);
    }

    var res = await saveDomainSheets(target, { Exercises: nextExercises });
    return {
      success: true,
      importedCount: cleanIncoming.length,
      exercises: res.sheets.Exercises,
      hasDraft: Boolean(res.hasDraft),
      syncedToServer: Boolean(res.syncedToServer),
      syncReason: res.syncReason || '',
      syncError: res.syncError || ''
    };
  }

  async function exportWorkbook(domain, overrideSheets) {
    var xlsx = getXlsx();
    if (!xlsx) {
      throw new Error('SheetJS (XLSX) library is not loaded.');
    }
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);

    var loaded = overrideSheets
      ? normalizeSheetsForDomain(domain, overrideSheets)
      : (await loadWorkbook(domain)).sheets;

    var wb = xlsx.utils.book_new();
    meta.sheets.forEach(function (sheetName) {
      var rows = Array.isArray(loaded[sheetName]) ? loaded[sheetName] : [];
      var ws;
      if (rows.length > 0) {
        ws = xlsx.utils.json_to_sheet(rows);
      } else {
        var headers = (DEFAULT_COLUMNS[domain] && DEFAULT_COLUMNS[domain][sheetName]) || ['id'];
        ws = xlsx.utils.aoa_to_sheet([headers]);
      }
      xlsx.utils.book_append_sheet(wb, ws, sheetName);
    });

    xlsx.writeFile(wb, meta.fileName);
    return {
      fileName: meta.fileName,
      counts: meta.sheets.reduce(function (acc, s) {
        acc[s] = (loaded[s] || []).length;
        return acc;
      }, {})
    };
  }

  async function importWorkbookFile(domain, arrayBuffer) {
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);
    var parsed = parseXlsxBuffer(domain, arrayBuffer);
    if (countRowsInSheets(parsed) === 0) {
      throw new Error(
        'No matching sheets (' + meta.sheets.join(', ') + ') with data rows were found in the uploaded Excel file.'
      );
    }
    var saved = writeDraft(domain, parsed);
    var syncRes = await syncDomainToServer(domain, saved);
    var finalSheets = syncRes.syncedToServer && syncRes.sheets ? syncRes.sheets : saved;
    return {
      success: true,
      fileName: meta.fileName,
      sheets: finalSheets,
      hasDraft: !syncRes.syncedToServer,
      syncedToServer: Boolean(syncRes.syncedToServer),
      syncReason: syncRes.syncReason || '',
      syncError: syncRes.error || '',
      counts: meta.sheets.reduce(function (acc, s) {
        acc[s] = (finalSheets[s] || []).length;
        return acc;
      }, {})
    };
  }

  async function clearDraft(domain) {
    var key = DRAFT_KEYS[domain];
    if (!key) throw new Error('Unknown content domain: ' + domain);
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(key);
        LEGACY_DRAFT_KEYS.forEach(function (oldKey) {
          global.localStorage.removeItem(oldKey);
        });
      }
    } catch (_) {}
    var repo = await loadRepositoryWorkbook(domain);
    dispatchContentChange(domain, repo.sheets);
    return {
      success: true,
      sheets: repo.sheets,
      source: repo.source,
      hasDraft: false
    };
  }

  async function fetchStaticRepoSheets(domain) {
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);
    if (getXlsx()) {
      try {
        var xlsxRes = await fetch(meta.xlsxPath + '?t=' + Date.now(), { cache: 'no-store' });
        if (xlsxRes.ok) {
          var buf = await xlsxRes.arrayBuffer();
          var parsed = parseXlsxBuffer(domain, buf);
          if (countRowsInSheets(parsed) > 0) {
            return normalizeSheetsForDomain(domain, parsed);
          }
        }
      } catch (_) {}
    }
    var jsonRes = await fetch(meta.jsonPath + '?t=' + Date.now(), { cache: 'no-store' });
    if (jsonRes.ok) {
      var jsonData = await jsonRes.json();
      if (jsonData && jsonData.sheets && countRowsInSheets(jsonData.sheets) > 0) {
        return normalizeSheetsForDomain(domain, jsonData.sheets);
      }
    }
    throw new Error('Could not load ' + meta.fileName + ' or JSON mirror.');
  }

  async function forceSyncRepoToD1(domain) {
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);

    // Purge any stale drafts (v1 and v2) before pushing repo workbook
    try {
      if (global.localStorage) {
        if (DRAFT_KEYS[domain]) global.localStorage.removeItem(DRAFT_KEYS[domain]);
        LEGACY_DRAFT_KEYS.forEach(function (oldKey) {
          global.localStorage.removeItem(oldKey);
        });
      }
    } catch (_) {}

    var repoSheets = await fetchStaticRepoSheets(domain);

    if (!hasBackend()) {
      dispatchContentChange(domain, repoSheets);
      return {
        success: true,
        syncedToServer: false,
        sheets: repoSheets,
        error: 'Cleared local drafts on GitHub Pages and reloaded directly from ' + meta.xlsxPath + '.'
      };
    }

    var token = await getAuthBearerToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var forceRes = await fetch(apiUrl('/api/database/force-sync'), {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ domain: domain, sheets: repoSheets, force: true })
    });
    var forceData = await forceRes.json().catch(function () {
      return {};
    });

    if (forceRes.ok && forceData && forceData.success) {
      var finalSheets = forceData.sheets ? normalizeSheetsForDomain(domain, forceData.sheets) : repoSheets;
      setDataSourceStatus(domain, 'cloudflare-d1', forceData.database || 'edu-hub-db');
      dispatchContentChange(domain, finalSheets);
      return {
        success: true,
        syncedToServer: true,
        sheets: finalSheets,
        database: forceData.database || 'edu-hub-db'
      };
    }

    // Fallback to standard /api/database/sync?force=1
    var syncRes = await syncDomainToServer(domain, repoSheets);
    return {
      success: Boolean(syncRes && (syncRes.syncedToServer || syncRes.sheets)),
      syncedToServer: Boolean(syncRes && syncRes.syncedToServer),
      sheets: (syncRes && syncRes.sheets) || repoSheets,
      error: (forceData && forceData.error) || (syncRes && syncRes.error) || ''
    };
  }

  function compressRasterDataUrlIfNeeded(dataUrl, mimeType) {
    return new Promise(function (resolve) {
      try {
        if (
          typeof document === 'undefined' ||
          typeof Image === 'undefined' ||
          !/^image\/(jpeg|jpg|png|webp)$/i.test(String(mimeType || '')) ||
          String(dataUrl || '').length <= 160000
        ) {
          resolve(dataUrl);
          return;
        }
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (!w || !h) {
              resolve(dataUrl);
              return;
            }
            var maxDim = 960;
            var scale = Math.min(1, maxDim / Math.max(w, h));
            var tw = Math.max(1, Math.round(w * scale));
            var th = Math.max(1, Math.round(h * scale));
            var canvas = document.createElement('canvas');
            canvas.width = tw;
            canvas.height = th;
            var ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(dataUrl);
              return;
            }
            ctx.drawImage(img, 0, 0, tw, th);
            var outMime = /^image\/png$/i.test(mimeType) ? 'image/png' : 'image/jpeg';
            var candidate = outMime === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86);
            if (outMime === 'image/png' && candidate.length > 180000) {
              var webpCandidate = canvas.toDataURL('image/webp', 0.86);
              if (webpCandidate && webpCandidate.indexOf('data:image/webp') === 0 && webpCandidate.length < candidate.length) {
                candidate = webpCandidate;
              }
            }
            if (candidate && candidate.indexOf('data:image/') === 0 && candidate.length < dataUrl.length) {
              resolve(candidate);
            } else {
              resolve(dataUrl);
            }
          } catch (_) {
            resolve(dataUrl);
          }
        };
        img.onerror = function () {
          resolve(dataUrl);
        };
        img.src = dataUrl;
      } catch (_) {
        resolve(dataUrl);
      }
    });
  }

  function readFileAsInlineMedia(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      if (file.size > MAX_INLINE_MEDIA_BYTES) {
        var mb = (file.size / (1024 * 1024)).toFixed(2);
        var extLower = (String(file.name || '').split('.').pop() || '').toLowerCase();
        var subFolder =
          /^(mp4|webm|mov|m4v)$/.test(extLower)
            ? 'assets/video/'
            : /^(mp3|wav|ogg|m4a)$/.test(extLower)
            ? 'assets/audio/'
            : 'assets/images/';
        var limitErr = new Error(
          'File "' +
            file.name +
            '" (' +
            mb +
            ' MB) exceeds the 1.5 MB browser storage limit on static GitHub Pages. Click "Use Repo Path" (then commit the file to ' +
            subFolder +
            '), upload on Cloudflare / local server, or paste a hosted https:// URL.'
        );
        limitErr.code = 'STATIC_LARGE_MEDIA';
        limitErr.fileName = file.name;
        limitErr.fileSizeMb = mb;
        limitErr.suggestedRepoPath = subFolder + file.name;
        reject(limitErr);
        return;
      }
      var reader = new FileReader();
      reader.onload = async function () {
        var rawUrl = String(reader.result || '');
        var finalUrl = await compressRasterDataUrlIfNeeded(rawUrl, file.type);
        resolve({
          url: finalUrl,
          inline: true,
          size: file.size,
          name: file.name
        });
      };
      reader.onerror = function () {
        reject(new Error('Failed to read selected file "' + file.name + '".'));
      };
      reader.readAsDataURL(file);
    });
  }

  global.LinguaContentStore = {
    MAX_INLINE_MEDIA_BYTES: MAX_INLINE_MEDIA_BYTES,
    hasDraft: hasDraft,
    getDraftStatusSummary: getDraftStatusSummary,
    getDataSourceStatus: getDataSourceStatus,
    loadWorkbook: loadWorkbook,
    loadLessonsWorkbook: function (opts) {
      return loadWorkbook('lessons', opts);
    },
    loadStoriesWorkbook: function (opts) {
      return loadWorkbook('stories', opts);
    },
    loadReelsWorkbook: function (opts) {
      return loadWorkbook('reels', opts);
    },
    saveLessonsSheets: function (partial) {
      return saveDomainSheets('lessons', partial);
    },
    saveStoriesSheets: function (partial) {
      return saveDomainSheets('stories', partial);
    },
    saveReelsSheets: function (partial) {
      return saveDomainSheets('reels', partial);
    },
    importExercisesLocal: importExercisesLocal,
    exportWorkbook: exportWorkbook,
    importWorkbookFile: importWorkbookFile,
    syncDomainToServer: syncDomainToServer,
    forceSyncRepoToD1: forceSyncRepoToD1,
    clearDraft: clearDraft,
    readFileAsInlineMedia: readFileAsInlineMedia,
    cloneArray: cloneArray
  };
  global.cloneArray = cloneArray;
})(typeof window !== 'undefined' ? window : globalThis);
