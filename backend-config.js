/**
 * =========================================================
 * LINGUAPATH - STATIC RUNTIME CONFIG, MEDIA RESOLVER & EXCEL CONTENT STORE
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

  function getStoredOverride() {
    return '';
  }

  function getApiBase() {
    return '';
  }

  function hasBackend() {
    return false;
  }

  function setApiBase() {
    return '';
  }

  function clearApiBase() {
    return '';
  }

  function apiUrl(path) {
    var raw = String(path || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.charAt(0) === '/' ? raw : '/' + raw;
  }

  function assetUrl(path) {
    var trimmed = String(path || '').trim();
    if (!trimmed || /^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    return trimmed;
  }

  async function testConnection() {
    return {
      ok: false,
      error: 'LinguaPath is configured for 100% static GitHub Pages mode using Excel workbooks.'
    };
  }

  global.LinguaBackend = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_PRODUCTION_BACKEND_URL: DEFAULT_PRODUCTION_BACKEND_URL,
    isStaticGithubHost: isStaticGithubHost,
    isValidHttpUrl: isValidHttpUrl,
    isMixedContentUrl: isMixedContentUrl,
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
    lessons: 'linguapath_cms_lessons_v1',
    stories: 'linguapath_cms_stories_v1',
    reels: 'linguapath_cms_reels_v1'
  };

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

  function normalizeSheetsForDomain(domain, rawSheets) {
    var meta = WORKBOOK_META[domain];
    var out = {};
    meta.sheets.forEach(function (name) {
      out[name] = cloneArray(rawSheets && rawSheets[name]);
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
      return {
        sheets: normalizeSheetsForDomain(domain, parsed.sheets),
        updatedAt: String(parsed.updatedAt || '')
      };
    } catch (_) {
      return null;
    }
  }

  function writeDraft(domain, sheets) {
    var key = DRAFT_KEYS[domain];
    if (!key) throw new Error('Unknown content domain: ' + domain);
    var normalized = normalizeSheetsForDomain(domain, sheets);
    var payload = {
      sheets: normalized,
      updatedAt: new Date().toISOString()
    };
    try {
      if (global.localStorage) {
        global.localStorage.setItem(key, JSON.stringify(payload));
      }
    } catch (err) {
      throw new Error(
        'Browser storage limit reached. Click Export ' +
          WORKBOOK_META[domain].fileName +
          ' to save your workbook, and use assets/... paths for media files larger than 1.5 MB.'
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

  async function syncDomainToServer(domain, sheets) {
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);
    var normalized = normalizeSheetsForDomain(domain, sheets);
    var token = await getAuthBearerToken();
    if (!token) {
      return {
        syncedToServer: false,
        syncReason: 'auth-required',
        error: 'No active Admin server session token found. Please sign out and sign in once.'
      };
    }

    try {
      var res = await fetch('/api/admin/workbook/' + encodeURIComponent(domain), {
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
      if (!res.ok || !data || !data.success) {
        return {
          syncedToServer: false,
          syncReason: res.status === 401 || res.status === 403 ? 'auth-required' : 'server-error',
          error: (data && data.error) || 'Server returned HTTP ' + res.status
        };
      }

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
    } catch (err) {
      return {
        syncedToServer: false,
        syncReason: 'network-error',
        error: err && err.message ? err.message : 'Unable to reach backend server.'
      };
    }
  }

  async function loadRepositoryWorkbook(domain) {
    var meta = WORKBOOK_META[domain];
    if (!meta) throw new Error('Unknown content domain: ' + domain);

    // 0. Primary: Cloudflare D1 Database / Server Excel (data/*.xlsx)
    try {
      var d1Url = '/api/database/bundle?domain=' + encodeURIComponent(domain) + '&t=' + Date.now();
      var d1Res = await fetch(d1Url, { cache: 'no-store' });
      if (d1Res.ok) {
        var d1Data = await d1Res.json();
        if (d1Data && d1Data.success && d1Data.sheets) {
          var normD1 = normalizeSheetsForDomain(domain, d1Data.sheets);
          setDataSourceStatus(domain, 'cloudflare-d1', d1Data.database || 'edu-hub-db');
          return {
            sheets: normD1,
            source: 'cloudflare-d1',
            database: d1Data.database || 'edu-hub-db'
          };
        }
      }
    } catch (_) {}

    // 1. Fallback: Direct binary Excel parsing via SheetJS (data/*.xlsx)
    if (getXlsx()) {
      try {
        var xlsxRes = await fetch(meta.xlsxPath + '?t=' + Date.now(), { cache: 'no-store' });
        if (xlsxRes.ok) {
          var buf = await xlsxRes.arrayBuffer();
          var parsedSheets = parseXlsxBuffer(domain, buf);
          setDataSourceStatus(domain, 'xlsx-fallback', 'edu-hub-db');
          return { sheets: parsedSheets, source: 'xlsx' };
        }
      } catch (_) {}
    }

    // 2. Static JSON fallback if SheetJS unavailable or Excel missing
    try {
      var jsonRes = await fetch(meta.jsonPath + '?t=' + Date.now(), { cache: 'no-store' });
      if (jsonRes.ok) {
        var jsonData = await jsonRes.json();
        if (jsonData && jsonData.sheets) {
          var normJson = normalizeSheetsForDomain(domain, jsonData.sheets);
          setDataSourceStatus(domain, 'json-fallback', 'edu-hub-db');
          return { sheets: normJson, source: 'json' };
        }
      }
    } catch (_) {}

    setDataSourceStatus(domain, 'empty', 'edu-hub-db');
    return { sheets: createEmptySheets(domain), source: 'empty' };
  }

  async function loadWorkbook(domain, options) {
    var skipDraft = Boolean(options && options.skipDraft);
    if (!skipDraft) {
      var draft = readDraft(domain);
      if (draft && draft.sheets) {
        return {
          sheets: draft.sheets,
          source: 'local-draft',
          hasDraft: true,
          updatedAt: draft.updatedAt
        };
      }
    }
    var repo = await loadRepositoryWorkbook(domain);
    return {
      sheets: repo.sheets,
      source: repo.source,
      hasDraft: false,
      updatedAt: ''
    };
  }

  async function saveDomainSheets(domain, partialSheets) {
    var current = await loadWorkbook(domain);
    var merged = normalizeSheetsForDomain(domain, current.sheets);
    Object.keys(partialSheets || {}).forEach(function (sheetName) {
      if (Object.prototype.hasOwnProperty.call(merged, sheetName)) {
        merged[sheetName] = cloneArray(partialSheets[sheetName]);
      }
    });
    var saved = writeDraft(domain, merged);
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

  function readFileAsInlineMedia(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      if (file.size > MAX_INLINE_MEDIA_BYTES) {
        var mb = (file.size / (1024 * 1024)).toFixed(2);
        reject(
          new Error(
            'File "' +
              file.name +
              '" (' +
              mb +
              ' MB) exceeds the 1.5 MB inline limit. Copy large media into your repository assets/ folder and paste the path (e.g. assets/video/...).'
          )
        );
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve({
          url: String(reader.result || ''),
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
    clearDraft: clearDraft,
    readFileAsInlineMedia: readFileAsInlineMedia,
    cloneArray: cloneArray
  };
  global.cloneArray = cloneArray;
})(typeof window !== 'undefined' ? window : globalThis);
