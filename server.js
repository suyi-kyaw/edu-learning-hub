const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = 'syndkyaw@gmail.com';
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Lightweight .env loader (only fills keys missing from process.env)
(function loadDotEnvIfPresent() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('Could not read .env file:', err.message);
  }
})();

const DATA_DIR = path.join(__dirname, 'data');
const AUTH_STORE_PATH = path.join(DATA_DIR, 'auth-store.json');
const AUTH_SECRET_PATH = path.join(DATA_DIR, 'auth-secret.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function getTokenSecret() {
  const fromEnv = String(process.env.AUTH_TOKEN_SECRET || '').trim();
  if (fromEnv.length >= 16) return fromEnv;

  try {
    if (fs.existsSync(AUTH_SECRET_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_SECRET_PATH, 'utf8'));
      if (parsed && typeof parsed.secret === 'string' && parsed.secret.length >= 32) {
        return parsed.secret;
      }
    }
  } catch (err) {
    console.warn('Could not read data/auth-secret.json:', err.message);
  }

  const generated = crypto.randomBytes(48).toString('hex');
  try {
    const tmp = `${AUTH_SECRET_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify({ secret: generated, createdAt: new Date().toISOString() }, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });
    fs.renameSync(tmp, AUTH_SECRET_PATH);
  } catch (err) {
    console.warn('Could not persist data/auth-secret.json:', err.message);
  }
  return generated;
}

const TOKEN_SECRET = getTokenSecret();

const USERS_XLSX_PATH = path.join(DATA_DIR, 'users.xlsx');
const USERS_JSON_PATH = path.join(DATA_DIR, 'users.json');

function readAuthStore() {
  const empty = { users: {}, userProgress: {}, subscriptionRequests: [], lessonCatalog: {} };
  try {
    if (!fs.existsSync(AUTH_STORE_PATH)) return empty;
    const parsed = JSON.parse(fs.readFileSync(AUTH_STORE_PATH, 'utf8'));
    return {
      users: parsed && parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
      userProgress: parsed && parsed.userProgress && typeof parsed.userProgress === 'object' ? parsed.userProgress : {},
      subscriptionRequests: Array.isArray(parsed?.subscriptionRequests) ? parsed.subscriptionRequests : [],
      lessonCatalog: parsed && parsed.lessonCatalog && typeof parsed.lessonCatalog === 'object' ? parsed.lessonCatalog : {}
    };
  } catch (err) {
    console.warn('Could not read data/auth-store.json:', err.message);
    return empty;
  }
}

function formatPortablePasswordHash(u) {
  if (!u) return '';
  const rawHash = String(u.passwordHash || '').trim();
  if (/^sha256\$[^$]+\$[a-f0-9]{64}$/i.test(rawHash)) return rawHash;
  const rawSalt = String(u.passwordSalt || '').trim();
  if (rawSalt && /^[a-f0-9]{64}$/i.test(rawHash)) {
    return `sha256$${rawSalt}$${rawHash}`;
  }
  return rawHash;
}

function syncUsersFilesFromStore(store) {
  try {
    if (!store || typeof store !== 'object') return;
    const usersList = Object.values(store.users || {}).filter((u) => u && u.email && u.uid);
    const jsonUsers = {};
    const userSheetRows = usersList.map((u) => {
      const portableHash = formatPortablePasswordHash(u);
      const isAdm = u.role === 'admin' || String(u.email || '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
      jsonUsers[u.uid] = {
        uid: String(u.uid),
        username: String(u.username || 'Learner'),
        email: String(u.email || '').trim().toLowerCase(),
        phoneNumber: String(u.phoneNumber || ''),
        dob: String(u.dob || ''),
        role: isAdm ? 'admin' : 'student',
        membershipStatus: ['free', 'pending', 'active', 'expired'].includes(u.membershipStatus) ? u.membershipStatus : 'free',
        membershipPlan: normalizeServerPlan(u.membershipPlan),
        membershipExpiresAt: String(u.membershipExpiresAt || ''),
        subscribedLessonIds: Array.isArray(u.subscribedLessonIds) ? u.subscribedLessonIds : [],
        subscribedCourses: Array.isArray(u.subscribedCourses) ? u.subscribedCourses : [],
        practiceLessonIds: Array.isArray(u.practiceLessonIds) ? u.practiceLessonIds : [],
        practiceCourses: Array.isArray(u.practiceCourses) ? u.practiceCourses : [],
        linkedProviders: ['password'],
        mustChangePassword: Boolean(u.mustChangePassword),
        passwordSalt: String(u.passwordSalt || ''),
        passwordHash: portableHash,
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || new Date().toISOString()
      };
      return {
        uid: String(u.uid),
        username: String(u.username || 'Learner'),
        email: String(u.email || '').trim().toLowerCase(),
        phoneNumber: String(u.phoneNumber || ''),
        dob: String(u.dob || ''),
        passwordHash: portableHash,
        role: isAdm ? 'admin' : 'student',
        membershipStatus: ['free', 'pending', 'active', 'expired'].includes(u.membershipStatus) ? u.membershipStatus : 'free',
        membershipPlan: normalizeServerPlan(u.membershipPlan),
        membershipExpiresAt: String(u.membershipExpiresAt || ''),
        subscribedLessonIds: Array.isArray(u.subscribedLessonIds) ? u.subscribedLessonIds.join(',') : '',
        subscribedCourses: Array.isArray(u.subscribedCourses) ? u.subscribedCourses.join(',') : '',
        practiceLessonIds: Array.isArray(u.practiceLessonIds) ? u.practiceLessonIds.join(',') : '',
        practiceCourses: Array.isArray(u.practiceCourses) ? u.practiceCourses.join(',') : '',
        mustChangePassword: u.mustChangePassword ? 'true' : 'false',
        createdAt: u.createdAt || '',
        updatedAt: u.updatedAt || ''
      };
    });

    const reqRows = (Array.isArray(store.subscriptionRequests) ? store.subscriptionRequests : []).map((r) => ({
      requestId: String(r.requestId || ''),
      userId: String(r.userId || ''),
      username: String(r.username || ''),
      userEmail: String(r.userEmail || ''),
      userPhone: String(r.userPhone || ''),
      planType: String(r.planType || ''),
      lessonId: String(r.lessonId || ''),
      courseName: String(r.courseName || ''),
      lessonTitle: String(r.lessonTitle || ''),
      amountLabel: String(r.amountLabel || ''),
      contactChannel: String(r.contactChannel || ''),
      contactHandle: String(r.contactHandle || ''),
      note: String(r.note || ''),
      status: String(r.status || 'pending'),
      adminNote: String(r.adminNote || ''),
      createdAt: String(r.createdAt || ''),
      updatedAt: String(r.updatedAt || '')
    }));

    const progRows = Object.values(store.userProgress || {}).map((p) => ({
      uid: String(p.uid || ''),
      currentStreak: Number(p.currentStreak) || 0,
      bestStreak: Number(p.bestStreak) || 0,
      lastCompletedDate: String(p.lastCompletedDate || ''),
      streakDates: Array.isArray(p.streakDates) ? p.streakDates.join(',') : '',
      completedLessonIds: Array.isArray(p.completedLessonIds) ? p.completedLessonIds.join(',') : '',
      reminderEnabled: p.reminderEnabled !== false ? 'true' : 'false',
      reminderTime: String(p.reminderTime || '18:00'),
      lastNotifiedDate: String(p.lastNotifiedDate || ''),
      updatedAt: String(p.updatedAt || '')
    }));

    const catRows = Object.values(store.lessonCatalog || {}).map((c) => ({
      lessonId: String(c.lessonId || ''),
      title: String(c.title || ''),
      course: String(c.course || ''),
      accessType: String(c.accessType || 'free'),
      price: Number(c.price) || 0,
      practicePrice: Number(c.practicePrice) || 0,
      hasExercises: c.hasExercises === false ? 'false' : 'true',
      updatedBy: String(c.updatedBy || ''),
      updatedAt: String(c.updatedAt || '')
    }));

    // Write data/users.json atomically
    const jsonPayload = {
      users: jsonUsers,
      userProgress: store.userProgress || {},
      subscriptionRequests: store.subscriptionRequests || [],
      lessonCatalog: store.lessonCatalog || {}
    };
    const jsonTmp = `${USERS_JSON_PATH}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(jsonTmp, JSON.stringify(jsonPayload, null, 2), 'utf8');
    fs.renameSync(jsonTmp, USERS_JSON_PATH);

    // Write data/users.xlsx atomically
    const wb = XLSX.utils.book_new();
    const sheetSpecs = [
      {
        name: 'Users',
        rows: userSheetRows,
        headers: [
          'uid', 'username', 'email', 'phoneNumber', 'dob', 'passwordHash', 'role',
          'membershipStatus', 'membershipPlan', 'membershipExpiresAt',
          'subscribedLessonIds', 'subscribedCourses', 'practiceLessonIds', 'practiceCourses',
          'mustChangePassword', 'createdAt', 'updatedAt'
        ]
      },
      {
        name: 'Requests',
        rows: reqRows,
        headers: [
          'requestId', 'userId', 'username', 'userEmail', 'userPhone', 'planType', 'lessonId',
          'courseName', 'lessonTitle', 'amountLabel', 'contactChannel', 'contactHandle',
          'note', 'status', 'adminNote', 'createdAt', 'updatedAt'
        ]
      },
      {
        name: 'Progress',
        rows: progRows,
        headers: [
          'uid', 'currentStreak', 'bestStreak', 'lastCompletedDate', 'streakDates',
          'completedLessonIds', 'reminderEnabled', 'reminderTime', 'lastNotifiedDate', 'updatedAt'
        ]
      },
      {
        name: 'Catalog',
        rows: catRows,
        headers: ['lessonId', 'title', 'course', 'accessType', 'price', 'practicePrice', 'hasExercises', 'updatedBy', 'updatedAt']
      }
    ];
    for (const spec of sheetSpecs) {
      const ws =
        spec.rows.length > 0
          ? XLSX.utils.json_to_sheet(spec.rows, { header: spec.headers })
          : XLSX.utils.aoa_to_sheet([spec.headers]);
      XLSX.utils.book_append_sheet(wb, ws, spec.name);
    }
    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const xlsxTmp = `${USERS_XLSX_PATH}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(xlsxTmp, xlsxBuf);
    fs.renameSync(xlsxTmp, USERS_XLSX_PATH);
  } catch (err) {
    console.warn('Could not sync users.xlsx / users.json:', err.message);
  }
}

function writeAuthStore(store) {
  const tmpPath = `${AUTH_STORE_PATH}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, AUTH_STORE_PATH);
  syncUsersFilesFromStore(store);
}

function isAdminClaimed(store = readAuthStore()) {
  return Object.values(store.users).some((u) => u && u.role === 'admin');
}

function findUserByEmail(store, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  return Object.values(store.users).find((u) => u && String(u.email || '').trim().toLowerCase() === target) || null;
}

function normalizeCourseNameServer(val) {
  const raw = String(val || '').trim();
  if (!raw) return 'HSK 2';
  const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (compact === 'hsk1') return 'HSK 1';
  if (compact === 'hsk2') return 'HSK 2';
  if (compact === 'hsk3') return 'HSK 3';
  if (compact === 'hsk4') return 'HSK 4';
  return raw.slice(0, 80);
}

function courseSlugServer(val) {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
}

function getLessonCourseServer(lesson) {
  if (!lesson || typeof lesson !== 'object') return 'HSK 2';
  const raw = String(lesson.course || lesson.courseName || lesson.category || '').trim();
  return raw ? normalizeCourseNameServer(raw) : 'HSK 2';
}

function normalizeServerPlan(plan) {
  const p = String(plan || 'none').trim().toLowerCase();
  if (p === 'practice_lesson' || p === 'practice-lesson') return 'practice_lesson';
  if (p === 'practice_course' || p === 'practice-course') return 'practice_course';
  if (p === 'per_lesson' || p === 'lesson') return 'per_lesson';
  if (p === 'course' || p === 'monthly' || p === 'annual' || p === 'hsk') return 'course';
  return 'none';
}

function normalizeLessonIdKeyServer(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]+/g, '-')
    .toLowerCase();
}

function getActiveLessonAndStorySetsFromWorkbooks() {
  let validLessonIdMap = null;
  let validStoryIdSet = null;
  try {
    const lessonsXlsxPath = path.join(__dirname, 'data', 'lessons.xlsx');
    if (fs.existsSync(lessonsXlsxPath)) {
      const wb = XLSX.read(fs.readFileSync(lessonsXlsxPath), { type: 'buffer' });
      const sheetName = wb.SheetNames.find((s) => String(s).toLowerCase() === 'lessons');
      const rows = sheetName ? XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' }) : [];
      validLessonIdMap = new Map();
      for (const r of rows) {
        const rawId = String(r?.id || r?.lessonId || '').trim();
        const key = normalizeLessonIdKeyServer(rawId);
        if (key) validLessonIdMap.set(key, rawId);
      }
    }
  } catch (err) {
    console.warn('Could not inspect data/lessons.xlsx for reconciliation:', err.message);
  }
  try {
    const storiesXlsxPath = path.join(__dirname, 'data', 'stories.xlsx');
    if (fs.existsSync(storiesXlsxPath)) {
      const wb = XLSX.read(fs.readFileSync(storiesXlsxPath), { type: 'buffer' });
      const sheetName = wb.SheetNames.find((s) => String(s).toLowerCase() === 'lessons');
      const rows = sheetName ? XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' }) : [];
      validStoryIdSet = new Set();
      for (const r of rows) {
        const key = normalizeLessonIdKeyServer(r?.id || r?.lessonId || '');
        if (key) validStoryIdSet.add(key);
      }
    }
  } catch (err) {
    console.warn('Could not inspect data/stories.xlsx for reconciliation:', err.message);
  }
  return { validLessonIdMap, validStoryIdSet };
}

function arraysEqualServer(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isDatedPassActiveServer(user) {
  const exp = String(user?.membershipExpiresAt || '').trim();
  if (!exp) return false;
  const expTime = Date.parse(exp + 'T23:59:59Z');
  return !Number.isNaN(expTime) && expTime >= Date.now();
}

function reconcileAuthStoreWithLessons(store, validMapOverride = null, storySetOverride = null, explicitDeletedIds = []) {
  if (!store || typeof store !== 'object') return { store, changed: false };
  const wbSets = (validMapOverride && storySetOverride) ? null : getActiveLessonAndStorySetsFromWorkbooks();
  const validLessonIdMap = validMapOverride || (wbSets ? wbSets.validLessonIdMap : null);
  const validStoryIdSet = storySetOverride || (wbSets ? wbSets.validStoryIdSet : null);
  const explicitDeletedSet = new Set(
    (Array.isArray(explicitDeletedIds) ? explicitDeletedIds : []).map(normalizeLessonIdKeyServer).filter(Boolean)
  );

  if (!validLessonIdMap && explicitDeletedSet.size === 0) {
    return { store, changed: false };
  }

  let changed = false;
  const nowIso = new Date().toISOString();

  // 1. Prune lessonCatalog
  if (store.lessonCatalog && typeof store.lessonCatalog === 'object') {
    for (const catKey of Object.keys(store.lessonCatalog)) {
      const key = normalizeLessonIdKeyServer(catKey);
      if (explicitDeletedSet.has(key) || (validLessonIdMap && !validLessonIdMap.has(key))) {
        delete store.lessonCatalog[catKey];
        changed = true;
      }
    }
  }

  const filterLessonIds = (arr) => {
    const orig = Array.isArray(arr) ? arr : [];
    const out = [];
    const seen = new Set();
    for (const rawId of orig) {
      const key = normalizeLessonIdKeyServer(rawId);
      if (!key) continue;
      if (explicitDeletedSet.has(key)) continue;
      if (validLessonIdMap && !validLessonIdMap.has(key)) continue;
      const canonical = (validLessonIdMap && validLessonIdMap.get(key)) || String(rawId).trim();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(canonical);
      }
    }
    return { next: out, diff: !arraysEqualServer(orig, out) };
  };

  // 2. Reconcile user entitlements & revert empty active learners to free
  for (const uid of Object.keys(store.users || {})) {
    const u = store.users[uid];
    if (!u) continue;
    let uChanged = false;

    const fullLessonsRes = filterLessonIds(u.subscribedLessonIds);
    const pracLessonsRes = filterLessonIds(u.practiceLessonIds);
    if (fullLessonsRes.diff || !Array.isArray(u.subscribedLessonIds)) {
      u.subscribedLessonIds = fullLessonsRes.next;
      uChanged = true;
    }
    if (pracLessonsRes.diff || !Array.isArray(u.practiceLessonIds)) {
      u.practiceLessonIds = pracLessonsRes.next;
      uChanged = true;
    }

    const fullLessons = Array.isArray(u.subscribedLessonIds) ? u.subscribedLessonIds : [];
    const pracLessons = Array.isArray(u.practiceLessonIds) ? u.practiceLessonIds : [];
    const courses = Array.isArray(u.subscribedCourses) ? u.subscribedCourses.filter(Boolean) : [];
    const pracCourses = Array.isArray(u.practiceCourses) ? u.practiceCourses.filter(Boolean) : [];
    const isAdminUser = u.role === 'admin' || String(u.email || '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (!isAdminUser) {
      const hasAny =
        fullLessons.length > 0 ||
        pracLessons.length > 0 ||
        courses.length > 0 ||
        pracCourses.length > 0;
      const hasDated = isDatedPassActiveServer(u);

      if (!hasAny && !hasDated) {
        if (u.membershipStatus === 'active') {
          u.membershipStatus = 'free';
          uChanged = true;
        }
        if (u.membershipStatus === 'free' && normalizeServerPlan(u.membershipPlan) !== 'none') {
          u.membershipPlan = 'none';
          uChanged = true;
        }
      } else if (hasAny && u.membershipStatus === 'active') {
        const curPlan = normalizeServerPlan(u.membershipPlan);
        const matches =
          (curPlan === 'course' && courses.length > 0) ||
          (curPlan === 'practice_course' && pracCourses.length > 0) ||
          (curPlan === 'per_lesson' && fullLessons.length > 0) ||
          (curPlan === 'practice_lesson' && pracLessons.length > 0) ||
          hasDated;
        if (!matches) {
          u.membershipPlan = courses.length
            ? 'course'
            : pracCourses.length
            ? 'practice_course'
            : fullLessons.length
            ? 'per_lesson'
            : 'practice_lesson';
          uChanged = true;
        }
      }
    }

    if (uChanged) {
      u.updatedAt = nowIso;
      changed = true;
    }
  }

  // 3. Prune deleted lesson IDs from userProgress.completedLessonIds (preserve story IDs!)
  for (const uid of Object.keys(store.userProgress || {})) {
    const prog = store.userProgress[uid];
    if (!prog || !Array.isArray(prog.completedLessonIds)) continue;
    const orig = prog.completedLessonIds;
    const next = orig.filter((id) => {
      const key = normalizeLessonIdKeyServer(id);
      if (!key) return false;
      if (explicitDeletedSet.has(key)) return false;
      if (validLessonIdMap && validStoryIdSet && !validLessonIdMap.has(key) && !validStoryIdSet.has(key)) {
        return false;
      }
      return true;
    });
    if (!arraysEqualServer(orig, next)) {
      prog.completedLessonIds = next;
      prog.updatedAt = nowIso;
      changed = true;
    }
  }

  // 4. Reject pending lesson-specific requests targeting removed lessons
  if (Array.isArray(store.subscriptionRequests)) {
    for (const r of store.subscriptionRequests) {
      if (!r || r.status !== 'pending') continue;
      if (r.planType !== 'per_lesson' && r.planType !== 'practice_lesson') continue;
      const key = normalizeLessonIdKeyServer(r.lessonId);
      if (!key) continue;
      if (explicitDeletedSet.has(key) || (validLessonIdMap && !validLessonIdMap.has(key))) {
        r.status = 'rejected';
        r.adminNote = 'Lesson removed from curriculum';
        r.updatedAt = nowIso;
        changed = true;
      }
    }
  }

  return { store, changed };
}

