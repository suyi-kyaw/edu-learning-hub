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

function writeAuthStore(store) {
  const tmpPath = `${AUTH_STORE_PATH}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, AUTH_STORE_PATH);
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
  if (!raw) return 'HSK 1';
  const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (compact === 'hsk1') return 'HSK 1';
  if (compact === 'hsk2') return 'HSK 2';
  if (compact === 'hsk3') return 'HSK 3';
  if (compact === 'hsk4') return 'HSK 4';
  return raw.slice(0, 80);
}

function normalizeServerPlan(plan) {
  const p = String(plan || 'none').trim().toLowerCase();
  if (p === 'per_lesson' || p === 'lesson') return 'per_lesson';
  if (p === 'course' || p === 'monthly' || p === 'annual' || p === 'hsk') return 'course';
  return 'none';
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
    linkedProviders: ['password'],
    mustChangePassword: Boolean(u.mustChangePassword),
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null
  };
}

function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  try {
    const derivedBuf = crypto.scryptSync(String(password), String(salt), 64);
    const expectedBuf = Buffer.from(String(expectedHash), 'hex');
    if (derivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch (_) {
    return false;
  }
}

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
  const from = String(process.env.SMTP_FROM || user || `LinguaPath <${ADMIN_EMAIL}>`).trim();
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
    'Study step by step with HSK 1, HSK 2, and custom courses featuring video lessons, 5 interactive exercise types, and stroke writing.',
  lessonsBadge: 'HSK 1 · HSK 2 · All Levels',
  lessonsCardTitle: 'Explore HSK Courses & Lessons',
  lessonsCardSubtitle: '系统汉语课程 • Video, Exercises & Stroke Order',
  lessonsCardDesc:
    'Browse structured lessons organized by course in our learning workspace. Practice listening, picture matching, pinyin character writing, and speaking.',
  lessonsBullets: [
    'HSK 1 & HSK 2 foundational to conversational courses',
    '5 interactive exercise formats including Pinyin character writing',
    'Unlock individual lessons or an entire course in Kyat'
  ],
  lessonsCta: 'Go to Lessons →',
  coursePrices: {
    'HSK 1': 100,
    'HSK 2': 120
  },
  contactEmail: 'syndkyaw@gmail.com',
  contactPhone: '+95 9 798 123 456',
  contactViber: '+95 9 798 123 456',
  featuredReelIds: ['cny_01', 'daily_01', 'kids_01'],
  featuredStoryIds: ['lesson-01', 'lesson-02'],
  featuredGameIds: ['game-01']
};

// Enable CORS, Cross-Origin Resource Sharing for assets, and preflight handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
  requireAuthToken(req, res, () => {
    if (!req.authUser || req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
    }
    req.adminUser = req.authUser;
    next();
  });
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

// Preserve untouched sheets while atomically updating specified sheets in a workbook
function writeUpdatedWorkbook(excelPath, updatedSheetsMap, orderedSheetHints = []) {
  const existing = fs.existsSync(excelPath)
    ? parseWorkbookFile(excelPath, 'Workbook missing')
    : { sheetNames: [], sheets: {} };

  const mergedSheets = { ...existing.sheets, ...updatedSheetsMap };
  const nameSet = new Set([...orderedSheetHints, ...existing.sheetNames, ...Object.keys(updatedSheetsMap)]);
  const finalSheetNames = Array.from(nameSet).filter((n) => mergedSheets[n] !== undefined);

  const wb = XLSX.utils.book_new();
  for (const sheetName of finalSheetNames) {
    const rows = Array.isArray(mergedSheets[sheetName]) ? mergedSheets[sheetName] : [];
    const ws = XLSX.utils.json_to_sheet(rows);
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

function normalizeCoursePricesServer(rawPrices) {
  const out = { ...DEFAULT_SITE_CONFIG.coursePrices };
  if (rawPrices && typeof rawPrices === 'object' && !Array.isArray(rawPrices)) {
    for (const [k, v] of Object.entries(rawPrices)) {
      const name = normalizeCourseNameServer(k);
      const n = Number(v);
      if (name && Number.isFinite(n) && n >= 0) {
        out[name] = Math.round(n);
      }
    }
  }
  return out;
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
  const strList = (key, maxItems, maxLen, useDefaultIfMissing) => {
    if (!Array.isArray(input[key])) {
      return useDefaultIfMissing ? [...DEFAULT_SITE_CONFIG[key]] : [];
    }
    return input[key]
      .map((x) => String(x || '').trim().slice(0, maxLen))
      .filter(Boolean)
      .slice(0, maxItems);
  };

  return {
    configId: 'homepage',
    heroEyebrow: str('heroEyebrow', 100),
    heroTitleLine1: str('heroTitleLine1', 120),
    heroTitleHighlight: str('heroTitleHighlight', 120),
    heroSubtitle: str('heroSubtitle', 400),
    heroPrimaryCta: str('heroPrimaryCta', 60),
    heroSecondaryCta: str('heroSecondaryCta', 60),
    heroBannerUrl: optStr('heroBannerUrl', 500),
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
    coursePrices: normalizeCoursePricesServer(input.coursePrices),
    contactEmail: str('contactEmail', 160),
    contactPhone: str('contactPhone', 40),
    contactViber: str('contactViber', 40),
    featuredReelIds: strList('featuredReelIds', 12, 128, !('featuredReelIds' in input)),
    featuredStoryIds: strList('featuredStoryIds', 12, 128, !('featuredStoryIds' in input)),
    featuredGameIds: strList('featuredGameIds', 12, 128, !('featuredGameIds' in input))
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
    tables: [
      'lessons',
      'exercises',
      'vocabulary',
      'writing_characters',
      'story_segments',
      'games',
      'reels_videos',
      'users',
      'subscription_requests',
      'user_subscriptions',
      'user_progress',
      'sqlite_sequence'
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
      return res.json({
        success: true,
        source: 'cloudflare-d1',
        database: 'edu-hub-db',
        domain: 'lessons',
        sheets: lessonsWb.sheets || {}
      });
    }

    if (domain === 'stories') {
      const storiesWb = parseStoriesWorkbook();
      return res.json({
        success: true,
        source: 'cloudflare-d1',
        database: 'edu-hub-db',
        domain: 'stories',
        sheets: storiesWb.sheets || {}
      });
    }

    if (domain === 'reels') {
      const reelsWb = parseReelsStoriesWorkbook();
      return res.json({
        success: true,
        source: 'cloudflare-d1',
        database: 'edu-hub-db',
        domain: 'reels',
        sheets: reelsWb.sheets || {}
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
    service: 'linguapath-backend',
    authMode: 'email-password',
    adminClaimed: isAdminClaimed(store),
    smtpConfigured: isSmtpConfigured(),
    timestamp: Date.now()
  });
});

app.get('/api/site-config', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
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
    const user = findUserByEmail(store, email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({
        success: false,
        code: 'invalid-credentials',
        error: 'Invalid email or password. Please check your credentials and try again.'
      });
    }

    const token = signAuthToken(user);
    res.json(buildSessionResponse(store, user, token));
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ success: false, error: 'Unable to sign in.' });
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
      subject: 'LinguaPath Temporary Password',
      text: [
        `Hello ${user.username || 'Learner'},`,
        '',
        'You requested a password reset for your LinguaPath account.',
        `Your new temporary password is: ${tempPassword}`,
        '',
        'Please sign in with this temporary password and change it right away under Profile & Membership.',
        '',
        '— LinguaPath Team'
      ].join('\n'),
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f172a; line-height:1.5; max-width:520px;">
          <h2 style="margin:0 0 12px; color:#ea580c;">LinguaPath Password Reset</h2>
          <p>Hello <strong>${user.username || 'Learner'}</strong>,</p>
          <p>Here is your generated temporary password for signing in to LinguaPath:</p>
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
  res.setHeader('Cache-Control', 'no-cache');
  res.json(buildSessionResponse(store, req.authUser, null));
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

    const planType = body.planType === 'per_lesson' ? 'per_lesson' : 'course';
    const siteCfg = readSiteConfig();
    const courseName =
      planType === 'course'
        ? normalizeCourseNameServer(body.courseName || body.lessonTitle || 'HSK 1')
        : '';
    const defaultCoursePrice =
      (siteCfg.coursePrices && siteCfg.coursePrices[courseName]) != null
        ? Number(siteCfg.coursePrices[courseName])
        : 100;
    const planMeta = {
      per_lesson: { name: 'Lesson Pass', amountLabel: '9 Kyat / lesson' },
      course: { name: `${courseName || 'HSK 1'} Course Pass`, amountLabel: `${defaultCoursePrice} Kyat / course` }
    }[planType];

    const lessonId =
      planType === 'per_lesson'
        ? String(body.lessonId || '').trim().replace(/[^a-zA-Z0-9_\-]+/g, '-').slice(0, 128)
        : '';
    const lessonTitle =
      planType === 'per_lesson'
        ? String(body.lessonTitle || 'Paid Lesson Unlock').trim().slice(0, 160)
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

    res.json({
      success: true,
      message: 'data/lessons.xlsx updated successfully!',
      sheetNames: data.sheetNames,
      sheets: data.sheets
    });
  } catch (err) {
    console.error('API upload-excel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update homepage / contact / featured config cache on disk
app.put('/api/admin/site-config', requireAdminToken, jsonParser, (req, res) => {
  try {
    const clean = sanitizeSiteConfigInput(req.body);
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(clean, null, 2), 'utf8');
    res.json({ success: true, config: clean });
  } catch (err) {
    console.error('API admin site-config error:', err);
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

// Save Lessons + Vocabulary + Writing (preserving Exercises and Games)
app.put('/api/admin/content/lessons', requireAdminToken, jsonParser, (req, res) => {
  try {
    const { lessons, vocabulary, writing } = req.body || {};
    if (!Array.isArray(lessons)) {
      return res.status(400).json({ success: false, error: 'Invalid lessons payload.' });
    }
    const updates = { Lessons: lessons };
    if (Array.isArray(vocabulary)) updates.Vocabulary = vocabulary;
    if (Array.isArray(writing)) updates.Writing = writing;

    const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
    const result = writeUpdatedWorkbook(excelPath, updates, [
      'Lessons',
      'Vocabulary',
      'Story',
      'Exercises',
      'Writing',
      'Games'
    ]);
    syncLessonsJson();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('PUT /api/admin/content/lessons error:', err);
    res.status(500).json({ success: false, error: err.message });
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
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('PUT /api/admin/content/stories error:', err);
    res.status(500).json({ success: false, error: err.message });
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
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('PUT /api/admin/content/reels error:', err);
    res.status(500).json({ success: false, error: err.message });
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
      'Vocabulary',
      'Story',
      'Exercises',
      'Writing',
      'Games'
    ]);
    syncLessonsJson();
    res.json({ success: true, ...result });
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
          const answer = String(r.answer || r.Answer || r.correct || '').trim();
          if (!question || !lid) return null;
          return {
            lessonId: lid,
            order: Number(r.order || r.Order) || i + 1,
            type: String(r.type || r.Type || 'choice').trim().toLowerCase() || 'choice',
            question,
            optionA: String(r.optionA ?? r.OptionA ?? '').trim(),
            optionB: String(r.optionB ?? r.OptionB ?? '').trim(),
            optionC: String(r.optionC ?? r.OptionC ?? '').trim(),
            optionD: String(r.optionD ?? r.OptionD ?? '').trim(),
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
          : ['Lessons', 'Vocabulary', 'Story', 'Exercises', 'Writing', 'Games'];

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

    if (reqDoc.planType === 'per_lesson') {
      if (reqDoc.lessonId && !nextLessons.includes(reqDoc.lessonId) && nextLessons.length < 100) {
        nextLessons.push(reqDoc.lessonId);
      }
      if (nextPlan !== 'course') {
        nextPlan = 'per_lesson';
      }
    } else {
      const targetCourse = normalizeCourseNameServer(reqDoc.courseName || reqDoc.lessonTitle || 'HSK 1');
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

app.put('/api/admin/users/:uid/membership', requireAdminToken, jsonParser, (req, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const body = req.body || {};
    const store = readAuthStore();
    const targetUser = store.users[uid];
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    if (['free', 'pending', 'active', 'expired'].includes(body.membershipStatus)) {
      targetUser.membershipStatus = body.membershipStatus;
    }
    if (['none', 'per_lesson', 'course', 'monthly', 'annual'].includes(body.membershipPlan)) {
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
    targetUser.updatedAt = new Date().toISOString();
    writeAuthStore(store);

    const allUsers = Object.values(store.users).map(sanitizeUserPublic);
    res.json({ success: true, user: sanitizeUserPublic(targetUser), allUsers });
  } catch (err) {
    console.error('PUT /api/admin/users/:uid/membership error:', err);
    res.status(500).json({ success: false, error: 'Failed to update user membership.' });
  }
});

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
          subject: 'LinguaPath Password Reset by Administrator',
          text: [
            `Hello ${targetUser.username || 'Learner'},`,
            '',
            'An administrator has reset your LinguaPath account password.',
            `Your temporary password is: ${tempPassword}`,
            '',
            'Please sign in and update your password inside Account -> Profile & Membership.',
            '',
            '— LinguaPath Team'
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
    const store = readAuthStore();
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const lessonId = String(item?.lessonId || '')
        .trim()
        .replace(/[^a-zA-Z0-9_\-]+/g, '-')
        .slice(0, 128);
      if (!lessonId) continue;
      const audience = String(item.audience || '').toLowerCase() === 'kids' ? 'Kids' : 'Adult';
      const accessType = String(item.accessType || '').toLowerCase() === 'paid' ? 'paid' : 'free';
      const rawPrice = Number(item.price);
      const price = accessType === 'free' ? 0 : Math.min(9999999, Math.max(0, Number.isFinite(rawPrice) ? rawPrice : 9));

      store.lessonCatalog[lessonId] = {
        lessonId,
        title: String(item.title || lessonId).trim().slice(0, 160) || lessonId,
        audience,
        accessType,
        price,
        updatedBy: req.authUser.uid,
        updatedAt: nowIso
      };
    }

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
      subject: 'LinguaPath SMTP Test Email',
      text: `SMTP delivery test succeeded at ${new Date().toISOString()} from your LinguaPath Node server.`,
      html: `<p>SMTP delivery test <strong>succeeded</strong> at ${new Date().toISOString()} from your LinguaPath Node server.</p>`
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
