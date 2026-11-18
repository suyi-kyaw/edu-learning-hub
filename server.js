const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const multer = require('multer');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const app = express();
const PORT = 3000;
const ADMIN_EMAIL = 'syndkyaw@gmail.com';

// Load Firebase projectId cleanly for stateless verifyIdToken()
let firebaseProjectId = 'melodic-ace-2lvvl';
try {
  const cfgPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg && cfg.projectId) {
      firebaseProjectId = cfg.projectId;
    }
  }
} catch (err) {
  console.warn('Could not read firebase-applet-config.json:', err.message);
}

if (!getApps().length) {
  initializeApp({ projectId: firebaseProjectId });
}
const adminAuth = getAuth();

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
  heroPrimaryCta: 'Explore Stories & Reels',
  heroSecondaryCta: 'Learning Hub',
  heroBannerUrl: 'assets/hero-banner.png',
  storiesLabel: 'Featured Stories & Reels',
  storiesTitle: 'Stories & Reels',
  storiesSubtitle:
    'Watch bite-sized vertical video reels and engaging cultural narratives crafted for modern Mandarin learners.',
  gamesLabel: 'Interactive Practice',
  gamesTitle: 'Play & Practice Games',
  gamesSubtitle:
    'Reinforce your Chinese tones, character recognition, and rapid recall through interactive gameplay.',
  lessonsLabel: 'Curriculum Pathways',
  lessonsTitle: 'Choose Your Learning Pathway',
  lessonsSubtitle:
    'Select your track to access structured lessons, native voice recordings, dialogues, and practice exercises.',
  adultBadge: 'Adults • Comprehensive',
  adultTitle: 'Mandarin for Adults & Professionals',
  adultSubtitle: '实用成人汉语 • Practical Proficiency',
  adultDesc:
    'Master practical conversation for career, travel, dining, and HSK test preparation with real-world scenarios and cultural nuance.',
  adultBullets: [
    'Everyday Living & Socializing',
    'Business Meetings & Travel Mandarin',
    'Sentence Patterns & HSK Vocabulary'
  ],
  adultCta: 'Start Learning (Adults) →',
  kidsBadge: 'Kids • Playful Immersion',
  kidsTitle: 'Chinese for Kids & Young Learners',
  kidsSubtitle: '少儿趣味中文 • Joyful Adventures',
  kidsDesc:
    'Discover the joy of Mandarin through colorful stories, playful pinyin songs, animal adventures, and interactive challenges that inspire confidence.',
  kidsBullets: [
    'Animals, Colors & Family Adventures',
    'Cheerful Pinyin Songs & Animations',
    'Reward Badges & Interactive Quizzes'
  ],
  kidsCta: 'Start Learning (Kids) →',
  contactEmail: 'syndkyaw@gmail.com',
  contactPhone: '+95 9 798 123 456',
  contactViber: '+95 9 798 123 456',
  featuredReelIds: ['cny_01', 'daily_01', 'kids_01'],
  featuredStoryIds: ['lesson-01'],
  featuredGameIds: ['game-01']
};

// Enable CORS and preflight handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const jsonParser = express.json({ limit: '15mb' });

// Admin Authentication Middleware (Firebase ID token signature + verified admin email)
async function requireAdminToken(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing Authorization Bearer token.' });
    }
    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return res.status(401).json({ success: false, error: 'Empty ID token.' });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = String(decoded.email || '').toLowerCase();
    if (email !== ADMIN_EMAIL.toLowerCase() || decoded.email_verified !== true) {
      return res.status(403).json({ success: false, error: 'Admin privileges required.' });
    }
    req.adminUser = decoded;
    next();
  } catch (err) {
    console.warn('Admin token verification failed:', err.message);
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
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
    gamesLabel: str('gamesLabel', 100),
    gamesTitle: str('gamesTitle', 120),
    gamesSubtitle: str('gamesSubtitle', 400),
    lessonsLabel: str('lessonsLabel', 100),
    lessonsTitle: str('lessonsTitle', 120),
    lessonsSubtitle: str('lessonsSubtitle', 400),
    adultBadge: str('adultBadge', 80),
    adultTitle: str('adultTitle', 140),
    adultSubtitle: str('adultSubtitle', 140),
    adultDesc: str('adultDesc', 400),
    adultBullets: strList('adultBullets', 6, 140, true),
    adultCta: str('adultCta', 80),
    kidsBadge: str('kidsBadge', 80),
    kidsTitle: str('kidsTitle', 140),
    kidsSubtitle: str('kidsSubtitle', 140),
    kidsDesc: str('kidsDesc', 400),
    kidsBullets: strList('kidsBullets', 6, 140, true),
    kidsCta: str('kidsCta', 80),
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

app.get('/api/site-config', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ success: true, config: readSiteConfigFile() });
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

// Serve static files from root directory (no-cache on code/markup so bundle updates apply immediately)
app.use(
  express.static(__dirname, {
    setHeaders(res, filePath) {
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