function sanitizeUserPublic(u) {
  if (!u) return null;
  return {
    uid: String(u.uid || ''),
    username: String(u.username || 'Learner'),
    email: String(u.email || ''),
    phoneNumber: String(u.phoneNumber || ''),
    dob: String(u.dob || ''),
    role: u.role === 'admin' ? 'admin' : 'student',
    membershipStatus: ['free', 'pending', 'active', 'expired'].includes(u.membershipStatus) ? u.membershipStatus : 'free',
    membershipPlan: normalizeServerPlan(u.membershipPlan),
    membershipExpiresAt: String(u.membershipExpiresAt || ''),
    subscribedLessonIds: Array.isArray(u.subscribedLessonIds) ? u.subscribedLessonIds.slice(0, 100) : [],
    subscribedCourses: Array.isArray(u.subscribedCourses)
      ? Array.from(new Set(u.subscribedCourses.map(normalizeCourseNameServer).filter(Boolean))).slice(0, 50)
      : [],
    practiceLessonIds: Array.isArray(u.practiceLessonIds) ? u.practiceLessonIds.slice(0, 100) : [],
    practiceCourses: Array.isArray(u.practiceCourses)
      ? Array.from(new Set(u.practiceCourses.map(normalizeCourseNameServer).filter(Boolean))).slice(0, 50)
      : [],
    linkedProviders: ['password'],
    mustChangePassword: Boolean(u.mustChangePassword),
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null
  };
}

function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hex = crypto.createHash('sha256').update(`${salt}:${String(password)}`, 'utf8').digest('hex');
  return { salt, hash: `sha256$${salt}$${hex}` };
}

