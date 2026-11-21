/**
 * =========================================================
 * LINGUAPATH - CLIENT AUTH, MEMBERSHIP & SITE CONFIG STORE
 * Backed by data/users.xlsx + data/site-config.json + localStorage overlay
 * Supports Lesson Pass (per_lesson) & Course Pass (course) in Kyat
 * =========================================================
 */
(function () {
  'use strict';

  var DEFAULT_SITE_CONFIG = {
    configId: 'homepage',
    heroEyebrow: 'Learn Chinese Step by Step',
    heroTitleLine1: 'Learn Chinese',
    heroTitleHighlight: 'with Confidence.',
    heroSubtitle: 'Build your Chinese skills through pronunciation, everyday expressions, conversations, vocabulary, and practical exercises.',
    heroPrimaryCta: 'Explore Lessons',
    heroSecondaryCta: 'Explore Stories & Reels',
    heroBannerUrl: 'assets/hero-banner.png',
    storiesLabel: 'Interactive Reading',
    storiesTitle: 'Chinese Stories',
    storiesSubtitle: 'Read illustrated Mandarin stories with pinyin, native audio, vocabulary, and comprehension exercises.',
    reelsLabel: 'Short Video Immersion',
    reelsTitle: 'Short Mandarin Reels',
    reelsSubtitle: 'Watch bite-sized vertical video reels with quad-language subtitles in Hanzi, Pinyin, English, and Myanmar.',
    gamesLabel: 'Interactive Practice',
    gamesTitle: 'Play & Practice Games',
    gamesSubtitle: 'Reinforce your Chinese tones, character recognition, and rapid recall through interactive gameplay.',
    lessonsLabel: 'Structured Curriculum',
    lessonsTitle: 'Mandarin Lessons',
    lessonsSubtitle: 'Master Chinese step by step with HSK 2 and structured courses featuring video lessons, exercises, and character writing.',
    lessonsBadge: 'HSK 2 • Structured Course',
    lessonsCardTitle: 'Interactive HSK 2 Mandarin Course',
    lessonsCardSubtitle: 'HSK 标准课程 • Step-by-Step Fluency',
    lessonsCardDesc: 'Explore guided video lessons, HSK listening and matching exercises, pinyin fill-in-the-blank writing, and stroke-order practice.',
    lessonsBullets: [
      'HSK 2 Structured Curriculum',
      'Listening, Image Choice & Pinyin Exercises',
      'Stroke-Order Writing & Pronunciation Check'
    ],
    lessonsCta: 'Go to Lessons →',
    coursePrices: {
      'HSK 2': 120
    },
    contactEmail: 'syndkyaw@gmail.com',
    contactPhone: '+95 9 798 123 456',
    contactViber: '+95 9 798 123 456',
    featuredReelIds: ['cny_01', 'daily_01', 'kids_01'],
    featuredStoryIds: ['lesson-01'],
    featuredGameIds: ['game-01']
  };

  var CONTACT_INFO = {
    email: 'syndkyaw@gmail.com',
    viber: '+95 9 798 123 456',
    viberUri: 'viber://chat?number=%2B959798123456'
  };

  var MEMBERSHIP_PLANS = {
    per_lesson: {
      id: 'per_lesson',
      name: 'Lesson Pass',
      price: 9,
      amountLabel: '9 Kyat / lesson',
      description: 'Lifetime unlock for one selected paid lesson.'
    },
    course: {
      id: 'course',
      name: 'Course Pass',
      price: 120,
      amountLabel: '120 Kyat / course',
      description: 'Unlock every lesson in the selected course (e.g. HSK 2).'
    }
  };

  var USERS_XLSX_PATH = 'data/users.xlsx';
  var OVERLAY_KEY = 'linguapath_excel_overlay_v1';
  var LEGACY_AUTH_KEY = 'linguapath_local_auth_store_v1';
  var SESSION_UID_KEY = 'linguapath_local_session_uid';
  var PRIMARY_ADMIN_EMAIL = 'syndkyaw@gmail.com';

  function getXLSX() {
    return window.XLSX || null;
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      try {
        var el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.onload = function () { resolve(true); };
        el.onerror = function () { resolve(false); };
        document.head.appendChild(el);
      } catch (e) {
        resolve(false);
      }
    });
  }

  var xlsxLoadPromise = null;
  async function ensureXLSX() {
    var lib = getXLSX();
    if (lib) return lib;
    if (!xlsxLoadPromise) {
      xlsxLoadPromise = (async function () {
        await loadScript('vendor/xlsx.full.min.js');
        if (getXLSX()) return getXLSX();
        await loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js');
        return getXLSX();
      })();
    }
    var loaded = await xlsxLoadPromise;
    if (!loaded) xlsxLoadPromise = null;
    return loaded;
  }

  function calculateAge(dob) {
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
    var parts = dob.split('-').map(Number);
    var born = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(born.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - born.getFullYear();
    var mDiff = now.getMonth() - born.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < born.getDate())) {
      age--;
    }
    return age < 0 || age > 125 ? null : age;
  }

  function cleanId(val) {
    return String(val || '').trim().replace(/[^a-zA-Z0-9_\-]+/g, '-').slice(0, 128) || ('item-' + Date.now());
  }

  function normalizeCourseName(val) {
    var raw = String(val || '').trim();
    if (!raw) return 'HSK 2';
    var compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
    if (compact === 'hsk1') return 'HSK 1';
    if (compact === 'hsk2') return 'HSK 2';
    if (compact === 'hsk3') return 'HSK 3';
    if (compact === 'hsk4') return 'HSK 4';
    return raw.slice(0, 80);
  }

  function courseKey(val) {
    return String(val || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
  }

  function getLessonCourseName(lesson) {
    if (!lesson || typeof lesson !== 'object') return 'HSK 2';
    var c = String(lesson.course || lesson.courseName || lesson.category || '').trim();
    if (c) return normalizeCourseName(c);
    return 'HSK 2';
  }

  function randomHex(bytes) {
    var len = bytes || 16;
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var arr = new Uint8Array(len);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      }
    } catch (e) {}
    var out = '';
    for (var i = 0; i < len * 2; i++) {
      out += Math.floor(Math.random() * 16).toString(16);
    }
    return out;
  }

  function fallbackSha256(str) {
    var data = new TextEncoder().encode(str);
    var K = new Uint32Array([
      1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
      3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
      3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
      2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
      666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
      2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
      430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
      1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298
    ]);
    var h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
    var h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
    var bitLen = data.length * 8;
    var aligned = Math.ceil((data.length + 9) / 64) * 64;
    var buf = new Uint8Array(aligned);
    buf.set(data);
    buf[data.length] = 128;
    var view = new DataView(buf.buffer);
    view.setUint32(aligned - 8, Math.floor(bitLen / 4294967296), false);
    view.setUint32(aligned - 4, bitLen >>> 0, false);
    var W = new Uint32Array(64);
    var rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var offset = 0; offset < aligned; offset += 64) {
      for (var t = 0; t < 16; t++) W[t] = view.getUint32(offset + t * 4, false);
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = rotr(W[t2 - 15], 7) ^ rotr(W[t2 - 15], 18) ^ (W[t2 - 15] >>> 3);
        var s1 = rotr(W[t2 - 2], 17) ^ rotr(W[t2 - 2], 19) ^ (W[t2 - 2] >>> 10);
        W[t2] = (W[t2 - 16] + s0 + W[t2 - 7] + s1) >>> 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (var t3 = 0; t3 < 64; t3++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t3] + W[t3]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map(function (x) { return x.toString(16).padStart(8, '0'); }).join('');
  }

  async function sha256Hex(str) {
    try {
      if (window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined') {
        var enc = new TextEncoder().encode(str);
        var digest = await window.crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      }
    } catch (e) {}
    return fallbackSha256(str);
  }

  async function hashPassword(pw) {
    var salt = randomHex(16);
    var hex = await sha256Hex(salt + ':' + pw);
    return 'sha256$' + salt + '$' + hex;
  }

  async function verifyPassword(pw, stored) {
    var s = String(stored == null ? '' : stored);
    if (!s) return false;
    var m = s.match(/^sha256\$([^$]+)\$([a-f0-9]{64})$/i);
    if (m) {
      var candidate = await sha256Hex(m[1] + ':' + pw);
      return candidate.toLowerCase() === m[2].toLowerCase();
    }
    return pw === s;
  }

  function cleanPhone(phone) {
    return String(phone == null ? '' : phone).trim().replace(/[\s\-().+]+/g, '');
  }

  function phoneVariants(phone) {
    var digits = String(phone == null ? '' : phone).replace(/\D+/g, '');
    if (!digits) return [];
    var set = new Set([digits]);
    if (digits.startsWith('950') && digits.length >= 10) {
      var v0 = '0' + digits.slice(3);
      set.add(v0);
      set.add(v0.slice(1));
    } else if (digits.startsWith('95') && digits.length >= 10) {
      var v1 = '0' + digits.slice(2);
      set.add(v1);
      set.add(digits.slice(2));
    } else if (digits.startsWith('0') && digits.length >= 8) {
      set.add(digits.slice(1));
      set.add('95' + digits.slice(1));
    }
    return Array.from(set);
  }

  function phonesMatch(a, b) {
    var ca = cleanPhone(a);
    var cb = cleanPhone(b);
    if (!ca || !cb) return false;
    if (ca === cb) return true;
    var va = phoneVariants(a);
    var vb = new Set(phoneVariants(b));
    return va.some(function (x) { return vb.has(x); });
  }

  function normalizeDate(val) {
    if (val == null || val === '') return '';
    if (typeof val === 'number' && Number.isFinite(val) && val > 1000 && val < 100000) {
      var ms = Math.round((val - 25569) * 86400 * 1000);
      var d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    var s = String(val).trim().replace(/\//g, '-');
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s.slice(0, 20);
  }

  function parseBool(val, defVal) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    var s = String(val == null ? '' : val).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    return Boolean(defVal);
  }

  function parseList(val, normalizer) {
    var arr = Array.isArray(val)
      ? val
      : String(val == null ? '' : val).split(',');
    var out = [];
    var seen = new Set();
    arr.forEach(function (item) {
      var clean = String(item || '').trim();
      if (!clean) return;
      if (typeof normalizer === 'function') clean = normalizer(clean);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    });
    return out;
  }

  function tsMs(str) {
    if (typeof str !== 'string' || !str.trim()) return 0;
    var t = Date.parse(str);
    return Number.isNaN(t) ? 0 : t;
  }

  var baseWorkbookData = {
    users: {},
    requests: {},
    progress: {},
    lessonCatalog: {},
    loaded: false,
    lastLoadedAt: '',
    lastError: ''
  };

  function emptyStore() {
    return { users: {}, requests: {}, progress: {}, lessonCatalog: {} };
  }

  function readOverlay() {
    var store = emptyStore();
    try {
      var raw = localStorage.getItem(OVERLAY_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return {
          users: parsed && parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
          requests: parsed && parsed.requests && typeof parsed.requests === 'object' ? parsed.requests : {},
          progress: parsed && parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
          lessonCatalog: parsed && parsed.lessonCatalog && typeof parsed.lessonCatalog === 'object' ? parsed.lessonCatalog : {},
          siteConfig: parsed && parsed.siteConfig && typeof parsed.siteConfig === 'object' ? parsed.siteConfig : undefined
        };
      }
      var leg = localStorage.getItem(LEGACY_AUTH_KEY);
      if (leg) {
        var pLeg = JSON.parse(leg);
        var out = emptyStore();
        if (pLeg.users) {
          Object.entries(pLeg.users).forEach(function (entry) {
            var uid = entry[0], u = entry[1];
            if (u && u.profile && u.profile.email) {
              var pw = (u.salt && u.passwordHash && !String(u.passwordHash).startsWith('sha256$'))
                ? ('sha256$' + u.salt + '$' + u.passwordHash)
                : String(u.passwordHash || '');
              out.users[uid] = { profile: u.profile, passwordHash: pw };
            }
          });
        }
        if (Array.isArray(pLeg.requests)) {
          pLeg.requests.forEach(function (r) {
            if (r && r.requestId) out.requests[r.requestId] = r;
          });
        }
        if (pLeg.progress) out.progress = pLeg.progress;
        if (pLeg.lessonCatalog) out.lessonCatalog = pLeg.lessonCatalog;
        if (pLeg.siteConfig) out.siteConfig = pLeg.siteConfig;
        return out;
      }
    } catch (e) {}
    return store;
  }

  function writeOverlay(data) {
    try {
      localStorage.setItem(OVERLAY_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getStoredUid() {
    try {
      var v = localStorage.getItem(SESSION_UID_KEY);
      return v ? v.trim() : null;
    } catch (e) {
      return null;
    }
  }

  function setStoredUid(uid) {
    try {
      if (uid) localStorage.setItem(SESSION_UID_KEY, uid);
      else localStorage.removeItem(SESSION_UID_KEY);
    } catch (e) {}
  }

  function normalizePlanValue(val, allowNone) {
    var p = String(val || '').trim().toLowerCase();
    if (p === 'per_lesson' || p === 'lesson') return 'per_lesson';
    if (p === 'course' || p === 'hsk' || p === 'annual' || p === 'monthly') {
      // Preserve course or legacy active plans gracefully; UI uses 'course' and 'per_lesson'
      return (p === 'annual' || p === 'monthly') ? 'course' : 'course';
    }
    return allowNone ? 'none' : 'course';
  }

  function parseUsersWorkbook(wb, xlsxLib) {
    var out = emptyStore();
    var findSheet = function (name) {
      var found = wb.SheetNames.find(function (s) { return s.toLowerCase() === name.toLowerCase(); });
      return found ? wb.Sheets[found] : null;
    };

    var usersSheet = findSheet('Users') || (wb.SheetNames.length ? wb.Sheets[wb.SheetNames[0]] : null);
    if (usersSheet) {
      var rows = xlsxLib.utils.sheet_to_json(usersSheet, { defval: '' });
      rows.forEach(function (o) {
        var email = String(o.email || o.Email || '').trim().toLowerCase().slice(0, 160);
        if (!email) return;
        var uid = String(o.uid || o.UID || '').trim() || ('usr_' + email.replace(/[^a-z0-9]/g, '_'));
        var pwHash = String(o.password || o.Password || o.passwordHash || '').trim();
        var role = String(o.role || 'student').trim().toLowerCase() === 'admin' ? 'admin' : 'student';
        var st = String(o.membershipStatus || 'free').trim().toLowerCase();
        var status = (st === 'active' || st === 'pending' || st === 'expired') ? st : 'free';
        var rawPlan = String(o.membershipPlan || 'none').trim().toLowerCase();
        var plan = (rawPlan === 'per_lesson' || rawPlan === 'course')
          ? rawPlan
          : (rawPlan === 'monthly' || rawPlan === 'annual' ? 'course' : 'none');
        var subCourses = parseList(o.subscribedCourses || o.SubscribedCourses || '', normalizeCourseName);
        if ((rawPlan === 'monthly' || rawPlan === 'annual') && status === 'active' && subCourses.length === 0) {
          subCourses = ['HSK 2'];
        }
        out.users[uid] = {
          profile: {
            uid: uid,
            username: String(o.username || o.name || email.split('@')[0] || 'Learner').trim().slice(0, 60),
            email: email,
            phoneNumber: String(o.phoneNumber || o.phone || '').trim().slice(0, 32),
            dob: normalizeDate(o.dob),
            role: role,
            membershipStatus: status,
            membershipPlan: plan,
            membershipExpiresAt: normalizeDate(o.membershipExpiresAt),
            subscribedLessonIds: parseList(o.subscribedLessonIds),
            subscribedCourses: subCourses,
            linkedProviders: ['password'],
            mustChangePassword: parseBool(o.mustChangePassword, false),
            createdAt: String(o.createdAt || '').trim(),
            updatedAt: String(o.updatedAt || '').trim()
          },
          passwordHash: pwHash
        };
      });
    }

    var reqSheet = findSheet('Requests');
    if (reqSheet) {
      var reqRows = xlsxLib.utils.sheet_to_json(reqSheet, { defval: '' });
      reqRows.forEach(function (o) {
        var requestId = String(o.requestId || '').trim();
        var userId = String(o.userId || '').trim();
        if (!requestId || !userId) return;
        var pt = normalizePlanValue(o.planType || 'course', false);
        var st = String(o.status || 'pending').trim().toLowerCase();
        var status = (st === 'approved' || st === 'rejected') ? st : 'pending';
        out.requests[requestId] = {
          requestId: requestId,
          userId: userId,
          username: String(o.username || '').trim(),
          userEmail: String(o.userEmail || '').trim().toLowerCase(),
          userPhone: String(o.userPhone || '').trim(),
          planType: pt,
          lessonId: String(o.lessonId || '').trim(),
          courseName: o.courseName ? normalizeCourseName(o.courseName) : '',
          lessonTitle: String(o.lessonTitle || '').trim(),
          amountLabel: String(o.amountLabel || '').trim(),
          contactChannel: String(o.contactChannel || '').trim().toLowerCase() === 'email' ? 'email' : 'viber',
          contactHandle: String(o.contactHandle || '').trim(),
          note: String(o.note || '').trim(),
          status: status,
          adminNote: String(o.adminNote || '').trim(),
          createdAt: String(o.createdAt || '').trim(),
          updatedAt: String(o.updatedAt || '').trim()
        };
      });
    }

    var progSheet = findSheet('Progress');
    if (progSheet) {
      var pRows = xlsxLib.utils.sheet_to_json(progSheet, { defval: '' });
      pRows.forEach(function (o) {
        var uid = String(o.uid || '').trim();
        if (!uid) return;
        out.progress[uid] = {
          uid: uid,
          currentStreak: Number(o.currentStreak) || 0,
          bestStreak: Number(o.bestStreak) || 0,
          lastCompletedDate: normalizeDate(o.lastCompletedDate),
          streakDates: parseList(o.streakDates),
          completedLessonIds: parseList(o.completedLessonIds),
          reminderEnabled: parseBool(o.reminderEnabled, true),
          reminderTime: sanitizeTime(String(o.reminderTime || '18:00')),
          lastNotifiedDate: normalizeDate(o.lastNotifiedDate),
          updatedAt: String(o.updatedAt || '').trim()
        };
      });
    }

    var catSheet = findSheet('Catalog');
    if (catSheet) {
      var cRows = xlsxLib.utils.sheet_to_json(catSheet, { defval: '' });
      cRows.forEach(function (o) {
        if (!o.lessonId) return;
        var lid = cleanId(String(o.lessonId));
        out.lessonCatalog[lid] = {
          lessonId: lid,
          title: String(o.title || lid).trim(),
          course: normalizeCourseName(o.course || o.audience || 'HSK 2'),
          accessType: String(o.accessType || '').trim().toLowerCase() === 'paid' ? 'paid' : 'free',
          price: Math.max(0, Number(o.price) || 0),
          updatedBy: String(o.updatedBy || '').trim(),
          updatedAt: String(o.updatedAt || '').trim()
        };
      });
    }

    return out;
  }

  async function loadBaseUsersWorkbook(force) {
    if (baseWorkbookData.loaded && !force) return;
    try {
      var xlsxLib = await ensureXLSX();
      if (!xlsxLib) {
        baseWorkbookData.lastError = 'Excel reader (SheetJS) failed to load.';
        return;
      }
      var res = await fetch(USERS_XLSX_PATH + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) {
        baseWorkbookData.lastError = 'Could not load ' + USERS_XLSX_PATH + ' (HTTP ' + res.status + ').';
        return;
      }
      var buf = await res.arrayBuffer();
      var wb = xlsxLib.read(buf, { type: 'array' });
      var parsed = parseUsersWorkbook(wb, xlsxLib);
      baseWorkbookData.users = parsed.users;
      baseWorkbookData.requests = parsed.requests;
      baseWorkbookData.progress = parsed.progress;
      baseWorkbookData.lessonCatalog = parsed.lessonCatalog;
      baseWorkbookData.loaded = true;
      baseWorkbookData.lastLoadedAt = new Date().toISOString();
      baseWorkbookData.lastError = '';
    } catch (err) {
      baseWorkbookData.lastError = err instanceof Error ? err.message : 'Failed to parse users.xlsx.';
    }
  }

  function mergeStore() {
    var overlay = readOverlay();
    var merged = emptyStore();

    Object.entries(baseWorkbookData.users).forEach(function (entry) {
      var uid = entry[0], rec = entry[1];
      merged.users[uid] = {
        profile: Object.assign({}, rec.profile),
        passwordHash: rec.passwordHash
      };
    });

    Object.entries(overlay.users).forEach(function (entry) {
      var uid = entry[0], rec = entry[1];
      if (!rec || !rec.profile || !rec.profile.email) return;
      var byUid = merged.users[uid];
      var byEmailKey = Object.keys(merged.users).find(function (k) {
        return merged.users[k].profile.email.toLowerCase() === rec.profile.email.toLowerCase();
      });
      var targetKey = byUid ? uid : (byEmailKey || uid);
      var existing = merged.users[targetKey];
      var normalizedProfile = Object.assign({ subscribedCourses: [], subscribedLessonIds: [] }, rec.profile);
      normalizedProfile.subscribedCourses = parseList(normalizedProfile.subscribedCourses || [], normalizeCourseName);
      normalizedProfile.subscribedLessonIds = parseList(normalizedProfile.subscribedLessonIds || []);
      if (!existing) {
        merged.users[targetKey] = { profile: normalizedProfile, passwordHash: rec.passwordHash };
      } else {
        var oTs = tsMs(rec.profile.updatedAt);
        var bTs = tsMs(existing.profile.updatedAt);
        if (oTs >= bTs) {
          merged.users[targetKey] = { profile: normalizedProfile, passwordHash: rec.passwordHash };
        }
      }
    });

    Object.entries(baseWorkbookData.requests).forEach(function (e) { merged.requests[e[0]] = Object.assign({}, e[1]); });
    Object.entries(overlay.requests).forEach(function (e) {
      var cur = merged.requests[e[0]];
      if (!cur || tsMs(e[1].updatedAt) >= tsMs(cur.updatedAt)) {
        merged.requests[e[0]] = Object.assign({}, e[1]);
      }
    });

    Object.entries(baseWorkbookData.progress).forEach(function (e) { merged.progress[e[0]] = Object.assign({}, e[1]); });
    Object.entries(overlay.progress).forEach(function (e) {
      var cur = merged.progress[e[0]];
      if (!cur || tsMs(e[1].updatedAt) >= tsMs(cur.updatedAt)) {
        merged.progress[e[0]] = Object.assign({}, e[1]);
      }
    });

    Object.entries(baseWorkbookData.lessonCatalog).forEach(function (e) { merged.lessonCatalog[e[0]] = Object.assign({}, e[1]); });
    Object.entries(overlay.lessonCatalog).forEach(function (e) {
      var cur = merged.lessonCatalog[e[0]];
      if (!cur || tsMs(e[1].updatedAt) >= tsMs(cur.updatedAt)) {
        merged.lessonCatalog[e[0]] = Object.assign({}, e[1]);
      }
    });

    merged.siteConfig = overlay.siteConfig;
    return merged;
  }

  function getExcelSyncSummary() {
    var overlay = readOverlay();
    var merged = mergeStore();
    var baseCount = Object.keys(baseWorkbookData.users).length;
    var delta = 0;
    Object.entries(overlay.users).forEach(function (entry) {
      var uid = entry[0], rec = entry[1];
      var baseRec = baseWorkbookData.users[uid] || Object.values(baseWorkbookData.users).find(function (b) {
        return b.profile.email.toLowerCase() === rec.profile.email.toLowerCase();
      });
      if (!baseRec || tsMs(rec.profile.updatedAt) > tsMs(baseRec.profile.updatedAt)) delta++;
    });
    return {
      baseUsersCount: baseCount,
      overlayDeltaCount: delta,
      totalMergedUsers: Object.keys(merged.users).length,
      workbookLoaded: baseWorkbookData.loaded,
      lastLoadedAt: baseWorkbookData.lastLoadedAt
    };
  }

  function isAdminClaimed(store) {
    return Object.values(store.users).some(function (rec) {
      return rec && rec.profile && (
        rec.profile.role === 'admin' ||
        String(rec.profile.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL
      );
    });
  }

  function sortedRequests(store) {
    return Object.values(store.requests).sort(function (a, b) {
      return tsMs(b.createdAt) - tsMs(a.createdAt);
    });
  }

  function buildSessionPayload(store, uid) {
    var rec = store.users[uid];
    if (!rec || !rec.profile) return null;
    var profile = Object.assign({ subscribedLessonIds: [], subscribedCourses: [] }, rec.profile);
    var admin = profile.role === 'admin';
    var reqs = sortedRequests(store);
    return {
      user: {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.username,
        role: profile.role,
        mustChangePassword: Boolean(profile.mustChangePassword)
      },
      profile: profile,
      userProgress: store.progress[uid] || defaultProgress(uid),
      myRequests: reqs.filter(function (r) { return r.userId === uid; }),
      lessonCatalog: store.lessonCatalog || {},
      adminClaimed: isAdminClaimed(store),
      allUsers: admin ? Object.values(store.users).map(function (u) { return Object.assign({}, u.profile); }) : [],
      allRequests: admin ? reqs : []
    };
  }

  var state = {
    ready: false,
    user: null,
    profile: null,
    userProgress: null,
    isAdmin: false,
    adminClaimed: false,
    excelSummary: { baseUsersCount: 0, overlayDeltaCount: 0, totalMergedUsers: 0, workbookLoaded: false, lastLoadedAt: '' },
    myRequests: [],
    allRequests: [],
    allUsers: [],
    lessonCatalog: {},
    siteConfig: Object.assign({}, DEFAULT_SITE_CONFIG),
    lastError: null
  };

  var listeners = new Set();

  function isAdminUser() {
    return (state.user && state.user.role === 'admin') || (state.profile && state.profile.role === 'admin');
  }

  function notify() {
    state.excelSummary = getExcelSyncSummary();
    var snapshot = Object.assign({}, state, { isAdmin: isAdminUser() });
    listeners.forEach(function (fn) {
      try { fn(snapshot); } catch (err) { console.error('LinguaAuth subscriber error:', err); }
    });
    if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('lingua-auth-change', { detail: snapshot }));
    }
  }

  function notifySiteConfig() {
    if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('lingua-site-config-change', { detail: state.siteConfig }));
    }
  }

  function cleanStringArray(arr, maxItems, maxLen, fallback) {
    if (!Array.isArray(arr)) return fallback.slice();
    return arr.map(function (item) { return String(item || '').trim().slice(0, maxLen); })
      .filter(Boolean)
      .slice(0, maxItems);
  }

  function normalizeCoursePrices(raw) {
    var prices = {};
    Object.entries(DEFAULT_SITE_CONFIG.coursePrices).forEach(function (entry) {
      prices[entry[0]] = entry[1];
    });
    if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(function (entry) {
        var name = normalizeCourseName(entry[0]);
        var num = Number(entry[1]);
        if (name && Number.isFinite(num) && num >= 0) {
          prices[name] = Math.round(num);
        }
      });
    }
    return prices;
  }

  function normalizeSiteConfig(raw) {
    var pick = function (val, maxLen, fb) {
      return typeof val !== 'string' ? fb : ((val.trim() || fb).slice(0, maxLen));
    };
    var pickOpt = function (val, maxLen, fb) {
      return typeof val !== 'string' ? fb : val.trim().slice(0, maxLen);
    };
    return {
      configId: 'homepage',
      heroEyebrow: pick(raw && raw.heroEyebrow, 100, DEFAULT_SITE_CONFIG.heroEyebrow),
      heroTitleLine1: pick(raw && raw.heroTitleLine1, 120, DEFAULT_SITE_CONFIG.heroTitleLine1),
      heroTitleHighlight: pick(raw && raw.heroTitleHighlight, 120, DEFAULT_SITE_CONFIG.heroTitleHighlight),
      heroSubtitle: pick(raw && raw.heroSubtitle, 400, DEFAULT_SITE_CONFIG.heroSubtitle),
      heroPrimaryCta: pick(raw && raw.heroPrimaryCta, 60, DEFAULT_SITE_CONFIG.heroPrimaryCta),
      heroSecondaryCta: pick(raw && raw.heroSecondaryCta, 60, DEFAULT_SITE_CONFIG.heroSecondaryCta),
      heroBannerUrl: pickOpt(raw && raw.heroBannerUrl, 500, DEFAULT_SITE_CONFIG.heroBannerUrl) || DEFAULT_SITE_CONFIG.heroBannerUrl,
      storiesLabel: pick(raw && raw.storiesLabel, 100, DEFAULT_SITE_CONFIG.storiesLabel),
      storiesTitle: pick(raw && raw.storiesTitle, 120, DEFAULT_SITE_CONFIG.storiesTitle),
      storiesSubtitle: pick(raw && raw.storiesSubtitle, 400, DEFAULT_SITE_CONFIG.storiesSubtitle),
      reelsLabel: pick(raw && raw.reelsLabel, 100, DEFAULT_SITE_CONFIG.reelsLabel),
      reelsTitle: pick(raw && raw.reelsTitle, 120, DEFAULT_SITE_CONFIG.reelsTitle),
      reelsSubtitle: pick(raw && raw.reelsSubtitle, 400, DEFAULT_SITE_CONFIG.reelsSubtitle),
      gamesLabel: pick(raw && raw.gamesLabel, 100, DEFAULT_SITE_CONFIG.gamesLabel),
      gamesTitle: pick(raw && raw.gamesTitle, 120, DEFAULT_SITE_CONFIG.gamesTitle),
      gamesSubtitle: pick(raw && raw.gamesSubtitle, 400, DEFAULT_SITE_CONFIG.gamesSubtitle),
      lessonsLabel: pick(raw && raw.lessonsLabel, 100, DEFAULT_SITE_CONFIG.lessonsLabel),
      lessonsTitle: pick(raw && raw.lessonsTitle, 120, DEFAULT_SITE_CONFIG.lessonsTitle),
      lessonsSubtitle: pick(raw && raw.lessonsSubtitle, 400, DEFAULT_SITE_CONFIG.lessonsSubtitle),
      lessonsBadge: pick(raw && raw.lessonsBadge, 80, DEFAULT_SITE_CONFIG.lessonsBadge),
      lessonsCardTitle: pick(raw && raw.lessonsCardTitle, 140, DEFAULT_SITE_CONFIG.lessonsCardTitle),
      lessonsCardSubtitle: pick(raw && raw.lessonsCardSubtitle, 140, DEFAULT_SITE_CONFIG.lessonsCardSubtitle),
      lessonsCardDesc: pick(raw && raw.lessonsCardDesc, 400, DEFAULT_SITE_CONFIG.lessonsCardDesc),
      lessonsBullets: cleanStringArray(raw && raw.lessonsBullets, 6, 140, DEFAULT_SITE_CONFIG.lessonsBullets),
      lessonsCta: pick(raw && raw.lessonsCta, 80, DEFAULT_SITE_CONFIG.lessonsCta),
      coursePrices: normalizeCoursePrices(raw && raw.coursePrices),
      contactEmail: pick(raw && raw.contactEmail, 160, DEFAULT_SITE_CONFIG.contactEmail),
      contactPhone: pick(raw && raw.contactPhone, 40, DEFAULT_SITE_CONFIG.contactPhone),
      contactViber: pick(raw && raw.contactViber, 40, DEFAULT_SITE_CONFIG.contactViber),
      featuredReelIds: Array.isArray(raw && raw.featuredReelIds) ? cleanStringArray(raw.featuredReelIds, 12, 128, []) : DEFAULT_SITE_CONFIG.featuredReelIds.slice(),
      featuredStoryIds: Array.isArray(raw && raw.featuredStoryIds) ? cleanStringArray(raw.featuredStoryIds, 12, 128, []) : DEFAULT_SITE_CONFIG.featuredStoryIds.slice(),
      featuredGameIds: Array.isArray(raw && raw.featuredGameIds) ? cleanStringArray(raw.featuredGameIds, 12, 128, []) : DEFAULT_SITE_CONFIG.featuredGameIds.slice(),
      updatedBy: raw && raw.updatedBy,
      updatedAt: raw && raw.updatedAt
    };
  }

  function applySessionPayload(payload) {
    if (payload.user && typeof payload.user === 'object') state.user = payload.user;
    if (payload.profile && typeof payload.profile === 'object') state.profile = payload.profile;
    if (payload.userProgress && typeof payload.userProgress === 'object') {
      state.userProgress = normalizeProgress(payload.userProgress, (state.user && state.user.uid) || '');
    } else if (state.user) {
      state.userProgress = defaultProgress(state.user.uid);
    }
    if (Array.isArray(payload.myRequests)) state.myRequests = payload.myRequests;
    if (payload.lessonCatalog && typeof payload.lessonCatalog === 'object') state.lessonCatalog = payload.lessonCatalog;
    if (typeof payload.adminClaimed === 'boolean') state.adminClaimed = payload.adminClaimed;
    if ((state.user && state.user.role === 'admin') || (state.profile && state.profile.role === 'admin')) {
      if (Array.isArray(payload.allRequests)) state.allRequests = payload.allRequests;
      if (Array.isArray(payload.allUsers)) state.allUsers = payload.allUsers;
    } else {
      state.allRequests = [];
      state.allUsers = [];
    }
    state.isAdmin = isAdminUser();
    state.lastError = null;
  }

  function clearSession() {
    setStoredUid(null);
    state.user = null;
    state.profile = null;
    state.userProgress = null;
    state.isAdmin = false;
    state.myRequests = [];
    state.allRequests = [];
    state.allUsers = [];
  }

  function hydrateSession(store, uidOverride) {
    state.lessonCatalog = store.lessonCatalog || {};
    state.adminClaimed = isAdminClaimed(store);
    var uid = uidOverride !== undefined ? uidOverride : getStoredUid();
    if (uid) {
      var payload = buildSessionPayload(store, uid);
      if (payload) {
        applySessionPayload(payload);
        return;
      }
    }
    clearSession();
  }

  async function initAuth(force) {
    var fetchedConfig = {};
    try {
      var r = await fetch('data/site-config.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) fetchedConfig = await r.json();
    } catch (e) {}
    await loadBaseUsersWorkbook(Boolean(force));
    var store = mergeStore();
    state.siteConfig = normalizeSiteConfig(store.siteConfig ? Object.assign({}, fetchedConfig, store.siteConfig) : fetchedConfig);
    notifySiteConfig();
    hydrateSession(store);
    state.ready = true;
    notify();
  }
  initAuth(false);

  async function registerWithEmail(opts) {
    var username = String(opts.username || '').trim().slice(0, 60);
    var email = String(opts.email || '').trim().toLowerCase().slice(0, 160);
    var phoneNumber = String(opts.phoneNumber || '').trim().slice(0, 32);
    var dob = normalizeDate(opts.dob);
    var password = String(opts.password || '');
    if (!username || !email) throw new Error('User Name and Email Address are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters long.');

    await loadBaseUsersWorkbook(false);
    var store = mergeStore();
    var dup = Object.values(store.users).find(function (u) { return u.profile.email.toLowerCase() === email; });
    if (dup) throw new Error('An account with this email address already exists. Please sign in instead.');

    var uid = 'usr_' + Date.now().toString(36) + '_' + randomHex(4);
    var nowIso = new Date().toISOString();
    var claimAdmin = email === PRIMARY_ADMIN_EMAIL && !isAdminClaimed(store);
    var pwHash = await hashPassword(password);
    var profile = {
      uid: uid,
      username: username,
      email: email,
      phoneNumber: phoneNumber,
      dob: dob,
      role: claimAdmin ? 'admin' : 'student',
      membershipStatus: claimAdmin ? 'active' : 'free',
      membershipPlan: claimAdmin ? 'course' : 'none',
      membershipExpiresAt: '',
      subscribedLessonIds: [],
      subscribedCourses: claimAdmin ? ['HSK 2'] : [],
      linkedProviders: ['password'],
      mustChangePassword: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    var overlay = readOverlay();
    overlay.users[uid] = { profile: profile, passwordHash: pwHash };
    overlay.progress[uid] = defaultProgress(uid);
    writeOverlay(overlay);
    setStoredUid(uid);
    hydrateSession(mergeStore(), uid);
    state.ready = true;
    notify();
    return state.profile;
  }

  async function loginWithEmail(email, password) {
    var e = String(email || '').trim().toLowerCase();
    var p = String(password || '');
    if (!e || !p) throw new Error('Please enter both your email and password.');
    await loadBaseUsersWorkbook(true);
    var store = mergeStore();
    var found = Object.values(store.users).find(function (u) { return u.profile.email.toLowerCase() === e; });
    if (!found) {
      if (!baseWorkbookData.loaded && baseWorkbookData.lastError) throw new Error(baseWorkbookData.lastError);
      throw new Error('No account found in users.xlsx for ' + e + '. Click Register to create one.');
    }
    var ok = await verifyPassword(p, found.passwordHash);
    if (!ok) throw new Error('Incorrect email or password.');
    var uid = found.profile.uid;
    setStoredUid(uid);
    hydrateSession(store, uid);
    state.ready = true;
    notify();
    return state.user;
  }

  async function resetPasswordWithVerification(opts) {
    var email = String(opts.email || '').trim().toLowerCase();
    var dob = normalizeDate(opts.dob);
    var phoneClean = cleanPhone(opts.phoneNumber);
    var newPw = String(opts.newPassword || '');
    if (!email || !dob || !phoneClean) throw new Error('Please enter your Email, Date of Birth, and Phone / Viber Number to verify your identity.');
    if (newPw.length < 6) throw new Error('New password must be at least 6 characters long.');

    await loadBaseUsersWorkbook(false);
    var store = mergeStore();
    var found = Object.values(store.users).find(function (u) { return u.profile.email.toLowerCase() === email; });
    if (!found) throw new Error('No account found for ' + email + '.');

    var storedDob = normalizeDate(found.profile.dob);
    var storedPhone = cleanPhone(found.profile.phoneNumber);
    if (!storedDob || !storedPhone) {
      throw new Error('This account cannot be self-reset without both Date of Birth and Phone saved. Ask the site Admin to reset your password in Admin Portal or users.xlsx.');
    }
    if (storedDob !== dob || !phonesMatch(found.profile.phoneNumber, opts.phoneNumber)) {
      throw new Error('Verification details did not match our records. Check your Date of Birth and Phone Number.');
    }

    var pwHash = await hashPassword(newPw);
    var nowIso = new Date().toISOString();
    var overlay = readOverlay();
    overlay.users[found.profile.uid] = {
      profile: Object.assign({}, found.profile, { mustChangePassword: false, updatedAt: nowIso }),
      passwordHash: pwHash
    };
    writeOverlay(overlay);
    notify();
    return 'Password reset successfully! Sign in now with your new password.';
  }

  async function sendPasswordReset(email) {
    return resetPasswordWithVerification({ email: email, dob: '', phoneNumber: '', newPassword: '' });
  }

  async function changePassword(currentPw, newPw) {
    if (!state.user) throw new Error('Please sign in first.');
    if (!currentPw || !newPw || newPw.length < 6) {
      throw new Error('Enter your current password and a new password (min. 6 characters).');
    }
    var rec = mergeStore().users[state.user.uid];
    if (!rec) throw new Error('Account record not found.');
    var ok = await verifyPassword(currentPw, rec.passwordHash);
    if (!ok) throw new Error('Current password is incorrect.');
    var pwHash = await hashPassword(newPw);
    var updated = Object.assign({}, rec.profile, { mustChangePassword: false, updatedAt: new Date().toISOString() });
    var overlay = readOverlay();
    overlay.users[state.user.uid] = { profile: updated, passwordHash: pwHash };
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
    return state.profile;
  }

  async function reloadAuthSession() {
    await initAuth(true);
    return getState();
  }

  async function logout() {
    clearSession();
    state.ready = true;
    notify();
    try {
      if (typeof window !== 'undefined' && window.location) {
        var p = window.location.pathname || '';
        if (!p.endsWith('index.html') && p !== '/' && p !== '') {
          window.location.href = 'index.html';
        }
      }
    } catch (e) {}
  }

  async function adminUpdateUserDetails(uid, updates) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var rec = mergeStore().users[uid];
    if (!rec) throw new Error('User not found.');
    var updated = Object.assign({}, rec.profile, {
      username: updates.username !== undefined ? String(updates.username).trim().slice(0, 60) : rec.profile.username,
      email: updates.email !== undefined ? String(updates.email).trim().toLowerCase().slice(0, 160) : rec.profile.email,
      phoneNumber: updates.phoneNumber !== undefined ? String(updates.phoneNumber).trim().slice(0, 32) : rec.profile.phoneNumber,
      dob: updates.dob !== undefined ? normalizeDate(updates.dob) : rec.profile.dob,
      role: (updates.role === 'admin' || updates.role === 'student') ? updates.role : rec.profile.role,
      membershipStatus: updates.membershipStatus !== undefined ? updates.membershipStatus : rec.profile.membershipStatus,
      membershipPlan: updates.membershipPlan !== undefined ? normalizePlanValue(updates.membershipPlan, true) : rec.profile.membershipPlan,
      membershipExpiresAt: updates.membershipExpiresAt !== undefined ? normalizeDate(updates.membershipExpiresAt) : rec.profile.membershipExpiresAt,
      updatedAt: new Date().toISOString()
    });
    var overlay = readOverlay();
    overlay.users[uid] = { profile: updated, passwordHash: rec.passwordHash };
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
  }

  async function updateProfileDetails(updates) {
    if (!state.user) throw new Error('Please sign in first.');
    var username = String(updates.username || '').trim().slice(0, 60);
    var phoneNumber = String(updates.phoneNumber || '').trim().slice(0, 32);
    var dob = normalizeDate(updates.dob);
    if (!username) throw new Error('User Name cannot be empty.');
    var rec = mergeStore().users[state.user.uid];
    if (!rec) throw new Error('Account record not found.');
    var overlay = readOverlay();
    overlay.users[state.user.uid] = {
      profile: Object.assign({}, rec.profile, {
        username: username,
        phoneNumber: phoneNumber,
        dob: dob,
        updatedAt: new Date().toISOString()
      }),
      passwordHash: rec.passwordHash
    };
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
  }

  async function submitSubscriptionRequest(opts) {
    if (!state.user || !state.profile) throw new Error('Please sign in first.');
    var nowIso = new Date().toISOString();
    var planType = opts.planType === 'per_lesson' ? 'per_lesson' : 'course';
    var courseName = opts.courseName ? normalizeCourseName(opts.courseName) : (opts.lessonTitle ? normalizeCourseName(opts.lessonTitle) : 'HSK 2');
    var defaultAmt = planType === 'per_lesson' ? '9 Kyat' : (getCoursePrice(courseName) + ' Kyat');
    var req = {
      requestId: 'req_' + Date.now().toString(36) + '_' + randomHex(3),
      userId: state.user.uid,
      username: state.profile.username || state.user.displayName || 'Learner',
      userEmail: state.profile.email || state.user.email,
      userPhone: state.profile.phoneNumber || '',
      planType: planType,
      lessonId: (planType === 'per_lesson' && opts.lessonId) ? cleanId(opts.lessonId) : '',
      courseName: planType === 'course' ? courseName : '',
      lessonTitle: String(opts.lessonTitle || '').trim() || (planType === 'course' ? (courseName + ' Full Course') : 'Lesson Pass'),
      amountLabel: String(opts.amountLabel || '').trim() || defaultAmt,
      contactChannel: opts.contactChannel === 'email' ? 'email' : 'viber',
      contactHandle: String(opts.contactHandle || '').trim(),
      note: String(opts.note || '').trim().slice(0, 400),
      status: 'pending',
      adminNote: '',
      createdAt: nowIso,
      updatedAt: nowIso
    };
    var overlay = readOverlay();
    overlay.requests[req.requestId] = req;
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
    return req;
  }

  async function cancelPendingRequest(requestId) {
    if (!state.user) throw new Error('Please sign in first.');
    var req = mergeStore().requests[requestId];
    if (!req || req.userId !== state.user.uid || req.status !== 'pending') return;
    var overlay = readOverlay();
    overlay.requests[requestId] = Object.assign({}, req, {
      status: 'rejected',
      adminNote: 'Cancelled by learner',
      updatedAt: new Date().toISOString()
    });
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
  }

  async function approveSubscriptionRequest(reqDoc, adminNote) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var note = adminNote === undefined ? 'Verified via QR payment' : adminNote;
    var store = mergeStore();
    var req = store.requests[reqDoc.requestId];
    if (!req) throw new Error('Subscription request not found.');
    var nowIso = new Date().toISOString();
    var overlay = readOverlay();
    overlay.requests[reqDoc.requestId] = Object.assign({}, req, {
      status: 'approved',
      adminNote: note,
      updatedAt: nowIso
    });
    var userRec = store.users[req.userId];
    if (userRec) {
      var nextProfile = Object.assign({}, userRec.profile, {
        membershipStatus: 'active',
        membershipPlan: req.planType === 'per_lesson' ? 'per_lesson' : 'course',
        updatedAt: nowIso
      });
      if (req.planType === 'per_lesson' && req.lessonId) {
        var lessonSet = new Set(nextProfile.subscribedLessonIds || []);
        lessonSet.add(cleanId(req.lessonId));
        nextProfile.subscribedLessonIds = Array.from(lessonSet);
      } else {
        var cName = normalizeCourseName(req.courseName || req.lessonTitle || 'HSK 2');
        var courseSet = new Set((nextProfile.subscribedCourses || []).map(normalizeCourseName));
        courseSet.add(cName);
        nextProfile.subscribedCourses = Array.from(courseSet);
      }
      overlay.users[req.userId] = { profile: nextProfile, passwordHash: userRec.passwordHash };
    }
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
  }

  async function rejectSubscriptionRequest(requestId, adminNote) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var req = mergeStore().requests[requestId];
    if (req) {
      var overlay = readOverlay();
      overlay.requests[requestId] = Object.assign({}, req, {
        status: 'rejected',
        adminNote: adminNote || 'Payment could not be verified',
        updatedAt: new Date().toISOString()
      });
      writeOverlay(overlay);
    }
    hydrateSession(mergeStore(), state.user.uid);
    notify();
  }

  async function updateUserMembershipAdmin(uid, updates) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var rec = mergeStore().users[uid];
    if (!rec) throw new Error('User not found.');
    var nextProfile = Object.assign({}, rec.profile, {
      membershipStatus: updates.membershipStatus || rec.profile.membershipStatus,
      membershipPlan: updates.membershipPlan !== undefined ? normalizePlanValue(updates.membershipPlan, true) : rec.profile.membershipPlan,
      membershipExpiresAt: updates.membershipExpiresAt !== undefined ? normalizeDate(updates.membershipExpiresAt) : rec.profile.membershipExpiresAt,
      subscribedLessonIds: Array.isArray(updates.subscribedLessonIds)
        ? updates.subscribedLessonIds.map(cleanId)
        : (rec.profile.subscribedLessonIds || []),
      subscribedCourses: Array.isArray(updates.subscribedCourses)
        ? parseList(updates.subscribedCourses, normalizeCourseName)
        : (rec.profile.subscribedCourses || []),
      updatedAt: new Date().toISOString()
    });
    var overlay = readOverlay();
    overlay.users[uid] = { profile: nextProfile, passwordHash: rec.passwordHash };
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
  }

  function generateTempPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    var out = '';
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var bytes = new Uint8Array(12);
        window.crypto.getRandomValues(bytes);
        for (var i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
        return out;
      }
    } catch (e) {}
    for (var j = 0; j < 12; j++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  async function adminResetUserPassword(uid, opts) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var rec = mergeStore().users[uid];
    if (!rec) throw new Error('User not found.');
    var tmp = (opts && opts.newPassword && opts.newPassword.trim()) || generateTempPassword();
    if (tmp.length < 6) throw new Error('Password must be at least 6 characters.');
    var pwHash = await hashPassword(tmp);
    var nextProfile = Object.assign({}, rec.profile, {
      mustChangePassword: true,
      updatedAt: new Date().toISOString()
    });
    var overlay = readOverlay();
    overlay.users[uid] = { profile: nextProfile, passwordHash: pwHash };
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
    return { temporaryPassword: tmp, user: nextProfile };
  }

  async function saveLessonCatalogItems(items) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var overlay = readOverlay();
    var nowIso = new Date().toISOString();
    (items || []).forEach(function (item) {
      var lid = cleanId(item.lessonId);
      overlay.lessonCatalog[lid] = {
        lessonId: lid,
        title: String(item.title || lid).trim(),
        course: normalizeCourseName(item.course || item.audience || 'HSK 2'),
        accessType: item.accessType === 'paid' ? 'paid' : 'free',
        price: Math.max(0, Number(item.price) || 0),
        updatedBy: state.user.email,
        updatedAt: nowIso
      };
    });
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
  }

  async function getIdToken() {
    return state.user ? state.user.uid : null;
  }

  function getSiteConfig() {
    return normalizeSiteConfig(state.siteConfig);
  }

  function getCoursePrice(courseName) {
    var cname = normalizeCourseName(courseName);
    var cfg = getSiteConfig();
    if (cfg.coursePrices && cfg.coursePrices[cname] !== undefined) {
      return Number(cfg.coursePrices[cname]) || 0;
    }
    var matchKey = courseKey(cname);
    if (cfg.coursePrices) {
      var entry = Object.entries(cfg.coursePrices).find(function (e) { return courseKey(e[0]) === matchKey; });
      if (entry) return Number(entry[1]) || 0;
    }
    return 120;
  }

  async function saveSiteConfig(partial) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var normalized = normalizeSiteConfig(Object.assign({}, state.siteConfig, partial || {}));
    var overlay = readOverlay();
    overlay.siteConfig = Object.assign({}, normalized, {
      updatedBy: state.user.email,
      updatedAt: new Date().toISOString()
    });
    writeOverlay(overlay);
    state.siteConfig = normalizeSiteConfig(overlay.siteConfig);
    notifySiteConfig();
    notify();
    return state.siteConfig;
  }

  function exportSiteConfigJson() {
    var cfg = getSiteConfig();
    var blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'site-config.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(url);
    }, 150);
  }

  async function exportUsersWorkbook() {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var xlsxLib = await ensureXLSX();
    if (!xlsxLib) throw new Error('SheetJS library is not loaded.');
    var store = mergeStore();
    var userRows = Object.values(store.users).map(function (rec) {
      var a = rec.profile;
      return {
        uid: a.uid,
        username: a.username || '',
        email: a.email || '',
        phoneNumber: a.phoneNumber || '',
        dob: a.dob || '',
        passwordHash: rec.passwordHash || '',
        role: a.role || 'student',
        membershipStatus: a.membershipStatus || 'free',
        membershipPlan: a.membershipPlan || 'none',
        membershipExpiresAt: a.membershipExpiresAt || '',
        subscribedLessonIds: (a.subscribedLessonIds || []).join(','),
        subscribedCourses: (a.subscribedCourses || []).join(','),
        mustChangePassword: a.mustChangePassword ? 'true' : 'false',
        createdAt: String(a.createdAt || ''),
        updatedAt: String(a.updatedAt || '')
      };
    });
    var reqRows = sortedRequests(store).map(function (a) {
      return {
        requestId: a.requestId,
        userId: a.userId,
        username: a.username,
        userEmail: a.userEmail,
        userPhone: a.userPhone,
        planType: a.planType,
        lessonId: a.lessonId,
        courseName: a.courseName || '',
        lessonTitle: a.lessonTitle,
        amountLabel: a.amountLabel,
        contactChannel: a.contactChannel,
        contactHandle: a.contactHandle,
        note: a.note,
        status: a.status,
        adminNote: a.adminNote,
        createdAt: String(a.createdAt || ''),
        updatedAt: String(a.updatedAt || '')
      };
    });
    var progRows = Object.values(store.progress).map(function (a) {
      return {
        uid: a.uid,
        currentStreak: a.currentStreak || 0,
        bestStreak: a.bestStreak || 0,
        lastCompletedDate: a.lastCompletedDate || '',
        streakDates: (a.streakDates || []).join(','),
        completedLessonIds: (a.completedLessonIds || []).join(','),
        reminderEnabled: a.reminderEnabled !== false ? 'true' : 'false',
        reminderTime: a.reminderTime || '18:00',
        lastNotifiedDate: a.lastNotifiedDate || '',
        updatedAt: String(a.updatedAt || '')
      };
    });
    var catRows = Object.values(store.lessonCatalog).map(function (a) {
      return {
        lessonId: a.lessonId,
        title: a.title,
        course: a.course || 'HSK 1',
        accessType: a.accessType,
        price: Number(a.price) || 0,
        updatedBy: a.updatedBy || '',
        updatedAt: String(a.updatedAt || '')
      };
    });

    var wb = xlsxLib.utils.book_new();
    xlsxLib.utils.book_append_sheet(
      wb,
      userRows.length ? xlsxLib.utils.json_to_sheet(userRows) : xlsxLib.utils.aoa_to_sheet([['uid', 'username', 'email', 'phoneNumber', 'dob', 'passwordHash', 'role', 'membershipStatus', 'membershipPlan', 'membershipExpiresAt', 'subscribedLessonIds', 'subscribedCourses', 'mustChangePassword', 'createdAt', 'updatedAt']]),
      'Users'
    );
    xlsxLib.utils.book_append_sheet(
      wb,
      reqRows.length ? xlsxLib.utils.json_to_sheet(reqRows) : xlsxLib.utils.aoa_to_sheet([['requestId', 'userId', 'username', 'userEmail', 'userPhone', 'planType', 'lessonId', 'courseName', 'lessonTitle', 'amountLabel', 'contactChannel', 'contactHandle', 'note', 'status', 'adminNote', 'createdAt', 'updatedAt']]),
      'Requests'
    );
    xlsxLib.utils.book_append_sheet(
      wb,
      progRows.length ? xlsxLib.utils.json_to_sheet(progRows) : xlsxLib.utils.aoa_to_sheet([['uid', 'currentStreak', 'bestStreak', 'lastCompletedDate', 'streakDates', 'completedLessonIds', 'reminderEnabled', 'reminderTime', 'lastNotifiedDate', 'updatedAt']]),
      'Progress'
    );
    xlsxLib.utils.book_append_sheet(
      wb,
      catRows.length ? xlsxLib.utils.json_to_sheet(catRows) : xlsxLib.utils.aoa_to_sheet([['lessonId', 'title', 'course', 'accessType', 'price', 'updatedBy', 'updatedAt']]),
      'Catalog'
    );
    xlsxLib.writeFile(wb, 'users.xlsx');
    return { fileName: 'users.xlsx', userCount: userRows.length, requestCount: reqRows.length, progressCount: progRows.length, catalogCount: catRows.length };
  }

  async function importUsersWorkbook(arrayBuffer) {
    if (!state.user || !isAdminUser()) throw new Error('Administrator access required.');
    var xlsxLib = await ensureXLSX();
    if (!xlsxLib) throw new Error('SheetJS library is not loaded.');
    var wb = xlsxLib.read(arrayBuffer, { type: 'array' });
    var parsed = parseUsersWorkbook(wb, xlsxLib);
    var userCount = Object.keys(parsed.users).length;
    if (userCount === 0) throw new Error('No valid user rows with email column found in the uploaded Excel file.');
    var nowIso = new Date().toISOString();
    var overlay = readOverlay();
    overlay.users = {};
    overlay.requests = {};
    overlay.progress = {};
    overlay.lessonCatalog = {};
    Object.entries(parsed.users).forEach(function (entry) {
      var uid = entry[0], rec = entry[1];
      var baseRec = baseWorkbookData.users[uid];
      var bTs = baseRec ? tsMs(baseRec.profile.updatedAt) : 0;
      var pTs = tsMs(rec.profile.updatedAt);
      overlay.users[uid] = {
        profile: Object.assign({}, rec.profile, { updatedAt: pTs >= bTs && rec.profile.updatedAt ? rec.profile.updatedAt : nowIso }),
        passwordHash: rec.passwordHash
      };
    });
    Object.entries(parsed.requests).forEach(function (e) { overlay.requests[e[0]] = Object.assign({}, e[1], { updatedAt: e[1].updatedAt || nowIso }); });
    Object.entries(parsed.progress).forEach(function (e) { overlay.progress[e[0]] = Object.assign({}, e[1], { updatedAt: e[1].updatedAt || nowIso }); });
    Object.entries(parsed.lessonCatalog).forEach(function (e) { overlay.lessonCatalog[e[0]] = Object.assign({}, e[1], { updatedAt: e[1].updatedAt || nowIso }); });
    writeOverlay(overlay);
    hydrateSession(mergeStore(), state.user.uid);
    notify();
    return {
      userCount: userCount,
      requestCount: Object.keys(parsed.requests).length,
      progressCount: Object.keys(parsed.progress).length,
      catalogCount: Object.keys(parsed.lessonCatalog).length
    };
  }

  async function reloadUsersWorkbookFromRepo() {
    await loadBaseUsersWorkbook(true);
    hydrateSession(mergeStore());
    notify();
    return getExcelSyncSummary();
  }

  function getLessonPricing(lesson) {
    var lid = cleanId((lesson && (lesson.id || lesson.lessonId)) || '');
    var catItem = state.lessonCatalog[lid];
    if (catItem) {
      return {
        accessType: catItem.accessType === 'paid' ? 'paid' : 'free',
        price: Number(catItem.price) || (catItem.accessType === 'paid' ? 9 : 0)
      };
    }
    var rawAccess = String((lesson && (lesson.accessType || lesson.access)) || '').trim().toLowerCase();
    if (rawAccess === 'free' || (lesson && (lesson.isFree === true || String(lesson.isFree).toLowerCase() === 'true'))) {
      return { accessType: 'free', price: 0 };
    }
    if (rawAccess === 'paid' || rawAccess === 'premium' || (lesson && (lesson.isFree === false || String(lesson.isFree).toLowerCase() === 'false'))) {
      var p1 = Number(lesson && lesson.price);
      return { accessType: 'paid', price: Number.isFinite(p1) && p1 > 0 ? p1 : 9 };
    }
    var p2 = Number(lesson && lesson.price);
    if (Number.isFinite(p2) && p2 > 0) return { accessType: 'paid', price: p2 };
    return { accessType: 'free', price: 0 };
  }

  function hasActiveMembership() {
    var prof = state.profile;
    if (!prof) return false;
    if (isAdminUser()) return true;
    if (prof.membershipStatus !== 'active') return false;
    if (prof.membershipExpiresAt) {
      var exp = Date.parse(prof.membershipExpiresAt + 'T23:59:59Z');
      if (!Number.isNaN(exp) && exp < Date.now()) return false;
    }
    return Boolean((prof.subscribedCourses || []).length || (prof.subscribedLessonIds || []).length);
  }

  function hasCourseAccess(courseName) {
    if (isAdminUser()) return true;
    var prof = state.profile;
    if (!prof) return false;
    var targetKey = courseKey(normalizeCourseName(courseName));
    var courses = prof.subscribedCourses || [];
    return courses.some(function (c) { return courseKey(c) === targetKey; });
  }

  function hasPendingRequest() {
    return state.myRequests.some(function (r) { return r.status === 'pending'; });
  }

  function canAccessLesson(lesson) {
    if (getLessonPricing(lesson).accessType === 'free' || isAdminUser()) return true;
    var lid = cleanId((lesson && (lesson.id || lesson.lessonId)) || '');
    if ((state.profile && state.profile.subscribedLessonIds || []).map(cleanId).includes(lid)) return true;
    var cname = getLessonCourseName(lesson);
    if (hasCourseAccess(cname)) return true;
    return false;
  }

  function todayYmd(d) {
    var dt = new Date(d || Date.now());
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }

  function dayDiff(fromYmd, toYmd) {
    if (!fromYmd || !toYmd) return Infinity;
    var a = new Date(fromYmd + 'T00:00:00');
    var b = new Date(toYmd + 'T00:00:00');
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  function validYmd(str) {
    var s = String(str || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  function sanitizeTime(str) {
    var s = String(str || '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : '18:00';
  }

  function defaultProgress(uid) {
    return {
      uid: uid,
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDate: '',
      streakDates: [],
      completedLessonIds: [],
      reminderEnabled: true,
      reminderTime: '18:00',
      lastNotifiedDate: ''
    };
  }

  function normalizeProgress(raw, uid) {
    var def = defaultProgress(uid);
    if (!raw) return def;
    var last = validYmd(raw.lastCompletedDate);
    var cur = Math.min(10000, Math.max(0, Math.round(Number(raw.currentStreak) || 0)));
    var today = todayYmd();
    var computed = cur;
    if (!last) {
      computed = 0;
    } else {
      var diff = dayDiff(last, today);
      if (diff > 1) computed = 0;
      else if (diff === 0 || diff === 1) computed = Math.max(1, cur);
    }
    var best = Math.min(10000, Math.max(computed, Math.round(Number(raw.bestStreak) || 0)));
    var dates = Array.isArray(raw.streakDates)
      ? Array.from(new Set(raw.streakDates.map(validYmd).filter(Boolean))).slice(-366)
      : [];
    var completedIds = Array.isArray(raw.completedLessonIds)
      ? Array.from(new Set(raw.completedLessonIds.map(function (c) { return String(c || '').trim().slice(0, 128); }).filter(Boolean))).slice(-200)
      : [];
    return {
      uid: uid,
      currentStreak: computed,
      bestStreak: best,
      lastCompletedDate: last,
      streakDates: dates,
      completedLessonIds: completedIds,
      reminderEnabled: raw.reminderEnabled !== false,
      reminderTime: sanitizeTime(raw.reminderTime),
      lastNotifiedDate: validYmd(raw.lastNotifiedDate),
      updatedAt: raw.updatedAt
    };
  }

  function getUserProgress() {
    return state.user ? normalizeProgress(state.userProgress, state.user.uid) : null;
  }

  async function saveProgressObj(prog) {
    if (!state.user) throw new Error('Sign in required to save progress.');
    var clean = {
      uid: state.user.uid,
      currentStreak: Math.min(10000, Math.max(0, Math.round(prog.currentStreak || 0))),
      bestStreak: Math.min(10000, Math.max(0, Math.round(prog.bestStreak || 0))),
      lastCompletedDate: validYmd(prog.lastCompletedDate),
      streakDates: Array.from(new Set((prog.streakDates || []).map(validYmd).filter(Boolean))).slice(-366),
      completedLessonIds: Array.from(new Set((prog.completedLessonIds || []).map(function (c) { return String(c || '').trim().slice(0, 128); }).filter(Boolean))).slice(-200),
      reminderEnabled: Boolean(prog.reminderEnabled),
      reminderTime: sanitizeTime(prog.reminderTime),
      lastNotifiedDate: validYmd(prog.lastNotifiedDate),
      updatedAt: new Date().toISOString()
    };
    state.userProgress = Object.assign({}, clean);
    var overlay = readOverlay();
    overlay.progress[state.user.uid] = Object.assign({}, clean);
    writeOverlay(overlay);
    notify();
    return state.userProgress;
  }

  async function recordLessonCompletedProgress(lessonId, isDone) {
    if (isDone === undefined) isDone = true;
    if (!state.user) return null;
    var lid = String(lessonId || '').trim().slice(0, 128);
    var cur = getUserProgress() || defaultProgress(state.user.uid);
    var completedSet = new Set(cur.completedLessonIds || []);
    if (lid) {
      if (isDone) completedSet.add(lid);
      else completedSet.delete(lid);
    }
    var curStreak = cur.currentStreak;
    var bestStreak = cur.bestStreak;
    var lastDate = cur.lastCompletedDate;
    var dates = (cur.streakDates || []).slice();
    if (isDone) {
      var t = todayYmd();
      if (!lastDate) curStreak = 1;
      else {
        var diff = dayDiff(lastDate, t);
        if (diff === 0) curStreak = Math.max(1, curStreak);
        else if (diff === 1) curStreak = curStreak + 1;
        else curStreak = 1;
      }
      lastDate = t;
      if (!dates.includes(t)) dates.push(t);
      bestStreak = Math.max(bestStreak, curStreak);
    }
    return saveProgressObj(Object.assign({}, cur, {
      currentStreak: curStreak,
      bestStreak: bestStreak,
      lastCompletedDate: lastDate,
      streakDates: dates.slice(-366),
      completedLessonIds: Array.from(completedSet).slice(-200)
    }));
  }

  async function saveReminderPreferences(opts) {
    if (!state.user) return null;
    var cur = getUserProgress() || defaultProgress(state.user.uid);
    return saveProgressObj(Object.assign({}, cur, {
      reminderEnabled: typeof opts.enabled === 'boolean' ? opts.enabled : cur.reminderEnabled,
      reminderTime: opts.time !== undefined ? sanitizeTime(opts.time) : cur.reminderTime,
      lastNotifiedDate: opts.lastNotifiedDate !== undefined ? validYmd(opts.lastNotifiedDate) : cur.lastNotifiedDate
    }));
  }

  function subscribe(fn) {
    listeners.add(fn);
    fn(getState());
    return function () { listeners.delete(fn); };
  }

  function getState() {
    return Object.assign({}, state, {
      excelSummary: getExcelSyncSummary(),
      isAdmin: isAdminUser()
    });
  }

  var api = {
    CONTACT_INFO: CONTACT_INFO,
    MEMBERSHIP_PLANS: MEMBERSHIP_PLANS,
    DEFAULT_SITE_CONFIG: DEFAULT_SITE_CONFIG,
    calculateAge: calculateAge,
    normalizeCourseName: normalizeCourseName,
    getLessonCourseName: getLessonCourseName,
    getCoursePrice: getCoursePrice,
    getState: getState,
    subscribe: subscribe,
    getIdToken: getIdToken,
    getSiteConfig: getSiteConfig,
    saveSiteConfig: saveSiteConfig,
    exportSiteConfigJson: exportSiteConfigJson,
    registerWithEmail: registerWithEmail,
    loginWithEmail: loginWithEmail,
    resetPasswordWithVerification: resetPasswordWithVerification,
    sendPasswordReset: sendPasswordReset,
    changePassword: changePassword,
    reloadAuthSession: reloadAuthSession,
    logout: logout,
    updateProfileDetails: updateProfileDetails,
    submitSubscriptionRequest: submitSubscriptionRequest,
    cancelPendingRequest: cancelPendingRequest,
    approveSubscriptionRequest: approveSubscriptionRequest,
    rejectSubscriptionRequest: rejectSubscriptionRequest,
    updateUserMembershipAdmin: updateUserMembershipAdmin,
    adminUpdateUserDetails: adminUpdateUserDetails,
    adminResetUserPassword: adminResetUserPassword,
    saveLessonCatalogItems: saveLessonCatalogItems,
    exportUsersWorkbook: exportUsersWorkbook,
    importUsersWorkbook: importUsersWorkbook,
    reloadUsersWorkbookFromRepo: reloadUsersWorkbookFromRepo,
    getExcelSyncSummary: getExcelSyncSummary,
    getLessonPricing: getLessonPricing,
    hasActiveMembership: hasActiveMembership,
    hasCourseAccess: hasCourseAccess,
    hasPendingRequest: hasPendingRequest,
    canAccessLesson: canAccessLesson,
    getUserProgress: getUserProgress,
    recordLessonCompletedProgress: recordLessonCompletedProgress,
    saveReminderPreferences: saveReminderPreferences
  };

  window.LinguaAuth = api;
})();