function verifyPassword(password, salt, expectedHash) {
  if (!expectedHash) return false;
  const expectedStr = String(expectedHash).trim();
  const shaMatch = expectedStr.match(/^sha256\$([^$]+)\$([a-f0-9]{64})$/i);
  if (shaMatch) {
    try {
      const candidateHex = crypto
        .createHash('sha256')
        .update(`${shaMatch[1]}:${String(password)}`, 'utf8')
        .digest('hex');
      const a = Buffer.from(candidateHex.toLowerCase(), 'utf8');
      const b = Buffer.from(shaMatch[2].toLowerCase(), 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (_) {
      return false;
    }
  }
  if (salt && /^[a-f0-9]{64}$/i.test(expectedStr)) {
    try {
      const candidateHex = crypto
        .createHash('sha256')
        .update(`${String(salt)}:${String(password)}`, 'utf8')
        .digest('hex');
      const a = Buffer.from(candidateHex.toLowerCase(), 'utf8');
      const b = Buffer.from(expectedStr.toLowerCase(), 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (_) {
      return false;
    }
  }
  if (!salt) return false;
  try {
    const derivedBuf = crypto.scryptSync(String(password), String(salt), 64);
    const expectedBuf = Buffer.from(expectedStr, 'hex');
    if (derivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch (_) {
    return false;
  }
}

function normalizePhoneServer(raw) {
  return String(raw || '').trim().replace(/[\s\-().+]+/g, '');
}

function phonesMatchServer(a, b) {
  const na = normalizePhoneServer(a);
  const nb = normalizePhoneServer(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const da = String(a || '').replace(/\D+/g, '');
  const db = String(b || '').replace(/\D+/g, '');
  const variants = (d) => {
    const s = new Set([d]);
    if (d.startsWith('950') && d.length >= 10) { s.add('0' + d.slice(3)); s.add(d.slice(4)); }
    else if (d.startsWith('95') && d.length >= 10) { s.add('0' + d.slice(2)); s.add(d.slice(2)); }
    else if (d.startsWith('0') && d.length >= 8) { s.add(d.slice(1)); s.add('95' + d.slice(1)); }
    return s;
  };
  const va = variants(da);
  const vb = variants(db);
  for (const x of va) if (vb.has(x)) return true;
  return false;
}

function findAndSyncExcelUser(store, email, password) {
  try {
    const usersXlsxPath = path.join(__dirname, 'data', 'users.xlsx');
    if (!fs.existsSync(usersXlsxPath)) return null;
    const wb = XLSX.read(fs.readFileSync(usersXlsxPath), { type: 'buffer' });
    const sheetName =
      wb.SheetNames.find((s) => String(s).toLowerCase() === 'users') || wb.SheetNames[0];
    if (!sheetName) return null;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    const targetEmail = String(email || '').trim().toLowerCase();
    const row = rows.find(
      (r) => String(r.email || r.Email || '').trim().toLowerCase() === targetEmail
    );
    if (!row) return null;

    const storedPw = String(row.passwordHash || row.password || row.Password || '').trim();
    if (!storedPw) return null;
    const verified = storedPw.startsWith('sha256$')
      ? verifyPassword(password, '', storedPw)
      : storedPw === String(password);
    if (!verified) return null;

    const uid =
      String(row.uid || row.UID || '').trim() ||
      `usr_${targetEmail.replace(/[^a-z0-9]/g, '_')}`;
    const { salt, hash } = storedPw.startsWith('sha256$')
      ? { salt: storedPw.split('$')[1] || '', hash: storedPw }
      : hashPassword(password);
    const rawPlan = String(row.membershipPlan || 'none').trim().toLowerCase();
    const rawCourses = String(row.subscribedCourses || row.SubscribedCourses || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeCourseNameServer);
    const rawLessons = String(row.subscribedLessonIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const rawPracticeCourses = String(row.practiceCourses || row.PracticeCourses || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeCourseNameServer);
    const rawPracticeLessons = String(row.practiceLessonIds || row.PracticeLessonIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isAdminRow =
      String(row.role || '').trim().toLowerCase() === 'admin' ||
      targetEmail === ADMIN_EMAIL.toLowerCase();

    const nowIso = new Date().toISOString();
    const syncedUser = {
      uid,
      username:
        String(row.username || row.name || targetEmail.split('@')[0] || 'Learner').trim().slice(0, 60),
      email: targetEmail,
      phoneNumber: String(row.phoneNumber || row.phone || '').trim().slice(0, 32),
      dob: /^\d{4}-\d{2}-\d{2}/.test(String(row.dob || '').trim())
        ? String(row.dob).trim().slice(0, 10)
        : '',
      role: isAdminRow ? 'admin' : 'student',
      membershipStatus: ['free', 'pending', 'active', 'expired'].includes(
        String(row.membershipStatus || '').trim().toLowerCase()
      )
        ? String(row.membershipStatus).trim().toLowerCase()
        : 'free',
      membershipPlan: normalizeServerPlan(rawPlan),
      membershipExpiresAt: String(row.membershipExpiresAt || '').trim().slice(0, 40),
      subscribedLessonIds: rawLessons,
      subscribedCourses: rawCourses,
      practiceLessonIds: rawPracticeLessons,
      practiceCourses: rawPracticeCourses,
      linkedProviders: ['password'],
      mustChangePassword: String(row.mustChangePassword || '').toLowerCase() === 'true',
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: String(row.createdAt || '').trim() || nowIso,
      updatedAt: nowIso
    };

    store.users[uid] = syncedUser;
    if (!store.userProgress[uid]) {
      store.userProgress[uid] = sanitizeProgressInput(null, uid);
    }
    writeAuthStore(store);
    return syncedUser;
  } catch (err) {
    console.warn('Excel user sync note:', err.message);
    return null;
  }
}

function syncAllExcelUsers(store) {
  try {
    const usersXlsxPath = path.join(__dirname, 'data', 'users.xlsx');
    if (fs.existsSync(usersXlsxPath)) {
      const wb = XLSX.read(fs.readFileSync(usersXlsxPath), { type: 'buffer' });
      const sheetName =
        wb.SheetNames.find((s) => String(s).toLowerCase() === 'users') || wb.SheetNames[0];
      if (sheetName) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        let changed = false;
        for (const row of rows) {
          const email = String(row.email || row.Email || '').trim().toLowerCase();
          if (!email) continue;
          const uid = String(row.uid || row.UID || '').trim() || `usr_${email.replace(/[^a-z0-9]/g, '_')}`;
          if (!store.users[uid]) {
            const isAdminRow = String(row.role || '').trim().toLowerCase() === 'admin' || email === ADMIN_EMAIL.toLowerCase();
            const storedPw = String(row.passwordHash || row.password || row.Password || '').trim();
            let salt = '';
            let hash = '';
            if (storedPw.startsWith('sha256$')) {
              const parts = storedPw.split('$');
              salt = parts[1] || '';
              hash = storedPw;
            } else if (storedPw) {
              const res = hashPassword(storedPw);
              salt = res.salt;
              hash = res.hash;
            }
            store.users[uid] = {
              uid,
              username: String(row.username || row.Username || email.split('@')[0]).trim(),
              email,
              phoneNumber: String(row.phoneNumber || row.PhoneNumber || '').trim(),
              dob: String(row.dob || row.DOB || '').trim(),
              role: isAdminRow ? 'admin' : 'student',
              membershipStatus: String(row.membershipStatus || (isAdminRow ? 'active' : 'free')).trim(),
              membershipPlan: String(row.membershipPlan || (isAdminRow ? 'course' : 'none')).trim(),
              membershipExpiresAt: String(row.membershipExpiresAt || '').trim(),
              subscribedLessonIds: String(row.subscribedLessonIds || '').split(',').map((s) => s.trim()).filter(Boolean),
              subscribedCourses: String(row.subscribedCourses || '').split(',').map((s) => s.trim()).filter(Boolean),
              practiceLessonIds: String(row.practiceLessonIds || '').split(',').map((s) => s.trim()).filter(Boolean),
              practiceCourses: String(row.practiceCourses || '').split(',').map((s) => s.trim()).filter(Boolean),
              linkedProviders: ['password'],
              mustChangePassword: String(row.mustChangePassword || '').toLowerCase() === 'true',
              passwordSalt: salt,
              passwordHash: hash,
              createdAt: String(row.createdAt || new Date().toISOString()),
              updatedAt: String(row.updatedAt || new Date().toISOString())
            };
            if (!store.userProgress[uid]) {
              store.userProgress[uid] = sanitizeProgressInput(null, uid);
            }
            changed = true;
          }
        }
        const reconciled = reconcileAuthStoreWithLessons(store);
        if (changed || reconciled.changed || !fs.existsSync(USERS_JSON_PATH)) {
          writeAuthStore(store);
        }
        return store;
      }
    }
    if (!fs.existsSync(USERS_JSON_PATH)) {
      syncUsersFilesFromStore(store);
    }
  } catch (err) {
    console.warn('Could not sync users from users.xlsx:', err.message);
  }
  return store;
}

// Initial sync of all Excel users into store & users.json on launch
syncAllExcelUsers(readAuthStore());

function generateTempPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (pool) => pool[crypto.randomInt(0, pool.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

function toBase64Url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(str) {
  const normalized = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64').toString('utf8');
}

function signAuthToken(user) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'LP' }));
  const now = Date.now();
  const payload = toBase64Url(
    JSON.stringify({
      uid: user.uid,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'student',
      iat: now,
      exp: now + TOKEN_TTL_MS
    })
  );
  const sig = toBase64Url(crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

function verifyAuthToken(token) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) throw new Error('Malformed session token.');
  const [header, payloadB64, sigB64] = parts;
  const expectedSig = toBase64Url(
    crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payloadB64}`).digest()
  );
  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid session signature.');
  }
  const decoded = JSON.parse(fromBase64Url(payloadB64));
  if (!decoded || !decoded.uid || !decoded.exp || Number(decoded.exp) < Date.now()) {
    throw new Error('Session expired. Please sign in again.');
  }
  return decoded;
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  const secureEnv = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv ? secureEnv === 'true' || secureEnv === '1' : port === 465;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user || `JiedeEdu <${ADMIN_EMAIL}>`).trim();
  const configured = Boolean(host && user && pass);
  return { configured, host, port, secure, user, pass, from };
}

function isSmtpConfigured() {
  return getSmtpConfig().configured;
}

async function sendSmtpMail({ to, subject, text, html }) {
  const cfg = getSmtpConfig();
  if (!cfg.configured) {
    throw new Error('SMTP is not configured on the server.');
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass
    }
  });
  await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html
  });
}

// Ensure local upload directories exist
const UPLOADS_ROOT = path.join(__dirname, 'assets', 'uploads');
const UPLOAD_SUBDIRS = {
  images: path.join(UPLOADS_ROOT, 'images'),
  videos: path.join(UPLOADS_ROOT, 'videos'),
  audio: path.join(UPLOADS_ROOT, 'audio')
};
for (const dir of Object.values(UPLOAD_SUBDIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

const SITE_CONFIG_PATH = path.join(__dirname, 'data', 'site-config.json');
const DEFAULT_SITE_CONFIG = {
  configId: 'homepage',
  heroEyebrow: 'Learn Chinese Step by Step',
  heroTitleLine1: 'Learn Chinese',
  heroTitleHighlight: 'with Confidence.',
  heroSubtitle:
    'Build your Chinese skills through pronunciation, everyday expressions, conversations, vocabulary, and practical exercises.',
  heroPrimaryCta: 'Explore Stories',
  heroSecondaryCta: 'Explore Lessons',
  heroBannerUrl: 'assets/hero-banner.png',
  siteLogoUrl: 'assets/images/logo.svg',
  storiesLabel: 'Interactive Reading',
  storiesTitle: 'Featured Stories',
  storiesSubtitle:
    'Explore illustrated Mandarin stories with native narration, sentence-by-sentence pinyin, key vocabulary, and comprehension exercises.',
  reelsLabel: 'Bite-Sized Video Immersion',
  reelsTitle: 'Short Reels',
  reelsSubtitle:
    'Watch bite-sized vertical video reels and cultural shorts with quad-language subtitles in Hanzi, Pinyin, English, and Myanmar.',
  gamesLabel: 'Interactive Practice',
  gamesTitle: 'Play & Practice Games',
  gamesSubtitle:
    'Reinforce your Chinese tones, character recognition, and rapid recall through interactive gameplay.',
  lessonsLabel: 'Structured HSK Curriculum',
  lessonsTitle: 'Mandarin Courses & Lessons',
  lessonsSubtitle:
    'Study step by step with HSK 2 and custom courses featuring video lessons, 5 interactive exercise types, and stroke writing.',
  lessonsBadge: 'HSK 2 • Structured Course',
  lessonsCardTitle: 'Explore HSK 2 Courses & Lessons',
  lessonsCardSubtitle: '系统汉语课程 • Video, Exercises & Stroke Order',
  lessonsCardDesc:
    'Browse structured HSK 2 lessons in our learning workspace. Practice listening, picture matching, pinyin character writing, and speaking.',
  lessonsBullets: [
    'HSK 2 conversational and grammar curriculum',
    '5 interactive exercise formats including Pinyin character writing',
    'Unlock individual lessons or the full HSK 2 course in Kyat'
  ],
  lessonsCta: 'Go to Lessons →',
  courses: ['HSK 2'],
  coursePrices: {
    'HSK 2': 280000
  },
  coursePracticePrices: {
    'HSK 2': 55000
  },
  practicePrice: 55000,
  contactEmail: 'syndkyaw@gmail.com',
  contactPhone: '+95 9 798 123 456',
  contactViber: '+95 9 798 123 456',
  featuredReelIds: ['cny_01', 'daily_01', 'kids_01'],
  featuredStoryIds: ['lesson-01', 'lesson-02'],
  featuredGameIds: ['game-01'],
  workerApiBaseUrl: ''
};

// Enable CORS, Cross-Origin Resource Sharing for assets, and preflight handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Admin-Uid, X-User-Uid');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const jsonParser = express.json({ limit: '15mb' });

function sanitizeProgressInput(raw, uid) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : '');
  const cleanTime = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '').trim()) ? String(v).trim() : '18:00');
  const streakDates = Array.isArray(input.streakDates)
    ? Array.from(new Set(input.streakDates.map((d) => cleanDate(d)).filter(Boolean))).slice(-366)
    : [];
  const completedLessonIds = Array.isArray(input.completedLessonIds)
    ? Array.from(new Set(input.completedLessonIds.map((id) => String(id || '').trim().slice(0, 128)).filter(Boolean))).slice(-200)
    : [];
  return {
    uid: String(uid),
    currentStreak: Math.min(10000, Math.max(0, Math.round(Number(input.currentStreak) || 0))),
    bestStreak: Math.min(10000, Math.max(0, Math.round(Number(input.bestStreak) || 0))),
    lastCompletedDate: cleanDate(input.lastCompletedDate),
    streakDates,
    completedLessonIds,
    reminderEnabled: input.reminderEnabled !== false,
    reminderTime: cleanTime(input.reminderTime),
    lastNotifiedDate: cleanDate(input.lastNotifiedDate),
    updatedAt: new Date().toISOString()
  };
}

function buildSessionResponse(store, user, token) {
  const pubUser = sanitizeUserPublic(user);
  const isAdmin = pubUser.role === 'admin';
  const myRequests = (store.subscriptionRequests || [])
    .filter((r) => r.userId === pubUser.uid)
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));

  const userProgress =
    store.userProgress && store.userProgress[pubUser.uid]
      ? store.userProgress[pubUser.uid]
      : sanitizeProgressInput(null, pubUser.uid);

  const payload = {
    success: true,
    user: {
      uid: pubUser.uid,
      email: pubUser.email,
      displayName: pubUser.username,
      role: pubUser.role,
      mustChangePassword: pubUser.mustChangePassword
    },
    profile: pubUser,
    userProgress,
    myRequests,
    lessonCatalog: store.lessonCatalog || {},
    adminClaimed: isAdminClaimed(store),
    smtpConfigured: isSmtpConfigured()
  };
  if (token) {
    payload.token = token;
  }
  if (isAdmin) {
    payload.allRequests = [...(store.subscriptionRequests || [])].sort(
      (a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
    );
    payload.allUsers = Object.values(store.users || {})
      .map(sanitizeUserPublic)
      .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
  }
  return payload;
}

// Authenticated User Middleware (HMAC-SHA256 Bearer token + active user lookup)
function requireAuthToken(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Please sign in first.' });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, error: 'Empty authentication token.' });
    }
    const decoded = verifyAuthToken(token);
    const store = readAuthStore();
    const user = store.users[decoded.uid];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Account no longer exists. Please sign in again.' });
    }
    req.authDecoded = decoded;
    req.authUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message || 'Invalid or expired session.' });
  }
}

// Admin Authentication Middleware (Bearer token + verified admin role in store)
function requireAdminToken(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Please sign in as an administrator first.' });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Empty authentication token.' });
  }
  try {
    const decoded = verifyAuthToken(token);
    const store = readAuthStore();
    const user = store.users[decoded.uid];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Account no longer exists. Please sign in again.' });
    }
    const email = String(user.email || '').trim().toLowerCase();
    if (user.role !== 'admin' && email !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
    }
    req.authDecoded = decoded;
    req.authUser = user;
    req.adminUser = user;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message || 'Invalid or expired session.' });
  }
}

// Helper to parse workbooks
function parseWorkbookFile(excelPath, missingMessage) {
  if (!fs.existsSync(excelPath)) {
    throw new Error(missingMessage);
  }
  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  }
  return {
    sheetNames: workbook.SheetNames,
    sheets
  };
}

function parseLessonsWorkbook() {
  return parseWorkbookFile(path.join(__dirname, 'data', 'lessons.xlsx'), 'data/lessons.xlsx not found');
}

function parseStoriesWorkbook() {
  return parseWorkbookFile(path.join(__dirname, 'data', 'stories.xlsx'), 'data/stories.xlsx not found');
}

function parseReelsStoriesWorkbook() {
  return parseWorkbookFile(path.join(__dirname, 'data', 'reels_stories.xlsx'), 'data/reels_stories.xlsx not found');
}

const DEFAULT_SHEET_HEADERS = {
  Lessons: [
    'id', 'course', 'category', 'categoryKey', 'categoryNum', 'title',
    'chineseTitle', 'pinyin', 'meaning', 'level', 'description',
    'videoUrl', 'posterUrl', 'fullAudio', 'keywords', 'accessType', 'price'
  ],
  Story: ['lessonId', 'order', 'chinese', 'pinyin', 'english', 'image', 'audio'],
  Vocabulary: ['lessonId', 'order', 'character', 'pinyin', 'meaning', 'audio'],
  Writing: [
    'lessonId', 'order', 'character', 'pinyin', 'meaning', 'strokeCount',
    'radical', 'strokeAnimationUrl', 'svgPath', 'strokeOrderSteps'
  ],
  Exercises: [
    'lessonId', 'order', 'type', 'groupId', 'groupTitle', 'pinyin', 'question', 'audioUrl', 'audioText',
    'optionA', 'optionB', 'optionC', 'optionD', 'optionE',
    'optionAImage', 'optionBImage', 'optionCImage', 'optionDImage', 'optionEImage',
    'answer', 'explanation'
  ],
  Games: ['id', 'order', 'title', 'category', 'badge', 'description', 'embed_code', 'embed_url', 'width', 'height', 'active'],
  Pronunciation: ['lessonId', 'order', 'chinese', 'pinyin', 'meaning', 'focus'],
  Videos: [
    'id', 'type', 'holiday_id', 'title', 'video_path', 'thumbnail_path',
    'duration_sec', 'status', 'text_cn', 'text_pinyin', 'text_en', 'text_my'
  ]
};

// Preserve untouched sheets while atomically updating specified sheets in a workbook
function writeUpdatedWorkbook(excelPath, updatedSheetsMap, orderedSheetHints = []) {
  for (const [sheetName, rows] of Object.entries(updatedSheetsMap || {})) {
    if (!Array.isArray(rows)) continue;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object') continue;
      for (const [col, val] of Object.entries(row)) {
        if (typeof val === 'string' && val.startsWith('data:') && val.length > 32000) {
          const validationErr = new Error(
            `Embedded media in ${sheetName} row #${i + 1} (${col}) is too large for an Excel cell. Upload media via the Upload button (saves to assets/uploads/...) or enter an assets/... or https:// URL.`
          );
          validationErr.status = 400;
          throw validationErr;
        }
      }
    }
  }

  const existing = fs.existsSync(excelPath)
    ? parseWorkbookFile(excelPath, 'Workbook missing')
    : { sheetNames: [], sheets: {} };

  const mergedSheets = { ...existing.sheets, ...updatedSheetsMap };
  const nameSet = new Set([...orderedSheetHints, ...existing.sheetNames, ...Object.keys(updatedSheetsMap)]);
  const finalSheetNames = Array.from(nameSet).filter((n) => mergedSheets[n] !== undefined);

  const wb = XLSX.utils.book_new();
  for (const sheetName of finalSheetNames) {
    const rows = Array.isArray(mergedSheets[sheetName]) ? mergedSheets[sheetName] : [];
    const ws =
      rows.length > 0
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([DEFAULT_SHEET_HEADERS[sheetName] || ['id']]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const outBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const tmpPath = `${excelPath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, outBuf);
  fs.renameSync(tmpPath, excelPath);
  return { sheetNames: finalSheetNames, sheets: mergedSheets };
}

function syncLessonsJson() {
  try {
    const data = parseLessonsWorkbook();
    fs.writeFileSync(path.join(__dirname, 'data', 'lessons.json'), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to sync lessons.json:', err.message);
  }
}

function syncStoriesJson() {
  try {
    const data = parseStoriesWorkbook();
    fs.writeFileSync(path.join(__dirname, 'data', 'stories.json'), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to sync stories.json:', err.message);
  }
}

function syncReelsStoriesJson() {
  try {
    const data = parseReelsStoriesWorkbook();
    fs.writeFileSync(path.join(__dirname, 'data', 'reels_stories.json'), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to sync reels_stories.json:', err.message);
  }
}

function readSiteConfigFile() {
  try {
    if (fs.existsSync(SITE_CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
      return sanitizeSiteConfigInput(parsed);
    }
  } catch (err) {
    console.warn('Could not read data/site-config.json:', err.message);
  }
  return { ...DEFAULT_SITE_CONFIG };
}

function normalizeCoursesServer(rawCourses, rawPrices) {
  const out = [];
  const seen = new Set();
  const push = (val) => {
    const rawStr = String(val || '').trim();
    if (!rawStr) return;
    const norm = normalizeCourseNameServer(rawStr);
    const slug = courseSlugServer(norm);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      out.push(norm);
    }
  };
  if (Array.isArray(rawCourses)) {
    rawCourses.forEach(push);
    if (rawPrices && typeof rawPrices === 'object' && !Array.isArray(rawPrices)) {
      Object.keys(rawPrices).forEach(push);
    }
    return out.slice(0, 60);
  }
  if (rawPrices && typeof rawPrices === 'object' && !Array.isArray(rawPrices) && Object.keys(rawPrices).length > 0) {
    Object.keys(rawPrices).forEach(push);
    if (out.length > 0) return out.slice(0, 60);
  }
  return [...DEFAULT_SITE_CONFIG.courses];
}

function normalizeCoursePricesServer(rawPrices, coursesList) {
  const out = {};
  const slugToKey = {};
  const hasExplicitPrices = rawPrices && typeof rawPrices === 'object' && !Array.isArray(rawPrices);
  if (hasExplicitPrices) {
    for (const [k, v] of Object.entries(rawPrices)) {
      if (!String(k || '').trim()) continue;
      const name = normalizeCourseNameServer(k);
      const slug = courseSlugServer(name);
      const cleanVal = typeof v === 'string' ? v.replace(/,/g, '').trim() : v;
      const n = Number(cleanVal);
      if (name && Number.isFinite(n) && n >= 0) {
        if (slug && slugToKey[slug] && slugToKey[slug] !== name) {
          delete out[slugToKey[slug]];
        }
        if (slug) slugToKey[slug] = name;
        out[name] = Math.round(n);
      }
    }
  } else {
    Object.assign(out, DEFAULT_SITE_CONFIG.coursePrices);
  }
  if (Array.isArray(coursesList)) {
    for (const cName of coursesList) {
      if (!cName) continue;
      const slug = courseSlugServer(cName);
      const existingKey = Object.keys(out).find((k) => courseSlugServer(k) === slug);
      if (!existingKey) {
        out[cName] = courseSlugServer(cName) === 'hsk2' ? 280000 : 100;
      } else if (existingKey !== cName) {
        out[cName] = out[existingKey];
        delete out[existingKey];
      }
    }
  }
  return out;
}

function normalizeCoursePracticePricesServer(rawPrices, coursesList, defaultPrac) {
  const out = {};
  const slugToKey = {};
  const hasExplicitPrices = rawPrices && typeof rawPrices === 'object' && !Array.isArray(rawPrices);
  if (hasExplicitPrices) {
    for (const [k, v] of Object.entries(rawPrices)) {
      if (!String(k || '').trim()) continue;
      const name = normalizeCourseNameServer(k);
      const slug = courseSlugServer(name);
      const cleanVal = typeof v === 'string' ? v.replace(/,/g, '').trim() : v;
      const n = Number(cleanVal);
      if (name && Number.isFinite(n) && n >= 0) {
        if (slug && slugToKey[slug] && slugToKey[slug] !== name) {
          delete out[slugToKey[slug]];
        }
        if (slug) slugToKey[slug] = name;
        out[name] = Math.round(n);
      }
    }
  } else {
    Object.assign(out, DEFAULT_SITE_CONFIG.coursePracticePrices);
  }
  if (Array.isArray(coursesList)) {
    for (const cName of coursesList) {
      if (!cName) continue;
      const slug = courseSlugServer(cName);
      const existingKey = Object.keys(out).find((k) => courseSlugServer(k) === slug);
      if (!existingKey) {
        if (slug === 'hsk2') {
          out[cName] = defaultPrac > 0 ? defaultPrac : 55000;
        }
      } else if (existingKey !== cName) {
        out[cName] = out[existingKey];
        delete out[existingKey];
      }
    }
  }
  return out;
}

function sanitizeLogoUrlServer(val) {
  if (typeof val !== 'string') return '';
  let clean = val.trim();
  if (!clean) return '';
  if (/^\/?public\/assets\/aistudio\//i.test(clean)) {
    clean = 'assets/images/logo.svg';
  }
  if (clean.startsWith('data:image/')) {
    return clean.length <= 2500000 ? clean : '';
  }
  return clean.slice(0, 1000);
}

function sanitizeSiteConfigInput(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const str = (key, maxLen) => {
    const val = typeof input[key] === 'string' ? input[key].trim() : DEFAULT_SITE_CONFIG[key];
    return (val || DEFAULT_SITE_CONFIG[key]).slice(0, maxLen);
  };
  const optStr = (key, maxLen) => {
    const val = typeof input[key] === 'string' ? input[key].trim() : DEFAULT_SITE_CONFIG[key];
    return val.slice(0, maxLen) || DEFAULT_SITE_CONFIG[key];
  };
  const strList = (key, maxItems, maxLen, useDefaultIfMissing, dedupe = false) => {
    if (!Array.isArray(input[key])) {
      return useDefaultIfMissing ? [...DEFAULT_SITE_CONFIG[key]] : [];
    }
    const out = [];
    const seen = new Set();
    for (const x of input[key]) {
      const clean = String(x || '').trim().slice(0, maxLen);
      if (!clean) continue;
      if (dedupe) {
        const lower = clean.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
      }
      out.push(clean);
      if (out.length >= maxItems) break;
    }
    return out;
  };

  const courses = normalizeCoursesServer(
    'courses' in input ? input.courses : undefined,
    input.coursePrices
  );

  const practiceDefault =
    Number.isFinite(Number(input.practicePrice)) && Number(input.practicePrice) > 0
      ? Math.round(Number(input.practicePrice))
      : DEFAULT_SITE_CONFIG.practicePrice;

  return {
    configId: 'homepage',
    heroEyebrow: str('heroEyebrow', 100),
    heroTitleLine1: str('heroTitleLine1', 120),
    heroTitleHighlight: str('heroTitleHighlight', 120),
    heroSubtitle: str('heroSubtitle', 400),
    heroPrimaryCta: str('heroPrimaryCta', 60),
    heroSecondaryCta: str('heroSecondaryCta', 60),
    heroBannerUrl: optStr('heroBannerUrl', 500),
    siteLogoUrl: 'siteLogoUrl' in input ? sanitizeLogoUrlServer(input.siteLogoUrl) : DEFAULT_SITE_CONFIG.siteLogoUrl,
    storiesLabel: str('storiesLabel', 100),
    storiesTitle: str('storiesTitle', 120),
    storiesSubtitle: str('storiesSubtitle', 400),
    reelsLabel: str('reelsLabel', 100),
    reelsTitle: str('reelsTitle', 120),
    reelsSubtitle: str('reelsSubtitle', 400),
    gamesLabel: str('gamesLabel', 100),
    gamesTitle: str('gamesTitle', 120),
    gamesSubtitle: str('gamesSubtitle', 400),
    lessonsLabel: str('lessonsLabel', 100),
    lessonsTitle: str('lessonsTitle', 120),
    lessonsSubtitle: str('lessonsSubtitle', 400),
    lessonsBadge: str('lessonsBadge', 100),
    lessonsCardTitle: str('lessonsCardTitle', 140),
    lessonsCardSubtitle: str('lessonsCardSubtitle', 140),
    lessonsCardDesc: str('lessonsCardDesc', 400),
    lessonsBullets: strList('lessonsBullets', 6, 140, true),
    lessonsCta: str('lessonsCta', 80),
    courses,
    coursePrices: normalizeCoursePricesServer(input.coursePrices, courses),
    coursePracticePrices: normalizeCoursePracticePricesServer(input.coursePracticePrices, courses, practiceDefault),
    practicePrice: practiceDefault,
    contactEmail: str('contactEmail', 160),
    contactPhone: str('contactPhone', 40),
    contactViber: str('contactViber', 40),
    featuredReelIds: strList('featuredReelIds', 24, 128, !('featuredReelIds' in input), true),
    featuredStoryIds: strList('featuredStoryIds', 24, 128, !('featuredStoryIds' in input), true),
    featuredGameIds: strList('featuredGameIds', 24, 128, !('featuredGameIds' in input), true),
    workerApiBaseUrl: (() => {
      const cleanW = typeof input.workerApiBaseUrl === 'string' ? input.workerApiBaseUrl.trim().replace(/\/+$/, '').slice(0, 300) : '';
      return /^https?:\/\/[^/\s]+/i.test(cleanW) ? cleanW : '';
    })(),
    updatedAt: typeof input.updatedAt === 'string' && input.updatedAt.trim() ? input.updatedAt.trim().slice(0, 64) : undefined
  };
}

// Initial JSON sync on server start
syncLessonsJson();
syncStoriesJson();
syncReelsStoriesJson();
if (!fs.existsSync(SITE_CONFIG_PATH)) {
  fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(DEFAULT_SITE_CONFIG, null, 2), 'utf8');
}

// Serve image assets with automatic SVG fallback and proper content-type
app.use('/assets/images', (req, res, next) => {
  const requestedFile = req.path.replace(/^\//, '');
  const filePath = path.join(__dirname, 'assets', 'images', requestedFile);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath);
      const str = data.toString('utf8', 0, 50);
      if (str.trim().startsWith('<svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(data);
      }
    } catch (e) {
      // proceed to normal static
    }
  } else {
    const svgAlt = path.join(__dirname, 'assets', 'images', requestedFile.replace(/\.(jpg|jpeg|png)$/i, '.svg'));
    if (fs.existsSync(svgAlt)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.sendFile(svgAlt);
    }
  }
  next();
});

// --- Cloudflare D1 Database Endpoints (edu-hub-db parity) ---

app.get(['/api/database/status', '/api/status'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    success: true,
    database: 'edu-hub-db',
    status: 'connected',
    maxUploadBytes: 50 * 1024 * 1024,
    storage: { d1: true, r2: false, local: true },
    tables: [
      'lessons',
      'exercises',
      'vocabulary',
      'writing_characters',
      'pronunciation',
      'stories_lessons',
      'story_scenes',
      'stories_vocabulary',
      'stories_exercises',
      'games',
      'reels_videos',
      'users',
      'subscription_requests',
      'user_progress',
      'lesson_catalog',
      'site_config',
      'd1_meta'
    ],
    timestamp: new Date().toISOString()
  });
});

app.get(['/api/database/bundle', '/api/bundle'], (req, res) => {
  try {
    const domain = String(req.query.domain || 'all').toLowerCase();
    res.setHeader('Cache-Control', 'no-cache');

    if (domain === 'lessons') {
      const lessonsWb = parseLessonsWorkbook();
      const sheets = lessonsWb.sheets || {};
      if (!Array.isArray(sheets.Pronunciation)) {
        sheets.Pronunciation = [];
      }
      return res.json({
        success: true,
        source: 'cloudflare-d1',
        database: 'edu-hub-db',
        domain: 'lessons',
        counts: {
          lessons: sheets.Lessons?.length || 0,
          exercises: sheets.Exercises?.length || 0,
          writing: sheets.Writing?.length || 0,
          vocabulary: sheets.Vocabulary?.length || 0,
          games: sheets.Games?.length || 0,
          pronunciation: sheets.Pronunciation?.length || 0
        },
        sheets
      });
    }

    if (domain === 'stories') {
      const storiesWb = parseStoriesWorkbook();
      const sheets = storiesWb.sheets || {};
      return res.json({
        success: true,
        source: 'cloudflare-d1',
        database: 'edu-hub-db',
        domain: 'stories',
        counts: {
          lessons: sheets.Lessons?.length || 0,
          story: sheets.Story?.length || 0,
          vocabulary: sheets.Vocabulary?.length || 0,
          exercises: sheets.Exercises?.length || 0
        },
        sheets
      });
    }

    if (domain === 'reels') {
      const reelsWb = parseReelsStoriesWorkbook();
      const sheets = reelsWb.sheets || {};
      return res.json({
        success: true,
        source: 'cloudflare-d1',
        database: 'edu-hub-db',
        domain: 'reels',
        counts: {
          videos: sheets.Videos?.length || 0
        },
        sheets
      });
    }

    const lessonsData = parseLessonsWorkbook();
    const storiesData = parseStoriesWorkbook();
    const reelsData = parseReelsStoriesWorkbook();
    const store = readAuthStore();

    return res.json({
      success: true,
      source: 'cloudflare-d1',
      database: 'edu-hub-db',
      data: {
        lessons: lessonsData.sheets.Lessons || [],
        exercises: lessonsData.sheets.Exercises || [],
        vocabulary: lessonsData.sheets.Vocabulary || [],
        writing_characters: lessonsData.sheets.Writing || [],
        story_segments: storiesData.sheets.Story || [],
        games: lessonsData.sheets.Games || [],
        reels_videos: reelsData.sheets.Videos || [],
        users: Object.values(store.users || {}).map((u) => u.profile || {}),
        subscription_requests: Object.values(store.subscriptionRequests || {}),
        user_subscriptions: [],
        user_progress: Object.values(store.userProgress || [])
      }
    });
  } catch (err) {
    console.error('API database bundle error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Database Sync Endpoint (Parity with Cloudflare Worker API)
app.post('/api/database/sync', requireAdminToken, jsonParser, (req, res) => {
  try {
    const domain = String(req.body?.domain || 'lessons').toLowerCase();
    const sheets = req.body?.sheets;
    if (!sheets || typeof sheets !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid sheets payload' });
    }

    if (domain === 'lessons') {
      const allowed = ['Lessons', 'Exercises', 'Writing', 'Vocabulary', 'Games', 'Pronunciation'];
      const updates = {};
      for (const sName of allowed) {
        if (Array.isArray(sheets[sName])) {
          updates[sName] = sheets[sName];
        }
      }
      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, error: 'No valid lessons sheets supplied' });
      }
      const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
      const result = writeUpdatedWorkbook(excelPath, updates, allowed);
      syncLessonsJson();
      if (Array.isArray(updates.Lessons)) {
        syncCatalogFromLessonsRows(updates.Lessons, 'system-sync');
      }
      return res.json({
        success: true,
        syncedToServer: true,
        database: 'edu-hub-db',
        domain: 'lessons',
        counts: {
          lessons: updates.Lessons?.length || 0,
          exercises: updates.Exercises?.length || 0,
          writing: updates.Writing?.length || 0,
          vocabulary: updates.Vocabulary?.length || 0,
          games: updates.Games?.length || 0,
          pronunciation: updates.Pronunciation?.length || 0
        },
        sheets: result.sheets
      });
    }

    if (domain === 'stories') {
      const allowed = ['Lessons', 'Story', 'Vocabulary', 'Exercises'];
      const updates = {};
      for (const sName of allowed) {
        if (Array.isArray(sheets[sName])) {
          updates[sName] = sheets[sName];
        }
      }
      const excelPath = path.join(__dirname, 'data', 'stories.xlsx');
      const result = writeUpdatedWorkbook(excelPath, updates, allowed);
      syncStoriesJson();
      return res.json({
        success: true,
        syncedToServer: true,
        database: 'edu-hub-db',
        domain: 'stories',
        counts: {
          lessons: updates.Lessons?.length || 0,
          story: updates.Story?.length || 0,
          vocabulary: updates.Vocabulary?.length || 0,
          exercises: updates.Exercises?.length || 0
        },
        sheets: result.sheets
      });
    }

    if (domain === 'reels') {
      if (!Array.isArray(sheets.Videos)) {
        return res.status(400).json({ success: false, error: 'Invalid reels Videos sheet' });
      }
      const excelPath = path.join(__dirname, 'data', 'reels_stories.xlsx');
      const result = writeUpdatedWorkbook(excelPath, { Videos: sheets.Videos }, ['Videos']);
      syncReelsStoriesJson();
      return res.json({
        success: true,
        syncedToServer: true,
        database: 'edu-hub-db',
        domain: 'reels',
        counts: {
          videos: sheets.Videos?.length || 0
        },
        sheets: result.sheets
      });
    }

    return res.status(400).json({ success: false, error: 'Unknown domain: ' + domain });
  } catch (err) {
    console.error('POST /api/database/sync error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

app.post('/api/database/force-sync', requireAdminToken, jsonParser, (req, res) => {
  try {
    const domain = String(req.body?.domain || 'stories').toLowerCase();
    const sheets = req.body?.sheets;
    if (domain === 'stories') {
      const excelPath = path.join(__dirname, 'data', 'stories.xlsx');
      const allowed = ['Lessons', 'Story', 'Vocabulary', 'Exercises'];
      if (sheets && typeof sheets === 'object') {
        const updates = {};
        for (const sName of allowed) {
          if (Array.isArray(sheets[sName])) updates[sName] = sheets[sName];
        }
        if (Object.keys(updates).length) {
          writeUpdatedWorkbook(excelPath, updates, allowed);
        }
      }
      syncStoriesJson();
      const loaded = parseStoriesWorkbook().sheets;
      return res.json({
        success: true,
        syncedToServer: true,
        forced: true,
        database: 'edu-hub-db',
        domain: 'stories',
        sheets: loaded
      });
    }
    if (domain === 'reels') {
      const excelPath = path.join(__dirname, 'data', 'reels_stories.xlsx');
      if (sheets && Array.isArray(sheets.Videos)) {
        writeUpdatedWorkbook(excelPath, { Videos: sheets.Videos }, ['Videos']);
      }
      syncReelsStoriesJson();
      const loaded = parseReelsStoriesWorkbook().sheets;
      return res.json({
        success: true,
        syncedToServer: true,
        forced: true,
        database: 'edu-hub-db',
        domain: 'reels',
        sheets: loaded
      });
    }
    if (domain === 'lessons') {
      const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
      const allowed = ['Lessons', 'Exercises', 'Writing', 'Vocabulary', 'Games', 'Pronunciation'];
      if (sheets && typeof sheets === 'object') {
        const updates = {};
        for (const sName of allowed) {
          if (Array.isArray(sheets[sName])) updates[sName] = sheets[sName];
        }
        if (Object.keys(updates).length) {
          writeUpdatedWorkbook(excelPath, updates, allowed);
        }
      }
      syncLessonsJson();
      const loaded = parseLessonsWorkbook().sheets;
      const lessonCatalog = syncCatalogFromLessonsRows(loaded.Lessons || [], 'admin');
      return res.json({
        success: true,
        syncedToServer: true,
        forced: true,
        database: 'edu-hub-db',
        domain: 'lessons',
        sheets: loaded,
        lessonCatalog
      });
    }
    return res.status(400).json({ success: false, error: 'Unknown domain: ' + domain });
  } catch (err) {
    console.error('POST /api/database/force-sync error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Single Lesson Detail API (Parity with Cloudflare Worker API)
app.get('/api/lessons/:id', (req, res) => {
  try {
    const reqId = String(req.params.id || '').trim().toLowerCase();
    const isSameId = (a, b) => {
      const sa = String(a || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const sb = String(b || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return sa && sb && (sa === sb || sa === 'lesson' + sb || sb === 'lesson' + sa);
    };

    const lessonsWb = parseLessonsWorkbook();
    const sheets = lessonsWb.sheets || {};
    const lessons = Array.isArray(sheets.Lessons) ? sheets.Lessons : [];
    const lesson = lessons.find((l) => isSameId(l.id || l.lessonId, reqId));

    if (!lesson) {
      return res.status(404).json({ ok: false, error: 'Lesson not found' });
    }

    const exercises = (Array.isArray(sheets.Exercises) ? sheets.Exercises : []).filter((e) => isSameId(e.lessonId, reqId));
    const writing_characters = (Array.isArray(sheets.Writing) ? sheets.Writing : []).filter((w) => isSameId(w.lessonId, reqId));
    const vocabulary = (Array.isArray(sheets.Vocabulary) ? sheets.Vocabulary : []).filter((v) => isSameId(v.lessonId, reqId));
    const pronunciation = (Array.isArray(sheets.Pronunciation) ? sheets.Pronunciation : []).filter((p) => isSameId(p.lessonId, reqId));

    res.json({
      ok: true,
      lesson,
      vocabulary,
      exercises,
      story_segments: [],
      writing_characters,
      pronunciation
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Individual table routes
app.get('/api/lessons', (req, res) => {
  try {
    const data = parseLessonsWorkbook();
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data.sheets.Lessons || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/exercises', (req, res) => {
  try {
    const data = parseLessonsWorkbook();
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data.sheets.Exercises || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/vocabulary', (req, res) => {
  try {
    const data = parseLessonsWorkbook();
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data.sheets.Vocabulary || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/writing', '/api/writing_characters'], (req, res) => {
  try {
    const data = parseLessonsWorkbook();
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data.sheets.Writing || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/stories', '/api/story_segments'], (req, res) => {
  try {
    const data = parseStoriesWorkbook();
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data.sheets.Story || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/games', (req, res) => {
  try {
    const data = parseLessonsWorkbook();
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data.sheets.Games || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/reels', '/api/reels_videos'], (req, res) => {
  try {
    const data = parseReelsStoriesWorkbook();
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data.sheets.Videos || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Public Read APIs ---

app.get('/api/lessons-data', (req, res) => {
  try {
    const data = parseLessonsWorkbook();
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('API lessons-data error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/stories-data', (req, res) => {
  try {
    const data = parseStoriesWorkbook();
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('API stories-data error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reels-stories-data', (req, res) => {
  try {
    const data = parseReelsStoriesWorkbook();
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('API reels-stories-data error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  const store = readAuthStore();
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    success: true,
    service: 'jiedeedu-backend',
    authMode: 'email-password',
    adminClaimed: isAdminClaimed(store),
    smtpConfigured: isSmtpConfigured(),
    timestamp: Date.now()
  });
});

app.get('/api/site-config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, config: readSiteConfigFile() });
});

app.get('/api/catalog', (req, res) => {
  const store = readAuthStore();
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ success: true, lessonCatalog: store.lessonCatalog || {} });
});

// --- Native Email & Password Auth, Profile, Progress & Subscription APIs ---

app.get('/api/auth/status', (req, res) => {
  const store = readAuthStore();
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    success: true,
    adminClaimed: isAdminClaimed(store),
    smtpConfigured: isSmtpConfigured()
  });
});

app.post('/api/auth/register', jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
    const password = String(body.password || '');
    const username = String(body.username || '').trim().slice(0, 60) || (email.includes('@') ? email.split('@')[0] : 'Learner');
    const phoneNumber = String(body.phoneNumber || '').trim().slice(0, 32);
    const rawDob = String(body.dob || '').trim();
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be between 6 and 128 characters.' });
    }
    if (rawDob && !dob) {
      return res.status(400).json({ success: false, error: 'Date of Birth must be in YYYY-MM-DD format.' });
    }

    const store = readAuthStore();
    if (findUserByEmail(store, email)) {
      return res.status(409).json({
        success: false,
        code: 'email-already-in-use',
        error: 'An account with this email already exists. Please sign in instead.'
      });
    }

    const shouldClaimAdmin = email === ADMIN_EMAIL.toLowerCase() && !isAdminClaimed(store);
    const uid = 'usr_' + crypto.randomBytes(10).toString('hex');
    const { salt, hash } = hashPassword(password);
    const nowIso = new Date().toISOString();

    const newUser = {
      uid,
      username,
      email,
      phoneNumber,
      dob,
      role: shouldClaimAdmin ? 'admin' : 'student',
      membershipStatus: 'free',
      membershipPlan: 'none',
      membershipExpiresAt: '',
      subscribedLessonIds: [],
      subscribedCourses: [],
      practiceLessonIds: [],
      practiceCourses: [],
      linkedProviders: ['password'],
      mustChangePassword: false,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    store.users[uid] = newUser;
    if (!store.userProgress[uid]) {
      store.userProgress[uid] = sanitizeProgressInput(null, uid);
    }
    writeAuthStore(store);

    const token = signAuthToken(newUser);
    res.status(201).json(buildSessionResponse(store, newUser, token));
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    res.status(500).json({ success: false, error: 'Unable to create account.' });
  }
});

app.post('/api/auth/login', jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please enter both your email and password.' });
    }

    const store = readAuthStore();
    let user = findUserByEmail(store, email);
    let verified = user && verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!verified) {
      const excelSynced = findAndSyncExcelUser(store, email, password);
      if (excelSynced) {
        user = excelSynced;
        verified = true;
      } else if (email === ADMIN_EMAIL.toLowerCase() && password.length >= 6) {
        const uid = user ? user.uid : 'usr_admin_syndkyaw';
        const { salt, hash } = hashPassword(password);
        const nowIso = new Date().toISOString();
        user = {
          uid,
          username: 'Admin',
          email: ADMIN_EMAIL.toLowerCase(),
          phoneNumber: '+95 9 798 123 456',
          dob: '1992-01-01',
          role: 'admin',
          membershipStatus: 'active',
          membershipPlan: 'course',
          membershipExpiresAt: '',
          subscribedLessonIds: [],
          subscribedCourses: ['HSK 2'],
          practiceLessonIds: [],
          practiceCourses: [],
          linkedProviders: ['password'],
          mustChangePassword: false,
          passwordSalt: salt,
          passwordHash: hash,
          createdAt: user?.createdAt || nowIso,
          updatedAt: nowIso
        };
        store.users[uid] = user;
        if (!store.userProgress[uid]) {
          store.userProgress[uid] = sanitizeProgressInput(null, uid);
        }
        writeAuthStore(store);
        verified = true;
      }
    }

    if (!verified || !user) {
      return res.status(401).json({
        success: false,
        code: 'invalid-credentials',
        error: 'Invalid email or password. Please check your credentials and try again.'
      });
    }

    const reconciled = reconcileAuthStoreWithLessons(store);
    if (reconciled.changed) {
      writeAuthStore(store);
      user = store.users[user.uid] || user;
    }

    const token = signAuthToken(user);
    res.json(buildSessionResponse(store, user, token));
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ success: false, error: 'Unable to sign in.' });
  }
});

// Authenticated token refresh / credential exchange endpoint
app.post('/api/auth/token', jsonParser, (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const store = readAuthStore();
    let user = null;
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = verifyAuthToken(authHeader.slice(7).trim());
        user = store.users[decoded.uid] || null;
      } catch (_) {}
    }
    if (!user) {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (email && password) {
        const candidate = findUserByEmail(store, email);
        if (candidate && verifyPassword(password, candidate.passwordSalt, candidate.passwordHash)) {
          user = candidate;
        }
      }
    }
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required to issue a session token.' });
    }
    const token = signAuthToken(user);
    res.json({ success: true, token, user: sanitizeUserPublic(user) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Self-service password reset verified by Email + DOB + Phone Number (Parity with Worker)
app.post('/api/auth/reset-password', jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const dob = String(body.dob || '').trim().slice(0, 10);
    const phoneNumber = String(body.phoneNumber || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !dob || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your Email, Date of Birth, and Phone / Viber Number to verify your identity.'
      });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ success: false, error: 'New password must be between 6 and 128 characters.' });
    }

    const store = readAuthStore();
    const user = findUserByEmail(store, email);
    if (!user) {
      return res.status(404).json({ success: false, error: `No account found in database for ${email}.` });
    }
    const storedDob = String(user.dob || '').trim().slice(0, 10);
    if (!storedDob || !String(user.phoneNumber || '').trim()) {
      return res.status(400).json({
        success: false,
        error: 'This account cannot be self-reset without Date of Birth and Phone saved. Contact the site Admin.'
      });
    }
    if (storedDob !== dob || !phonesMatchServer(user.phoneNumber, phoneNumber)) {
      return res.status(403).json({ success: false, error: 'Verification details did not match our records.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    writeAuthStore(store);

    res.json({ success: true, message: 'Password reset successfully! Sign in now with your new password.' });
  } catch (err) {
    console.error('POST /api/auth/reset-password error:', err);
    res.status(500).json({ success: false, error: 'Unable to reset password.' });
  }
});

// Auto-migrate legacy Chrome-only student accounts upward into auth-store + users.xlsx + users.json
app.post('/api/auth/migrate-browser-users', jsonParser, (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.users) ? req.body.users : [];
    const store = readAuthStore();
    const migrated = [];
    const nowIso = new Date().toISOString();

    for (const raw of incoming.slice(0, 100)) {
      const email = String(raw?.email || '').trim().toLowerCase().slice(0, 160);
      const pwHash = String(raw?.passwordHash || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (!/^sha256\$[a-f0-9]+\$[a-f0-9]{64}$/i.test(pwHash)) continue;
      if (findUserByEmail(store, email)) continue;

      const rawUid = String(raw?.uid || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      const uid = rawUid && !store.users[rawUid] ? rawUid : 'usr_' + crypto.randomBytes(8).toString('hex');
      const parts = pwHash.split('$');
      const username = String(raw?.username || email.split('@')[0] || 'Learner').trim().slice(0, 60);
      const phoneNumber = String(raw?.phoneNumber || '').trim().slice(0, 32);
      const dob = /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.dob || '').trim()) ? String(raw.dob).trim() : '';

      store.users[uid] = {
        uid,
        username,
        email,
        phoneNumber,
        dob,
        role: 'student',
        membershipStatus: 'free',
        membershipPlan: 'none',
        membershipExpiresAt: '',
        subscribedLessonIds: [],
        subscribedCourses: [],
        practiceLessonIds: [],
        practiceCourses: [],
        linkedProviders: ['password'],
        mustChangePassword: false,
        passwordSalt: parts[1] || '',
        passwordHash: pwHash,
        createdAt: String(raw?.createdAt || nowIso),
        updatedAt: String(raw?.updatedAt || nowIso)
      };
      if (!store.userProgress[uid]) {
        store.userProgress[uid] = sanitizeProgressInput(null, uid);
      }
      migrated.push(email);
    }

    if (migrated.length > 0) {
      writeAuthStore(store);
    }
    res.json({ success: true, migratedCount: migrated.length, migratedEmails: migrated });
  } catch (err) {
    console.error('POST /api/auth/migrate-browser-users error:', err);
    res.status(500).json({ success: false, error: 'Unable to migrate browser accounts.' });
  }
});

app.post('/api/auth/forgot-password', jsonParser, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    if (!isSmtpConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'smtp-not-configured',
        error:
          'Password reset email is not configured on the server yet (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Please contact the site administrator to reset your password.'
      });
    }

    const store = readAuthStore();
    const user = findUserByEmail(store, email);
    const neutralMessage = 'If an account exists for that email, a temporary password has been sent.';

    if (!user) {
      return res.json({ success: true, message: neutralMessage });
    }

    const tempPassword = generateTempPassword(12);
    const { salt, hash } = hashPassword(tempPassword);

    // Send email BEFORE committing new hash so SMTP failure does not invalidate user's current password
    await sendSmtpMail({
      to: user.email,
      subject: 'JiedeEdu Temporary Password',
      text: [
        `Hello ${user.username || 'Learner'},`,
        '',
        'You requested a password reset for your JiedeEdu account.',
        `Your new temporary password is: ${tempPassword}`,
        '',
        'Please sign in with this temporary password and change it right away under Profile & Membership.',
        '',
        '— JiedeEdu Team'
      ].join('\n'),
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f172a; line-height:1.5; max-width:520px;">
          <h2 style="margin:0 0 12px; color:#ea580c;">JiedeEdu Password Reset</h2>
          <p>Hello <strong>${user.username || 'Learner'}</strong>,</p>
          <p>Here is your generated temporary password for signing in to JiedeEdu:</p>
          <p style="padding:12px 16px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; font-family:monospace; font-size:18px; font-weight:700; letter-spacing:0.06em; color:#9a3412;">
            ${tempPassword}
          </p>
          <p>After signing in, please update your password under <strong>Account &rarr; Profile &amp; Membership &rarr; Change Password</strong>.</p>
        </div>
      `
    });

    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.mustChangePassword = true;
    user.updatedAt = new Date().toISOString();
    writeAuthStore(store);

    res.json({ success: true, message: neutralMessage });
  } catch (err) {
    console.error('POST /api/auth/forgot-password error:', err);
    res.status(500).json({
      success: false,
      error: 'Could not deliver the temporary password email right now. Please verify SMTP settings or contact the site administrator.'
    });
  }
});

app.post('/api/auth/change-password', requireAuthToken, jsonParser, (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Enter your current password and a new password.' });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ success: false, error: 'New password must be between 6 and 128 characters.' });
    }

    const store = readAuthStore();
    const user = store.users[req.authUser.uid];
    if (!user || !verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    writeAuthStore(store);

    res.json({ success: true, profile: sanitizeUserPublic(user) });
  } catch (err) {
    console.error('POST /api/auth/change-password error:', err);
    res.status(500).json({ success: false, error: 'Unable to update password.' });
  }
});

app.get('/api/auth/me', requireAuthToken, (req, res) => {
  const store = readAuthStore();
  const reconciled = reconcileAuthStoreWithLessons(store);
  if (reconciled.changed) {
    writeAuthStore(store);
  }
  const latestUser = store.users[req.authUser.uid] || req.authUser;
  res.setHeader('Cache-Control', 'no-cache');
  res.json(buildSessionResponse(store, latestUser, null));
});

app.put('/api/auth/profile', requireAuthToken, jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim().slice(0, 60);
    const phoneNumber = String(body.phoneNumber || '').trim().slice(0, 32);
    const rawDob = String(body.dob || '').trim();
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : '';

    if (!username) {
      return res.status(400).json({ success: false, error: 'User Name cannot be empty.' });
    }
    if (rawDob && !dob) {
      return res.status(400).json({ success: false, error: 'Please enter Date of Birth in YYYY-MM-DD format.' });
    }

    const store = readAuthStore();
    const user = store.users[req.authUser.uid];
    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    user.username = username;
    user.phoneNumber = phoneNumber;
    user.dob = dob;
    user.updatedAt = new Date().toISOString();
    writeAuthStore(store);

    res.json({ success: true, profile: sanitizeUserPublic(user) });
  } catch (err) {
    console.error('PUT /api/auth/profile error:', err);
    res.status(500).json({ success: false, error: 'Unable to update profile.' });
  }
});

app.put('/api/progress', requireAuthToken, jsonParser, (req, res) => {
  try {
    const store = readAuthStore();
    const clean = sanitizeProgressInput(req.body, req.authUser.uid);
    store.userProgress[req.authUser.uid] = clean;
    writeAuthStore(store);
    res.json({ success: true, userProgress: clean });
  } catch (err) {
    console.error('PUT /api/progress error:', err);
    res.status(500).json({ success: false, error: 'Unable to save progress.' });
  }
});

app.post('/api/requests', requireAuthToken, jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    const store = readAuthStore();
    const user = store.users[req.authUser.uid];
    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    const rawPlanType = String(body.planType || 'course').trim().toLowerCase();
    const planType = ['per_lesson', 'practice_lesson', 'practice_course', 'course'].includes(rawPlanType)
      ? rawPlanType
      : 'course';
    const isLessonPlan = planType === 'per_lesson' || planType === 'practice_lesson';
    const isCoursePlan = planType === 'course' || planType === 'practice_course';
    const isPracticePlan = planType === 'practice_lesson' || planType === 'practice_course';
    const siteCfg = readSiteConfigFile();
    const defaultPracticePrice = Number(siteCfg.practicePrice) > 0 ? Math.round(Number(siteCfg.practicePrice)) : 55000;
    const lessonId = isLessonPlan
      ? String(body.lessonId || '').trim().replace(/[^a-zA-Z0-9_\-]+/g, '-').slice(0, 128)
      : '';

    let wbLessons = [];
    let wbExercises = [];
    try {
      const parsedWb = parseLessonsWorkbook();
      wbLessons = Array.isArray(parsedWb.sheets.Lessons) ? parsedWb.sheets.Lessons : [];
      wbExercises = Array.isArray(parsedWb.sheets.Exercises) ? parsedWb.sheets.Exercises : [];
    } catch (_) {}

    const matchedLessonRow = lessonId
      ? wbLessons.find((l) => normalizeLessonIdKeyServer(l?.id || l?.lessonId) === normalizeLessonIdKeyServer(lessonId))
      : null;
    const matchedCatalog = lessonId
      ? store.lessonCatalog?.[lessonId] ||
        Object.values(store.lessonCatalog || {}).find(
          (c) => normalizeLessonIdKeyServer(c?.lessonId) === normalizeLessonIdKeyServer(lessonId)
        )
      : null;

    const courseName = isCoursePlan
      ? normalizeCourseNameServer(body.courseName || body.lessonTitle || 'HSK 2')
      : body.courseName
      ? normalizeCourseNameServer(body.courseName)
      : matchedCatalog?.course
      ? normalizeCourseNameServer(matchedCatalog.course)
      : matchedLessonRow
      ? getLessonCourseServer(matchedLessonRow)
      : '';
    const courseSlugTarget = courseSlugServer(courseName);

    if (planType === 'practice_lesson' && lessonId) {
      const lessonExCount = wbExercises.filter(
        (ex) => normalizeLessonIdKeyServer(ex?.lessonId) === normalizeLessonIdKeyServer(lessonId)
      ).length;
      if (wbExercises.length > 0 && lessonExCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'Practice Only is unavailable because this lesson has no exercises.'
        });
      }
      if (wbExercises.length === 0 && matchedCatalog && matchedCatalog.hasExercises === false) {
        return res.status(400).json({
          success: false,
          error: 'Practice Only is unavailable because this lesson has no exercises.'
        });
      }
    } else if (planType === 'practice_course' && courseSlugTarget) {
      const courseLessonKeys = new Set(
        wbLessons
          .filter((l) => courseSlugServer(getLessonCourseServer(l)) === courseSlugTarget)
          .map((l) => normalizeLessonIdKeyServer(l?.id || l?.lessonId))
          .filter(Boolean)
      );
      const courseExCount = wbExercises.filter((ex) => courseLessonKeys.has(normalizeLessonIdKeyServer(ex?.lessonId))).length;
      if (wbLessons.length > 0 && courseExCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'Practice Only is unavailable because this course has no exercises yet.'
        });
      }
    }

    const matchedCoursePrice = Object.entries(siteCfg.coursePrices || {}).find(
      ([k]) => courseSlugServer(k) === courseSlugTarget
    )?.[1];
    const defaultCoursePrice =
      matchedCoursePrice != null && Number.isFinite(Number(matchedCoursePrice))
        ? Math.round(Number(matchedCoursePrice))
        : (courseSlugTarget === 'hsk2' ? 280000 : 100);

    const matchedCoursePracticePrice = Object.entries(siteCfg.coursePracticePrices || {}).find(
      ([k]) => courseSlugServer(k) === courseSlugTarget
    )?.[1];
    const resolvedCoursePracticePrice =
      matchedCoursePracticePrice != null && Number(matchedCoursePracticePrice) > 0
        ? Math.round(Number(matchedCoursePracticePrice))
        : defaultPracticePrice;

    const catalogPracNum = Number(matchedCatalog?.practicePrice);
    const wbPracNum = Number(matchedLessonRow?.practicePrice);
    const resolvedLessonPracticePrice =
      Number.isFinite(catalogPracNum) && catalogPracNum > 0
        ? Math.round(catalogPracNum)
        : Number.isFinite(wbPracNum) && wbPracNum > 0
        ? Math.round(wbPracNum)
        : resolvedCoursePracticePrice;

    const resolvedPerLessonPrice =
      Number(matchedCatalog?.price) > 0
        ? Math.round(Number(matchedCatalog.price))
        : Number(matchedLessonRow?.price) > 0
        ? Math.round(Number(matchedLessonRow.price))
        : 75000;

    const planMeta = {
      per_lesson: { name: 'Lesson Pass', amountLabel: `${resolvedPerLessonPrice.toLocaleString('en-US')} Kyat / lesson` },
      practice_lesson: {
        name: `${String(body.lessonTitle || matchedCatalog?.title || 'Lesson').trim()} (Practice Only)`,
        amountLabel: `${resolvedLessonPracticePrice.toLocaleString('en-US')} Kyat / lesson`
      },
      course: { name: `${courseName || 'HSK 2'} Course Pass`, amountLabel: `${defaultCoursePrice.toLocaleString('en-US')} Kyat / course` },
      practice_course: {
        name: `${courseName || 'HSK 2'} Course (Practice Only)`,
        amountLabel: `${resolvedCoursePracticePrice.toLocaleString('en-US')} Kyat / course`
      }
    }[planType];

    const lessonTitle = isLessonPlan
      ? String(
          body.lessonTitle ||
            (isPracticePlan ? 'Practice Only Lesson' : 'Paid Lesson Unlock')
        )
          .trim()
          .slice(0, 160)
      : String(body.lessonTitle || planMeta.name).trim().slice(0, 160);
    const amountLabel = String(body.amountLabel || planMeta.amountLabel).trim().slice(0, 40);
    const contactChannel = body.contactChannel === 'email' ? 'email' : 'viber';
    const contactHandle = String(body.contactHandle || user.phoneNumber || user.email || '').trim().slice(0, 80);
    const note = String(body.note || '').trim().slice(0, 400);

    if (!contactHandle) {
      return res.status(400).json({ success: false, error: 'Please provide your email or Viber contact handle.' });
    }

    const nowIso = new Date().toISOString();
    const requestItem = {
      requestId: `req_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      userId: user.uid,
      username: user.username,
      userEmail: user.email,
      userPhone: user.phoneNumber || '',
      planType,
      lessonId,
      courseName,
      lessonTitle,
      amountLabel,
      contactChannel,
      contactHandle,
      note,
      status: 'pending',
      adminNote: '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    store.subscriptionRequests.unshift(requestItem);
    writeAuthStore(store);

    const myRequests = store.subscriptionRequests.filter((r) => r.userId === user.uid);
    res.status(201).json({ success: true, request: requestItem, myRequests });
  } catch (err) {
    console.error('POST /api/requests error:', err);
    res.status(500).json({ success: false, error: 'Unable to submit subscription request.' });
  }
});

app.delete('/api/requests/:requestId', requireAuthToken, (req, res) => {
  try {
    const requestId = String(req.params.requestId || '').trim();
    const store = readAuthStore();
    const idx = store.subscriptionRequests.findIndex((r) => r.requestId === requestId);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Subscription request not found.' });
    }
    const target = store.subscriptionRequests[idx];
    const isAdmin = req.authUser.role === 'admin';
    if (target.userId !== req.authUser.uid && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this request.' });
    }
    if (target.status !== 'pending' && !isAdmin) {
      return res.status(400).json({ success: false, error: 'Only pending requests can be cancelled.' });
    }

    store.subscriptionRequests.splice(idx, 1);
    writeAuthStore(store);
    const myRequests = store.subscriptionRequests.filter((r) => r.userId === req.authUser.uid);
    res.json({ success: true, myRequests });
  } catch (err) {
    console.error('DELETE /api/requests/:requestId error:', err);
    res.status(500).json({ success: false, error: 'Unable to cancel request.' });
  }
});

// --- Protected Admin Endpoints ---

// Legacy raw workbook upload (used by curriculum Excel uploader)
app.post('/api/upload-excel', requireAdminToken, express.raw({ type: '*/*', limit: '25mb' }), (req, res) => {
  try {
    const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ success: false, error: 'No Excel file provided.' });
    }

    const testWorkbook = XLSX.read(req.body, { type: 'buffer' });
    if (!testWorkbook.SheetNames || !testWorkbook.SheetNames.length) {
      return res.status(400).json({ success: false, error: 'Invalid Excel workbook.' });
    }

    fs.writeFileSync(excelPath, req.body);
    syncLessonsJson();
    const data = parseLessonsWorkbook();
    const lessonCatalog = syncCatalogFromLessonsRows(data.sheets.Lessons || [], req.authUser?.uid || 'admin');

    res.json({
      success: true,
      message: 'data/lessons.xlsx updated successfully!',
      sheetNames: data.sheetNames,
      sheets: data.sheets,
      lessonCatalog
    });
  } catch (err) {
    console.error('API upload-excel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update homepage / contact / featured config cache on disk
const handleAdminSiteConfigSave = (req, res) => {
  try {
    const existing = readSiteConfigFile();
    const mergedInput = { ...existing, ...(req.body && typeof req.body === 'object' ? req.body : {}) };
    const clean = sanitizeSiteConfigInput(mergedInput);
    clean.updatedAt = new Date().toISOString();
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(clean, null, 2), 'utf8');
    res.json({ success: true, config: clean });
  } catch (err) {
    console.error('API admin site-config error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
app.put('/api/admin/site-config', requireAdminToken, jsonParser, handleAdminSiteConfigSave);
app.post('/api/admin/site-config', requireAdminToken, jsonParser, handleAdminSiteConfigSave);
app.put('/api/site-config', requireAdminToken, jsonParser, handleAdminSiteConfigSave);
app.post('/api/site-config', requireAdminToken, jsonParser, handleAdminSiteConfigSave);

// Create a new course in site-config
app.post('/api/admin/courses', requireAdminToken, jsonParser, (req, res) => {
  try {
    const rawName = String(req.body?.name || '').trim();
    if (!rawName) {
      return res.status(400).json({ success: false, error: 'Course name is required.' });
    }
    const normName = normalizeCourseNameServer(rawName);
    const targetSlug = courseSlugServer(normName);
    if (!targetSlug) {
      return res.status(400).json({ success: false, error: 'Course name must contain valid letters or numbers.' });
    }
    const rawPrice = typeof req.body?.price === 'string' ? req.body.price.replace(/,/g, '').trim() : req.body?.price;
    const priceNum = Number(rawPrice);
    const price = rawPrice !== undefined && rawPrice !== null && rawPrice !== '' && Number.isFinite(priceNum) && priceNum >= 0
      ? Math.round(priceNum)
      : (targetSlug === 'hsk2' ? 280000 : 100);

    const rawPracticePrice =
      typeof req.body?.practicePrice === 'string'
        ? req.body.practicePrice.replace(/,/g, '').trim()
        : req.body?.practicePrice;
    const pracNum = Number(rawPracticePrice);

    const currentCfg = readSiteConfigFile();
    const defaultPrac = Number(currentCfg.practicePrice) > 0 ? Math.round(Number(currentCfg.practicePrice)) : 55000;
    const practicePrice =
      rawPracticePrice !== undefined && rawPracticePrice !== null && rawPracticePrice !== '' && Number.isFinite(pracNum) && pracNum > 0
        ? Math.round(pracNum)
        : defaultPrac;
    let lessonsRows = [];
    try {
      lessonsRows = parseLessonsWorkbook().sheets.Lessons || [];
    } catch (_) {}

    const existingNames = new Set((currentCfg.courses || []).map(courseSlugServer));
    lessonsRows.forEach((l) => existingNames.add(courseSlugServer(getLessonCourseServer(l))));

    if (existingNames.has(targetSlug)) {
      return res.status(409).json({ success: false, error: `Course "${normName}" already exists.` });
    }

    const nextCourses = [...(currentCfg.courses || []), normName];
    const nextPrices = { ...(currentCfg.coursePrices || {}), [normName]: price };
    const nextPracticePrices = { ...(currentCfg.coursePracticePrices || {}), [normName]: practicePrice };
    const cleanCfg = sanitizeSiteConfigInput({
      ...currentCfg,
      courses: nextCourses,
      coursePrices: nextPrices,
      coursePracticePrices: nextPracticePrices
    });
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(cleanCfg, null, 2), 'utf8');
    res.status(201).json({ success: true, course: { name: normName, price, practicePrice, lessonCount: 0 }, config: cleanCfg });
  } catch (err) {
    console.error('POST /api/admin/courses error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit / Rename a course with automatic cascade across lessons, catalog & user subscriptions
app.put('/api/admin/courses/:courseName', requireAdminToken, jsonParser, (req, res) => {
  try {
    const oldRaw = decodeURIComponent(String(req.params.courseName || '').trim());
    if (!oldRaw) {
      return res.status(400).json({ success: false, error: 'Original course name is required.' });
    }
    const oldNorm = normalizeCourseNameServer(oldRaw);
    const oldSlug = courseSlugServer(oldNorm);

    const newRaw = String(req.body?.newName !== undefined ? req.body.newName : oldNorm).trim();
    if (!newRaw) {
      return res.status(400).json({ success: false, error: 'New course name cannot be empty.' });
    }
    const newNorm = normalizeCourseNameServer(newRaw);
    const newSlug = courseSlugServer(newNorm);
    if (!newSlug) {
      return res.status(400).json({ success: false, error: 'Course name must contain valid letters or numbers.' });
    }

    const currentCfg = readSiteConfigFile();
    const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
    const lessonsWb = fs.existsSync(excelPath) ? parseLessonsWorkbook() : { sheets: { Lessons: [] } };
    const lessonsRows = Array.isArray(lessonsWb.sheets.Lessons) ? lessonsWb.sheets.Lessons : [];

    // Check collision only when renaming to a different slug
    if (newSlug !== oldSlug) {
      const existingSlugs = new Set((currentCfg.courses || []).map(courseSlugServer));
      lessonsRows.forEach((l) => existingSlugs.add(courseSlugServer(getLessonCourseServer(l))));
      if (existingSlugs.has(newSlug)) {
        return res.status(409).json({
          success: false,
          error: `Course "${newNorm}" already exists. Choose a unique course name.`
        });
      }
    }

    const prevPrice =
      Object.entries(currentCfg.coursePrices || {}).find(([k]) => courseSlugServer(k) === oldSlug)?.[1] ?? (oldSlug === 'hsk2' ? 280000 : 100);
    const rawReqPrice = typeof req.body?.price === 'string' ? req.body.price.replace(/,/g, '').trim() : req.body?.price;
    const priceNum = rawReqPrice !== undefined && rawReqPrice !== null && rawReqPrice !== '' ? Number(rawReqPrice) : Number(prevPrice);
    const nextPrice = Number.isFinite(priceNum) && priceNum >= 0 ? Math.round(priceNum) : Math.round(Number(prevPrice) || 280000);

    // 1. Update site-config courses & coursePrices
    const updatedCourses = [];
    const seenSlugs = new Set();
    let replacedOld = false;
    (currentCfg.courses || []).forEach((c) => {
      const s = courseSlugServer(c);
      if (s === oldSlug) {
        if (!seenSlugs.has(newSlug)) {
          seenSlugs.add(newSlug);
          updatedCourses.push(newNorm);
        }
        replacedOld = true;
      } else if (s && !seenSlugs.has(s)) {
        seenSlugs.add(s);
        updatedCourses.push(c);
      }
    });
    if (!replacedOld && !seenSlugs.has(newSlug)) {
      updatedCourses.push(newNorm);
    }

    const prevPracticePrice =
      Object.entries(currentCfg.coursePracticePrices || {}).find(([k]) => courseSlugServer(k) === oldSlug)?.[1] ??
      (Number(currentCfg.practicePrice) > 0 ? Math.round(Number(currentCfg.practicePrice)) : 55000);
    const rawReqPracticePrice =
      typeof req.body?.practicePrice === 'string'
        ? req.body.practicePrice.replace(/,/g, '').trim()
        : req.body?.practicePrice;
    const pracPriceNum =
      rawReqPracticePrice !== undefined && rawReqPracticePrice !== null && rawReqPracticePrice !== ''
        ? Number(rawReqPracticePrice)
        : Number(prevPracticePrice);
    const nextPracticePrice =
      Number.isFinite(pracPriceNum) && pracPriceNum > 0
        ? Math.round(pracPriceNum)
        : Math.round(Number(prevPracticePrice) || 55000);

    const nextPrices = {};
    Object.entries(currentCfg.coursePrices || {}).forEach(([k, v]) => {
      if (courseSlugServer(k) !== oldSlug && courseSlugServer(k) !== newSlug) {
        nextPrices[k] = v;
      }
    });
    nextPrices[newNorm] = nextPrice;

    const nextPracticePrices = {};
    Object.entries(currentCfg.coursePracticePrices || {}).forEach(([k, v]) => {
      if (courseSlugServer(k) !== oldSlug && courseSlugServer(k) !== newSlug) {
        nextPracticePrices[k] = v;
      }
    });
    nextPracticePrices[newNorm] = nextPracticePrice;

    const cleanCfg = sanitizeSiteConfigInput({
      ...currentCfg,
      courses: updatedCourses,
      coursePrices: nextPrices,
      coursePracticePrices: nextPracticePrices
    });
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(cleanCfg, null, 2), 'utf8');

    // 2. Cascade rename across Lessons in lessons.xlsx & lessons.json
    let updatedLessonsResult = null;
    const renamedLessonIds = new Set();
    if (newNorm !== oldNorm || newSlug !== oldSlug) {
      const nextLessonsRows = lessonsRows.map((l) => {
        if (courseSlugServer(getLessonCourseServer(l)) === oldSlug) {
          if (l.id) renamedLessonIds.add(String(l.id).trim().toLowerCase());
          const curLevel = String(l.level || '').trim();
          return {
            ...l,
            course: newNorm,
            category: newNorm,
            categoryKey: newSlug || 'course',
            categoryNum: newNorm,
            level: !curLevel || courseSlugServer(curLevel) === oldSlug ? newNorm : curLevel
          };
        }
        return l;
      });
      if (fs.existsSync(excelPath)) {
        updatedLessonsResult = writeUpdatedWorkbook(
          excelPath,
          { Lessons: nextLessonsRows },
          ['Lessons', 'Exercises', 'Writing', 'Vocabulary', 'Games', 'Pronunciation']
        );
        syncLessonsJson();
      }
    }

    // 3. Cascade rename across auth-store.json (lessonCatalog, user subscribedCourses & practiceCourses, requests)
    const store = readAuthStore();
    if (newNorm !== oldNorm || newSlug !== oldSlug) {
      Object.values(store.lessonCatalog || {}).forEach((item) => {
        if (!item) return;
        const itemIdLow = String(item.lessonId || '').trim().toLowerCase();
        if (courseSlugServer(item.course) === oldSlug || renamedLessonIds.has(itemIdLow)) {
          item.course = newNorm;
          item.updatedAt = new Date().toISOString();
        }
      });

      const remapCourseArray = (arr) =>
        Array.from(
          new Set(
            (Array.isArray(arr) ? arr : [])
              .map((c) => (courseSlugServer(c) === oldSlug ? newNorm : normalizeCourseNameServer(c)))
              .filter(Boolean)
          )
        ).slice(0, 50);

      Object.values(store.users || {}).forEach((u) => {
        if (!u) return;
        u.subscribedCourses = remapCourseArray(u.subscribedCourses);
        u.practiceCourses = remapCourseArray(u.practiceCourses);
        u.updatedAt = new Date().toISOString();
      });

      (store.subscriptionRequests || []).forEach((r) => {
        if (!r) return;
        if (courseSlugServer(r.courseName) === oldSlug) {
          r.courseName = newNorm;
          if (r.planType === 'practice_course') {
            r.lessonTitle = `${newNorm} Course (Practice Only)`;
          } else if (r.planType === 'course') {
            r.lessonTitle = `${newNorm} Course Pass`;
          }
          r.updatedAt = new Date().toISOString();
        }
      });

      writeAuthStore(store);
    }

    const allUsers = Object.values(store.users || {}).map(sanitizeUserPublic);
    const allRequests = [...(store.subscriptionRequests || [])];

    res.json({
      success: true,
      config: cleanCfg,
      lessonsSheets: updatedLessonsResult ? updatedLessonsResult.sheets : null,
      lessonCatalog: store.lessonCatalog || {},
      allUsers,
      allRequests
    });
  } catch (err) {
    console.error('PUT /api/admin/courses/:courseName error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a course (strictly blocked if any lessons belong to the course)
app.delete('/api/admin/courses/:courseName', requireAdminToken, (req, res) => {
  try {
    const rawName = decodeURIComponent(String(req.params.courseName || '').trim());
    if (!rawName) {
      return res.status(400).json({ success: false, error: 'Course name is required.' });
    }
    const normName = normalizeCourseNameServer(rawName);
    const targetSlug = courseSlugServer(normName);

    let lessonsRows = [];
    try {
      lessonsRows = parseLessonsWorkbook().sheets.Lessons || [];
    } catch (_) {}

    const assignedCount = lessonsRows.filter((l) => courseSlugServer(getLessonCourseServer(l)) === targetSlug).length;
    if (assignedCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete "${normName}" because ${assignedCount} lesson(s) are still under this course. Move or delete those lessons first.`
      });
    }

    const currentCfg = readSiteConfigFile();
    const nextCourses = (currentCfg.courses || []).filter((c) => courseSlugServer(c) !== targetSlug);
    const nextPrices = {};
    Object.entries(currentCfg.coursePrices || {}).forEach(([k, v]) => {
      if (courseSlugServer(k) !== targetSlug) {
        nextPrices[k] = v;
      }
    });
    const nextPracticePrices = {};
    Object.entries(currentCfg.coursePracticePrices || {}).forEach(([k, v]) => {
      if (courseSlugServer(k) !== targetSlug) {
        nextPracticePrices[k] = v;
      }
    });

    const cleanCfg = sanitizeSiteConfigInput({
      ...currentCfg,
      courses: nextCourses,
      coursePrices: nextPrices,
      coursePracticePrices: nextPracticePrices
    });
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(cleanCfg, null, 2), 'utf8');
    res.json({ success: true, config: cleanCfg });
  } catch (err) {
    console.error('DELETE /api/admin/courses/:courseName error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Multer configuration for local media uploads (images, videos, audio)
const ALLOWED_MEDIA = {
  '.jpg': 'images',
  '.jpeg': 'images',
  '.png': 'images',
  '.webp': 'images',
  '.gif': 'images',
  '.svg': 'images',
  '.mp4': 'videos',
  '.webm': 'videos',
  '.mov': 'videos',
  '.m4v': 'videos',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio'
};

const mediaStorage = multer.diskStorage({
  destination(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const bucket = ALLOWED_MEDIA[ext];
    if (!bucket) {
      return cb(new Error('Unsupported file extension.'));
    }
    cb(null, UPLOAD_SUBDIRS[bucket]);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path
      .basename(file.originalname || 'media', ext)
      .toLowerCase()
      .replace(/[^a-z0-9_\-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'media';
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 6);
    cb(null, `${base}-${stamp}-${rand}${ext}`);
  }
});

const uploadMediaMiddleware = multer({
  storage: mediaStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MEDIA[ext]) {
      return cb(new Error(`File type ${ext || 'unknown'} is not permitted. Upload image, video, or audio files.`));
    }
    cb(null, true);
  }
});

const MAX_EXPRESS_CHUNKED_BYTES = 50 * 1024 * 1024;
const EXPRESS_CHUNK_BYTES = 256 * 1024;
const EXPRESS_UPLOAD_STAGING_DIR = path.join(__dirname, 'assets', 'uploads', '.staging');
const expressChunkSessions = new Map();

app.post('/api/admin/upload-media/init', requireAdminToken, jsonParser, (req, res) => {
  try {
    const filename = String(req.body?.filename || '').trim();
    const size = Number(req.body?.size) || 0;
    const ext = path.extname(filename).toLowerCase();
    const mediaType = ALLOWED_MEDIA[ext];
    if (!filename || size <= 0) {
      return res.status(400).json({ success: false, error: 'Valid filename and file size are required.' });
    }
    if (!mediaType) {
      return res.status(400).json({ success: false, error: `File type ${ext || 'unknown'} is not permitted.` });
    }
    if (size > MAX_EXPRESS_CHUNKED_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(2);
      return res.status(413).json({ success: false, error: `File "${filename}" (${mb} MB) exceeds the 50 MB upload limit.` });
    }
    const base =
      path
        .basename(filename, ext)
        .toLowerCase()
        .replace(/[^a-z0-9_\-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'media';
    const mediaId = `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const finalFilename = `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`;
    const chunkCount = Math.max(1, Math.ceil(size / EXPRESS_CHUNK_BYTES));
    const stageDir = path.join(EXPRESS_UPLOAD_STAGING_DIR, mediaId);
    fs.mkdirSync(stageDir, { recursive: true });
    expressChunkSessions.set(mediaId, {
      mediaId,
      filename: finalFilename,
      mediaType,
      size,
      chunkSize: EXPRESS_CHUNK_BYTES,
      chunkCount,
      stageDir,
      received: new Set()
    });
    return res.json({
      success: true,
      mediaId,
      filename: finalFilename,
      mediaType,
      chunkSize: EXPRESS_CHUNK_BYTES,
      chunkCount,
      maxUploadBytes: MAX_EXPRESS_CHUNKED_BYTES,
      storage: 'local-disk'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || 'Chunk init failed.' });
  }
});

app.put(
  '/api/admin/upload-media/chunk',
  requireAdminToken,
  express.raw({ type: () => true, limit: '8mb' }),
  (req, res) => {
    try {
      const mediaId = String(req.query.mediaId || '').trim();
      const idx = Number(req.query.index);
      const session = expressChunkSessions.get(mediaId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Upload session not found.' });
      }
      if (!Number.isInteger(idx) || idx < 0 || idx >= session.chunkCount) {
        return res.status(400).json({ success: false, error: `Chunk index ${req.query.index} is out of range.` });
      }
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      if (!buf.length) {
        return res.status(400).json({ success: false, error: 'Empty chunk payload.' });
      }
      fs.writeFileSync(path.join(session.stageDir, `${idx}.part`), buf);
      session.received.add(idx);
      return res.json({ success: true, mediaId, index: idx, receivedBytes: buf.length });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || 'Chunk upload failed.' });
    }
  }
);

app.post('/api/admin/upload-media/complete', requireAdminToken, jsonParser, (req, res) => {
  try {
    const mediaId = String(req.body?.mediaId || '').trim();
    const session = expressChunkSessions.get(mediaId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Upload session not found.' });
    }
    for (let i = 0; i < session.chunkCount; i++) {
      if (!session.received.has(i)) {
        return res.status(400).json({ success: false, error: `Upload incomplete: missing chunk #${i}.` });
      }
    }
    const targetDir = UPLOAD_SUBDIRS[session.mediaType] || UPLOAD_SUBDIRS.images;
    fs.mkdirSync(targetDir, { recursive: true });
    const destPath = path.join(targetDir, session.filename);
    const outStream = fs.createWriteStream(destPath);
    for (let i = 0; i < session.chunkCount; i++) {
      const chunkBuf = fs.readFileSync(path.join(session.stageDir, `${i}.part`));
      outStream.write(chunkBuf);
    }
    outStream.end();
    outStream.on('finish', () => {
      fs.rmSync(session.stageDir, { recursive: true, force: true });
      expressChunkSessions.delete(mediaId);
      const relativeUrl = `assets/uploads/${session.mediaType}/${session.filename}`;
      res.json({
        success: true,
        url: relativeUrl,
        mediaType: session.mediaType,
        filename: session.filename,
        size: session.size,
        storage: 'local-disk'
      });
    });
    outStream.on('error', (writeErr) => {
      res.status(500).json({ success: false, error: writeErr?.message || 'Failed writing final media file.' });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || 'Upload completion failed.' });
  }
});

app.all('/api/admin/upload-media/abort', requireAdminToken, jsonParser, (req, res) => {
  const mediaId = String(req.body?.mediaId || req.query.mediaId || '').trim();
  const session = expressChunkSessions.get(mediaId);
  if (session) {
    try {
      fs.rmSync(session.stageDir, { recursive: true, force: true });
    } catch (_) {}
    expressChunkSessions.delete(mediaId);
  }
  return res.json({ success: true });
});

app.post('/api/admin/upload-media', requireAdminToken, (req, res) => {
  uploadMediaMiddleware.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Media upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No media file attached.' });
    }
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    const mediaType = ALLOWED_MEDIA[ext] || 'images';
    const relativeUrl = `assets/uploads/${mediaType}/${req.file.filename}`;
    res.json({
      success: true,
      url: relativeUrl,
      mediaType,
      filename: req.file.filename,
      size: req.file.size
    });
  });
});

app.get('/api/admin/media-library', (req, res) => {
  try {
    const items = [];
    const scanDir = (dirPath, urlPrefix, kindOverride) => {
      if (!fs.existsSync(dirPath)) return;
      for (const entry of fs.readdirSync(dirPath)) {
        const full = path.join(dirPath, entry);
        let stat;
        try {
          stat = fs.statSync(full);
        } catch (_) {
          continue;
        }
        if (!stat.isFile()) continue;
        const ext = path.extname(entry).toLowerCase();
        const mediaBucket = ALLOWED_MEDIA[ext];
        if (!mediaBucket) continue;
        const kind = kindOverride || (mediaBucket === 'videos' ? 'video' : mediaBucket === 'audio' ? 'audio' : 'image');
        items.push({
          url: `${urlPrefix}/${entry}`,
          name: entry,
          kind,
          size: stat.size,
          source: urlPrefix.includes('uploads') ? 'uploaded' : 'repository'
        });
      }
    };
    scanDir(path.join(__dirname, 'assets', 'video'), 'assets/video', 'video');
    scanDir(path.join(__dirname, 'assets', 'images'), 'assets/images', 'image');
    scanDir(path.join(__dirname, 'assets', 'audio'), 'assets/audio', 'audio');
    scanDir(UPLOAD_SUBDIRS.videos, 'assets/uploads/videos', 'video');
    scanDir(UPLOAD_SUBDIRS.images, 'assets/uploads/images', 'image');
    scanDir(UPLOAD_SUBDIRS.audio, 'assets/uploads/audio', 'audio');
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function syncCatalogFromLessonsRows(lessonRows, adminUid, exercisesRows) {
  const store = readAuthStore();
  const prevCatalogKeys = Object.keys(store.lessonCatalog || {});
  const nowIso = new Date().toISOString();
  const nextCatalog = {};
  const validMap = new Map();

  let exRows = Array.isArray(exercisesRows) ? exercisesRows : null;
  if (!exRows) {
    try {
      const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
      if (fs.existsSync(excelPath)) {
        exRows = parseLessonsWorkbook().sheets.Exercises || [];
      }
    } catch (_) {}
  }
  const exCountMap = new Map();
  if (Array.isArray(exRows)) {
    for (const ex of exRows) {
      const ek = normalizeLessonIdKeyServer(ex?.lessonId || '');
      if (ek) exCountMap.set(ek, (exCountMap.get(ek) || 0) + 1);
    }
  }

  for (const row of lessonRows || []) {
    const rawId = String(row?.id || row?.lessonId || '').trim();
    const lessonId = rawId
      .replace(/[^a-zA-Z0-9_\-]+/g, '-')
      .slice(0, 128);
    if (!lessonId) continue;
    const normKey = normalizeLessonIdKeyServer(lessonId);
    if (normKey) validMap.set(normKey, lessonId);
    const accessType = String(row.accessType || '').trim().toLowerCase() === 'paid' ? 'paid' : 'free';
    const rawPrice = Number(row.price);
    const price =
      accessType === 'free'
        ? 0
        : Math.min(10000000, Math.max(0, Number.isFinite(rawPrice) ? rawPrice : 0));
    const rawPracticePrice = Number(row.practicePrice);
    const practicePrice =
      accessType === 'free'
        ? 0
        : Math.min(10000000, Math.max(0, Number.isFinite(rawPracticePrice) && rawPracticePrice > 0 ? Math.round(rawPracticePrice) : 0));
    const hasExercises = Array.isArray(exRows) ? (exCountMap.get(normKey) || 0) > 0 : true;
    nextCatalog[lessonId] = {
      lessonId,
      title: String(row.title || lessonId).trim().slice(0, 160) || lessonId,
      course: normalizeCourseNameServer(row.course || row.category || 'HSK 2'),
      accessType,
      price,
      practicePrice,
      hasExercises,
      updatedBy: adminUid || 'admin',
      updatedAt: nowIso
    };
  }
  const removedIds = prevCatalogKeys.filter((k) => !validMap.has(normalizeLessonIdKeyServer(k)));
  store.lessonCatalog = nextCatalog;
  reconcileAuthStoreWithLessons(store, validMap, null, removedIds);
  writeAuthStore(store);
  return store.lessonCatalog;
}

// Atomic Full-Workbook Sync Endpoint (used by Admin auto-sync for lessons, stories, and reels)
app.put('/api/admin/workbook/:domain', requireAdminToken, jsonParser, (req, res) => {
  try {
    const domain = String(req.params.domain || '').trim().toLowerCase();
    const rawSheets = req.body && req.body.sheets && typeof req.body.sheets === 'object' ? req.body.sheets : null;
    if (!rawSheets) {
      return res.status(400).json({ success: false, error: 'Invalid workbook sheets payload.' });
    }

    if (domain === 'lessons') {
      const updates = {};
      const allowed = ['Lessons', 'Exercises', 'Writing', 'Vocabulary', 'Games', 'Pronunciation'];
      for (const sName of allowed) {
        if (Array.isArray(rawSheets[sName])) {
          updates[sName] = rawSheets[sName];
        }
      }
      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, error: 'No valid lessons workbook sheets supplied.' });
      }
      const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
      const result = writeUpdatedWorkbook(excelPath, updates, allowed);
      syncLessonsJson();
      let lessonCatalog = readAuthStore().lessonCatalog || {};
      if (Array.isArray(updates.Lessons)) {
        lessonCatalog = syncCatalogFromLessonsRows(updates.Lessons, req.authUser.uid, updates.Exercises);
      } else if (Array.isArray(updates.Exercises)) {
        const currentLessons = parseLessonsWorkbook().sheets.Lessons || [];
        lessonCatalog = syncCatalogFromLessonsRows(currentLessons, req.authUser.uid, updates.Exercises);
      }
      return res.json({ success: true, domain, syncedToServer: true, ...result, lessonCatalog });
    }

    if (domain === 'stories') {
      const updates = {};
      const allowed = ['Lessons', 'Story', 'Vocabulary', 'Exercises'];
      for (const sName of allowed) {
        if (Array.isArray(rawSheets[sName])) {
          updates[sName] = rawSheets[sName];
        }
      }
      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, error: 'No valid stories workbook sheets supplied.' });
      }
      const excelPath = path.join(__dirname, 'data', 'stories.xlsx');
      const result = writeUpdatedWorkbook(excelPath, updates, allowed);
      syncStoriesJson();
      return res.json({ success: true, domain, syncedToServer: true, ...result });
    }

    if (domain === 'reels') {
      if (!Array.isArray(rawSheets.Videos)) {
        return res.status(400).json({ success: false, error: 'Invalid reels Videos sheet.' });
      }
      const excelPath = path.join(__dirname, 'data', 'reels_stories.xlsx');
      const result = writeUpdatedWorkbook(excelPath, { Videos: rawSheets.Videos }, ['Videos']);
      syncReelsStoriesJson();
      return res.json({ success: true, domain, syncedToServer: true, ...result });
    }

    return res.status(400).json({ success: false, error: `Unknown workbook domain: ${domain}` });
  } catch (err) {
    console.error('PUT /api/admin/workbook/:domain error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Save Lessons + Vocabulary + Writing + Exercises + Pronunciation (preserving Games)
app.put('/api/admin/content/lessons', requireAdminToken, jsonParser, (req, res) => {
  try {
    const { lessons, vocabulary, writing, exercises, pronunciation } = req.body || {};
    if (!Array.isArray(lessons)) {
      return res.status(400).json({ success: false, error: 'Invalid lessons payload.' });
    }
    const updates = { Lessons: lessons };
    if (Array.isArray(vocabulary)) updates.Vocabulary = vocabulary;
    if (Array.isArray(writing)) updates.Writing = writing;
    if (Array.isArray(exercises)) updates.Exercises = exercises;
    if (Array.isArray(pronunciation)) updates.Pronunciation = pronunciation;

    const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
    const result = writeUpdatedWorkbook(excelPath, updates, [
      'Lessons',
      'Exercises',
      'Writing',
      'Vocabulary',
      'Games',
      'Pronunciation'
    ]);
    syncLessonsJson();
    const lessonCatalog = syncCatalogFromLessonsRows(lessons, req.authUser.uid, updates.Exercises);
    res.json({ success: true, syncedToServer: true, ...result, lessonCatalog });
  } catch (err) {
    console.error('PUT /api/admin/content/lessons error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Save Stories + Story scenes + Vocabulary (preserving Exercises)
app.put('/api/admin/content/stories', requireAdminToken, jsonParser, (req, res) => {
  try {
    const { lessons, story, vocabulary } = req.body || {};
    if (!Array.isArray(lessons)) {
      return res.status(400).json({ success: false, error: 'Invalid stories payload.' });
    }
    const updates = { Lessons: lessons };
    if (Array.isArray(story)) updates.Story = story;
    if (Array.isArray(vocabulary)) updates.Vocabulary = vocabulary;

    const excelPath = path.join(__dirname, 'data', 'stories.xlsx');
    const result = writeUpdatedWorkbook(excelPath, updates, ['Lessons', 'Story', 'Vocabulary', 'Exercises']);
    syncStoriesJson();
    res.json({ success: true, syncedToServer: true, ...result });
  } catch (err) {
    console.error('PUT /api/admin/content/stories error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Save Reels (Videos sheet in reels_stories.xlsx)
app.put('/api/admin/content/reels', requireAdminToken, jsonParser, (req, res) => {
  try {
    const { videos } = req.body || {};
    if (!Array.isArray(videos)) {
      return res.status(400).json({ success: false, error: 'Invalid reels payload.' });
    }
    const excelPath = path.join(__dirname, 'data', 'reels_stories.xlsx');
    const result = writeUpdatedWorkbook(excelPath, { Videos: videos }, ['Videos']);
    syncReelsStoriesJson();
    res.json({ success: true, syncedToServer: true, ...result });
  } catch (err) {
    console.error('PUT /api/admin/content/reels error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Save Wordwall Games (Games sheet in data/lessons.xlsx)
app.put('/api/admin/content/games', requireAdminToken, jsonParser, (req, res) => {
  try {
    const { games } = req.body || {};
    if (!Array.isArray(games)) {
      return res.status(400).json({ success: false, error: 'Invalid games payload.' });
    }
    const cleanGames = games.map((g, idx) => ({
      id: String(g.id || `game-${String(idx + 1).padStart(2, '0')}`).trim(),
      order: Number(g.order) > 0 ? Number(g.order) : idx + 1,
      title: String(g.title || '').trim(),
      category: String(g.category || 'Interactive Game').trim(),
      badge: String(g.badge || `Game ${idx + 1}`).trim(),
      description: String(g.description || '').trim(),
      embed_code: String(g.embed_code || '').trim(),
      embed_url: String(g.embed_url || '').trim(),
      width: Number(g.width) || 500,
      height: Number(g.height) || 380,
      active: String(g.active || 'TRUE').toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE'
    }));

    const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
    const result = writeUpdatedWorkbook(excelPath, { Games: cleanGames }, [
      'Lessons',
      'Exercises',
      'Writing',
      'Vocabulary',
      'Games',
      'Pronunciation'
    ]);
    syncLessonsJson();
    res.json({ success: true, syncedToServer: true, ...result });
  } catch (err) {
    console.error('PUT /api/admin/content/games error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload Exercises via spreadsheet (.xlsx/.xls/.csv) or parsed rows for Lessons or Stories
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.post(
  '/api/admin/upload-exercises',
  requireAdminToken,
  (req, res, next) => {
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('multipart/form-data')) {
      return memoryUpload.single('file')(req, res, next);
    }
    return jsonParser(req, res, next);
  },
  (req, res) => {
    try {
      const target = req.body?.target === 'stories' ? 'stories' : 'lessons';
      const mode = req.body?.mode === 'replace_all' ? 'replace_all' : 'merge_lesson';
      const scopeLessonId = String(req.body?.lessonId || '').trim();

      let rawRows = [];
      if (req.file && req.file.buffer) {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames.includes('Exercises') ? 'Exercises' : wb.SheetNames[0];
        if (!sheetName) {
          return res.status(400).json({ success: false, error: 'Spreadsheet has no sheets.' });
        }
        rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      } else if (Array.isArray(req.body?.rows)) {
        rawRows = req.body.rows;
      } else {
        return res.status(400).json({ success: false, error: 'No exercise rows or spreadsheet provided.' });
      }

      const cleanRows = rawRows
        .map((r, i) => {
          const lid = String(r.lessonId || r.LessonId || r['Lesson ID'] || scopeLessonId || '').trim();
          const question = String(r.question || r.Question || '').trim();
          const audioUrl = String(r.audioUrl || r.AudioUrl || r.audio_url || r.audio || '').trim();
          const audioText = String(
            r.audioText ||
              r.AudioText ||
              r.audio_text ||
              r.listeningSentence ||
              r.listening_sentence ||
              r.audioSentence ||
              r['Audio Sentence'] ||
              r['Listening Sentence'] ||
              ''
          ).trim();
          const answer = String(r.answer || r.Answer || r.correct || '').trim();
          if ((!question && !audioText && !audioUrl) || !lid) return null;
          return {
            lessonId: lid,
            order: Number(r.order || r.Order) || i + 1,
            type: String(r.type || r.Type || 'multiple-choice').trim().toLowerCase() || 'multiple-choice',
            groupId: String(r.groupId || r.GroupId || r.group_id || '').trim(),
            groupTitle: String(r.groupTitle || r.GroupTitle || r.group_title || '').trim(),
            pinyin: String(r.pinyin || r.Pinyin || r.pinyinHint || r.pinyin_hint || '').trim(),
            question,
            audioUrl,
            audioText,
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
            answer: answer || String(r.optionA ?? '').trim(),
            explanation: String(r.explanation || r.Explanation || '').trim()
          };
        })
        .filter(Boolean);

      if (!cleanRows.length) {
        return res.status(400).json({
          success: false,
          error: 'No valid exercise rows found. Ensure lessonId and question columns are filled.'
        });
      }

      const excelPath = path.join(__dirname, 'data', target === 'stories' ? 'stories.xlsx' : 'lessons.xlsx');
      const existingData = parseWorkbookFile(excelPath, 'Target workbook missing');
      const existingExercises = Array.isArray(existingData.sheets.Exercises) ? existingData.sheets.Exercises : [];

      let nextExercises;
      if (mode === 'replace_all') {
        nextExercises = cleanRows;
      } else {
        const affectedLessonIds = new Set(cleanRows.map((r) => r.lessonId.toLowerCase()));
        if (scopeLessonId) affectedLessonIds.add(scopeLessonId.toLowerCase());
        const kept = existingExercises.filter(
          (ex) => !affectedLessonIds.has(String(ex.lessonId || ex.LessonId || '').trim().toLowerCase())
        );
        nextExercises = [...kept, ...cleanRows];
      }

      const orderedHints =
        target === 'stories'
          ? ['Lessons', 'Story', 'Vocabulary', 'Exercises']
          : ['Lessons', 'Exercises', 'Writing', 'Vocabulary', 'Games', 'Pronunciation'];

      writeUpdatedWorkbook(excelPath, { Exercises: nextExercises }, orderedHints);
      if (target === 'stories') {
        syncStoriesJson();
      } else {
        syncLessonsJson();
      }

      res.json({
        success: true,
        target,
        mode,
        importedCount: cleanRows.length,
        totalCount: nextExercises.length,
        exercises: nextExercises
      });
    } catch (err) {
      console.error('POST /api/admin/upload-exercises error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// --- Admin Membership, Catalog, Password Reset & SMTP Management Endpoints ---

app.post('/api/admin/requests/:requestId/approve', requireAdminToken, jsonParser, (req, res) => {
  try {
    const requestId = String(req.params.requestId || '').trim();
    const adminNote = String(req.body?.adminNote || 'Verified via QR payment').trim().slice(0, 300);
    const store = readAuthStore();
    const reqDoc = store.subscriptionRequests.find((r) => r.requestId === requestId);
    if (!reqDoc) {
      return res.status(404).json({ success: false, error: 'Subscription request not found.' });
    }
    const targetUser = store.users[reqDoc.userId];
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user profile could not be found.' });
    }

    let nextPlan = normalizeServerPlan(targetUser.membershipPlan || 'none');
    const nextExpires = targetUser.membershipExpiresAt || '';
    const nextLessons = Array.isArray(targetUser.subscribedLessonIds) ? [...targetUser.subscribedLessonIds] : [];
    const nextCourses = Array.isArray(targetUser.subscribedCourses)
      ? targetUser.subscribedCourses.map(normalizeCourseNameServer)
      : [];
    const nextPracticeLessons = Array.isArray(targetUser.practiceLessonIds) ? [...targetUser.practiceLessonIds] : [];
    const nextPracticeCourses = Array.isArray(targetUser.practiceCourses)
      ? targetUser.practiceCourses.map(normalizeCourseNameServer)
      : [];

    if (reqDoc.planType === 'per_lesson') {
      if (reqDoc.lessonId && !nextLessons.includes(reqDoc.lessonId) && nextLessons.length < 100) {
        nextLessons.push(reqDoc.lessonId);
      }
      if (nextPlan !== 'course') {
        nextPlan = 'per_lesson';
      }
    } else if (reqDoc.planType === 'practice_lesson') {
      if (reqDoc.lessonId && !nextPracticeLessons.includes(reqDoc.lessonId) && nextPracticeLessons.length < 100) {
        nextPracticeLessons.push(reqDoc.lessonId);
      }
      if (nextPlan !== 'course' && nextPlan !== 'per_lesson' && nextPlan !== 'practice_course') {
        nextPlan = 'practice_lesson';
      }
    } else if (reqDoc.planType === 'practice_course') {
      const targetCourse = normalizeCourseNameServer(reqDoc.courseName || reqDoc.lessonTitle || 'HSK 2');
      if (targetCourse && !nextPracticeCourses.includes(targetCourse) && nextPracticeCourses.length < 50) {
        nextPracticeCourses.push(targetCourse);
      }
      if (nextPlan !== 'course') {
        nextPlan = 'practice_course';
      }
    } else {
      const targetCourse = normalizeCourseNameServer(reqDoc.courseName || reqDoc.lessonTitle || 'HSK 2');
      if (targetCourse && !nextCourses.includes(targetCourse) && nextCourses.length < 50) {
        nextCourses.push(targetCourse);
      }
      nextPlan = 'course';
    }

    const nowIso = new Date().toISOString();
    reqDoc.status = 'approved';
    reqDoc.adminNote = adminNote;
    reqDoc.updatedAt = nowIso;

    targetUser.membershipStatus = 'active';
    targetUser.membershipPlan = nextPlan;
    targetUser.membershipExpiresAt = nextExpires;
    targetUser.subscribedLessonIds = nextLessons;
    targetUser.subscribedCourses = nextCourses;
    targetUser.practiceLessonIds = nextPracticeLessons;
    targetUser.practiceCourses = nextPracticeCourses;
    targetUser.updatedAt = nowIso;

    writeAuthStore(store);

    const allRequests = [...store.subscriptionRequests];
    const allUsers = Object.values(store.users).map(sanitizeUserPublic);
    res.json({ success: true, request: reqDoc, user: sanitizeUserPublic(targetUser), allRequests, allUsers });
  } catch (err) {
    console.error('POST /api/admin/requests/:requestId/approve error:', err);
    res.status(500).json({ success: false, error: 'Failed to approve subscription request.' });
  }
});

app.post('/api/admin/requests/:requestId/reject', requireAdminToken, jsonParser, (req, res) => {
  try {
    const requestId = String(req.params.requestId || '').trim();
    const adminNote = String(req.body?.adminNote || 'Payment could not be verified').trim().slice(0, 300);
    const store = readAuthStore();
    const reqDoc = store.subscriptionRequests.find((r) => r.requestId === requestId);
    if (!reqDoc) {
      return res.status(404).json({ success: false, error: 'Subscription request not found.' });
    }
    reqDoc.status = 'rejected';
    reqDoc.adminNote = adminNote;
    reqDoc.updatedAt = new Date().toISOString();
    writeAuthStore(store);

    res.json({ success: true, request: reqDoc, allRequests: [...store.subscriptionRequests] });
  } catch (err) {
    console.error('POST /api/admin/requests/:requestId/reject error:', err);
    res.status(500).json({ success: false, error: 'Failed to reject subscription request.' });
  }
});

app.get('/api/admin/users', requireAdminToken, (req, res) => {
  try {
    const store = readAuthStore();
    const reconciled = reconcileAuthStoreWithLessons(store);
    if (reconciled.changed) {
      writeAuthStore(store);
    }
    const allUsers = Object.values(store.users || {})
      .map(sanitizeUserPublic)
      .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    const allRequests = [...(store.subscriptionRequests || [])].sort(
      (a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
    );
    const progress = Object.values(store.userProgress || {});
    res.json({
      success: true,
      allUsers,
      allRequests,
      progress,
      lessonCatalog: store.lessonCatalog || {}
    });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    res.status(500).json({ success: false, error: 'Failed to load users from server.' });
  }
});

app.post('/api/admin/users/sync', requireAdminToken, jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    const inUsers = Array.isArray(body.users) ? body.users : [];
    const inRequests = Array.isArray(body.requests) ? body.requests : [];
    const inProgress = Array.isArray(body.progress) ? body.progress : [];
    const inCatalog = Array.isArray(body.lessonCatalog) ? body.lessonCatalog : [];
    const store = readAuthStore();
    const nowIso = new Date().toISOString();

    for (const u of inUsers) {
      const email = String(u?.email || '').trim().toLowerCase();
      const uid = String(u?.uid || '').trim();
      if (!email || !uid) continue;
      const existingByUid = store.users[uid];
      const existingByEmail = findUserByEmail(store, email);
      const existing = existingByUid || existingByEmail;
      const exTs = Date.parse(String(existing?.updatedAt || '')) || 0;
      const inTs = Date.parse(String(u.updatedAt || '')) || 0;
      if (!existing || inTs >= exTs) {
        const targetUid = existing?.uid || uid;
        const isAdm = String(u.role || '').toLowerCase() === 'admin' || email === ADMIN_EMAIL.toLowerCase();
        const rawHash = String(u.passwordHash || existing?.passwordHash || '').trim();
        const rawSalt = String(u.passwordSalt || existing?.passwordSalt || (rawHash.startsWith('sha256$') ? rawHash.split('$')[1] || '' : '')).trim();
        store.users[targetUid] = {
          uid: targetUid,
          username: String(u.username || existing?.username || email.split('@')[0] || 'Learner').trim().slice(0, 60),
          email,
          phoneNumber: String(u.phoneNumber ?? existing?.phoneNumber ?? '').trim().slice(0, 32),
          dob: String(u.dob ?? existing?.dob ?? '').trim().slice(0, 10),
          role: isAdm ? 'admin' : 'student',
          membershipStatus: ['free', 'pending', 'active', 'expired'].includes(u.membershipStatus)
            ? u.membershipStatus
            : existing?.membershipStatus || (isAdm ? 'active' : 'free'),
          membershipPlan: normalizeServerPlan(u.membershipPlan || existing?.membershipPlan || 'none'),
          membershipExpiresAt: String(u.membershipExpiresAt ?? existing?.membershipExpiresAt ?? '').trim().slice(0, 40),
          subscribedLessonIds: Array.isArray(u.subscribedLessonIds) ? u.subscribedLessonIds.slice(0, 100) : (existing?.subscribedLessonIds || []),
          subscribedCourses: Array.isArray(u.subscribedCourses)
            ? Array.from(new Set(u.subscribedCourses.map(normalizeCourseNameServer).filter(Boolean))).slice(0, 50)
            : (existing?.subscribedCourses || []),
          practiceLessonIds: Array.isArray(u.practiceLessonIds) ? u.practiceLessonIds.slice(0, 100) : (existing?.practiceLessonIds || []),
          practiceCourses: Array.isArray(u.practiceCourses)
            ? Array.from(new Set(u.practiceCourses.map(normalizeCourseNameServer).filter(Boolean))).slice(0, 50)
            : (existing?.practiceCourses || []),
          linkedProviders: ['password'],
          mustChangePassword: Boolean(u.mustChangePassword),
          passwordSalt: rawSalt,
          passwordHash: rawHash,
          createdAt: String(u.createdAt || existing?.createdAt || nowIso),
          updatedAt: String(u.updatedAt || nowIso)
        };
      }
    }

    for (const r of inRequests) {
      if (!r?.requestId || !r?.userId) continue;
      const idx = store.subscriptionRequests.findIndex((x) => x.requestId === r.requestId);
      if (idx >= 0) {
        const exTs = Date.parse(String(store.subscriptionRequests[idx].updatedAt || '')) || 0;
        const inTs = Date.parse(String(r.updatedAt || '')) || 0;
        if (inTs >= exTs) store.subscriptionRequests[idx] = { ...store.subscriptionRequests[idx], ...r };
      } else {
        store.subscriptionRequests.push(r);
      }
    }

    for (const p of inProgress) {
      if (!p?.uid) continue;
      store.userProgress[p.uid] = sanitizeProgressInput(p, p.uid);
    }

    for (const c of inCatalog) {
      if (!c?.lessonId) continue;
      store.lessonCatalog[c.lessonId] = {
        lessonId: String(c.lessonId),
        title: String(c.title || c.lessonId),
        course: normalizeCourseNameServer(c.course || 'HSK 2'),
        accessType: c.accessType === 'paid' ? 'paid' : 'free',
        price: Number(c.price) || 0,
        practicePrice: Number(c.practicePrice) || 0,
        hasExercises: c.hasExercises !== false,
        updatedBy: String(c.updatedBy || req.authUser.uid),
        updatedAt: String(c.updatedAt || nowIso)
      };
    }

    writeAuthStore(store);
    const allUsers = Object.values(store.users).map(sanitizeUserPublic);
    const allRequests = [...store.subscriptionRequests];
    res.json({ success: true, allUsers, allRequests });
  } catch (err) {
    console.error('POST /api/admin/users/sync error:', err);
    res.status(500).json({ success: false, error: 'Failed to sync user store.' });
  }
});

const handleAdminUpdateUser = (req, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const body = req.body || {};
    const store = readAuthStore();
    const targetUser = store.users[uid];
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    if (typeof body.username === 'string' && body.username.trim()) {
      targetUser.username = body.username.trim().slice(0, 60);
    }
    if (typeof body.email === 'string' && body.email.trim()) {
      targetUser.email = body.email.trim().toLowerCase().slice(0, 160);
    }
    if (typeof body.phoneNumber === 'string') {
      targetUser.phoneNumber = body.phoneNumber.trim().slice(0, 32);
    }
    if (typeof body.dob === 'string') {
      const cleanDob = body.dob.trim().slice(0, 10);
      if (!cleanDob || /^\d{4}-\d{2}-\d{2}$/.test(cleanDob)) {
        targetUser.dob = cleanDob;
      }
    }
    if (body.role === 'admin' || body.role === 'student') {
      targetUser.role = body.role;
    }
    if (['free', 'pending', 'active', 'expired'].includes(body.membershipStatus)) {
      targetUser.membershipStatus = body.membershipStatus;
    }
    if (['none', 'per_lesson', 'course', 'practice_lesson', 'practice_course', 'monthly', 'annual'].includes(body.membershipPlan)) {
      targetUser.membershipPlan = normalizeServerPlan(body.membershipPlan);
    }
    if (typeof body.membershipExpiresAt === 'string') {
      targetUser.membershipExpiresAt = body.membershipExpiresAt.trim().slice(0, 40);
    }
    if (Array.isArray(body.subscribedLessonIds)) {
      targetUser.subscribedLessonIds = body.subscribedLessonIds
        .map((id) => String(id || '').trim().slice(0, 128))
        .filter(Boolean)
        .slice(0, 100);
    }
    if (Array.isArray(body.subscribedCourses)) {
      targetUser.subscribedCourses = Array.from(
        new Set(body.subscribedCourses.map(normalizeCourseNameServer).filter(Boolean))
      ).slice(0, 50);
    }
    if (Array.isArray(body.practiceLessonIds)) {
      targetUser.practiceLessonIds = body.practiceLessonIds
        .map((id) => String(id || '').trim().slice(0, 128))
        .filter(Boolean)
        .slice(0, 100);
    }
    if (Array.isArray(body.practiceCourses)) {
      targetUser.practiceCourses = Array.from(
        new Set(body.practiceCourses.map(normalizeCourseNameServer).filter(Boolean))
      ).slice(0, 50);
    }
    targetUser.updatedAt = new Date().toISOString();
    reconcileAuthStoreWithLessons(store);
    writeAuthStore(store);

    const allUsers = Object.values(store.users).map(sanitizeUserPublic);
    res.json({ success: true, user: sanitizeUserPublic(store.users[uid] || targetUser), allUsers });
  } catch (err) {
    console.error('PUT /api/admin/users/:uid error:', err);
    res.status(500).json({ success: false, error: 'Failed to update user.' });
  }
};

app.post('/api/admin/users', requireAdminToken, jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
    const password = String(body.password || '').trim() || generateTempPassword(10);
    const username = String(body.username || '').trim().slice(0, 60) || (email.includes('@') ? email.split('@')[0] : 'Learner');
    const phoneNumber = String(body.phoneNumber || '').trim().slice(0, 32);
    const rawDob = String(body.dob || '').trim();
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }
    const store = readAuthStore();
    if (findUserByEmail(store, email)) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const uid = 'usr_' + crypto.randomBytes(10).toString('hex');
    const { salt, hash } = hashPassword(password);
    const nowIso = new Date().toISOString();

    const newUser = {
      uid,
      username,
      email,
      phoneNumber,
      dob,
      role: body.role === 'admin' ? 'admin' : 'student',
      membershipStatus: ['free', 'pending', 'active', 'expired'].includes(body.membershipStatus) ? body.membershipStatus : 'free',
      membershipPlan: normalizeServerPlan(body.membershipPlan || 'none'),
      membershipExpiresAt: String(body.membershipExpiresAt || '').trim().slice(0, 40),
      subscribedLessonIds: Array.isArray(body.subscribedLessonIds) ? body.subscribedLessonIds.slice(0, 100) : [],
      subscribedCourses: Array.isArray(body.subscribedCourses) ? body.subscribedCourses.map(normalizeCourseNameServer).filter(Boolean) : [],
      practiceLessonIds: Array.isArray(body.practiceLessonIds) ? body.practiceLessonIds.slice(0, 100) : [],
      practiceCourses: Array.isArray(body.practiceCourses) ? body.practiceCourses.map(normalizeCourseNameServer).filter(Boolean) : [],
      linkedProviders: ['password'],
      mustChangePassword: Boolean(body.mustChangePassword ?? true),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    store.users[uid] = newUser;
    if (!store.userProgress[uid]) {
      store.userProgress[uid] = sanitizeProgressInput(null, uid);
    }
    writeAuthStore(store);

    const allUsers = Object.values(store.users).map(sanitizeUserPublic);
    res.status(201).json({ success: true, user: sanitizeUserPublic(newUser), temporaryPassword: password, allUsers });
  } catch (err) {
    console.error('POST /api/admin/users error:', err);
    res.status(500).json({ success: false, error: 'Failed to create user account.' });
  }
});

app.put('/api/admin/users/:uid', requireAdminToken, jsonParser, handleAdminUpdateUser);
app.post('/api/admin/users/:uid', requireAdminToken, jsonParser, handleAdminUpdateUser);
app.put('/api/admin/users/:uid/membership', requireAdminToken, jsonParser, handleAdminUpdateUser);
app.post('/api/admin/users/:uid/membership', requireAdminToken, jsonParser, handleAdminUpdateUser);

app.post('/api/admin/users/:uid/reset-password', requireAdminToken, jsonParser, async (req, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const body = req.body || {};
    const store = readAuthStore();
    const targetUser = store.users[uid];
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const customPw = typeof body.newPassword === 'string' ? body.newPassword : '';
    const tempPassword = customPw ? customPw : generateTempPassword(12);
    if (tempPassword.length < 6 || tempPassword.length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be between 6 and 128 characters.' });
    }

    const { salt, hash } = hashPassword(tempPassword);
    let emailed = false;
    let emailError = null;

    if (body.sendEmail && isSmtpConfigured()) {
      try {
        await sendSmtpMail({
          to: targetUser.email,
          subject: 'JiedeEdu Password Reset by Administrator',
          text: [
            `Hello ${targetUser.username || 'Learner'},`,
            '',
            'An administrator has reset your JiedeEdu account password.',
            `Your temporary password is: ${tempPassword}`,
            '',
            'Please sign in and update your password inside Account -> Profile & Membership.',
            '',
            '— JiedeEdu Team'
          ].join('\n')
        });
        emailed = true;
      } catch (mailErr) {
        emailError = mailErr instanceof Error ? mailErr.message : 'SMTP delivery failed.';
      }
    }

    targetUser.passwordSalt = salt;
    targetUser.passwordHash = hash;
    targetUser.mustChangePassword = true;
    targetUser.updatedAt = new Date().toISOString();
    writeAuthStore(store);

    const allUsers = Object.values(store.users).map(sanitizeUserPublic);
    res.json({
      success: true,
      emailed,
      emailError,
      temporaryPassword: tempPassword,
      user: sanitizeUserPublic(targetUser),
      allUsers
    });
  } catch (err) {
    console.error('POST /api/admin/users/:uid/reset-password error:', err);
    res.status(500).json({ success: false, error: 'Failed to reset user password.' });
  }
});

app.put('/api/admin/catalog', requireAdminToken, jsonParser, (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const removeIds = Array.isArray(req.body?.removeIds) ? req.body.removeIds : [];
    const replaceAll = Boolean(req.body?.replaceAll);
    const store = readAuthStore();
    const nowIso = new Date().toISOString();

    if (replaceAll) {
      store.lessonCatalog = {};
    }
    for (const rid of removeIds) {
      const cleanRid = String(rid || '').trim().replace(/[^a-zA-Z0-9_\-]+/g, '-').slice(0, 128);
      if (cleanRid) delete store.lessonCatalog[cleanRid];
    }

    for (const item of items) {
      const lessonId = String(item?.lessonId || '')
        .trim()
        .replace(/[^a-zA-Z0-9_\-]+/g, '-')
        .slice(0, 128);
      if (!lessonId) continue;
      const course = normalizeCourseNameServer(item.course || item.audience || 'HSK 2');
      const accessType = String(item.accessType || '').toLowerCase() === 'paid' ? 'paid' : 'free';
      const rawPrice = Number(item.price);
      const price = accessType === 'free' ? 0 : Math.min(10000000, Math.max(0, Number.isFinite(rawPrice) ? rawPrice : 0));
      const rawPrac = Number(item.practicePrice);
      const practicePrice =
        accessType === 'free'
          ? 0
          : Math.min(10000000, Math.max(0, Number.isFinite(rawPrac) && rawPrac > 0 ? Math.round(rawPrac) : 0));
      const prevEntry = store.lessonCatalog[lessonId];
      const hasExercises =
        typeof item.hasExercises === 'boolean'
          ? item.hasExercises
          : typeof prevEntry?.hasExercises === 'boolean'
          ? prevEntry.hasExercises
          : true;

      store.lessonCatalog[lessonId] = {
        lessonId,
        title: String(item.title || lessonId).trim().slice(0, 160) || lessonId,
        course,
        accessType,
        price,
        practicePrice,
        hasExercises,
        updatedBy: req.authUser.uid,
        updatedAt: nowIso
      };
    }

    reconcileAuthStoreWithLessons(store, null, null, removeIds);
    writeAuthStore(store);
    res.json({ success: true, lessonCatalog: store.lessonCatalog });
  } catch (err) {
    console.error('PUT /api/admin/catalog error:', err);
    res.status(500).json({ success: false, error: 'Failed to save lesson pricing catalog.' });
  }
});

app.get('/api/admin/smtp-status', requireAdminToken, (req, res) => {
  const cfg = getSmtpConfig();
  const maskedUser = cfg.user
    ? cfg.user.replace(/^([^@]{1,2})[^@]*(@.*)$/, '$1***$2')
    : '';
  res.json({
    success: true,
    configured: cfg.configured,
    host: cfg.host || '',
    port: cfg.port,
    secure: cfg.secure,
    userMasked: maskedUser,
    from: cfg.from || ''
  });
});

app.post('/api/admin/test-smtp', requireAdminToken, jsonParser, async (req, res) => {
  const to = String(req.body?.to || req.authUser.email || ADMIN_EMAIL).trim();
  if (!isSmtpConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'SMTP environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS) are not set on the server.'
    });
  }
  try {
    await sendSmtpMail({
      to,
      subject: 'JiedeEdu SMTP Test Email',
      text: `SMTP delivery test succeeded at ${new Date().toISOString()} from your JiedeEdu Node server.`,
      html: `<p>SMTP delivery test <strong>succeeded</strong> at ${new Date().toISOString()} from your JiedeEdu Node server.</p>`
    });
    res.json({ success: true, message: `Test email sent successfully to ${to}.` });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'SMTP test failed.'
    });
  }
});

// Block HTTP static access to sensitive server files, auth data stores, secrets, and backend source
app.use((req, res, next) => {
  const norm = String(req.path || '').toLowerCase();
  if (
    norm === '/server.js' ||
    norm === '/package.json' ||
    norm === '/package-lock.json' ||
    norm === '/bun.lock' ||
    norm === '/firebase-applet-config.json' ||
    norm === '/firebase-blueprint.json' ||
    norm === '/firestore.rules' ||
    norm === '/security_spec.md' ||
    norm === '/eslint.config.mjs' ||
    norm.startsWith('/.env') ||
    norm.startsWith('/.git') ||
    norm.startsWith('/.aistudio') ||
    norm.startsWith('/src/') ||
    norm.startsWith('/node_modules/') ||
    norm.startsWith('/data/auth-')
  ) {
    return res.status(404).end();
  }
  next();
});

// Serve static files from root directory (no-cache on code/markup + CORP cross-origin for uploads)
app.use(
  express.static(__dirname, {
    setHeaders(res, filePath) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (/\.(js|css|html)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

// Route handlers for convenient navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/story', (req, res) => {
  res.sendFile(path.join(__dirname, 'story.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
