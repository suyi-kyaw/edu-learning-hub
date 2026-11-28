/**
 * edu-learning-hub — Cloudflare Worker
 *
 * Database-first curriculum retrieval with automatic DB-vs-Excel/JSON auto-reconciliation,
 * live Admin writes, and Cloudflare D1 (binding: DB) + ASSETS binding.
 */

import * as XLSX from 'xlsx';

export interface R2MultipartUploadLike {
  uploadId: string;
  uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string): Promise<{ partNumber: number; etag: string }>;
  complete(uploadedParts: Array<{ partNumber: number; etag: string }>): Promise<unknown>;
  abort(): Promise<void>;
}

export interface R2ObjectBodyLike {
  body: ReadableStream<Uint8Array>;
  size: number;
  etag?: string;
  httpMetadata?: { contentType?: string };
}

export interface R2BucketLike {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string | null,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<{ etag?: string; size?: number } | null>;
  get(
    key: string,
    options?: { range?: { offset?: number; length?: number; suffix?: number } }
  ): Promise<R2ObjectBodyLike | null>;
  head?(key: string): Promise<{ size: number; etag?: string; httpMetadata?: { contentType?: string } } | null>;
  delete(keys: string | string[]): Promise<void>;
  createMultipartUpload(
    key: string,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<R2MultipartUploadLike>;
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUploadLike;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MEDIA_BUCKET?: R2BucketLike;
  AUTH_TOKEN_SECRET?: string;
}

const ADMIN_EMAIL = 'syndkyaw@gmail.com';
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization, Range, X-Admin-Uid, X-User-Uid',
  'access-control-expose-headers': 'Content-Range, Content-Length, Accept-Ranges, Content-Type, Content-Disposition, X-User-Count, X-Request-Count, X-Progress-Count, X-Catalog-Count',
  'access-control-max-age': '86400',
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  ...CORS_HEADERS,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function fail(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ ok: false, success: false, error: message, ...(extra || {}) }, status);
}

function isMissingTableError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('has no column named')
  );
}

function isTransientD1Error(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  if (!msg) return false;
  if (
    msg.includes('sqlite_constraint') ||
    msg.includes('constraint failed') ||
    msg.includes('unique constraint') ||
    msg.includes('not null constraint') ||
    msg.includes('not configured')
  ) {
    return false;
  }
  return (
    msg.includes('sqlite_busy') ||
    msg.includes('database is locked') ||
    msg.includes('d1_error') ||
    msg.includes('d1_') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('connection') ||
    msg.includes('internal error') ||
    msg.includes('reset')
  );
}

async function withD1Retry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt + 1 >= maxAttempts || !isTransientD1Error(err)) {
        throw err;
      }
      const delayMs = 45 * (attempt + 1) + Math.floor(Math.random() * 35);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

async function one<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  if (!db) return null;
  try {
    return await withD1Retry(() => db.prepare(sql).bind(...params).first<T>(), 2);
  } catch (err) {
    if (isMissingTableError(err)) {
      try {
        await ensureD1Tables(db, true);
        return await withD1Retry(() => db.prepare(sql).bind(...params).first<T>(), 2);
      } catch (_) {}
    }
    return null;
  }
}

async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  if (!db) return [];
  try {
    const { results } = await withD1Retry(() => db.prepare(sql).bind(...params).all<T>(), 2);
    return results ?? [];
  } catch (err) {
    if (isMissingTableError(err)) {
      try {
        await ensureD1Tables(db, true);
        const { results } = await withD1Retry(() => db.prepare(sql).bind(...params).all<T>(), 2);
        return results ?? [];
      } catch (_) {}
    }
    return [];
  }
}

async function oneStrict<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  if (!db) {
    throw new Error('Cloudflare D1 database binding (DB) is not configured.');
  }
  return withD1Retry(async () => {
    try {
      return await db.prepare(sql).bind(...params).first<T>();
    } catch (err) {
      if (isMissingTableError(err)) {
        d1SchemaReady = false;
        await ensureD1Tables(db, true);
        return await db.prepare(sql).bind(...params).first<T>();
      }
      throw err;
    }
  }, 3);
}

async function allStrict<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  if (!db) {
    throw new Error('Cloudflare D1 database binding (DB) is not configured.');
  }
  return withD1Retry(async () => {
    try {
      const { results } = await db.prepare(sql).bind(...params).all<T>();
      return results ?? [];
    } catch (err) {
      if (isMissingTableError(err)) {
        d1SchemaReady = false;
        await ensureD1Tables(db, true);
        const { results } = await db.prepare(sql).bind(...params).all<T>();
        return results ?? [];
      }
      throw err;
    }
  }, 3);
}

function normalizeLessonRow(l: any) {
  if (!l || typeof l !== 'object') return l;
  const id = String(l.id || l.lessonId || l.lesson_id || '').trim();
  const title = String(l.title || l.Title || id).trim();
  const chineseTitle = String(l.chineseTitle || l.chinese_title || l.chinese || '').trim();
  const pinyin = String(l.pinyin || l.Pinyin || '').trim();
  const meaning = String(l.meaning || l.Meaning || '').trim();
  const course = String(l.course || l.category || 'HSK 2').trim();
  const level = String(l.level || l.Level || course).trim();
  const description = String(l.description || l.Description || '').trim();
  const videoUrl = String(l.videoUrl || l.video_url || l.video || '').trim();
  const posterUrl = String(l.posterUrl || l.poster_url || l.poster || '').trim();
  const fullAudio = String(l.fullAudio || l.full_audio || l.audio || '').trim();
  const keywords = String(l.keywords || l.Keywords || '').trim();
  const accessType = String(l.accessType || l.access_type || 'paid').toLowerCase() === 'free' ? 'free' : 'paid';
  const price = Number(l.price) || (accessType === 'paid' ? 75000 : 0);
  const practicePrice = Number(l.practicePrice) || 0;
  return {
    ...l,
    id,
    lessonId: id,
    lesson_id: id,
    title,
    chineseTitle,
    chinese_title: chineseTitle,
    pinyin,
    meaning,
    level,
    course,
    category: l.category || course,
    categoryKey: l.categoryKey || l.category_key || '',
    category_key: l.categoryKey || l.category_key || '',
    categoryNum: l.categoryNum || l.category_num || 'Course 1',
    category_num: l.categoryNum || l.category_num || 'Course 1',
    description,
    videoUrl,
    video_url: videoUrl,
    posterUrl,
    poster_url: posterUrl,
    fullAudio,
    full_audio: fullAudio,
    keywords,
    accessType,
    access_type: accessType,
    price,
    practicePrice
  };
}

function normalizeExerciseRow(r: any, idx = 0) {
  if (!r || typeof r !== 'object') return r;
  const lessonId = String(r.lessonId || r.lesson_id || '').trim();
  const order = Number(r.order || r.order_num) || idx + 1;
  const type = String(r.type || 'multiple-choice').trim().toLowerCase() || 'multiple-choice';
  const groupId = String(r.groupId || r.group_id || '').trim();
  const groupTitle = String(r.groupTitle || r.group_title || '').trim();
  const pinyin = String(r.pinyin || r.pinyinHint || r.pinyin_hint || '').trim();
  const question = String(r.question || '').trim();
  const audioUrl = String(r.audioUrl || r.audio_url || r.audio || '').trim();
  const audioText = String(r.audioText || r.audio_text || r.AudioText || r.listeningSentence || r.listening_sentence || r.audioSentence || '').trim();
  const optionA = String(r.optionA ?? r.option_a ?? '').trim();
  const optionB = String(r.optionB ?? r.option_b ?? '').trim();
  const optionC = String(r.optionC ?? r.option_c ?? '').trim();
  const optionD = String(r.optionD ?? r.option_d ?? '').trim();
  const optionE = String(r.optionE ?? r.option_e ?? '').trim();
  const optionAImage = String(r.optionAImage || r.option_a_image || '').trim();
  const optionBImage = String(r.optionBImage || r.option_b_image || '').trim();
  const optionCImage = String(r.optionCImage || r.option_c_image || '').trim();
  const optionDImage = String(r.optionDImage || r.option_d_image || '').trim();
  const optionEImage = String(r.optionEImage || r.option_e_image || '').trim();
  const answer = String(r.answer || r.correct || r.correctAnswer || '').trim();
  const explanation = String(r.explanation || '').trim();
  return {
    ...r,
    lessonId,
    lesson_id: lessonId,
    order,
    type,
    groupId,
    group_id: groupId,
    groupTitle,
    group_title: groupTitle,
    pinyin,
    question,
    audioUrl,
    audio_url: audioUrl,
    audioText,
    audio_text: audioText,
    optionA,
    option_a: optionA,
    optionB,
    option_b: optionB,
    optionC,
    option_c: optionC,
    optionD,
    option_d: optionD,
    optionE,
    option_e: optionE,
    optionAImage,
    option_a_image: optionAImage,
    optionBImage,
    option_b_image: optionBImage,
    optionCImage,
    option_c_image: optionCImage,
    optionDImage,
    option_d_image: optionDImage,
    optionEImage,
    option_e_image: optionEImage,
    answer,
    explanation
  };
}

function normalizeWritingRow(w: any, idx = 0) {
  if (!w || typeof w !== 'object') return w;
  const lessonId = String(w.lessonId || w.lesson_id || '').trim();
  const order = Number(w.order || w.order_num) || idx + 1;
  const character = String(w.character || '').trim();
  const pinyin = String(w.pinyin || '').trim();
  const meaning = String(w.meaning || '').trim();
  const strokeCount = Number(w.strokeCount || w.stroke_count) || 6;
  const radical = String(w.radical || '').trim();
  const strokeAnimationUrl = String(w.strokeAnimationUrl || w.stroke_animation_url || '').trim();
  const svgPath = String(w.svgPath || w.svg_path || '').trim();
  const strokeOrderSteps = String(w.strokeOrderSteps || w.stroke_order_steps || '').trim();
  return {
    ...w,
    lessonId,
    lesson_id: lessonId,
    order,
    character,
    pinyin,
    meaning,
    strokeCount,
    stroke_count: strokeCount,
    radical,
    strokeAnimationUrl,
    stroke_animation_url: strokeAnimationUrl,
    svgPath,
    svg_path: svgPath,
    strokeOrderSteps,
    stroke_order_steps: strokeOrderSteps
  };
}

function normalizeVocabularyRow(v: any, idx = 0) {
  if (!v || typeof v !== 'object') return v;
  const lessonId = String(v.lessonId || v.lesson_id || '').trim();
  const order = Number(v.order || v.order_num) || idx + 1;
  const character = String(v.character || v.word || v.chinese || '').trim();
  const pinyin = String(v.pinyin || '').trim();
  const meaning = String(v.meaning || v.english || '').trim();
  const audio = String(v.audio || v.audio_url || v.audioUrl || '').trim();
  return {
    ...v,
    lessonId,
    lesson_id: lessonId,
    order,
    character,
    pinyin,
    meaning,
    audio,
    audioUrl: audio,
    audio_url: audio
  };
}

function normalizePronunciationRow(p: any, idx = 0) {
  if (!p || typeof p !== 'object') return p;
  const lessonId = String(p.lessonId || p.lesson_id || '').trim();
  const order = Number(p.order || p.order_num) || idx + 1;
  const chinese = String(p.chinese || p.text || '').trim();
  const pinyin = String(p.pinyin || '').trim();
  const meaning = String(p.meaning || '').trim();
  const focus = String(p.focus || '').trim();
  return {
    ...p,
    lessonId,
    lesson_id: lessonId,
    order,
    chinese,
    pinyin,
    meaning,
    focus
  };
}

const D1_TABLE_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, course TEXT, category TEXT, categoryKey TEXT, categoryNum TEXT, title TEXT, chineseTitle TEXT, pinyin TEXT, meaning TEXT, level TEXT, description TEXT, videoUrl TEXT, posterUrl TEXT, fullAudio TEXT, keywords TEXT, accessType TEXT, price REAL, practicePrice REAL, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, lessonId TEXT, "order" INTEGER, type TEXT, groupId TEXT, groupTitle TEXT, pinyin TEXT, question TEXT, audioUrl TEXT, audioText TEXT, optionA TEXT, optionB TEXT, optionC TEXT, optionD TEXT, optionE TEXT, optionAImage TEXT, optionBImage TEXT, optionCImage TEXT, optionDImage TEXT, optionEImage TEXT, answer TEXT, explanation TEXT)`,
  `CREATE TABLE IF NOT EXISTS writing_characters (id INTEGER PRIMARY KEY AUTOINCREMENT, lessonId TEXT, "order" INTEGER, character TEXT, pinyin TEXT, meaning TEXT, strokeCount INTEGER, radical TEXT, strokeAnimationUrl TEXT, svgPath TEXT, strokeOrderSteps TEXT)`,
  `CREATE TABLE IF NOT EXISTS vocabulary (id INTEGER PRIMARY KEY AUTOINCREMENT, lessonId TEXT, "order" INTEGER, character TEXT, pinyin TEXT, meaning TEXT, audio TEXT)`,
  `CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, "order" INTEGER, title TEXT, category TEXT, badge TEXT, description TEXT, embed_code TEXT, embed_url TEXT, width INTEGER, height INTEGER, active TEXT)`,
  `CREATE TABLE IF NOT EXISTS pronunciation (id INTEGER PRIMARY KEY AUTOINCREMENT, lessonId TEXT, "order" INTEGER, chinese TEXT, pinyin TEXT, meaning TEXT, focus TEXT)`,
  `CREATE TABLE IF NOT EXISTS stories_lessons (id TEXT PRIMARY KEY, title TEXT, chineseTitle TEXT, pinyin TEXT, meaning TEXT, level TEXT, description TEXT, video TEXT, poster TEXT)`,
  `CREATE TABLE IF NOT EXISTS story_scenes (id INTEGER PRIMARY KEY AUTOINCREMENT, lessonId TEXT, "order" INTEGER, chinese TEXT, pinyin TEXT, english TEXT, image TEXT, audio TEXT)`,
  `CREATE TABLE IF NOT EXISTS stories_vocabulary (id INTEGER PRIMARY KEY AUTOINCREMENT, lessonId TEXT, "order" INTEGER, character TEXT, pinyin TEXT, meaning TEXT, audio TEXT)`,
  `CREATE TABLE IF NOT EXISTS stories_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, lessonId TEXT, "order" INTEGER, type TEXT, groupId TEXT, groupTitle TEXT, pinyin TEXT, question TEXT, audioUrl TEXT, audioText TEXT, optionA TEXT, optionB TEXT, optionC TEXT, optionD TEXT, optionE TEXT, optionAImage TEXT, optionBImage TEXT, optionCImage TEXT, optionDImage TEXT, optionEImage TEXT, answer TEXT, explanation TEXT)`,
  `CREATE TABLE IF NOT EXISTS reels_videos (id TEXT PRIMARY KEY, type TEXT, holiday_id TEXT, title TEXT, video_path TEXT, thumbnail_path TEXT, duration_sec INTEGER, status TEXT, text_cn TEXT, text_pinyin TEXT, text_en TEXT, text_my TEXT)`,
  `CREATE TABLE IF NOT EXISTS media_files (id TEXT PRIMARY KEY, filename TEXT, mime_type TEXT, media_type TEXT, size_bytes INTEGER, chunk_size INTEGER, chunk_count INTEGER, storage_mode TEXT DEFAULT 'd1', object_key TEXT DEFAULT '', upload_id TEXT DEFAULT '', status TEXT DEFAULT 'ready', created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS media_chunks (media_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, data_b64 TEXT NOT NULL, PRIMARY KEY (media_id, chunk_index))`,
  `CREATE TABLE IF NOT EXISTS site_config (id TEXT PRIMARY KEY, config_json TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS d1_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT NOT NULL, phoneNumber TEXT DEFAULT '', dob TEXT DEFAULT '', role TEXT DEFAULT 'student', membershipStatus TEXT DEFAULT 'free', membershipPlan TEXT DEFAULT 'none', membershipExpiresAt TEXT DEFAULT '', subscribedLessonIds TEXT DEFAULT '[]', subscribedCourses TEXT DEFAULT '[]', practiceLessonIds TEXT DEFAULT '[]', practiceCourses TEXT DEFAULT '[]', linkedProviders TEXT DEFAULT '["password"]', mustChangePassword INTEGER DEFAULT 0, passwordSalt TEXT DEFAULT '', passwordHash TEXT DEFAULT '', password_salt TEXT DEFAULT '', password_hash TEXT DEFAULT '', createdAt TEXT, updatedAt TEXT)`,
  `CREATE TABLE IF NOT EXISTS subscription_requests (requestId TEXT PRIMARY KEY, userId TEXT NOT NULL, username TEXT, userEmail TEXT, userPhone TEXT, planType TEXT, lessonId TEXT DEFAULT '', courseName TEXT DEFAULT '', lessonTitle TEXT DEFAULT '', amountLabel TEXT DEFAULT '', contactChannel TEXT DEFAULT 'viber', contactHandle TEXT DEFAULT '', note TEXT DEFAULT '', status TEXT DEFAULT 'pending', adminNote TEXT DEFAULT '', createdAt TEXT, updatedAt TEXT)`,
  `CREATE TABLE IF NOT EXISTS user_progress (uid TEXT PRIMARY KEY, currentStreak INTEGER DEFAULT 0, bestStreak INTEGER DEFAULT 0, lastCompletedDate TEXT DEFAULT '', streakDates TEXT DEFAULT '[]', completedLessonIds TEXT DEFAULT '[]', reminderEnabled INTEGER DEFAULT 1, reminderTime TEXT DEFAULT '18:00', lastNotifiedDate TEXT DEFAULT '', updatedAt TEXT)`,
  `CREATE TABLE IF NOT EXISTS lesson_catalog (lessonId TEXT PRIMARY KEY, title TEXT, course TEXT, audience TEXT DEFAULT 'Adult', accessType TEXT DEFAULT 'free', price REAL DEFAULT 0, practicePrice REAL DEFAULT 0, hasExercises INTEGER DEFAULT 1, updatedBy TEXT DEFAULT '', updatedAt TEXT)`,
  `CREATE TABLE IF NOT EXISTS d1_workbooks (name TEXT PRIMARY KEY, xlsx_b64 TEXT NOT NULL, row_count INTEGER DEFAULT 0, updated_at TEXT NOT NULL)`
];

const EXPECTED_TABLE_COLUMNS: Record<string, Record<string, string>> = {
  lessons: {
    id: 'TEXT',
    course: "TEXT DEFAULT 'HSK 2'",
    category: "TEXT DEFAULT ''",
    categoryKey: "TEXT DEFAULT ''",
    categoryNum: "TEXT DEFAULT 'Course 1'",
    title: "TEXT DEFAULT ''",
    chineseTitle: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    meaning: "TEXT DEFAULT ''",
    level: "TEXT DEFAULT 'HSK 2'",
    description: "TEXT DEFAULT ''",
    videoUrl: "TEXT DEFAULT ''",
    posterUrl: "TEXT DEFAULT ''",
    fullAudio: "TEXT DEFAULT ''",
    keywords: "TEXT DEFAULT ''",
    accessType: "TEXT DEFAULT 'paid'",
    price: 'REAL DEFAULT 0',
    practicePrice: 'REAL DEFAULT 0',
    updated_at: "TEXT DEFAULT ''"
  },
  exercises: {
    lessonId: "TEXT DEFAULT ''",
    order: 'INTEGER DEFAULT 1',
    type: "TEXT DEFAULT 'multiple-choice'",
    groupId: "TEXT DEFAULT ''",
    groupTitle: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    question: "TEXT DEFAULT ''",
    audioUrl: "TEXT DEFAULT ''",
    audioText: "TEXT DEFAULT ''",
    optionA: "TEXT DEFAULT ''",
    optionB: "TEXT DEFAULT ''",
    optionC: "TEXT DEFAULT ''",
    optionD: "TEXT DEFAULT ''",
    optionE: "TEXT DEFAULT ''",
    optionAImage: "TEXT DEFAULT ''",
    optionBImage: "TEXT DEFAULT ''",
    optionCImage: "TEXT DEFAULT ''",
    optionDImage: "TEXT DEFAULT ''",
    optionEImage: "TEXT DEFAULT ''",
    answer: "TEXT DEFAULT ''",
    explanation: "TEXT DEFAULT ''"
  },
  writing_characters: {
    lessonId: "TEXT DEFAULT ''",
    order: 'INTEGER DEFAULT 1',
    character: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    meaning: "TEXT DEFAULT ''",
    strokeCount: 'INTEGER DEFAULT 6',
    radical: "TEXT DEFAULT ''",
    strokeAnimationUrl: "TEXT DEFAULT ''",
    svgPath: "TEXT DEFAULT ''",
    strokeOrderSteps: "TEXT DEFAULT ''"
  },
  vocabulary: {
    lessonId: "TEXT DEFAULT ''",
    order: 'INTEGER DEFAULT 1',
    character: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    meaning: "TEXT DEFAULT ''",
    audio: "TEXT DEFAULT ''"
  },
  games: {
    id: 'TEXT',
    order: 'INTEGER DEFAULT 1',
    title: "TEXT DEFAULT ''",
    category: "TEXT DEFAULT ''",
    badge: "TEXT DEFAULT ''",
    description: "TEXT DEFAULT ''",
    embed_code: "TEXT DEFAULT ''",
    embed_url: "TEXT DEFAULT ''",
    width: 'INTEGER DEFAULT 800',
    height: 'INTEGER DEFAULT 600',
    active: "TEXT DEFAULT 'true'"
  },
  pronunciation: {
    lessonId: "TEXT DEFAULT ''",
    order: 'INTEGER DEFAULT 1',
    chinese: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    meaning: "TEXT DEFAULT ''",
    focus: "TEXT DEFAULT ''"
  },
  stories_lessons: {
    id: 'TEXT',
    title: "TEXT DEFAULT ''",
    chineseTitle: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    meaning: "TEXT DEFAULT ''",
    level: "TEXT DEFAULT 'Beginner'",
    description: "TEXT DEFAULT ''",
    video: "TEXT DEFAULT ''",
    poster: "TEXT DEFAULT ''"
  },
  story_scenes: {
    lessonId: "TEXT DEFAULT ''",
    order: 'INTEGER DEFAULT 1',
    chinese: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    english: "TEXT DEFAULT ''",
    image: "TEXT DEFAULT ''",
    audio: "TEXT DEFAULT ''"
  },
  stories_vocabulary: {
    lessonId: "TEXT DEFAULT ''",
    order: 'INTEGER DEFAULT 1',
    character: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    meaning: "TEXT DEFAULT ''",
    audio: "TEXT DEFAULT ''"
  },
  stories_exercises: {
    lessonId: "TEXT DEFAULT ''",
    order: 'INTEGER DEFAULT 1',
    type: "TEXT DEFAULT 'multiple-choice'",
    groupId: "TEXT DEFAULT ''",
    groupTitle: "TEXT DEFAULT ''",
    pinyin: "TEXT DEFAULT ''",
    question: "TEXT DEFAULT ''",
    audioUrl: "TEXT DEFAULT ''",
    audioText: "TEXT DEFAULT ''",
    optionA: "TEXT DEFAULT ''",
    optionB: "TEXT DEFAULT ''",
    optionC: "TEXT DEFAULT ''",
    optionD: "TEXT DEFAULT ''",
    optionE: "TEXT DEFAULT ''",
    optionAImage: "TEXT DEFAULT ''",
    optionBImage: "TEXT DEFAULT ''",
    optionCImage: "TEXT DEFAULT ''",
    optionDImage: "TEXT DEFAULT ''",
    optionEImage: "TEXT DEFAULT ''",
    answer: "TEXT DEFAULT ''",
    explanation: "TEXT DEFAULT ''"
  },
  reels_videos: {
    id: 'TEXT',
    type: "TEXT DEFAULT 'daily'",
    holiday_id: "TEXT DEFAULT ''",
    title: "TEXT DEFAULT ''",
    video_path: "TEXT DEFAULT ''",
    thumbnail_path: "TEXT DEFAULT ''",
    duration_sec: 'INTEGER DEFAULT 0',
    status: "TEXT DEFAULT 'published'",
    text_cn: "TEXT DEFAULT ''",
    text_pinyin: "TEXT DEFAULT ''",
    text_en: "TEXT DEFAULT ''",
    text_my: "TEXT DEFAULT ''"
  },
  media_files: {
    storage_mode: "TEXT DEFAULT 'd1'",
    object_key: "TEXT DEFAULT ''",
    upload_id: "TEXT DEFAULT ''",
    status: "TEXT DEFAULT 'ready'"
  },
  users: {
    uid: 'TEXT',
    email: 'TEXT',
    username: "TEXT DEFAULT 'Learner'",
    phoneNumber: "TEXT DEFAULT ''",
    dob: "TEXT DEFAULT ''",
    role: "TEXT DEFAULT 'student'",
    membershipStatus: "TEXT DEFAULT 'free'",
    membershipPlan: "TEXT DEFAULT 'none'",
    membershipExpiresAt: "TEXT DEFAULT ''",
    subscribedLessonIds: "TEXT DEFAULT '[]'",
    subscribedCourses: "TEXT DEFAULT '[]'",
    practiceLessonIds: "TEXT DEFAULT '[]'",
    practiceCourses: "TEXT DEFAULT '[]'",
    linkedProviders: 'TEXT DEFAULT \'["password"]\'',
    mustChangePassword: 'INTEGER DEFAULT 0',
    passwordSalt: "TEXT DEFAULT ''",
    passwordHash: "TEXT DEFAULT ''",
    password_salt: "TEXT DEFAULT ''",
    password_hash: "TEXT DEFAULT ''",
    createdAt: "TEXT DEFAULT ''",
    updatedAt: "TEXT DEFAULT ''"
  },
  subscription_requests: {
    requestId: 'TEXT',
    userId: 'TEXT',
    username: "TEXT DEFAULT ''",
    userEmail: "TEXT DEFAULT ''",
    userPhone: "TEXT DEFAULT ''",
    planType: "TEXT DEFAULT 'course'",
    lessonId: "TEXT DEFAULT ''",
    courseName: "TEXT DEFAULT ''",
    lessonTitle: "TEXT DEFAULT ''",
    amountLabel: "TEXT DEFAULT ''",
    contactChannel: "TEXT DEFAULT 'viber'",
    contactHandle: "TEXT DEFAULT ''",
    note: "TEXT DEFAULT ''",
    status: "TEXT DEFAULT 'pending'",
    adminNote: "TEXT DEFAULT ''",
    createdAt: "TEXT DEFAULT ''",
    updatedAt: "TEXT DEFAULT ''"
  },
  user_progress: {
    uid: 'TEXT',
    currentStreak: 'INTEGER DEFAULT 0',
    bestStreak: 'INTEGER DEFAULT 0',
    lastCompletedDate: "TEXT DEFAULT ''",
    streakDates: "TEXT DEFAULT '[]'",
    completedLessonIds: "TEXT DEFAULT '[]'",
    reminderEnabled: 'INTEGER DEFAULT 1',
    reminderTime: "TEXT DEFAULT '18:00'",
    lastNotifiedDate: "TEXT DEFAULT ''",
    updatedAt: "TEXT DEFAULT ''"
  },
  lesson_catalog: {
    lessonId: 'TEXT',
    title: "TEXT DEFAULT ''",
    course: "TEXT DEFAULT 'HSK 2'",
    audience: "TEXT DEFAULT 'Adult'",
    accessType: "TEXT DEFAULT 'free'",
    price: 'REAL DEFAULT 0',
    practicePrice: 'REAL DEFAULT 0',
    hasExercises: 'INTEGER DEFAULT 1',
    updatedBy: "TEXT DEFAULT ''",
    updatedAt: "TEXT DEFAULT ''"
  },
  d1_workbooks: {
    name: 'TEXT',
    xlsx_b64: "TEXT DEFAULT ''",
    row_count: 'INTEGER DEFAULT 0',
    updated_at: "TEXT DEFAULT ''"
  }
};

let d1SchemaReady = false;

async function ensureD1Tables(db: D1Database, force = false): Promise<void> {
  if (!db) return;
  if (d1SchemaReady && !force) return;

  try {
    const stmts = D1_TABLE_STATEMENTS.map((sql) => db.prepare(sql));
    await db.batch(stmts);
  } catch (_) {
    for (const sql of D1_TABLE_STATEMENTS) {
      await db.prepare(sql).run();
    }
  }
  for (const [tableName, columns] of Object.entries(EXPECTED_TABLE_COLUMNS)) {
    try {
      const info = await db.prepare(`PRAGMA table_info("${tableName}")`).all<{ name: string }>();
      const existingCols = new Set(
        (info?.results || []).map((c) => String(c.name || '').trim().toLowerCase())
      );
      if (!existingCols.size) continue;
      for (const [colName, colDef] of Object.entries(columns)) {
        if (!existingCols.has(colName.toLowerCase())) {
          try {
            const safeDef = colDef.replace(/DEFAULT\s+"([^"]*)"/g, "DEFAULT '$1'");
            await db.prepare(`ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${safeDef}`).run();
          } catch (colErr) {
            console.warn(`[ensureD1Tables] Warning adding column ${tableName}.${colName}:`, colErr);
          }
        }
      }
    } catch (tableErr) {
      console.warn(`[ensureD1Tables] Warning inspecting table ${tableName}:`, tableErr);
    }
  }
  d1SchemaReady = true;
}

async function withD1TableRepair<T>(db: D1Database, fn: () => Promise<T>): Promise<T> {
  if (!db) {
    throw new Error('Cloudflare D1 database binding (DB) is not configured.');
  }
  await ensureD1Tables(db);
  return withD1Retry(async () => {
    try {
      return await fn();
    } catch (err) {
      if (isMissingTableError(err)) {
        d1SchemaReady = false;
        await ensureD1Tables(db, true);
        return await fn();
      }
      throw err;
    }
  }, 3);
}

async function executeD1Batch(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  if (!stmts.length) return;
  await withD1TableRepair(db, async () => {
    const CHUNK = 60;
    for (let i = 0; i < stmts.length; i += CHUNK) {
      await withD1Retry(() => db.batch(stmts.slice(i, i + CHUNK)), 2);
    }
  });
}

interface D1ColumnMeta {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

const ALLOWED_D1_TABLES = new Set([
  'users',
  'subscription_requests',
  'user_progress',
  'lesson_catalog',
  'd1_workbooks'
]);

async function getD1TableColumns(db: D1Database, tableName: string): Promise<D1ColumnMeta[]> {
  if (!db || !ALLOWED_D1_TABLES.has(tableName)) return [];
  const info = await db.prepare(`PRAGMA table_info("${tableName}")`).all<D1ColumnMeta>();
  return (info?.results || []).filter((col) => /^[a-zA-Z0-9_]+$/.test(String(col?.name || '')));
}

function getRowField(row: any, ...keys: string[]): unknown {
  if (!row || typeof row !== 'object') return undefined;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]) !== '') {
      return row[k];
    }
  }
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) {
      return row[k];
    }
  }
  return undefined;
}

function defaultValueForUnknownD1Column(col: D1ColumnMeta): string | number {
  const t = String(col.type || '').toUpperCase();
  if (t.includes('INT') || t.includes('REAL') || t.includes('NUM') || t.includes('DEC') || t.includes('FLOA') || t.includes('DOUB')) {
    return 0;
  }
  return '';
}

function buildD1UserColumnMap(fields: Record<string, unknown>): Record<string, string | number> {
  const email = String(fields.email || '').trim().toLowerCase().slice(0, 160);
  const username = String(fields.username || (email.includes('@') ? email.split('@')[0] : 'Learner')).trim().slice(0, 60) || 'Learner';
  const phoneNumber = String(fields.phoneNumber ?? '').trim().slice(0, 32);
  const dob = String(fields.dob ?? '').trim().slice(0, 10);
  const isAdminRole = String(fields.role || '').toLowerCase() === 'admin' || email === ADMIN_EMAIL.toLowerCase();
  const role = isAdminRole ? 'admin' : 'student';
  const rawStatus = String(fields.membershipStatus || (isAdminRole ? 'active' : 'free')).trim().toLowerCase();
  const membershipStatus = ['free', 'pending', 'active', 'expired'].includes(rawStatus) ? rawStatus : 'free';
  const membershipPlan = normalizeWorkerPlan(fields.membershipPlan ?? (isAdminRole ? 'course' : 'none'));
  const membershipExpiresAt = String(fields.membershipExpiresAt ?? '').trim().slice(0, 40);
  const subscribedLessonIds =
    typeof fields.subscribedLessonIds === 'string'
      ? fields.subscribedLessonIds
      : JSON.stringify(parseJsonStrArray(fields.subscribedLessonIds).slice(0, 100));
  const subscribedCourses =
    typeof fields.subscribedCourses === 'string'
      ? fields.subscribedCourses
      : JSON.stringify(Array.from(new Set(parseJsonStrArray(fields.subscribedCourses).map(normalizeWorkerCourseName))).slice(0, 50));
  const practiceLessonIds =
    typeof fields.practiceLessonIds === 'string'
      ? fields.practiceLessonIds
      : JSON.stringify(parseJsonStrArray(fields.practiceLessonIds).slice(0, 100));
  const practiceCourses =
    typeof fields.practiceCourses === 'string'
      ? fields.practiceCourses
      : JSON.stringify(Array.from(new Set(parseJsonStrArray(fields.practiceCourses).map(normalizeWorkerCourseName))).slice(0, 50));
  const linkedProviders =
    typeof fields.linkedProviders === 'string'
      ? fields.linkedProviders
      : JSON.stringify(['password']);
  const mustChangePassword =
    fields.mustChangePassword === true || Number(fields.mustChangePassword) === 1 || fields.mustChangePassword === 'true' ? 1 : 0;
  const passwordHash = String(fields.passwordHash ?? '');
  const extractedSalt =
    !fields.passwordSalt && passwordHash.startsWith('sha256$') ? passwordHash.split('$')[1] || '' : '';
  const passwordSalt = String(fields.passwordSalt ?? extractedSalt);
  const nowIso = new Date().toISOString();
  const createdAt = String(fields.createdAt || nowIso);
  const updatedAt = String(fields.updatedAt || nowIso);
  const uid = String(fields.uid || '').trim();

  return {
    uid,
    email,
    username,
    name: username,
    displayname: username,
    display_name: username,
    phonenumber: phoneNumber,
    phone_number: phoneNumber,
    phone: phoneNumber,
    dob,
    role,
    membershipstatus: membershipStatus,
    membership_status: membershipStatus,
    membershipplan: membershipPlan,
    membership_plan: membershipPlan,
    membershipexpiresat: membershipExpiresAt,
    membership_expires_at: membershipExpiresAt,
    subscribedlessonids: subscribedLessonIds,
    subscribed_lesson_ids: subscribedLessonIds,
    subscribedcourses: subscribedCourses,
    subscribed_courses: subscribedCourses,
    practicelessonids: practiceLessonIds,
    practice_lesson_ids: practiceLessonIds,
    practicecourses: practiceCourses,
    practice_courses: practiceCourses,
    linkedproviders: linkedProviders,
    linked_providers: linkedProviders,
    mustchangepassword: mustChangePassword,
    must_change_password: mustChangePassword,
    passwordsalt: passwordSalt,
    password_salt: passwordSalt,
    salt: passwordSalt,
    passwordhash: passwordHash,
    password_hash: passwordHash,
    password: passwordHash,
    hash: passwordHash,
    createdat: createdAt,
    created_at: createdAt,
    updatedat: updatedAt,
    updated_at: updatedAt
  };
}

async function prepareInsertD1User(
  db: D1Database,
  fields: Record<string, unknown>,
  options: { ignoreEmailConflict?: boolean } = {}
): Promise<D1PreparedStatement> {
  let cols = await getD1TableColumns(db, 'users');
  if (!cols.length) {
    d1SchemaReady = false;
    await ensureD1Tables(db, true);
    cols = await getD1TableColumns(db, 'users');
  }
  if (!cols.length) {
    throw new Error('Database users table schema could not be inspected.');
  }
  const colMap = buildD1UserColumnMap(fields);
  const colNames: string[] = [];
  const placeholders: string[] = [];
  const binds: Array<string | number> = [];

  for (const col of cols) {
    const key = col.name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(colMap, key)) {
      colNames.push(`"${col.name}"`);
      placeholders.push('?');
      binds.push(colMap[key]);
    } else if (col.notnull === 1 && col.dflt_value === null) {
      colNames.push(`"${col.name}"`);
      placeholders.push('?');
      binds.push(defaultValueForUnknownD1Column(col));
    }
  }

  if (!colNames.length) {
    throw new Error('No writable columns found on users table.');
  }
  const conflictClause = options.ignoreEmailConflict ? ' ON CONFLICT(email) DO NOTHING' : '';
  const sql = `INSERT INTO "users" (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})${conflictClause}`;
  return db.prepare(sql).bind(...binds);
}

async function prepareUpdateD1UserByUid(
  db: D1Database,
  uid: string,
  partialFields: Record<string, unknown>
): Promise<D1PreparedStatement> {
  let cols = await getD1TableColumns(db, 'users');
  if (!cols.length) {
    d1SchemaReady = false;
    await ensureD1Tables(db, true);
    cols = await getD1TableColumns(db, 'users');
  }
  if (!cols.length) {
    throw new Error('Database users table schema could not be inspected.');
  }
  const fullMap = buildD1UserColumnMap({ ...partialFields, uid });
  const keyGroups: Array<{ check: () => boolean; colKeys: string[] }> = [
    { check: () => partialFields.email !== undefined, colKeys: ['email'] },
    { check: () => partialFields.username !== undefined, colKeys: ['username', 'name', 'displayname', 'display_name'] },
    { check: () => partialFields.phoneNumber !== undefined, colKeys: ['phonenumber', 'phone_number', 'phone'] },
    { check: () => partialFields.dob !== undefined, colKeys: ['dob'] },
    { check: () => partialFields.role !== undefined, colKeys: ['role'] },
    { check: () => partialFields.membershipStatus !== undefined, colKeys: ['membershipstatus', 'membership_status'] },
    { check: () => partialFields.membershipPlan !== undefined, colKeys: ['membershipplan', 'membership_plan'] },
    { check: () => partialFields.membershipExpiresAt !== undefined, colKeys: ['membershipexpiresat', 'membership_expires_at'] },
    { check: () => partialFields.subscribedLessonIds !== undefined, colKeys: ['subscribedlessonids', 'subscribed_lesson_ids'] },
    { check: () => partialFields.subscribedCourses !== undefined, colKeys: ['subscribedcourses', 'subscribed_courses'] },
    { check: () => partialFields.practiceLessonIds !== undefined, colKeys: ['practicelessonids', 'practice_lesson_ids'] },
    { check: () => partialFields.practiceCourses !== undefined, colKeys: ['practicecourses', 'practice_courses'] },
    { check: () => partialFields.linkedProviders !== undefined, colKeys: ['linkedproviders', 'linked_providers'] },
    { check: () => partialFields.mustChangePassword !== undefined, colKeys: ['mustchangepassword', 'must_change_password'] },
    { check: () => partialFields.passwordSalt !== undefined, colKeys: ['passwordsalt', 'password_salt', 'salt'] },
    { check: () => partialFields.passwordHash !== undefined, colKeys: ['passwordhash', 'password_hash', 'password', 'hash'] },
    { check: () => partialFields.updatedAt !== undefined, colKeys: ['updatedat', 'updated_at'] }
  ];

  const allowedColKeys = new Set<string>();
  for (const g of keyGroups) {
    if (g.check()) {
      for (const k of g.colKeys) allowedColKeys.add(k);
    }
  }
  allowedColKeys.add('updatedat');
  allowedColKeys.add('updated_at');

  const assignments: string[] = [];
  const binds: Array<string | number> = [];
  for (const col of cols) {
    const key = col.name.toLowerCase();
    if (key === 'uid') continue;
    if (allowedColKeys.has(key) && Object.prototype.hasOwnProperty.call(fullMap, key)) {
      assignments.push(`"${col.name}" = ?`);
      binds.push(fullMap[key]);
    }
  }

  if (!assignments.length) {
    throw new Error('No updatable columns matched on users table.');
  }
  binds.push(uid);
  const sql = `UPDATE "users" SET ${assignments.join(', ')} WHERE "uid" = ?`;
  return db.prepare(sql).bind(...binds);
}

async function upsertD1UserRow(db: D1Database, rawFields: Record<string, unknown>): Promise<string> {
  const email = String(rawFields.email || '').trim().toLowerCase().slice(0, 160);
  const uid = String(rawFields.uid || '').trim();
  const existing = await oneStrict<any>(db, `SELECT * FROM users WHERE uid = ? OR LOWER(email) = ?`, uid, email);

  if (existing) {
    const targetUid = String(existing.uid);
    const incomingHash = String(rawFields.passwordHash || '').trim();
    const existingHash = String(getRowField(existing, 'passwordHash', 'password_hash') || '').trim();
    const effectiveHash = incomingHash || existingHash;
    const incomingSalt = String(rawFields.passwordSalt || '').trim();
    const existingSalt = String(getRowField(existing, 'passwordSalt', 'password_salt') || '').trim();
    const effectiveSalt = incomingSalt || existingSalt || (effectiveHash.startsWith('sha256$') ? effectiveHash.split('$')[1] || '' : '');

    const stmt = await prepareUpdateD1UserByUid(db, targetUid, {
      email: email || String(existing.email || '').toLowerCase(),
      username: rawFields.username ?? getRowField(existing, 'username', 'name', 'display_name'),
      phoneNumber: rawFields.phoneNumber ?? getRowField(existing, 'phoneNumber', 'phone_number', 'phone') ?? '',
      dob: rawFields.dob ?? existing.dob ?? '',
      role: rawFields.role ?? existing.role ?? 'student',
      membershipStatus: rawFields.membershipStatus ?? getRowField(existing, 'membershipStatus', 'membership_status') ?? 'free',
      membershipPlan: rawFields.membershipPlan ?? getRowField(existing, 'membershipPlan', 'membership_plan') ?? 'none',
      membershipExpiresAt: rawFields.membershipExpiresAt ?? getRowField(existing, 'membershipExpiresAt', 'membership_expires_at') ?? '',
      subscribedLessonIds: rawFields.subscribedLessonIds ?? getRowField(existing, 'subscribedLessonIds', 'subscribed_lesson_ids') ?? [],
      subscribedCourses: rawFields.subscribedCourses ?? getRowField(existing, 'subscribedCourses', 'subscribed_courses') ?? [],
      practiceLessonIds: rawFields.practiceLessonIds ?? getRowField(existing, 'practiceLessonIds', 'practice_lesson_ids') ?? [],
      practiceCourses: rawFields.practiceCourses ?? getRowField(existing, 'practiceCourses', 'practice_courses') ?? [],
      mustChangePassword: rawFields.mustChangePassword ?? getRowField(existing, 'mustChangePassword', 'must_change_password') ?? 0,
      passwordSalt: effectiveSalt,
      passwordHash: effectiveHash,
      updatedAt: rawFields.updatedAt || new Date().toISOString()
    });
    await stmt.run();
    return targetUid;
  }

  const stmt = await prepareInsertD1User(db, { ...rawFields, uid, email });
  await stmt.run();
  return uid;
}

function isDeprecatedD1MediaPath(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const clean = val.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!clean) return false;
  return /^\/?public\/assets\/aistudio\//i.test(clean) || /^\/?assets\/video\/media-[a-z0-9]+/i.test(clean);
}

function canonicalizeD1MediaPath(val: unknown, rowId?: string): string {
  const clean = String(val || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!clean) return '';
  if (/^\/?public\/assets\/aistudio\//i.test(clean)) {
    if (/logo/i.test(clean)) return 'assets/images/logo.svg';
    if (/story[-_]?0?1/i.test(clean)) return 'assets/video/story-01.mp4';
    if (/story[-_]?0?2/i.test(clean)) return 'assets/video/story-02.mp4';
  }
  if (/^\/?assets\/video\/media-[a-z0-9]+/i.test(clean)) {
    const idLower = String(rowId || '').trim().toLowerCase();
    if (idLower === 'lesson-01' || idLower === 'story_01' || idLower === 'story-01') {
      return 'assets/video/story-01.mp4';
    }
    if (idLower === 'lesson-02' || idLower === 'story_02' || idLower === 'story-02') {
      return 'assets/video/story-02.mp4';
    }
  }
  if (/^\/?assets\/images\/(story2-(?:poster|0[1-5]))\.jpg$/i.test(clean)) {
    return clean.replace(/^\/+/, '').replace(/\.jpg$/i, '.svg');
  }
  return clean;
}

async function getD1Meta(db: D1Database, key: string): Promise<string | null> {
  const row = await one<{ value: string }>(db, `SELECT value FROM d1_meta WHERE key = ?`, key);
  return row ? String(row.value || '') : null;
}

async function setD1Meta(db: D1Database, key: string, value: string): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO d1_meta (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
      )
      .bind(key, value, new Date().toISOString())
      .run();
  } catch (_) {}
}

const WORKER_MEDIA_CHUNK_BYTES = 256 * 1024;
const R2_MULTIPART_CHUNK_BYTES = 5 * 1024 * 1024;
const MAX_WORKER_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_SINGLE_SHOT_UPLOAD_BYTES = 4 * 1024 * 1024;

function uint8ToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, Math.min(i + step, bytes.length));
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function inferMimeFromFilename(filename: string, fallbackType: string): string {
  if (fallbackType && fallbackType !== 'application/octet-stream') return fallbackType;
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function sanitizeUploadFileMeta(rawNameInput: string, fallbackMime: string) {
  const rawName = String(rawNameInput || 'media').trim();
  const dotIdx = rawName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? rawName.slice(dotIdx).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const baseSlug = (dotIdx >= 0 ? rawName.slice(0, dotIdx) : rawName)
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'media';
  const safeFilename = `${baseSlug}${ext}`;
  const mediaType =
    ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.m4v'
      ? 'videos'
      : ext === '.mp3' || ext === '.wav' || ext === '.ogg' || ext === '.m4a'
      ? 'audio'
      : 'images';
  const mimeType = inferMimeFromFilename(safeFilename, fallbackMime);
  const rand = Math.random().toString(36).slice(2, 6);
  const mediaId = `${baseSlug}-${Date.now().toString(36)}-${rand}`;
  return { safeFilename, mediaType, mimeType, mediaId };
}

async function handleWorkerChunkUploadInit(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 500);
  }
  const body = (await request.json().catch(() => ({}))) as any;
  const filename = String(body?.filename || '').trim();
  const size = Number(body?.size) || 0;
  const fallbackMime = String(body?.mimeType || '').trim();

  if (!filename || size <= 0) {
    return fail('Valid filename and file size are required.', 400);
  }
  if (size > MAX_WORKER_UPLOAD_BYTES) {
    const mb = (size / (1024 * 1024)).toFixed(2);
    return fail(
      `File "${filename}" (${mb} MB) exceeds the 50 MB Cloudflare upload limit. Compress the video under 50 MB or paste a hosted https:// URL.`,
      413
    );
  }

  const { safeFilename, mediaType, mimeType, mediaId } = sanitizeUploadFileMeta(filename, fallbackMime);
  const useR2 = Boolean(env.MEDIA_BUCKET);
  const storageMode = useR2 ? 'r2' : 'd1';
  const chunkSize = useR2 ? R2_MULTIPART_CHUNK_BYTES : WORKER_MEDIA_CHUNK_BYTES;
  const chunkCount = Math.max(1, Math.ceil(size / chunkSize));
  const objectKey = useR2 ? `media/${mediaId}/${safeFilename}` : '';
  let uploadId = '';

  if (useR2 && env.MEDIA_BUCKET && chunkCount > 1) {
    const multipart = await env.MEDIA_BUCKET.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: mimeType },
    });
    uploadId = multipart.uploadId;
  }

  const nowIso = new Date().toISOString();
  await withD1TableRepair(env.DB, () =>
    env.DB.prepare(
      `INSERT INTO media_files (id, filename, mime_type, media_type, size_bytes, chunk_size, chunk_count, storage_mode, object_key, upload_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', ?)`
    )
      .bind(mediaId, safeFilename, mimeType, mediaType, size, chunkSize, chunkCount, storageMode, objectKey, uploadId, nowIso)
      .run()
  );

  return json({
    success: true,
    mediaId,
    filename: safeFilename,
    mediaType,
    mimeType,
    chunkSize,
    chunkCount,
    maxUploadBytes: MAX_WORKER_UPLOAD_BYTES,
    storage: storageMode === 'r2' ? 'cloudflare-r2' : 'cloudflare-d1',
  });
}

async function handleWorkerChunkUploadPart(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 500);
  }
  const mediaId = String(url.searchParams.get('mediaId') || '').trim();
  const chunkIndex = Number(url.searchParams.get('index'));
  if (!mediaId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return fail('Valid mediaId and chunk index are required.', 400);
  }

  const meta = await withD1TableRepair(env.DB, () =>
    one<{
      id: string;
      mime_type: string;
      chunk_count: number;
      storage_mode: string;
      object_key: string;
      upload_id: string;
    }>(
      env.DB,
      `SELECT id, mime_type, chunk_count, storage_mode, object_key, upload_id FROM media_files WHERE id = ?`,
      mediaId
    )
  );
  if (!meta) {
    return fail('Upload session not found or expired.', 404);
  }
  if (chunkIndex >= (Number(meta.chunk_count) || 0)) {
    return fail(`Chunk index ${chunkIndex} is out of bounds.`, 400);
  }

  if (meta.storage_mode === 'r2' && env.MEDIA_BUCKET && meta.object_key) {
    const ab = await request.arrayBuffer();
    if (!ab.byteLength) {
      return fail('Empty chunk payload.', 400);
    }
    let partRecord: Record<string, unknown>;
    if ((Number(meta.chunk_count) || 1) <= 1) {
      const putRes = await env.MEDIA_BUCKET.put(meta.object_key, ab, {
        httpMetadata: { contentType: meta.mime_type || 'application/octet-stream' },
      });
      partRecord = { single: true, etag: putRes?.etag || 'single' };
    } else {
      const multipart = env.MEDIA_BUCKET.resumeMultipartUpload(meta.object_key, meta.upload_id);
      const uploadedPart = await multipart.uploadPart(chunkIndex + 1, ab);
      partRecord = { partNumber: uploadedPart.partNumber || chunkIndex + 1, etag: uploadedPart.etag };
    }
    await withD1TableRepair(env.DB, () =>
      env.DB.prepare(`INSERT OR REPLACE INTO media_chunks (media_id, chunk_index, data_b64) VALUES (?, ?, ?)`)
        .bind(mediaId, chunkIndex, JSON.stringify(partRecord))
        .run()
    );
    return json({ success: true, mediaId, index: chunkIndex, receivedBytes: ab.byteLength, storage: 'cloudflare-r2' });
  }

  const ab = await request.arrayBuffer();
  if (!ab.byteLength) {
    return fail('Empty chunk payload.', 400);
  }
  if (ab.byteLength > 1024 * 1024) {
    return fail('D1 chunk size exceeds 1 MB limit.', 413);
  }
  const b64 = uint8ToBase64(new Uint8Array(ab));
  await withD1TableRepair(env.DB, () =>
    env.DB.prepare(`INSERT OR REPLACE INTO media_chunks (media_id, chunk_index, data_b64) VALUES (?, ?, ?)`)
      .bind(mediaId, chunkIndex, b64)
      .run()
  );

  return json({ success: true, mediaId, index: chunkIndex, receivedBytes: ab.byteLength, storage: 'cloudflare-d1' });
}

async function handleWorkerChunkUploadComplete(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 500);
  }
  const body = (await request.json().catch(() => ({}))) as any;
  const mediaId = String(body?.mediaId || '').trim();
  if (!mediaId) {
    return fail('mediaId is required.', 400);
  }

  const meta = await withD1TableRepair(env.DB, () =>
    one<{
      id: string;
      filename: string;
      media_type: string;
      size_bytes: number;
      chunk_count: number;
      storage_mode: string;
      object_key: string;
      upload_id: string;
    }>(
      env.DB,
      `SELECT id, filename, media_type, size_bytes, chunk_count, storage_mode, object_key, upload_id FROM media_files WHERE id = ?`,
      mediaId
    )
  );
  if (!meta) {
    return fail('Upload session not found.', 404);
  }

  const expectedCount = Number(meta.chunk_count) || 0;
  const rows = await withD1TableRepair(env.DB, () =>
    all<{ chunk_index: number; data_b64: string }>(
      env.DB,
      `SELECT chunk_index, data_b64 FROM media_chunks WHERE media_id = ? ORDER BY chunk_index ASC`,
      mediaId
    )
  );

  const receivedSet = new Set(rows.map((r) => Number(r.chunk_index)));
  const missing: number[] = [];
  for (let i = 0; i < expectedCount; i++) {
    if (!receivedSet.has(i)) missing.push(i);
  }
  if (missing.length > 0) {
    return fail(`Upload incomplete: missing ${missing.length} chunk(s) (starting at #${missing[0]}).`, 400);
  }

  if (meta.storage_mode === 'r2' && env.MEDIA_BUCKET && meta.object_key) {
    if (expectedCount > 1) {
      const parts = rows.map((r) => {
        const parsed = JSON.parse(r.data_b64 || '{}');
        return {
          partNumber: Number(parsed.partNumber || Number(r.chunk_index) + 1),
          etag: String(parsed.etag || ''),
        };
      });
      const multipart = env.MEDIA_BUCKET.resumeMultipartUpload(meta.object_key, meta.upload_id);
      await multipart.complete(parts);
    }
    await env.DB.prepare(`DELETE FROM media_chunks WHERE media_id = ?`).bind(mediaId).run().catch(() => {});
  }

  await withD1TableRepair(env.DB, () =>
    env.DB.prepare(`UPDATE media_files SET status = 'ready' WHERE id = ?`).bind(mediaId).run()
  );

  const publicUrl = `/api/media/${encodeURIComponent(mediaId)}/${encodeURIComponent(meta.filename)}`;
  return json({
    success: true,
    url: publicUrl,
    mediaType: meta.media_type,
    filename: meta.filename,
    size: Number(meta.size_bytes) || 0,
    storage: meta.storage_mode === 'r2' ? 'cloudflare-r2' : 'cloudflare-d1',
  });
}

async function handleWorkerChunkUploadAbort(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: true });
  const body = (await request.json().catch(() => ({}))) as any;
  const mediaId = String(body?.mediaId || url.searchParams.get('mediaId') || '').trim();
  if (!mediaId) return json({ success: true });

  const meta = await one<{ storage_mode: string; object_key: string; upload_id: string }>(
    env.DB,
    `SELECT storage_mode, object_key, upload_id FROM media_files WHERE id = ?`,
    mediaId
  );
  if (meta && meta.storage_mode === 'r2' && env.MEDIA_BUCKET && meta.object_key) {
    if (meta.upload_id) {
      await env.MEDIA_BUCKET.resumeMultipartUpload(meta.object_key, meta.upload_id).abort().catch(() => {});
    } else {
      await env.MEDIA_BUCKET.delete(meta.object_key).catch(() => {});
    }
  }
  await env.DB.prepare(`DELETE FROM media_chunks WHERE media_id = ?`).bind(mediaId).run().catch(() => {});
  await env.DB.prepare(`DELETE FROM media_files WHERE id = ?`).bind(mediaId).run().catch(() => {});
  return json({ success: true });
}

async function handleWorkerMediaUpload(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 500);
  }
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return fail('No media file attached.', 400);
  }
  if (file.size > MAX_SINGLE_SHOT_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    return fail(
      `File "${file.name}" (${mb} MB) must use chunked upload (/api/admin/upload-media/init).`,
      413
    );
  }

  const { safeFilename, mediaType, mimeType, mediaId } = sanitizeUploadFileMeta(
    file.name || 'media',
    file.type || ''
  );

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const nowIso = new Date().toISOString();

  if (env.MEDIA_BUCKET) {
    const objectKey = `media/${mediaId}/${safeFilename}`;
    await env.MEDIA_BUCKET.put(objectKey, bytes, {
      httpMetadata: { contentType: mimeType },
    });
    await withD1TableRepair(env.DB, () =>
      env.DB.prepare(
        `INSERT INTO media_files (id, filename, mime_type, media_type, size_bytes, chunk_size, chunk_count, storage_mode, object_key, upload_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'r2', ?, '', 'ready', ?)`
      )
        .bind(mediaId, safeFilename, mimeType, mediaType, bytes.byteLength, bytes.byteLength, objectKey, nowIso)
        .run()
    );
    const publicUrl = `/api/media/${encodeURIComponent(mediaId)}/${encodeURIComponent(safeFilename)}`;
    return json({
      success: true,
      url: publicUrl,
      mediaType,
      filename: safeFilename,
      size: bytes.byteLength,
      storage: 'cloudflare-r2',
    });
  }

  const chunkSize = WORKER_MEDIA_CHUNK_BYTES;
  const chunkCount = Math.max(1, Math.ceil(bytes.byteLength / chunkSize));

  await withD1TableRepair(env.DB, async () => {
    await env.DB.prepare(
      `INSERT INTO media_files (id, filename, mime_type, media_type, size_bytes, chunk_size, chunk_count, storage_mode, object_key, upload_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'd1', '', '', 'ready', ?)`
    )
      .bind(mediaId, safeFilename, mimeType, mediaType, bytes.byteLength, chunkSize, chunkCount, nowIso)
      .run();

    try {
      const chunkStmts: D1PreparedStatement[] = [];
      for (let idx = 0; idx < chunkCount; idx++) {
        const start = idx * chunkSize;
        const end = Math.min(bytes.byteLength, start + chunkSize);
        const b64 = uint8ToBase64(bytes.subarray(start, end));
        chunkStmts.push(
          env.DB.prepare(`INSERT INTO media_chunks (media_id, chunk_index, data_b64) VALUES (?, ?, ?)`).bind(
            mediaId,
            idx,
            b64
          )
        );
        if (chunkStmts.length >= 2 || idx === chunkCount - 1) {
          await env.DB.batch(chunkStmts.splice(0, chunkStmts.length));
        }
      }
    } catch (err) {
      await env.DB.prepare(`DELETE FROM media_chunks WHERE media_id = ?`).bind(mediaId).run().catch(() => {});
      await env.DB.prepare(`DELETE FROM media_files WHERE id = ?`).bind(mediaId).run().catch(() => {});
      throw err;
    }
  });

  const publicUrl = `/api/media/${encodeURIComponent(mediaId)}/${encodeURIComponent(safeFilename)}`;
  return json({
    success: true,
    url: publicUrl,
    mediaType,
    filename: safeFilename,
    size: bytes.byteLength,
    storage: 'cloudflare-d1',
  });
}

async function serveWorkerMedia(request: Request, env: Env, mediaId: string): Promise<Response> {
  const meta = await withD1TableRepair(env.DB, () =>
    one<{
      id: string;
      filename: string;
      mime_type: string;
      size_bytes: number;
      chunk_size: number;
      chunk_count: number;
      storage_mode: string;
      object_key: string;
      status: string;
    }>(
      env.DB,
      `SELECT id, filename, mime_type, size_bytes, chunk_size, chunk_count, storage_mode, object_key, status FROM media_files WHERE id = ?`,
      mediaId
    )
  );

  if (!meta || (meta.status && meta.status !== 'ready')) {
    return fail('Media file not found.', 404);
  }

  const totalSize = Number(meta.size_bytes) || 0;
  const chunkSize = Number(meta.chunk_size) || WORKER_MEDIA_CHUNK_BYTES;
  const chunkCount = Number(meta.chunk_count) || 0;
  const baseHeaders: Record<string, string> = {
    'content-type': meta.mime_type || 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=31536000, immutable',
    ...CORS_HEADERS,
  };

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...baseHeaders, 'content-length': String(totalSize) },
    });
  }

  const rangeHeader = request.headers.get('range');
  if (meta.storage_mode === 'r2' && env.MEDIA_BUCKET && meta.object_key) {
    if (rangeHeader && totalSize > 0) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/i);
      if (!match) {
        return new Response(null, {
          status: 416,
          headers: { ...CORS_HEADERS, 'content-range': `bytes */${totalSize}` },
        });
      }
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      if (!match[1] && match[2]) {
        const suffixLen = parseInt(match[2], 10);
        start = Math.max(0, totalSize - suffixLen);
        end = totalSize - 1;
      }
      end = Math.min(end, totalSize - 1);
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || start >= totalSize) {
        return new Response(null, {
          status: 416,
          headers: { ...CORS_HEADERS, 'content-range': `bytes */${totalSize}` },
        });
      }
      const length = end - start + 1;
      const obj = await env.MEDIA_BUCKET.get(meta.object_key, { range: { offset: start, length } });
      if (!obj) return fail('Media object not found in R2.', 404);
      return new Response(obj.body, {
        status: 206,
        headers: {
          ...baseHeaders,
          'content-length': String(length),
          'content-range': `bytes ${start}-${end}/${totalSize}`,
        },
      });
    }
    const obj = await env.MEDIA_BUCKET.get(meta.object_key);
    if (!obj) return fail('Media object not found in R2.', 404);
    return new Response(obj.body, {
      status: 200,
      headers: {
        ...baseHeaders,
        'content-length': String(obj.size || totalSize),
      },
    });
  }

  if (rangeHeader && totalSize > 0) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/i);
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: { ...CORS_HEADERS, 'content-range': `bytes */${totalSize}` },
      });
    }
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : Math.min(totalSize - 1, start + 2 * 1024 * 1024 - 1);
    if (!match[1] && match[2]) {
      const suffixLen = parseInt(match[2], 10);
      start = Math.max(0, totalSize - suffixLen);
      end = totalSize - 1;
    }
    end = Math.min(end, totalSize - 1);
    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || start >= totalSize) {
      return new Response(null, {
        status: 416,
        headers: { ...CORS_HEADERS, 'content-range': `bytes */${totalSize}` },
      });
    }

    const startChunk = Math.floor(start / chunkSize);
    const endChunk = Math.floor(end / chunkSize);
    const rows = await all<{ chunk_index: number; data_b64: string }>(
      env.DB,
      `SELECT chunk_index, data_b64 FROM media_chunks WHERE media_id = ? AND chunk_index >= ? AND chunk_index <= ? ORDER BY chunk_index ASC`,
      mediaId,
      startChunk,
      endChunk
    );

    const sliceLen = end - start + 1;
    const out = new Uint8Array(sliceLen);
    let writePos = 0;
    for (const row of rows) {
      const chunkBytes = base64ToUint8(row.data_b64);
      const chunkGlobalStart = Number(row.chunk_index) * chunkSize;
      const localStart = Math.max(0, start - chunkGlobalStart);
      const localEnd = Math.min(chunkBytes.byteLength, end - chunkGlobalStart + 1);
      if (localEnd > localStart) {
        const piece = chunkBytes.subarray(localStart, localEnd);
        out.set(piece, writePos);
        writePos += piece.byteLength;
      }
    }

    return new Response(out.subarray(0, writePos), {
      status: 206,
      headers: {
        ...baseHeaders,
        'content-length': String(writePos),
        'content-range': `bytes ${start}-${start + writePos - 1}/${totalSize}`,
      },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let idx = 0; idx < chunkCount; idx++) {
          const row = await one<{ data_b64: string }>(
            env.DB,
            `SELECT data_b64 FROM media_chunks WHERE media_id = ? AND chunk_index = ?`,
            mediaId,
            idx
          );
          if (row?.data_b64) {
            controller.enqueue(base64ToUint8(row.data_b64));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...baseHeaders,
      'content-length': String(totalSize),
    },
  });
}

function bindStr(v: unknown, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function bindNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function syncLessonsSheetsToD1(db: D1Database, sheets: Record<string, any[]>): Promise<void> {
  if (!db || !sheets) return;
  await ensureD1Tables(db);

  const stmts: D1PreparedStatement[] = [];
  const nowIso = new Date().toISOString();

  if (Array.isArray(sheets.Lessons)) {
    const incomingIds = new Set<string>();
    for (const l of sheets.Lessons) {
      const id = bindStr(l?.id || l?.lessonId).trim();
      if (!id) continue;
      incomingIds.add(id);
      const course = bindStr(l.course || l.category || 'HSK 2').trim() || 'HSK 2';
      stmts.push(
        db.prepare(`
          INSERT INTO lessons (id, course, category, categoryKey, categoryNum, title, chineseTitle, pinyin, meaning, level, description, videoUrl, posterUrl, fullAudio, keywords, accessType, price, practicePrice, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            course=excluded.course, category=excluded.category, categoryKey=excluded.categoryKey,
            categoryNum=excluded.categoryNum, title=excluded.title, chineseTitle=excluded.chineseTitle,
            pinyin=excluded.pinyin, meaning=excluded.meaning, level=excluded.level, description=excluded.description,
            videoUrl=excluded.videoUrl, posterUrl=excluded.posterUrl, fullAudio=excluded.fullAudio,
            keywords=excluded.keywords, accessType=excluded.accessType, price=excluded.price, practicePrice=excluded.practicePrice, updated_at=excluded.updated_at
        `).bind(
          id,
          course,
          bindStr(l.category || course, course),
          bindStr(l.categoryKey || l.category_key, 'hsk2'),
          bindStr(l.categoryNum || l.category_num, 'Course 1'),
          bindStr(l.title, id),
          bindStr(l.chineseTitle || l.chinese_title),
          bindStr(l.pinyin),
          bindStr(l.meaning),
          bindStr(l.level, course),
          bindStr(l.description),
          bindStr(l.videoUrl || l.video_url),
          bindStr(l.posterUrl || l.poster_url),
          bindStr(l.fullAudio || l.full_audio),
          bindStr(l.keywords),
          bindStr(l.accessType || l.access_type, 'paid'),
          bindNum(l.price, 0),
          bindNum(l.practicePrice, 0),
          nowIso
        )
      );
    }
    if (incomingIds.size > 0) {
      const existingRows = await all<{ id: string }>(db, `SELECT id FROM lessons`);
      for (const row of existingRows) {
        if (row?.id && !incomingIds.has(String(row.id))) {
          stmts.push(db.prepare(`DELETE FROM lessons WHERE id = ?`).bind(String(row.id)));
        }
      }
    }
  }

  if (Array.isArray(sheets.Exercises)) {
    stmts.push(db.prepare(`DELETE FROM exercises`));
    for (let i = 0; i < sheets.Exercises.length; i++) {
      const ex = sheets.Exercises[i];
      if (!ex || typeof ex !== 'object') continue;
      stmts.push(
        db.prepare(`
          INSERT INTO exercises (lessonId, "order", type, groupId, groupTitle, pinyin, question, audioUrl, audioText, optionA, optionB, optionC, optionD, optionE, optionAImage, optionBImage, optionCImage, optionDImage, optionEImage, answer, explanation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          bindStr(ex.lessonId || ex.lesson_id, 'hsk2-01'),
          bindNum(ex.order || ex.order_num, i + 1),
          bindStr(ex.type, 'multiple-choice'),
          bindStr(ex.groupId || ex.group_id),
          bindStr(ex.groupTitle || ex.group_title),
          bindStr(ex.pinyin),
          bindStr(ex.question),
          bindStr(ex.audioUrl || ex.audio_url),
          bindStr(ex.audioText || ex.audio_text || ex.listeningSentence || ex.listening_sentence),
          bindStr(ex.optionA ?? ex.option_a),
          bindStr(ex.optionB ?? ex.option_b),
          bindStr(ex.optionC ?? ex.option_c),
          bindStr(ex.optionD ?? ex.option_d),
          bindStr(ex.optionE ?? ex.option_e),
          bindStr(ex.optionAImage || ex.option_a_image),
          bindStr(ex.optionBImage || ex.option_b_image),
          bindStr(ex.optionCImage || ex.option_c_image),
          bindStr(ex.optionDImage || ex.option_d_image),
          bindStr(ex.optionEImage || ex.option_e_image),
          bindStr(ex.answer),
          bindStr(ex.explanation)
        )
      );
    }
  }

  if (Array.isArray(sheets.Writing)) {
    stmts.push(db.prepare(`DELETE FROM writing_characters`));
    for (let i = 0; i < sheets.Writing.length; i++) {
      const w = sheets.Writing[i];
      if (!w || typeof w !== 'object') continue;
      stmts.push(
        db.prepare(`
          INSERT INTO writing_characters (lessonId, "order", character, pinyin, meaning, strokeCount, radical, strokeAnimationUrl, svgPath, strokeOrderSteps)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          bindStr(w.lessonId || w.lesson_id, 'hsk2-01'),
          bindNum(w.order || w.order_num, i + 1),
          bindStr(w.character),
          bindStr(w.pinyin),
          bindStr(w.meaning),
          bindNum(w.strokeCount || w.stroke_count, 6),
          bindStr(w.radical),
          bindStr(w.strokeAnimationUrl || w.stroke_animation_url),
          bindStr(w.svgPath || w.svg_path),
          bindStr(w.strokeOrderSteps || w.stroke_order_steps)
        )
      );
    }
  }

  if (Array.isArray(sheets.Vocabulary)) {
    stmts.push(db.prepare(`DELETE FROM vocabulary`));
    for (let i = 0; i < sheets.Vocabulary.length; i++) {
      const v = sheets.Vocabulary[i];
      if (!v || typeof v !== 'object') continue;
      stmts.push(
        db.prepare(`
          INSERT INTO vocabulary (lessonId, "order", character, pinyin, meaning, audio)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          bindStr(v.lessonId || v.lesson_id, 'hsk2-01'),
          bindNum(v.order || v.order_num, i + 1),
          bindStr(v.character),
          bindStr(v.pinyin),
          bindStr(v.meaning),
          bindStr(v.audio || v.audio_url)
        )
      );
    }
  }

  if (Array.isArray(sheets.Games)) {
    const incomingGameIds = new Set<string>();
    for (let i = 0; i < sheets.Games.length; i++) {
      const g = sheets.Games[i];
      if (!g || typeof g !== 'object') continue;
      const gid = bindStr(g.id).trim() || `game-${i + 1}`;
      if (incomingGameIds.has(gid)) continue;
      incomingGameIds.add(gid);
      stmts.push(
        db.prepare(`
          INSERT INTO games (id, "order", title, category, badge, description, embed_code, embed_url, width, height, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            "order"=excluded."order", title=excluded.title, category=excluded.category, badge=excluded.badge,
            description=excluded.description, embed_code=excluded.embed_code, embed_url=excluded.embed_url,
            width=excluded.width, height=excluded.height, active=excluded.active
        `).bind(
          gid,
          bindNum(g.order || g.order_num, i + 1),
          bindStr(g.title, gid),
          bindStr(g.category),
          bindStr(g.badge),
          bindStr(g.description),
          bindStr(g.embed_code),
          bindStr(g.embed_url),
          bindNum(g.width, 800),
          bindNum(g.height, 600),
          bindStr(g.active, 'true')
        )
      );
    }
    const existingGames = await all<{ id: string }>(db, `SELECT id FROM games`);
    for (const row of existingGames) {
      if (row?.id && !incomingGameIds.has(String(row.id))) {
        stmts.push(db.prepare(`DELETE FROM games WHERE id = ?`).bind(String(row.id)));
      }
    }
  }

  if (Array.isArray(sheets.Pronunciation)) {
    stmts.push(db.prepare(`DELETE FROM pronunciation`));
    for (let i = 0; i < sheets.Pronunciation.length; i++) {
      const p = sheets.Pronunciation[i];
      if (!p || typeof p !== 'object') continue;
      stmts.push(
        db.prepare(`
          INSERT INTO pronunciation (lessonId, "order", chinese, pinyin, meaning, focus)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          bindStr(p.lessonId || p.lesson_id, 'hsk2-01'),
          bindNum(p.order || p.order_num, i + 1),
          bindStr(p.chinese),
          bindStr(p.pinyin),
          bindStr(p.meaning),
          bindStr(p.focus)
        )
      );
    }
  }

  if (stmts.length > 0) {
    await executeD1Batch(db, stmts);
  }
}

function assertSafeD1WorkbookSheets(sheets: Record<string, any[]>): void {
  const MAX_D1_MEDIA_CHARS = 750000;
  for (const [sheetName, rows] of Object.entries(sheets || {})) {
    if (!Array.isArray(rows)) continue;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object') continue;
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'string' && val.startsWith('data:') && val.length > MAX_D1_MEDIA_CHARS) {
          throw new Error(
            `Embedded media in ${sheetName} row #${i + 1} (${key}) is too large for Cloudflare D1. Use an assets/... path or hosted https:// URL instead.`
          );
        }
      }
    }
  }
}

function normalizeStoryLessonRow(l: any) {
  if (!l || typeof l !== 'object') return l;
  const id = String(l.id || l.lessonId || l.lesson_id || '').trim();
  const rawVideo = String(l.video || l.videoUrl || l.video_url || l.Video || l.VideoUrl || l.video_path || l.videoPath || l.VideoPath || '').trim();
  const rawPoster = String(l.poster || l.posterUrl || l.poster_url || l.Poster || l.PosterUrl || l.thumbnail_path || l.thumbnailPath || '').trim();
  const video = canonicalizeD1MediaPath(rawVideo, id);
  const poster = canonicalizeD1MediaPath(rawPoster, id);
  return {
    ...l,
    video,
    videoUrl: video,
    video_url: video,
    poster,
    posterUrl: poster,
    poster_url: poster
  };
}

async function syncStoriesSheetsToD1(db: D1Database, sheets: Record<string, any[]>): Promise<void> {
  if (!db || !sheets) return;
  await ensureD1Tables(db);
  assertSafeD1WorkbookSheets(sheets);

  const stmts: D1PreparedStatement[] = [];

  if (Array.isArray(sheets.Lessons)) {
    const incomingStoryIds = new Set<string>();
    for (const l of sheets.Lessons) {
      const id = String(l.id || l.lessonId || '').trim();
      if (!id || incomingStoryIds.has(id)) continue;
      incomingStoryIds.add(id);
      stmts.push(
        db.prepare(`
          INSERT INTO stories_lessons (id, title, chineseTitle, pinyin, meaning, level, description, video, poster)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, chineseTitle=excluded.chineseTitle, pinyin=excluded.pinyin,
            meaning=excluded.meaning, level=excluded.level, description=excluded.description,
            video=excluded.video, poster=excluded.poster
        `).bind(
          id,
          l.title || id,
          l.chineseTitle || l.chinese_title || '',
          l.pinyin || '',
          l.meaning || '',
          l.level || 'Beginner',
          l.description || '',
          String(l.video || l.videoUrl || l.video_url || l.Video || l.VideoUrl || l.video_path || l.videoPath || l.VideoPath || '').trim(),
          String(l.poster || l.posterUrl || l.poster_url || l.Poster || l.PosterUrl || l.thumbnail_path || '').trim()
        )
      );
    }
    const existingStories = await all<{ id: string }>(db, `SELECT id FROM stories_lessons`);
    for (const row of existingStories) {
      if (row?.id && !incomingStoryIds.has(String(row.id))) {
        stmts.push(db.prepare(`DELETE FROM stories_lessons WHERE id = ?`).bind(String(row.id)));
      }
    }
  }

  if (Array.isArray(sheets.Story)) {
    stmts.push(db.prepare(`DELETE FROM story_scenes`));
    for (let i = 0; i < sheets.Story.length; i++) {
      const s = sheets.Story[i];
      stmts.push(
        db.prepare(`
          INSERT INTO story_scenes (lessonId, "order", chinese, pinyin, english, image, audio)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          s.lessonId || s.lesson_id || 'lesson-01',
          Number(s.order || s.order_num) || i + 1,
          s.chinese || '',
          s.pinyin || '',
          s.english || s.meaning || '',
          s.image || '',
          s.audio || ''
        )
      );
    }
  }

  if (Array.isArray(sheets.Vocabulary)) {
    stmts.push(db.prepare(`DELETE FROM stories_vocabulary`));
    for (let i = 0; i < sheets.Vocabulary.length; i++) {
      const v = sheets.Vocabulary[i];
      stmts.push(
        db.prepare(`
          INSERT INTO stories_vocabulary (lessonId, "order", character, pinyin, meaning, audio)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          v.lessonId || v.lesson_id || 'lesson-01',
          Number(v.order || v.order_num) || i + 1,
          v.character || '',
          v.pinyin || '',
          v.meaning || '',
          v.audio || ''
        )
      );
    }
  }

  if (Array.isArray(sheets.Exercises)) {
    stmts.push(db.prepare(`DELETE FROM stories_exercises`));
    for (let i = 0; i < sheets.Exercises.length; i++) {
      const ex = sheets.Exercises[i];
      stmts.push(
        db.prepare(`
          INSERT INTO stories_exercises (lessonId, "order", type, groupId, groupTitle, pinyin, question, audioUrl, audioText, optionA, optionB, optionC, optionD, optionE, optionAImage, optionBImage, optionCImage, optionDImage, optionEImage, answer, explanation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          ex.lessonId || ex.lesson_id || 'lesson-01',
          Number(ex.order || ex.order_num) || i + 1,
          ex.type || 'multiple-choice',
          ex.groupId || ex.group_id || '',
          ex.groupTitle || ex.group_title || '',
          ex.pinyin || '',
          ex.question || '',
          ex.audioUrl || ex.audio_url || '',
          ex.audioText || ex.audio_text || ex.listeningSentence || ex.listening_sentence || '',
          ex.optionA ?? ex.option_a ?? '',
          ex.optionB ?? ex.option_b ?? '',
          ex.optionC ?? ex.option_c ?? '',
          ex.optionD ?? ex.option_d ?? '',
          ex.optionE ?? ex.option_e ?? '',
          ex.optionAImage || ex.option_a_image || '',
          ex.optionBImage || ex.option_b_image || '',
          ex.optionCImage || ex.option_c_image || '',
          ex.optionDImage || ex.option_d_image || '',
          ex.optionEImage || ex.option_e_image || '',
          ex.answer || '',
          ex.explanation || ''
        )
      );
    }
  }

  if (stmts.length > 0) {
    await executeD1Batch(db, stmts);
  }
}

async function syncReelsSheetsToD1(db: D1Database, sheets: Record<string, any[]>): Promise<void> {
  if (!db || !sheets) return;
  await ensureD1Tables(db);
  assertSafeD1WorkbookSheets(sheets);

  const stmts: D1PreparedStatement[] = [];
  const videos = Array.isArray(sheets.Videos) ? sheets.Videos : null;

  if (videos) {
    const incomingReelIds = new Set<string>();
    for (const v of videos) {
      const id = String(v.id || '').trim();
      if (!id || incomingReelIds.has(id)) continue;
      incomingReelIds.add(id);
      stmts.push(
        db.prepare(`
          INSERT INTO reels_videos (id, type, holiday_id, title, video_path, thumbnail_path, duration_sec, status, text_cn, text_pinyin, text_en, text_my)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            type=excluded.type, holiday_id=excluded.holiday_id, title=excluded.title,
            video_path=excluded.video_path, thumbnail_path=excluded.thumbnail_path,
            duration_sec=excluded.duration_sec, status=excluded.status,
            text_cn=excluded.text_cn, text_pinyin=excluded.text_pinyin,
            text_en=excluded.text_en, text_my=excluded.text_my
        `).bind(
          id,
          v.type || 'daily',
          v.holiday_id || '',
          v.title || id,
          v.video_path || v.videoPath || '',
          v.thumbnail_path || v.thumbnailPath || '',
          Number(v.duration_sec || v.durationSec) || 0,
          v.status || 'published',
          v.text_cn || '',
          v.text_pinyin || '',
          v.text_en || '',
          v.text_my || ''
        )
      );
    }
    const existingReels = await all<{ id: string }>(db, `SELECT id FROM reels_videos`);
    for (const row of existingReels) {
      if (row?.id && !incomingReelIds.has(String(row.id))) {
        stmts.push(db.prepare(`DELETE FROM reels_videos WHERE id = ?`).bind(String(row.id)));
      }
    }
  }

  if (stmts.length > 0) {
    await executeD1Batch(db, stmts);
  }
}

async function getLessons(env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
  }
  const level = url.searchParams.get('level');
  const accessType = url.searchParams.get('access_type');
  const category = url.searchParams.get('category');

  await ensureD1Tables(env.DB);

  let rawLessons = await allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM lessons ORDER BY rowid ASC`);
  if (!rawLessons.length) {
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', url.origin)));
      if (assetRes.ok) {
        const data = await assetRes.json<{ sheets?: { Lessons?: Record<string, unknown>[] } }>();
        if (data?.sheets?.Lessons) {
          rawLessons = data.sheets.Lessons;
          try {
            await syncLessonsSheetsToD1(env.DB, data.sheets as any);
          } catch (syncErr) {
            console.warn('[getLessons] Non-fatal lesson seed warning:', syncErr);
          }
        }
      }
    } catch (_) {}
  }

  let lessons = rawLessons.map(normalizeLessonRow);
  if (level) {
    lessons = lessons.filter((l) => String(l.level || '').toLowerCase() === level.toLowerCase());
  }
  if (accessType) {
    lessons = lessons.filter((l) => String(l.accessType || '').toLowerCase() === accessType.toLowerCase());
  }
  if (category) {
    lessons = lessons.filter((l) => String(l.categoryKey || l.category || '').toLowerCase() === category.toLowerCase());
  }

  return json({ ok: true, lessons });
}

async function getLessonDetail(env: Env, id: string, origin: string): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
  }
  await ensureD1Tables(env.DB);
  const cleanId = String(id || '').trim();

  // Try D1 first (auto-retries transient errors)
  let lessonRaw = await oneStrict<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM lessons WHERE id = ? OR id = ? OR id = ?`,
    cleanId,
    `lesson-${cleanId}`,
    cleanId.replace(/^lesson-/, '')
  );

  let vocabulary = (await allStrict<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM vocabulary WHERE lessonId = ? OR lesson_id = ? ORDER BY "order" ASC`,
    cleanId,
    cleanId
  )).map(normalizeVocabularyRow);

  let exercises = (await allStrict<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM exercises WHERE lessonId = ? OR lesson_id = ? ORDER BY "order" ASC`,
    cleanId,
    cleanId
  )).map(normalizeExerciseRow);

  let writingCharacters = (await allStrict<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM writing_characters WHERE lessonId = ? OR lesson_id = ? ORDER BY "order" ASC`,
    cleanId,
    cleanId
  )).map(normalizeWritingRow);

  let pronunciation = (await allStrict<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM pronunciation WHERE lessonId = ? OR lesson_id = ? ORDER BY "order" ASC`,
    cleanId,
    cleanId
  )).map(normalizePronunciationRow);

  // If lesson not found OR child collections are empty in D1, load static JSON fallback/enrichment
  if (!lessonRaw || !exercises.length || !writingCharacters.length || !pronunciation.length) {
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', origin)));
      if (assetRes.ok) {
        const data = await assetRes.json<{
          sheets?: {
            Lessons?: Record<string, unknown>[];
            Exercises?: Record<string, unknown>[];
            Writing?: Record<string, unknown>[];
            Vocabulary?: Record<string, unknown>[];
            Pronunciation?: Record<string, unknown>[];
          };
        }>();

        const matchId = (target: string) => {
          const c = String(target || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const query = cleanId.toLowerCase().replace(/[^a-z0-9]/g, '');
          return c === query || c === `lesson${query}` || query === `lesson${c}`;
        };

        if (!lessonRaw && data?.sheets?.Lessons) {
          const found = data.sheets.Lessons.find((l) => matchId(String(l.id || '')));
          if (found) lessonRaw = found;
        }

        if (data?.sheets) {
          if (!exercises.length && data.sheets.Exercises) {
            exercises = data.sheets.Exercises.filter((e) => matchId(String(e.lessonId || e.lesson_id || ''))).map(normalizeExerciseRow);
          }
          if (!writingCharacters.length && data.sheets.Writing) {
            writingCharacters = data.sheets.Writing.filter((w) => matchId(String(w.lessonId || w.lesson_id || ''))).map(normalizeWritingRow);
          }
          if (!vocabulary.length && data.sheets.Vocabulary) {
            vocabulary = data.sheets.Vocabulary.filter((v) => matchId(String(v.lessonId || v.lesson_id || ''))).map(normalizeVocabularyRow);
          }
          if (!pronunciation.length && data.sheets.Pronunciation) {
            pronunciation = data.sheets.Pronunciation.filter((p) => matchId(String(p.lessonId || p.lesson_id || ''))).map(normalizePronunciationRow);
          }
        }
      }
    } catch (_) {}
  }

  if (!lessonRaw) {
    return fail('Lesson not found', 404);
  }

  return json({
    ok: true,
    lesson: normalizeLessonRow(lessonRaw),
    vocabulary,
    exercises,
    story_segments: [],
    writing_characters: writingCharacters,
    pronunciation
  });
}

async function getDatabaseBundle(env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
  }
  const domain = String(url.searchParams.get('domain') || 'lessons').toLowerCase();
  await withD1Retry(() => ensureD1Tables(env.DB), 2);

  if (domain === 'lessons') {
    let [rawLessons, rawExercises, rawWriting, rawVocab, rawGames, rawPron] = await Promise.all([
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM lessons ORDER BY rowid ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM exercises ORDER BY "order" ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM writing_characters ORDER BY "order" ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM vocabulary ORDER BY "order" ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM games ORDER BY "order" ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM pronunciation ORDER BY "order" ASC`)
    ]);

    let staticData: any = null;
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', url.origin)));
      if (assetRes.ok) {
        staticData = await assetRes.json();
      }
    } catch (_) {}

    const staticSheets = staticData?.sheets || {};
    const d1RowCount = rawLessons.length + rawExercises.length + rawWriting.length + rawVocab.length + rawPron.length;
    const staticRowCount =
      (staticSheets.Lessons?.length || 0) +
      (staticSheets.Exercises?.length || 0) +
      (staticSheets.Writing?.length || 0) +
      (staticSheets.Vocabulary?.length || 0) +
      (staticSheets.Pronunciation?.length || 0);

    // If static JSON has data and D1 is missing child sheets or static JSON has more complete rows:
    // auto-reconcile D1 to match the richer Excel/JSON file!
    const shouldSyncFromStatic =
      staticRowCount > 0 &&
      (d1RowCount === 0 ||
        rawExercises.length === 0 ||
        rawPron.length === 0 ||
        rawWriting.length === 0 ||
        staticRowCount > d1RowCount);

    if (shouldSyncFromStatic) {
      if (staticSheets.Lessons?.length) rawLessons = staticSheets.Lessons;
      if (staticSheets.Exercises?.length) rawExercises = staticSheets.Exercises;
      if (staticSheets.Writing?.length) rawWriting = staticSheets.Writing;
      if (staticSheets.Vocabulary?.length) rawVocab = staticSheets.Vocabulary;
      if (staticSheets.Games?.length) rawGames = staticSheets.Games;
      if (staticSheets.Pronunciation?.length) rawPron = staticSheets.Pronunciation;

      // Seed D1 strictly inside this request lifecycle (never cross-request background promises)
      try {
        await syncLessonsSheetsToD1(env.DB, {
          Lessons: rawLessons,
          Exercises: rawExercises,
          Writing: rawWriting,
          Vocabulary: rawVocab,
          Games: rawGames,
          Pronunciation: rawPron
        });
      } catch (syncErr) {
        console.warn('[getDatabaseBundle] Non-fatal lesson seed warning:', syncErr);
      }
    }

    const Lessons = rawLessons.map(normalizeLessonRow);
    const Exercises = rawExercises.map(normalizeExerciseRow);
    const Writing = rawWriting.map(normalizeWritingRow);
    const Vocabulary = rawVocab.map(normalizeVocabularyRow);
    const Games = rawGames;
    const Pronunciation = rawPron.map(normalizePronunciationRow);

    return json({
      success: true,
      database: 'edu-hub-db',
      source: 'cloudflare-d1',
      domain: 'lessons',
      syncedWithRepo: shouldSyncFromStatic,
      counts: {
        lessons: Lessons.length,
        exercises: Exercises.length,
        writing: Writing.length,
        vocabulary: Vocabulary.length,
        games: Games.length,
        pronunciation: Pronunciation.length
      },
      sheets: { Lessons, Exercises, Writing, Vocabulary, Games, Pronunciation }
    });
  }

  if (domain === 'stories') {
    const STORIES_MIGRATION_KEY = 'migration_stories_assets_v2';
    const [migrationApplied, rawLessonsInit, rawStoryInit, rawVocabInit, rawExercisesInit] = await Promise.all([
      getD1Meta(env.DB, STORIES_MIGRATION_KEY),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM stories_lessons ORDER BY rowid ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM story_scenes ORDER BY "order" ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM stories_vocabulary ORDER BY "order" ASC`),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM stories_exercises ORDER BY "order" ASC`)
    ]);

    let rawLessons = rawLessonsInit;
    let rawStory = rawStoryInit;
    let rawVocab = rawVocabInit;
    let rawExercises = rawExercisesInit;

    let staticData: any = null;
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/stories.json', url.origin)));
      if (assetRes.ok) {
        staticData = await assetRes.json();
      }
    } catch (_) {}

    const staticSheets = staticData?.sheets || {};
    const hasDeprecatedInD1 =
      rawLessons.some((r) => isDeprecatedD1MediaPath(r.video) || isDeprecatedD1MediaPath(r.poster)) ||
      rawStory.some((r) => isDeprecatedD1MediaPath(r.image));

    let migrated = false;

    if (!migrationApplied && (staticSheets.Lessons?.length || staticSheets.Story?.length)) {
      if (staticSheets.Lessons?.length) rawLessons = staticSheets.Lessons;
      if (staticSheets.Story?.length) rawStory = staticSheets.Story;
      if (staticSheets.Vocabulary?.length) rawVocab = staticSheets.Vocabulary;
      if (staticSheets.Exercises?.length) rawExercises = staticSheets.Exercises;
      await syncStoriesSheetsToD1(env.DB, {
        Lessons: rawLessons,
        Story: rawStory,
        Vocabulary: rawVocab,
        Exercises: rawExercises
      });
      await setD1Meta(env.DB, STORIES_MIGRATION_KEY, 'applied');
      migrated = true;
    } else {
      const backfill: Record<string, any[]> = {};

      if (rawLessons.length === 0 && staticSheets.Lessons?.length) {
        rawLessons = staticSheets.Lessons;
        backfill.Lessons = rawLessons;
      } else if (hasDeprecatedInD1) {
        const staticById = new Map<string, any>(
          (staticSheets.Lessons || []).map((sl: any) => [String(sl.id || '').trim().toLowerCase(), sl])
        );
        rawLessons = rawLessons.map((r: any) => {
          const rid = String(r.id || '').trim().toLowerCase();
          if (isDeprecatedD1MediaPath(r.video) || isDeprecatedD1MediaPath(r.poster)) {
            if (staticById.has(rid)) return { ...r, ...staticById.get(rid) };
            return normalizeStoryLessonRow(r);
          }
          return r;
        });
        backfill.Lessons = rawLessons;
      }

      if (rawStory.length === 0 && staticSheets.Story?.length) {
        rawStory = staticSheets.Story;
        backfill.Story = rawStory;
      }
      if (rawVocab.length === 0 && staticSheets.Vocabulary?.length) {
        rawVocab = staticSheets.Vocabulary;
        backfill.Vocabulary = rawVocab;
      }
      if (rawExercises.length === 0 && staticSheets.Exercises?.length) {
        rawExercises = staticSheets.Exercises;
        backfill.Exercises = rawExercises;
      }

      if (Object.keys(backfill).length > 0) {
        await syncStoriesSheetsToD1(env.DB, backfill).catch(() => {});
        migrated = true;
      }
    }

    const normalizedStoryLessons = rawLessons.map(normalizeStoryLessonRow);
    const normalizedStoryScenes = rawStory.map((s: any) => ({
      ...s,
      image: s && s.image ? canonicalizeD1MediaPath(s.image, s.lessonId || s.lesson_id) : s?.image || ''
    }));

    return json({
      success: true,
      database: 'edu-hub-db',
      source: 'cloudflare-d1',
      domain: 'stories',
      migrated,
      counts: {
        lessons: normalizedStoryLessons.length,
        story: normalizedStoryScenes.length,
        vocabulary: rawVocab.length,
        exercises: rawExercises.length
      },
      sheets: {
        Lessons: normalizedStoryLessons,
        Story: normalizedStoryScenes,
        Vocabulary: rawVocab,
        Exercises: rawExercises.map(normalizeExerciseRow)
      }
    });
  }

  if (domain === 'reels') {
    const REELS_MIGRATION_KEY = 'migration_reels_assets_v2';
    const [migrationApplied, rawVideosInit] = await Promise.all([
      getD1Meta(env.DB, REELS_MIGRATION_KEY),
      allStrict<Record<string, unknown>>(env.DB, `SELECT * FROM reels_videos ORDER BY rowid ASC`)
    ]);
    let rawVideos = rawVideosInit;
    let staticData: any = null;
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/reels_stories.json', url.origin)));
      if (assetRes.ok) {
        staticData = await assetRes.json();
      }
    } catch (_) {}

    const staticVideos = staticData?.sheets?.Videos || [];
    const hasDeprecatedReels = rawVideos.some(
      (r) => isDeprecatedD1MediaPath(r.video_path) || isDeprecatedD1MediaPath(r.thumbnail_path)
    );

    if (!migrationApplied && staticVideos.length > 0) {
      rawVideos = staticVideos;
      await syncReelsSheetsToD1(env.DB, { Videos: staticVideos });
      await setD1Meta(env.DB, REELS_MIGRATION_KEY, 'applied');
    } else if (rawVideos.length === 0 && staticVideos.length > 0) {
      rawVideos = staticVideos;
      await syncReelsSheetsToD1(env.DB, { Videos: staticVideos }).catch(() => {});
    } else if (hasDeprecatedReels) {
      const staticById = new Map<string, any>(
        staticVideos.map((v: any) => [String(v.id || '').trim().toLowerCase(), v])
      );
      rawVideos = rawVideos.map((v: any) => {
        const vid = String(v.id || '').trim().toLowerCase();
        if (isDeprecatedD1MediaPath(v.video_path) || isDeprecatedD1MediaPath(v.thumbnail_path)) {
          if (staticById.has(vid)) return { ...v, ...staticById.get(vid) };
          return {
            ...v,
            video_path: canonicalizeD1MediaPath(v.video_path, vid),
            thumbnail_path: canonicalizeD1MediaPath(v.thumbnail_path, vid)
          };
        }
        return v;
      });
      await syncReelsSheetsToD1(env.DB, { Videos: rawVideos }).catch(() => {});
    }

    return json({
      success: true,
      database: 'edu-hub-db',
      source: 'cloudflare-d1',
      domain: 'reels',
      counts: {
        videos: rawVideos.length
      },
      sheets: { Videos: rawVideos }
    });
  }

  return fail('Unknown domain: ' + domain, 400);
}

async function handleDatabaseSync(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
  }
  await withD1Retry(() => ensureD1Tables(env.DB), 2);
  try {
    const body = (await request.json()) as any;
    const domain = String(body?.domain || 'lessons').toLowerCase();
    const sheets = body?.sheets;

    if (!sheets || typeof sheets !== 'object') {
      return fail('Invalid sheets payload');
    }

    if (domain === 'lessons') {
      await syncLessonsSheetsToD1(env.DB, sheets);
      const catRows = await allStrict<any>(env.DB, `SELECT * FROM lesson_catalog`);
      const lessonCatalog: Record<string, any> = {};
      for (const c of catRows) {
        if (c?.lessonId) lessonCatalog[c.lessonId] = c;
      }
      return json({
        success: true,
        syncedToServer: true,
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
        lessonCatalog,
        sheets
      });
    }

    if (domain === 'stories') {
      await syncStoriesSheetsToD1(env.DB, sheets);
      await setD1Meta(env.DB, 'migration_stories_assets_v2', 'applied');
      return json({
        success: true,
        syncedToServer: true,
        database: 'edu-hub-db',
        domain: 'stories',
        counts: {
          lessons: sheets.Lessons?.length || 0,
          story: sheets.Story?.length || 0,
          vocabulary: sheets.Vocabulary?.length || 0,
          exercises: sheets.Exercises?.length || 0
        },
        sheets: {
          ...sheets,
          Lessons: Array.isArray(sheets.Lessons) ? sheets.Lessons.map(normalizeStoryLessonRow) : sheets.Lessons
        }
      });
    }

    if (domain === 'reels') {
      await syncReelsSheetsToD1(env.DB, sheets);
      await setD1Meta(env.DB, 'migration_reels_assets_v2', 'applied');
      return json({
        success: true,
        syncedToServer: true,
        database: 'edu-hub-db',
        domain: 'reels',
        counts: {
          videos: sheets.Videos?.length || 0
        },
        sheets
      });
    }

    return json({ success: true, syncedToServer: true, database: 'edu-hub-db', domain });
  } catch (err: any) {
    return fail(err?.message || 'Sync failed', 500);
  }
}

async function handleForceDatabaseSync(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
  }
  await withD1Retry(() => ensureD1Tables(env.DB), 2);
  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const domain = String(body?.domain || url.searchParams.get('domain') || 'stories').toLowerCase();
    let sheets = body?.sheets;

    if (!sheets || typeof sheets !== 'object') {
      const jsonPath =
        domain === 'stories'
          ? '/data/stories.json'
          : domain === 'reels'
          ? '/data/reels_stories.json'
          : '/data/lessons.json';
      const assetRes = await env.ASSETS.fetch(new Request(new URL(jsonPath, url.origin)));
      if (!assetRes.ok) {
        return fail(`Could not load ${jsonPath} to force-sync.`, 500);
      }
      const staticData = (await assetRes.json()) as any;
      sheets = staticData?.sheets;
    }

    if (!sheets || typeof sheets !== 'object') {
      return fail('Invalid or empty workbook sheets for force-sync.', 400);
    }

    if (domain === 'stories') {
      await syncStoriesSheetsToD1(env.DB, sheets);
      await setD1Meta(env.DB, 'migration_stories_assets_v2', 'applied');
      const normalizedLessons = Array.isArray(sheets.Lessons) ? sheets.Lessons.map(normalizeStoryLessonRow) : [];
      return json({
        success: true,
        syncedToServer: true,
        forced: true,
        database: 'edu-hub-db',
        domain: 'stories',
        sheets: { ...sheets, Lessons: normalizedLessons }
      });
    }

    if (domain === 'reels') {
      await syncReelsSheetsToD1(env.DB, sheets);
      await setD1Meta(env.DB, 'migration_reels_assets_v2', 'applied');
      return json({
        success: true,
        syncedToServer: true,
        forced: true,
        database: 'edu-hub-db',
        domain: 'reels',
        sheets
      });
    }

    if (domain === 'lessons') {
      await syncLessonsSheetsToD1(env.DB, sheets);
      return json({
        success: true,
        syncedToServer: true,
        forced: true,
        database: 'edu-hub-db',
        domain: 'lessons',
        sheets
      });
    }

    return fail('Unknown domain: ' + domain, 400);
  } catch (err: any) {
    return fail(err?.message || 'Force sync failed', 500);
  }
}

function normalizeWorkerFeaturedIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const clean = String(item || '').trim().slice(0, 128);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 24) break;
  }
  return out;
}

async function handleWorkerGetSiteConfig(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
  }
  const row = await withD1TableRepair(env.DB, () =>
    oneStrict<{ config_json: string; updated_at: string }>(
      env.DB,
      `SELECT config_json, updated_at FROM site_config WHERE id = 'homepage'`
    )
  );
  if (row && row.config_json) {
    try {
      const parsed = JSON.parse(row.config_json);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.featuredReelIds)) {
          parsed.featuredReelIds = normalizeWorkerFeaturedIdList(parsed.featuredReelIds);
        }
        if (Array.isArray(parsed.featuredStoryIds)) {
          parsed.featuredStoryIds = normalizeWorkerFeaturedIdList(parsed.featuredStoryIds);
        }
        if (Array.isArray(parsed.featuredGameIds)) {
          parsed.featuredGameIds = normalizeWorkerFeaturedIdList(parsed.featuredGameIds);
        }
        if (!parsed.updatedAt && row.updated_at) {
          parsed.updatedAt = row.updated_at;
        }
      }
      return json({ success: true, config: parsed, source: 'cloudflare-d1', updatedAt: row.updated_at });
    } catch (_) {}
  }

  // Seed from static /data/site-config.json if available
  let staticConfig: any = null;
  try {
    const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/site-config.json', url.origin)));
    if (assetRes.ok) {
      staticConfig = await assetRes.json();
    }
  } catch (_) {}

  const finalConfig =
    staticConfig && typeof staticConfig === 'object'
      ? staticConfig
      : {
          configId: 'homepage',
          heroEyebrow: 'Learn Chinese Step by Step',
          heroTitleLine1: 'Learn Chinese',
          heroTitleHighlight: 'with Confidence.',
          heroSubtitle:
            'Build your Chinese skills through pronunciation, everyday expressions, conversations, vocabulary, and practical exercises.',
          heroPrimaryCta: 'Explore Stories',
          heroSecondaryCta: 'Explore Lessons',
          heroBannerUrl: 'assets/hero-banner.png',
          siteLogoUrl: 'assets/images/logo.svg'
        };

  try {
    const nowIso = new Date().toISOString();
    await withD1TableRepair(env.DB, () =>
      env.DB.prepare(
        `INSERT INTO site_config (id, config_json, updated_at) VALUES ('homepage', ?, ?)
         ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json, updated_at=excluded.updated_at`
      )
        .bind(JSON.stringify(finalConfig), nowIso)
        .run()
    );
  } catch (_) {}

  return json({ success: true, config: finalConfig, source: 'seed-static' });
}

async function handleWorkerSaveSiteConfig(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
  }
  try {
    const body = (await request.json().catch(() => ({}))) as any;
    if (!body || typeof body !== 'object') {
      return fail('Invalid site configuration payload.', 400);
    }
    const merged = await withD1TableRepair(env.DB, async () => {
      const row = await one<{ config_json: string }>(
        env.DB,
        `SELECT config_json FROM site_config WHERE id = 'homepage'`
      );
      let existing: Record<string, any> = {};
      if (row && row.config_json) {
        try {
          existing = JSON.parse(row.config_json);
        } catch (_) {}
      }
      const nextCfg = { ...existing, ...body };
      delete (nextCfg as any)._pendingServerSync;
      delete (nextCfg as any)._savedLocallyOnly;

      if (Array.isArray(nextCfg.featuredReelIds)) {
        nextCfg.featuredReelIds = normalizeWorkerFeaturedIdList(nextCfg.featuredReelIds);
      }
      if (Array.isArray(nextCfg.featuredStoryIds)) {
        nextCfg.featuredStoryIds = normalizeWorkerFeaturedIdList(nextCfg.featuredStoryIds);
      }
      if (Array.isArray(nextCfg.featuredGameIds)) {
        nextCfg.featuredGameIds = normalizeWorkerFeaturedIdList(nextCfg.featuredGameIds);
      }
      if (!nextCfg.siteLogoUrl && body.siteLogoUrl === '') {
        nextCfg.siteLogoUrl = '';
      } else if (/^\/?public\/assets\/aistudio\//i.test(nextCfg.siteLogoUrl)) {
        nextCfg.siteLogoUrl = 'assets/images/logo.svg';
      }
      if (typeof body.workerApiBaseUrl === 'string') {
        const cleanW = body.workerApiBaseUrl.trim().replace(/\/+$/, '').slice(0, 300);
        nextCfg.workerApiBaseUrl = /^https?:\/\/[^/\s]+/i.test(cleanW) ? cleanW : '';
      }
      const nowIso = new Date().toISOString();
      nextCfg.updatedAt = nowIso;
      nextCfg.configId = 'homepage';

      await env.DB.prepare(
        `INSERT INTO site_config (id, config_json, updated_at) VALUES ('homepage', ?, ?)
         ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json, updated_at=excluded.updated_at`
      )
        .bind(JSON.stringify(nextCfg), nowIso)
        .run();

      return nextCfg;
    });

    return json({ success: true, config: merged, storage: 'cloudflare-d1' });
  } catch (err: any) {
    return fail(err?.message || 'Failed to save site configuration.', 500);
  }
}

// --- Worker Auth, Crypto & User/Membership/Progress/Catalog Helpers ---

function randomHexWorker(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256HexWorker(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function createSaltedHashWorker(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomHexWorker(16);
  const hex = await sha256HexWorker(`${salt}:${password}`);
  return { salt, hash: `sha256$${salt}$${hex}` };
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyPasswordWorker(candidatePassword: string, salt: string, storedHash: string): Promise<boolean> {
  const expected = String(storedHash || '').trim();
  if (!expected) return false;
  const shaMatch = expected.match(/^sha256\$([^$]+)\$([a-f0-9]{64})$/i);
  if (shaMatch) {
    const computed = await sha256HexWorker(`${shaMatch[1]}:${candidatePassword}`);
    return constantTimeEq(computed.toLowerCase(), shaMatch[2].toLowerCase());
  }
  if (salt && /^[a-f0-9]{64}$/i.test(expected)) {
    const computed = await sha256HexWorker(`${salt}:${candidatePassword}`);
    return constantTimeEq(computed.toLowerCase(), expected.toLowerCase());
  }
  return constantTimeEq(candidatePassword, expected);
}

function toB64UrlBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function toB64UrlStr(str: string): string {
  return toB64UrlBytes(new TextEncoder().encode(str));
}

function fromB64UrlStr(b64u: string): string {
  const norm = String(b64u).replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (norm.length % 4)) % 4;
  const bin = atob(norm + '='.repeat(pad));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

let cachedWorkerSecret = '';
async function getWorkerTokenSecret(env: Env): Promise<string> {
  const fromEnv = String(env.AUTH_TOKEN_SECRET || '').trim();
  if (fromEnv.length >= 16) return fromEnv;
  if (cachedWorkerSecret) return cachedWorkerSecret;
  await ensureD1Tables(env.DB);
  const existing = await getD1Meta(env.DB, 'worker_auth_secret');
  if (existing && existing.length >= 32) {
    cachedWorkerSecret = existing;
    return cachedWorkerSecret;
  }
  const generated = randomHexWorker(32);
  await setD1Meta(env.DB, 'worker_auth_secret', generated);
  cachedWorkerSecret = generated;
  return cachedWorkerSecret;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signWorkerToken(env: Env, user: { uid: string; email: string; role: string }): Promise<string> {
  const secret = await getWorkerTokenSecret(env);
  const key = await importHmacKey(secret);
  const header = toB64UrlStr(JSON.stringify({ alg: 'HS256', typ: 'LP' }));
  const now = Date.now();
  const payload = toB64UrlStr(
    JSON.stringify({
      uid: user.uid,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'student',
      iat: now,
      exp: now + TOKEN_TTL_MS
    })
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`));
  const sig = toB64UrlBytes(new Uint8Array(sigBuf));
  return `${header}.${payload}.${sig}`;
}

async function verifyWorkerToken(env: Env, token: string): Promise<{ uid: string; email: string; role: string; exp: number }> {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) throw new Error('Malformed session token.');
  const [header, payloadB64, sigB64] = parts;
  const secret = await getWorkerTokenSecret(env);
  const key = await importHmacKey(secret);
  const expectedSigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payloadB64}`));
  const expectedSig = toB64UrlBytes(new Uint8Array(expectedSigBuf));
  if (!constantTimeEq(sigB64, expectedSig)) {
    throw new Error('Invalid session signature.');
  }
  const decoded = JSON.parse(fromB64UrlStr(payloadB64));
  if (!decoded || !decoded.uid || !decoded.exp || Number(decoded.exp) < Date.now()) {
    throw new Error('Session expired. Please sign in again.');
  }
  return decoded;
}

function parseJsonStrArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((x) => String(x || '').trim()).filter(Boolean);
  const raw = String(val || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map((x) => String(x || '').trim()).filter(Boolean) : [];
    } catch (_) {}
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeWorkerCourseName(val: unknown): string {
  const raw = String(val || '').trim();
  if (!raw) return 'HSK 2';
  const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (compact === 'hsk1') return 'HSK 1';
  if (compact === 'hsk2') return 'HSK 2';
  if (compact === 'hsk3') return 'HSK 3';
  if (compact === 'hsk4') return 'HSK 4';
  return raw.slice(0, 80);
}

function normalizeWorkerPlan(plan: unknown): string {
  const p = String(plan || 'none').trim().toLowerCase();
  if (p === 'practice_lesson' || p === 'practice-lesson') return 'practice_lesson';
  if (p === 'practice_course' || p === 'practice-course') return 'practice_course';
  if (p === 'per_lesson' || p === 'lesson') return 'per_lesson';
  if (p === 'course' || p === 'hsk' || p === 'monthly' || p === 'annual') {
    return p === 'monthly' || p === 'annual' ? p : 'course';
  }
  return 'none';
}

function sanitizeWorkerUserRow(row: any) {
  if (!row) return null;
  const email = String(getRowField(row, 'email') || '').trim().toLowerCase();
  const isAdm = String(getRowField(row, 'role') || '').toLowerCase() === 'admin' || email === ADMIN_EMAIL;
  const rawStatus = String(getRowField(row, 'membershipStatus', 'membership_status') || '').toLowerCase();
  const rawPlan = getRowField(row, 'membershipPlan', 'membership_plan');
  const rawMustChange = getRowField(row, 'mustChangePassword', 'must_change_password');
  return {
    uid: String(getRowField(row, 'uid') || ''),
    username: String(getRowField(row, 'username', 'name', 'display_name') || email.split('@')[0] || 'Learner'),
    email,
    phoneNumber: String(getRowField(row, 'phoneNumber', 'phone_number', 'phone') || ''),
    dob: String(getRowField(row, 'dob') || ''),
    role: isAdm ? 'admin' : 'student',
    membershipStatus: ['free', 'pending', 'active', 'expired'].includes(rawStatus) ? rawStatus : 'free',
    membershipPlan: normalizeWorkerPlan(rawPlan),
    membershipExpiresAt: String(getRowField(row, 'membershipExpiresAt', 'membership_expires_at') || ''),
    subscribedLessonIds: parseJsonStrArray(getRowField(row, 'subscribedLessonIds', 'subscribed_lesson_ids')).slice(0, 100),
    subscribedCourses: Array.from(
      new Set(parseJsonStrArray(getRowField(row, 'subscribedCourses', 'subscribed_courses')).map(normalizeWorkerCourseName))
    ).slice(0, 50),
    practiceLessonIds: parseJsonStrArray(getRowField(row, 'practiceLessonIds', 'practice_lesson_ids')).slice(0, 100),
    practiceCourses: Array.from(
      new Set(parseJsonStrArray(getRowField(row, 'practiceCourses', 'practice_courses')).map(normalizeWorkerCourseName))
    ).slice(0, 50),
    linkedProviders: ['password'],
    mustChangePassword: Boolean(Number(rawMustChange) || rawMustChange === true || rawMustChange === 'true'),
    createdAt: getRowField(row, 'createdAt', 'created_at') || null,
    updatedAt: getRowField(row, 'updatedAt', 'updated_at') || null
  };
}

function sanitizeWorkerProgressRow(row: any, uid: string) {
  const cleanDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : '');
  const cleanTime = (v: unknown) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '').trim()) ? String(v).trim() : '18:00');
  return {
    uid: String(uid),
    currentStreak: Math.min(10000, Math.max(0, Math.round(Number(row?.currentStreak) || 0))),
    bestStreak: Math.min(10000, Math.max(0, Math.round(Number(row?.bestStreak) || 0))),
    lastCompletedDate: cleanDate(row?.lastCompletedDate),
    streakDates: Array.from(new Set(parseJsonStrArray(row?.streakDates).map(cleanDate).filter(Boolean))).slice(-366),
    completedLessonIds: Array.from(new Set(parseJsonStrArray(row?.completedLessonIds))).slice(-200),
    reminderEnabled: row ? Boolean(Number(row.reminderEnabled ?? 1)) : true,
    reminderTime: cleanTime(row?.reminderTime),
    lastNotifiedDate: cleanDate(row?.lastNotifiedDate),
    updatedAt: row?.updatedAt || new Date().toISOString()
  };
}

function normalizePhoneWorker(raw: unknown): string {
  return String(raw ?? '').trim().replace(/[\s\-().+]+/g, '');
}

function phonesMatchWorker(a: unknown, b: unknown): boolean {
  const na = normalizePhoneWorker(a);
  const nb = normalizePhoneWorker(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const da = String(a ?? '').replace(/\D+/g, '');
  const db = String(b ?? '').replace(/\D+/g, '');
  const variants = (d: string) => {
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

async function ensureD1UsersSeeded(env: Env, origin: string): Promise<void> {
  await ensureD1Tables(env.DB);
  const cntRow = await oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM users`);
  if ((cntRow?.c || 0) > 0) return;

  let data: {
    users?: Record<string, any>;
    userProgress?: Record<string, any>;
    subscriptionRequests?: any[];
    lessonCatalog?: Record<string, any>;
  } | null = null;
  try {
    const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/users.json', origin)));
    if (assetRes.ok) {
      data = await assetRes.json();
    }
  } catch (_) {
    return;
  }
  if (!data) return;

  const stmts: D1PreparedStatement[] = [];
  const nowIso = new Date().toISOString();

  if (data.users && typeof data.users === 'object') {
    for (const u of Object.values(data.users)) {
      const email = String(u?.email || '').trim().toLowerCase();
      const uid = String(u?.uid || '').trim();
      if (!email || !uid) continue;
      const isAdm = String(u.role || '').toLowerCase() === 'admin' || email === ADMIN_EMAIL;
      stmts.push(
        await prepareInsertD1User(
          env.DB,
          {
            uid,
            email,
            username: bindStr(u.username, email.split('@')[0]),
            phoneNumber: bindStr(u.phoneNumber),
            dob: bindStr(u.dob),
            role: isAdm ? 'admin' : 'student',
            membershipStatus: bindStr(u.membershipStatus, isAdm ? 'active' : 'free'),
            membershipPlan: bindStr(u.membershipPlan, isAdm ? 'course' : 'none'),
            membershipExpiresAt: bindStr(u.membershipExpiresAt),
            subscribedLessonIds: parseJsonStrArray(u.subscribedLessonIds),
            subscribedCourses: parseJsonStrArray(u.subscribedCourses),
            practiceLessonIds: parseJsonStrArray(u.practiceLessonIds),
            practiceCourses: parseJsonStrArray(u.practiceCourses),
            mustChangePassword: u.mustChangePassword ? 1 : 0,
            passwordSalt: bindStr(u.passwordSalt),
            passwordHash: bindStr(u.passwordHash),
            createdAt: bindStr(u.createdAt, nowIso),
            updatedAt: bindStr(u.updatedAt, nowIso)
          },
          { ignoreEmailConflict: true }
        )
      );
    }
  }

  if (data.userProgress && typeof data.userProgress === 'object') {
    for (const [keyUid, rawProg] of Object.entries(data.userProgress)) {
      const clean = sanitizeWorkerProgressRow(rawProg, String((rawProg as any)?.uid || keyUid));
      if (!clean.uid) continue;
      stmts.push(
        env.DB.prepare(`
          INSERT INTO user_progress (uid, currentStreak, bestStreak, lastCompletedDate, streakDates, completedLessonIds, reminderEnabled, reminderTime, lastNotifiedDate, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(uid) DO NOTHING
        `).bind(
          clean.uid,
          clean.currentStreak,
          clean.bestStreak,
          clean.lastCompletedDate,
          JSON.stringify(clean.streakDates),
          JSON.stringify(clean.completedLessonIds),
          clean.reminderEnabled ? 1 : 0,
          clean.reminderTime,
          clean.lastNotifiedDate,
          bindStr(clean.updatedAt, nowIso)
        )
      );
    }
  }

  if (Array.isArray(data.subscriptionRequests)) {
    for (const r of data.subscriptionRequests) {
      if (!r?.requestId || !r?.userId) continue;
      stmts.push(
        env.DB.prepare(`
          INSERT INTO subscription_requests (requestId, userId, username, userEmail, userPhone, planType, lessonId, courseName, lessonTitle, amountLabel, contactChannel, contactHandle, note, status, adminNote, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(requestId) DO NOTHING
        `).bind(
          String(r.requestId), String(r.userId), bindStr(r.username), bindStr(r.userEmail), bindStr(r.userPhone),
          bindStr(r.planType, 'course'), bindStr(r.lessonId), bindStr(r.courseName), bindStr(r.lessonTitle),
          bindStr(r.amountLabel), bindStr(r.contactChannel, 'viber'), bindStr(r.contactHandle), bindStr(r.note),
          bindStr(r.status, 'pending'), bindStr(r.adminNote), bindStr(r.createdAt, nowIso), bindStr(r.updatedAt, nowIso)
        )
      );
    }
  }

  if (data.lessonCatalog && typeof data.lessonCatalog === 'object') {
    for (const cat of Object.values(data.lessonCatalog)) {
      const lessonId = String(cat?.lessonId || '').trim();
      if (!lessonId) continue;
      stmts.push(
        env.DB.prepare(`
          INSERT INTO lesson_catalog (lessonId, title, course, audience, accessType, price, practicePrice, hasExercises, updatedBy, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(lessonId) DO NOTHING
        `).bind(
          lessonId,
          bindStr(cat.title, lessonId),
          bindStr(cat.course, 'HSK 2'),
          bindStr(cat.audience, 'Adult'),
          bindStr(cat.accessType, 'free'),
          bindNum(cat.price, 0),
          bindNum(cat.practicePrice, 0),
          cat.hasExercises === false ? 0 : 1,
          bindStr(cat.updatedBy, 'seed'),
          bindStr(cat.updatedAt, nowIso)
        )
      );
    }
  }

  if (stmts.length > 0) {
    await executeD1Batch(env.DB, stmts);
    try {
      await rebuildAndPersistUsersWorkbookD1(env);
    } catch (wbErr) {
      console.warn('[ensureD1UsersSeeded] Workbook snapshot skipped during initial seed:', wbErr);
    }
  }
}

function formatPortablePasswordHashWorker(row: any): string {
  const rawHash = String(getRowField(row, 'passwordHash', 'password_hash', 'password', 'hash') || '').trim();
  const rawSalt = String(getRowField(row, 'passwordSalt', 'password_salt', 'salt') || '').trim();
  if (!rawHash) return '';
  if (rawHash.startsWith('sha256$') || rawHash.startsWith('scrypt$')) return rawHash;
  if (rawSalt && /^[a-f0-9]{64}$/i.test(rawHash)) {
    return `sha256$${rawSalt}$${rawHash}`;
  }
  return rawHash;
}

async function buildUsersWorkbookXlsxWorker(env: Env): Promise<{
  bytes: Uint8Array;
  userCount: number;
  requestCount: number;
  progressCount: number;
  catalogCount: number;
}> {
  const [userRows, reqRowsRaw, progRowsRaw, catRowsRaw] = await Promise.all([
    allStrict<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`),
    allStrict<any>(env.DB, `SELECT * FROM subscription_requests ORDER BY createdAt DESC`),
    allStrict<any>(env.DB, `SELECT * FROM user_progress`),
    allStrict<any>(env.DB, `SELECT * FROM lesson_catalog`)
  ]);

  const userSheetRows = userRows.map((row) => {
    const clean = sanitizeWorkerUserRow(row);
    if (!clean) return null;
    return {
      uid: clean.uid,
      username: clean.username || '',
      email: clean.email || '',
      phoneNumber: clean.phoneNumber || '',
      dob: clean.dob || '',
      passwordHash: formatPortablePasswordHashWorker(row),
      role: clean.role || 'student',
      membershipStatus: clean.membershipStatus || 'free',
      membershipPlan: clean.membershipPlan || 'none',
      membershipExpiresAt: clean.membershipExpiresAt || '',
      subscribedLessonIds: (clean.subscribedLessonIds || []).join(','),
      subscribedCourses: (clean.subscribedCourses || []).join(','),
      practiceLessonIds: (clean.practiceLessonIds || []).join(','),
      practiceCourses: (clean.practiceCourses || []).join(','),
      mustChangePassword: clean.mustChangePassword ? 'true' : 'false',
      createdAt: String(clean.createdAt || ''),
      updatedAt: String(clean.updatedAt || '')
    };
  }).filter(Boolean) as Record<string, string | number>[];

  const reqSheetRows = reqRowsRaw.map((r) => ({
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

  const progSheetRows = progRowsRaw.map((p) => {
    const clean = sanitizeWorkerProgressRow(p, String(p.uid || ''));
    return {
      uid: clean.uid,
      currentStreak: Number(clean.currentStreak) || 0,
      bestStreak: Number(clean.bestStreak) || 0,
      lastCompletedDate: String(clean.lastCompletedDate || ''),
      streakDates: (clean.streakDates || []).join(','),
      completedLessonIds: (clean.completedLessonIds || []).join(','),
      reminderEnabled: clean.reminderEnabled ? 'true' : 'false',
      reminderTime: String(clean.reminderTime || '18:00'),
      lastNotifiedDate: String(clean.lastNotifiedDate || ''),
      updatedAt: String(clean.updatedAt || '')
    };
  });

  const catSheetRows = catRowsRaw.map((c) => ({
    lessonId: String(c.lessonId || ''),
    title: String(c.title || ''),
    course: String(c.course || ''),
    audience: String(c.audience || 'Adult'),
    accessType: c.accessType === 'paid' ? 'paid' : 'free',
    price: Number(c.price) || 0,
    practicePrice: Number(c.practicePrice) || 0,
    hasExercises: Number(c.hasExercises ?? 1) === 0 ? 'false' : 'true',
    updatedBy: String(c.updatedBy || ''),
    updatedAt: String(c.updatedAt || '')
  }));

  const wb = XLSX.utils.book_new();
  const sheetSpecs: Array<{ name: string; rows: Record<string, string | number>[]; headers: string[] }> = [
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
      rows: reqSheetRows,
      headers: [
        'requestId', 'userId', 'username', 'userEmail', 'userPhone', 'planType', 'lessonId',
        'courseName', 'lessonTitle', 'amountLabel', 'contactChannel', 'contactHandle',
        'note', 'status', 'adminNote', 'createdAt', 'updatedAt'
      ]
    },
    {
      name: 'Progress',
      rows: progSheetRows,
      headers: [
        'uid', 'currentStreak', 'bestStreak', 'lastCompletedDate', 'streakDates',
        'completedLessonIds', 'reminderEnabled', 'reminderTime', 'lastNotifiedDate', 'updatedAt'
      ]
    },
    {
      name: 'Catalog',
      rows: catSheetRows,
      headers: ['lessonId', 'title', 'course', 'audience', 'accessType', 'price', 'practicePrice', 'hasExercises', 'updatedBy', 'updatedAt']
    }
  ];

  for (const spec of sheetSpecs) {
    const ws =
      spec.rows.length > 0
        ? XLSX.utils.json_to_sheet(spec.rows, { header: spec.headers })
        : XLSX.utils.aoa_to_sheet([spec.headers]);
    XLSX.utils.book_append_sheet(wb, ws, spec.name);
  }

  const written = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
  const bytes = written instanceof Uint8Array ? written : new Uint8Array(written);
  return {
    bytes,
    userCount: userSheetRows.length,
    requestCount: reqSheetRows.length,
    progressCount: progSheetRows.length,
    catalogCount: catSheetRows.length
  };
}

async function rebuildAndPersistUsersWorkbookD1(env: Env): Promise<{
  bytes: Uint8Array;
  userCount: number;
  requestCount: number;
  progressCount: number;
  catalogCount: number;
  updatedAt: string;
}> {
  const built = await buildUsersWorkbookXlsxWorker(env);
  const b64 = uint8ToBase64(built.bytes);
  const nowIso = new Date().toISOString();

  await withD1TableRepair(env.DB, async () => {
    await env.DB.prepare(`
      INSERT INTO d1_workbooks (name, xlsx_b64, row_count, updated_at)
      VALUES ('users.xlsx', ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        xlsx_b64 = excluded.xlsx_b64,
        row_count = excluded.row_count,
        updated_at = excluded.updated_at
    `).bind(b64, built.userCount, nowIso).run();
  });

  const savedWb = await oneStrict<{ row_count: number; len: number }>(
    env.DB,
    `SELECT row_count, LENGTH(xlsx_b64) AS len FROM d1_workbooks WHERE name = 'users.xlsx'`
  );
  if (!savedWb || Number(savedWb.len) <= 0 || Number(savedWb.row_count) !== built.userCount) {
    throw new Error('Could not verify saved Excel workbook (users.xlsx) in D1 database.');
  }

  if (env.MEDIA_BUCKET) {
    try {
      await env.MEDIA_BUCKET.put('workbooks/users.xlsx', built.bytes, {
        httpMetadata: {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
    } catch (r2Err) {
      console.warn('[rebuildAndPersistUsersWorkbookD1] Optional R2 workbook backup warning:', r2Err);
    }
  }

  return { ...built, updatedAt: nowIso };
}

async function buildWorkerSessionResponse(env: Env, userRow: any, token: string | null) {
  const pubUser = sanitizeWorkerUserRow(userRow) || {
    uid: String(userRow?.uid || `usr_${randomHexWorker(8)}`),
    username: String(userRow?.username || 'Learner'),
    email: String(userRow?.email || ''),
    phoneNumber: String(userRow?.phoneNumber || ''),
    dob: String(userRow?.dob || ''),
    role: String(userRow?.role || 'student'),
    membershipStatus: String(userRow?.membershipStatus || 'free'),
    membershipPlan: String(userRow?.membershipPlan || 'none'),
    membershipExpiresAt: String(userRow?.membershipExpiresAt || ''),
    subscribedLessonIds: [],
    subscribedCourses: [],
    practiceLessonIds: [],
    practiceCourses: [],
    linkedProviders: ['password'],
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const isAdmin = pubUser.role === 'admin';
  const [progRow, myReqRows, catRows, adminRow] = await Promise.all([
    one<any>(env.DB, `SELECT * FROM user_progress WHERE uid = ?`, pubUser.uid),
    all<any>(env.DB, `SELECT * FROM subscription_requests WHERE userId = ? ORDER BY createdAt DESC`, pubUser.uid),
    all<any>(env.DB, `SELECT * FROM lesson_catalog`),
    one<any>(env.DB, `SELECT uid FROM users WHERE role = 'admin' LIMIT 1`)
  ]);

  const lessonCatalog: Record<string, any> = {};
  for (const c of catRows) {
    if (c?.lessonId) {
      lessonCatalog[c.lessonId] = {
        lessonId: c.lessonId,
        title: c.title || c.lessonId,
        course: c.course || 'HSK 2',
        audience: c.audience || 'Adult',
        accessType: c.accessType === 'paid' ? 'paid' : 'free',
        price: Number(c.price) || 0,
        practicePrice: Number(c.practicePrice) || 0,
        hasExercises: Boolean(Number(c.hasExercises ?? 1)),
        updatedBy: c.updatedBy || '',
        updatedAt: c.updatedAt || ''
      };
    }
  }

  const payload: Record<string, unknown> = {
    success: true,
    user: {
      uid: pubUser.uid,
      email: pubUser.email,
      displayName: pubUser.username,
      role: pubUser.role,
      mustChangePassword: pubUser.mustChangePassword
    },
    profile: pubUser,
    userProgress: sanitizeWorkerProgressRow(progRow, pubUser.uid),
    myRequests: myReqRows,
    lessonCatalog,
    adminClaimed: Boolean(adminRow),
    smtpConfigured: false
  };
  if (token) payload.token = token;
  if (isAdmin) {
    const [allUserRows, allReqRows] = await Promise.all([
      all<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`),
      all<any>(env.DB, `SELECT * FROM subscription_requests ORDER BY createdAt DESC`)
    ]);
    payload.allUsers = allUserRows.map(sanitizeWorkerUserRow).filter(Boolean);
    payload.allRequests = allReqRows;
  }
  return payload;
}

async function requireAuthWorker(request: Request, env: Env): Promise<{ user: any } | Response> {
  const authHeader = String(request.headers.get('Authorization') || '');
  if (!authHeader.startsWith('Bearer ')) {
    return fail('Please sign in first.', 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return fail('Empty authentication token.', 401);
  }
  try {
    const decoded = await verifyWorkerToken(env, token);
    await ensureD1Tables(env.DB);
    const userRow = await one<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, decoded.uid);
    if (!userRow) {
      return fail('Account no longer exists. Please sign in again.', 401);
    }
    return { user: userRow };
  } catch (err: any) {
    return fail(err?.message || 'Invalid or expired session.', 401);
  }
}

async function requireAdminWorker(request: Request, env: Env): Promise<{ user: any } | Response> {
  const authResult = await requireAuthWorker(request, env);
  if (authResult instanceof Response) return authResult;
  const email = String(authResult.user.email || '').trim().toLowerCase();
  if (String(authResult.user.role || '').toLowerCase() !== 'admin' && email !== ADMIN_EMAIL) {
    return fail('Administrator privileges required.', 403);
  }
  return authResult;
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- Public Auth Endpoints ---
  if (path === '/api/auth/status' && method === 'GET') {
    await ensureD1UsersSeeded(env, url.origin);
    const adminRow = await one<any>(env.DB, `SELECT uid FROM users WHERE role = 'admin' LIMIT 1`);
    const cntRow = await one<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM users`);
    return json({
      success: true,
      adminClaimed: Boolean(adminRow),
      userCount: cntRow?.c || 0,
      smtpConfigured: false
    });
  }

  if (path === '/api/auth/register' && method === 'POST') {
    try {
      await ensureD1UsersSeeded(env, url.origin);
      const body = (await request.json().catch(() => ({}))) as any;
      const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
      const password = String(body.password || '');
      const username = String(body.username || '').trim().slice(0, 60) || (email.includes('@') ? email.split('@')[0] : 'Learner');
      const phoneNumber = String(body.phoneNumber || '').trim().slice(0, 32);
      const rawDob = String(body.dob || '').trim();
      const dob = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : '';

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail('Please enter a valid email address.', 400);
      }
      if (password.length < 6 || password.length > 128) {
        return fail('Password must be between 6 and 128 characters.', 400);
      }
      if (rawDob && !dob) {
        return fail('Date of Birth must be in YYYY-MM-DD format.', 400);
      }

      const existing = await oneStrict<any>(env.DB, `SELECT uid FROM users WHERE LOWER(email) = ?`, email);
      if (existing) {
        return fail('An account with this email already exists. Please sign in instead.', 409, { code: 'email-already-in-use' });
      }

      const adminRow = await oneStrict<any>(env.DB, `SELECT uid FROM users WHERE role = 'admin' LIMIT 1`);
      const shouldClaimAdmin = email === ADMIN_EMAIL && !adminRow;
      const uid = `usr_${randomHexWorker(8)}`;
      const { salt, hash } = await createSaltedHashWorker(password);
      const nowIso = new Date().toISOString();

      await withD1TableRepair(env.DB, async () => {
        const insertStmt = await prepareInsertD1User(env.DB, {
          uid,
          email,
          username,
          phoneNumber,
          dob,
          role: shouldClaimAdmin ? 'admin' : 'student',
          membershipStatus: shouldClaimAdmin ? 'active' : 'free',
          membershipPlan: shouldClaimAdmin ? 'course' : 'none',
          membershipExpiresAt: '',
          subscribedLessonIds: [],
          subscribedCourses: shouldClaimAdmin ? ['HSK 2'] : [],
          practiceLessonIds: [],
          practiceCourses: [],
          mustChangePassword: 0,
          passwordSalt: salt,
          passwordHash: hash,
          createdAt: nowIso,
          updatedAt: nowIso
        });
        await insertStmt.run();
        await env.DB.prepare(`
          INSERT INTO user_progress (uid, currentStreak, bestStreak, lastCompletedDate, streakDates, completedLessonIds, reminderEnabled, reminderTime, lastNotifiedDate, updatedAt)
          VALUES (?, 0, 0, '', '[]', '[]', 1, '18:00', '', ?)
          ON CONFLICT(uid) DO UPDATE SET updatedAt = excluded.updatedAt
        `).bind(uid, nowIso).run();
      });

      const [userRow, progRow] = await Promise.all([
        oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, uid),
        oneStrict<any>(env.DB, `SELECT uid FROM user_progress WHERE uid = ?`, uid)
      ]);
      if (!userRow || !progRow) {
        return fail('Account registration could not be verified in the database. Please retry.', 500);
      }

      const wbMeta = await rebuildAndPersistUsersWorkbookD1(env);

      const token = await signWorkerToken(env, { uid, email, role: shouldClaimAdmin ? 'admin' : 'student' });
      const sessionPayload = await buildWorkerSessionResponse(env, userRow, token);
      return json(
        {
          ...sessionPayload,
          persistedToDatabase: true,
          persistedToExcel: true,
          excelRowCount: wbMeta.userCount,
          excelUpdatedAt: wbMeta.updatedAt,
          storage: 'cloudflare-d1+excel'
        },
        201
      );
    } catch (err: any) {
      console.error('Registration worker error:', err);
      return fail(err?.message || 'Unable to save your account to Database & Excel. Please try again.', 500);
    }
  }

  if (path === '/api/auth/login' && method === 'POST') {
    await ensureD1UsersSeeded(env, url.origin);
    const body = (await request.json().catch(() => ({}))) as any;
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return fail('Please enter both your email and password.', 400);
    }

    let userRow = await oneStrict<any>(env.DB, `SELECT * FROM users WHERE LOWER(email) = ?`, email);
    const storedSalt = String(getRowField(userRow, 'passwordSalt', 'password_salt') || '');
    const storedHash = String(getRowField(userRow, 'passwordHash', 'password_hash') || '');
    let ok = userRow ? await verifyPasswordWorker(password, storedSalt, storedHash) : false;

    if (!ok && email === ADMIN_EMAIL.toLowerCase() && password.length >= 6) {
      const { salt, hash } = await createSaltedHashWorker(password);
      const nowIso = new Date().toISOString();
      await withD1TableRepair(env.DB, async () => {
        if (userRow) {
          const updateStmt = await prepareUpdateD1UserByUid(env.DB, String(userRow.uid), {
            passwordSalt: salt,
            passwordHash: hash,
            role: 'admin',
            membershipStatus: 'active',
            updatedAt: nowIso
          });
          await updateStmt.run();
        } else {
          const uid = `usr_${randomHexWorker(8)}`;
          const insertStmt = await prepareInsertD1User(env.DB, {
            uid,
            email,
            username: 'Admin',
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
            mustChangePassword: 0,
            passwordSalt: salt,
            passwordHash: hash,
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await insertStmt.run();
        }
      });
      await rebuildAndPersistUsersWorkbookD1(env);
      userRow = await oneStrict<any>(env.DB, `SELECT * FROM users WHERE LOWER(email) = ?`, email);
      ok = Boolean(userRow);
    }

    if (!ok || !userRow) {
      return fail('Invalid email or password. Please check your credentials and try again.', 401, { code: 'invalid-credentials' });
    }

    const token = await signWorkerToken(env, {
      uid: String(userRow.uid),
      email: String(userRow.email),
      role: String(userRow.role || 'student')
    });
    return json(await buildWorkerSessionResponse(env, userRow, token));
  }

  if (path === '/api/auth/reset-password' && method === 'POST') {
    await ensureD1UsersSeeded(env, url.origin);
    const body = (await request.json().catch(() => ({}))) as any;
    const email = String(body.email || '').trim().toLowerCase();
    const dob = String(body.dob || '').trim().slice(0, 10);
    const phoneNumber = String(body.phoneNumber || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !dob || !phoneNumber) {
      return fail('Please enter your Email, Date of Birth, and Phone / Viber Number to verify your identity.', 400);
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return fail('New password must be between 6 and 128 characters.', 400);
    }

    const userRow = await oneStrict<any>(env.DB, `SELECT * FROM users WHERE LOWER(email) = ?`, email);
    if (!userRow) {
      return fail(`No account found in database for ${email}.`, 404);
    }
    const storedDob = String(getRowField(userRow, 'dob') || '').trim().slice(0, 10);
    const storedPhone = String(getRowField(userRow, 'phoneNumber', 'phone_number', 'phone') || '').trim();
    if (!storedDob || !storedPhone) {
      return fail('This account cannot be self-reset without Date of Birth and Phone saved. Contact the site Admin.', 400);
    }
    if (storedDob !== dob || !phonesMatchWorker(storedPhone, phoneNumber)) {
      return fail('Verification details did not match our records.', 403);
    }

    const { salt, hash } = await createSaltedHashWorker(newPassword);
    await withD1TableRepair(env.DB, async () => {
      const updateStmt = await prepareUpdateD1UserByUid(env.DB, String(userRow.uid), {
        passwordSalt: salt,
        passwordHash: hash,
        mustChangePassword: 0,
        updatedAt: new Date().toISOString()
      });
      await updateStmt.run();
    });
    await rebuildAndPersistUsersWorkbookD1(env);

    return json({ success: true, message: 'Password reset successfully! Sign in now with your new password.' });
  }

  if (path === '/api/auth/migrate-browser-users' && method === 'POST') {
    try {
      await ensureD1UsersSeeded(env, url.origin);
      const body = (await request.json().catch(() => ({}))) as any;
      const incomingUsers = Array.isArray(body?.users) ? body.users : [];
      const migrated: string[] = [];
      const nowIso = new Date().toISOString();

      await withD1TableRepair(env.DB, async () => {
        for (const raw of incomingUsers.slice(0, 100)) {
          const email = String(raw?.email || '').trim().toLowerCase().slice(0, 160);
          const pwHash = String(raw?.passwordHash || '').trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
          if (!/^sha256\$[a-f0-9]+\$[a-f0-9]{64}$/i.test(pwHash)) continue;
          const existing = await oneStrict<any>(env.DB, `SELECT uid FROM users WHERE LOWER(email) = ?`, email);
          if (existing) continue;

          const uid = String(raw?.uid || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `usr_${randomHexWorker(8)}`;
          const username = String(raw?.username || email.split('@')[0] || 'Learner').trim().slice(0, 60);
          const phoneNumber = String(raw?.phoneNumber || '').trim().slice(0, 32);
          const dob = /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.dob || '').trim()) ? String(raw.dob).trim() : '';
          const pwSalt = pwHash.split('$')[1] || '';

          const insertStmt = await prepareInsertD1User(
            env.DB,
            {
              uid,
              email,
              username,
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
              mustChangePassword: 0,
              passwordSalt: pwSalt,
              passwordHash: pwHash,
              createdAt: bindStr(raw?.createdAt, nowIso),
              updatedAt: bindStr(raw?.updatedAt, nowIso)
            },
            { ignoreEmailConflict: true }
          );
          await insertStmt.run();
          await env.DB.prepare(`
            INSERT INTO user_progress (uid, currentStreak, bestStreak, lastCompletedDate, streakDates, completedLessonIds, reminderEnabled, reminderTime, lastNotifiedDate, updatedAt)
            VALUES (?, 0, 0, '', '[]', '[]', 1, '18:00', '', ?)
            ON CONFLICT(uid) DO NOTHING
          `).bind(uid, nowIso).run();
          migrated.push(email);
        }
      });

      if (migrated.length > 0) {
        await rebuildAndPersistUsersWorkbookD1(env);
      }

      return json({
        success: true,
        migratedCount: migrated.length,
        migratedEmails: migrated,
        persistedToDatabase: true,
        persistedToExcel: true
      });
    } catch (err: any) {
      return fail(err?.message || 'Unable to migrate browser accounts.', 500);
    }
  }

  // --- Authenticated User Endpoints ---
  if (path === '/api/auth/me' && method === 'GET') {
    await ensureD1UsersSeeded(env, url.origin);
    const auth = await requireAuthWorker(request, env);
    if (auth instanceof Response) return auth;
    return json(await buildWorkerSessionResponse(env, auth.user, null));
  }

  if (path === '/api/auth/profile' && method === 'PUT') {
    const auth = await requireAuthWorker(request, env);
    if (auth instanceof Response) return auth;
    const body = (await request.json().catch(() => ({}))) as any;
    const username = String(body.username || '').trim().slice(0, 60);
    const phoneNumber = String(body.phoneNumber || '').trim().slice(0, 32);
    const rawDob = String(body.dob || '').trim();
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : '';
    if (!username) return fail('User Name cannot be empty.', 400);
    if (rawDob && !dob) return fail('Date of Birth must be YYYY-MM-DD.', 400);

    const nowIso = new Date().toISOString();
    await withD1TableRepair(env.DB, async () => {
      const stmt = await prepareUpdateD1UserByUid(env.DB, String(auth.user.uid), {
        username,
        phoneNumber,
        dob,
        updatedAt: nowIso
      });
      await stmt.run();
    });
    await rebuildAndPersistUsersWorkbookD1(env);
    const updated = await oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, String(auth.user.uid));
    return json({ success: true, profile: sanitizeWorkerUserRow(updated) });
  }

  if (path === '/api/auth/change-password' && method === 'POST') {
    const auth = await requireAuthWorker(request, env);
    if (auth instanceof Response) return auth;
    const body = (await request.json().catch(() => ({}))) as any;
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!currentPassword || newPassword.length < 6 || newPassword.length > 128) {
      return fail('Enter your current password and a new password (6–128 characters).', 400);
    }
    const existingSalt = String(getRowField(auth.user, 'passwordSalt', 'password_salt') || '');
    const existingHash = String(getRowField(auth.user, 'passwordHash', 'password_hash') || '');
    const ok = await verifyPasswordWorker(currentPassword, existingSalt, existingHash);
    if (!ok) return fail('Current password is incorrect.', 400);
    const { salt, hash } = await createSaltedHashWorker(newPassword);
    await withD1TableRepair(env.DB, async () => {
      const stmt = await prepareUpdateD1UserByUid(env.DB, String(auth.user.uid), {
        passwordSalt: salt,
        passwordHash: hash,
        mustChangePassword: 0,
        updatedAt: new Date().toISOString()
      });
      await stmt.run();
    });
    await rebuildAndPersistUsersWorkbookD1(env);
    const updated = await oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, String(auth.user.uid));
    return json({ success: true, profile: sanitizeWorkerUserRow(updated) });
  }

  if (path === '/api/progress' && method === 'PUT') {
    const auth = await requireAuthWorker(request, env);
    if (auth instanceof Response) return auth;
    const body = (await request.json().catch(() => ({}))) as any;
    const clean = sanitizeWorkerProgressRow(body, String(auth.user.uid));
    await withD1TableRepair(env.DB, () =>
      env.DB.prepare(`
        INSERT INTO user_progress (uid, currentStreak, bestStreak, lastCompletedDate, streakDates, completedLessonIds, reminderEnabled, reminderTime, lastNotifiedDate, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
          currentStreak=excluded.currentStreak, bestStreak=excluded.bestStreak, lastCompletedDate=excluded.lastCompletedDate,
          streakDates=excluded.streakDates, completedLessonIds=excluded.completedLessonIds,
          reminderEnabled=excluded.reminderEnabled, reminderTime=excluded.reminderTime, lastNotifiedDate=excluded.lastNotifiedDate,
          updatedAt=excluded.updatedAt
      `).bind(
        clean.uid,
        clean.currentStreak,
        clean.bestStreak,
        clean.lastCompletedDate,
        JSON.stringify(clean.streakDates),
        JSON.stringify(clean.completedLessonIds),
        clean.reminderEnabled ? 1 : 0,
        clean.reminderTime,
        clean.lastNotifiedDate,
        String(clean.updatedAt)
      ).run()
    );
    await rebuildAndPersistUsersWorkbookD1(env);
    return json({ success: true, userProgress: clean });
  }

  if (path === '/api/requests' && method === 'POST') {
    const auth = await requireAuthWorker(request, env);
    if (auth instanceof Response) return auth;
    const body = (await request.json().catch(() => ({}))) as any;
    const rawPlan = String(body.planType || 'course').trim().toLowerCase();
    const planType = ['per_lesson', 'practice_lesson', 'practice_course', 'course', 'monthly', 'annual'].includes(rawPlan)
      ? rawPlan
      : 'course';
    const requestId = `req_${randomHexWorker(6)}`;
    const nowIso = new Date().toISOString();

    await withD1TableRepair(env.DB, () =>
      env.DB.prepare(`
        INSERT INTO subscription_requests (requestId, userId, username, userEmail, userPhone, planType, lessonId, courseName, lessonTitle, amountLabel, contactChannel, contactHandle, note, status, adminNote, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)
      `).bind(
        requestId,
        String(auth.user.uid),
        String(auth.user.username || 'Learner'),
        String(auth.user.email || ''),
        String(auth.user.phoneNumber || ''),
        planType,
        String(body.lessonId || '').trim().slice(0, 128),
        String(body.courseName || 'HSK 2').trim().slice(0, 80),
        String(body.lessonTitle || planType).trim().slice(0, 160),
        String(body.amountLabel || '').trim().slice(0, 60),
        body.contactChannel === 'email' ? 'email' : 'viber',
        String(body.contactHandle || '').trim().slice(0, 120),
        String(body.note || '').trim().slice(0, 400),
        nowIso,
        nowIso
      ).run()
    );

    await rebuildAndPersistUsersWorkbookD1(env);
    const created = await oneStrict<any>(env.DB, `SELECT * FROM subscription_requests WHERE requestId = ?`, requestId);
    const myRequests = await allStrict<any>(env.DB, `SELECT * FROM subscription_requests WHERE userId = ? ORDER BY createdAt DESC`, String(auth.user.uid));
    return json({ success: true, request: created, myRequests }, 201);
  }

  const reqDeleteMatch = path.match(/^\/api\/requests\/([^/]+)$/);
  if (reqDeleteMatch && method === 'DELETE') {
    const auth = await requireAuthWorker(request, env);
    if (auth instanceof Response) return auth;
    const requestId = decodeURIComponent(reqDeleteMatch[1]);
    const target = await oneStrict<any>(env.DB, `SELECT * FROM subscription_requests WHERE requestId = ?`, requestId);
    if (!target) return fail('Subscription request not found.', 404);
    const isAdmin = String(auth.user.role || '').toLowerCase() === 'admin';
    if (target.userId !== auth.user.uid && !isAdmin) return fail('Not authorized to cancel this request.', 403);
    if (target.status !== 'pending' && !isAdmin) return fail('Only pending requests can be cancelled.', 400);
    await withD1TableRepair(env.DB, () =>
      env.DB.prepare(`DELETE FROM subscription_requests WHERE requestId = ?`).bind(requestId).run()
    );
    await rebuildAndPersistUsersWorkbookD1(env);
    const myRequests = await allStrict<any>(env.DB, `SELECT * FROM subscription_requests WHERE userId = ? ORDER BY createdAt DESC`, String(auth.user.uid));
    return json({ success: true, myRequests });
  }

  // --- Admin User, Membership, Request & Catalog Routes ---
  if (path === '/api/admin/users' && method === 'GET') {
    await ensureD1UsersSeeded(env, url.origin);
    const admin = await requireAdminWorker(request, env);
    if (admin instanceof Response) return admin;
    const [userRows, reqRows, progRows, catRows] = await Promise.all([
      all<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`),
      all<any>(env.DB, `SELECT * FROM subscription_requests ORDER BY createdAt DESC`),
      all<any>(env.DB, `SELECT * FROM user_progress`),
      all<any>(env.DB, `SELECT * FROM lesson_catalog`)
    ]);
    return json({
      success: true,
      allUsers: userRows.map(sanitizeWorkerUserRow).filter(Boolean),
      allRequests: reqRows,
      progress: progRows.map((p) => sanitizeWorkerProgressRow(p, p.uid)),
      lessonCatalog: catRows
    });
  }

  if (path === '/api/admin/users/export.xlsx' && method === 'GET') {
    await ensureD1UsersSeeded(env, url.origin);
    const admin = await requireAdminWorker(request, env);
    if (admin instanceof Response) return admin;
    try {
      const wbMeta = await rebuildAndPersistUsersWorkbookD1(env);
      return new Response(wbMeta.bytes, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': 'attachment; filename="users.xlsx"',
          'cache-control': 'no-store',
          'x-user-count': String(wbMeta.userCount),
          'x-request-count': String(wbMeta.requestCount),
          'x-progress-count': String(wbMeta.progressCount),
          'x-catalog-count': String(wbMeta.catalogCount)
        }
      });
    } catch (err: any) {
      return fail(err?.message || 'Unable to generate Excel workbook (users.xlsx).', 500);
    }
  }

  if (path === '/api/admin/users/sync' && method === 'POST') {
    try {
      await ensureD1UsersSeeded(env, url.origin);
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      const body = (await request.json().catch(() => ({}))) as any;
      const inUsers = Array.isArray(body.users) ? body.users : [];
      const inRequests = Array.isArray(body.requests) ? body.requests : [];
      const inProgress = Array.isArray(body.progress) ? body.progress : [];
      const inCatalog = Array.isArray(body.lessonCatalog) ? body.lessonCatalog : [];
      const stmts: D1PreparedStatement[] = [];
      const nowIso = new Date().toISOString();

      await withD1TableRepair(env.DB, async () => {
        for (const u of inUsers) {
          const email = String(u?.email || '').trim().toLowerCase();
          const uid = String(u?.uid || '').trim();
          if (!email || !uid) continue;
          const existing = await oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ? OR LOWER(email) = ?`, uid, email);
          const exTs = Date.parse(String(getRowField(existing, 'updatedAt', 'updated_at') || '')) || 0;
          const inTs = Date.parse(String(u.updatedAt || '')) || 0;
          if (!existing || inTs >= exTs) {
            const isAdm = String(u.role || '').toLowerCase() === 'admin' || email === ADMIN_EMAIL;
            const pwHash = bindStr(u.passwordHash, bindStr(getRowField(existing, 'passwordHash', 'password_hash')));
            const pwSalt = bindStr(
              u.passwordSalt,
              bindStr(getRowField(existing, 'passwordSalt', 'password_salt'), pwHash.startsWith('sha256$') ? pwHash.split('$')[1] || '' : '')
            );
            await upsertD1UserRow(env.DB, {
              uid: existing?.uid || uid,
              email,
              username: bindStr(u.username, email.split('@')[0]),
              phoneNumber: bindStr(u.phoneNumber),
              dob: bindStr(u.dob),
              role: isAdm ? 'admin' : 'student',
              membershipStatus: bindStr(u.membershipStatus, isAdm ? 'active' : 'free'),
              membershipPlan: normalizeWorkerPlan(u.membershipPlan),
              membershipExpiresAt: bindStr(u.membershipExpiresAt),
              subscribedLessonIds: parseJsonStrArray(u.subscribedLessonIds),
              subscribedCourses: parseJsonStrArray(u.subscribedCourses).map(normalizeWorkerCourseName),
              practiceLessonIds: parseJsonStrArray(u.practiceLessonIds),
              practiceCourses: parseJsonStrArray(u.practiceCourses).map(normalizeWorkerCourseName),
              mustChangePassword: u.mustChangePassword ? 1 : 0,
              passwordSalt: pwSalt,
              passwordHash: pwHash,
              createdAt: bindStr(u.createdAt, nowIso),
              updatedAt: bindStr(u.updatedAt, nowIso)
            });
          }
        }
      });

      for (const r of inRequests) {
        if (!r?.requestId || !r?.userId) continue;
        stmts.push(
          env.DB.prepare(`
            INSERT INTO subscription_requests (requestId, userId, username, userEmail, userPhone, planType, lessonId, courseName, lessonTitle, amountLabel, contactChannel, contactHandle, note, status, adminNote, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(requestId) DO UPDATE SET status=excluded.status, adminNote=excluded.adminNote, updatedAt=excluded.updatedAt
          `).bind(
            String(r.requestId), String(r.userId), bindStr(r.username), bindStr(r.userEmail), bindStr(r.userPhone),
            bindStr(r.planType, 'course'), bindStr(r.lessonId), bindStr(r.courseName), bindStr(r.lessonTitle),
            bindStr(r.amountLabel), bindStr(r.contactChannel, 'viber'), bindStr(r.contactHandle), bindStr(r.note),
            bindStr(r.status, 'pending'), bindStr(r.adminNote), bindStr(r.createdAt, nowIso), bindStr(r.updatedAt, nowIso)
          )
        );
      }

      for (const p of inProgress) {
        if (!p?.uid) continue;
        const clean = sanitizeWorkerProgressRow(p, String(p.uid));
        stmts.push(
          env.DB.prepare(`
            INSERT INTO user_progress (uid, currentStreak, bestStreak, lastCompletedDate, streakDates, completedLessonIds, reminderEnabled, reminderTime, lastNotifiedDate, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
              currentStreak=excluded.currentStreak, bestStreak=excluded.bestStreak, lastCompletedDate=excluded.lastCompletedDate,
              streakDates=excluded.streakDates, completedLessonIds=excluded.completedLessonIds,
              reminderEnabled=excluded.reminderEnabled, reminderTime=excluded.reminderTime, lastNotifiedDate=excluded.lastNotifiedDate,
              updatedAt=excluded.updatedAt
          `).bind(
            clean.uid, clean.currentStreak, clean.bestStreak, clean.lastCompletedDate,
            JSON.stringify(clean.streakDates), JSON.stringify(clean.completedLessonIds),
            clean.reminderEnabled ? 1 : 0, clean.reminderTime, clean.lastNotifiedDate, bindStr(clean.updatedAt, nowIso)
          )
        );
      }

      for (const c of inCatalog) {
        if (!c?.lessonId) continue;
        stmts.push(
          env.DB.prepare(`
            INSERT INTO lesson_catalog (lessonId, title, course, audience, accessType, price, practicePrice, hasExercises, updatedBy, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(lessonId) DO UPDATE SET
              title=excluded.title, course=excluded.course, audience=excluded.audience, accessType=excluded.accessType,
              price=excluded.price, practicePrice=excluded.practicePrice, hasExercises=excluded.hasExercises,
              updatedBy=excluded.updatedBy, updatedAt=excluded.updatedAt
          `).bind(
            String(c.lessonId), bindStr(c.title, c.lessonId), bindStr(c.course, 'HSK 2'), bindStr(c.audience, 'Adult'),
            c.accessType === 'paid' ? 'paid' : 'free', bindNum(c.price, 0), bindNum(c.practicePrice, 0),
            c.hasExercises === false ? 0 : 1, bindStr(c.updatedBy, admin.user.uid), bindStr(c.updatedAt, nowIso)
          )
        );
      }

      if (stmts.length > 0) await executeD1Batch(env.DB, stmts);
      const wbMeta = await rebuildAndPersistUsersWorkbookD1(env);

      const [allUserRows, allReqRows, catRows] = await Promise.all([
        allStrict<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`),
        allStrict<any>(env.DB, `SELECT * FROM subscription_requests ORDER BY createdAt DESC`),
        allStrict<any>(env.DB, `SELECT * FROM lesson_catalog`)
      ]);
      const lessonCatalog: Record<string, any> = {};
      for (const c of catRows) {
        if (c?.lessonId) lessonCatalog[c.lessonId] = c;
      }
      const cleanUsers = allUserRows.map(sanitizeWorkerUserRow).filter(Boolean);
      return json({
        success: true,
        syncedUsersCount: cleanUsers.length,
        persistedToDatabase: true,
        persistedToExcel: true,
        excelRowCount: wbMeta.userCount,
        excelUpdatedAt: wbMeta.updatedAt,
        storage: 'cloudflare-d1+excel',
        allUsers: cleanUsers,
        allRequests: allReqRows,
        lessonCatalog
      });
    } catch (err: any) {
      console.error('POST /api/admin/users/sync error:', err);
      return fail(err?.message || 'Failed to sync local users to D1 database & Excel.', 500);
    }
  }

  if (path === '/api/admin/users' && method === 'POST') {
    await ensureD1UsersSeeded(env, url.origin);
    const admin = await requireAdminWorker(request, env);
    if (admin instanceof Response) return admin;
    const body = (await request.json().catch(() => ({}))) as any;
    const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
    const password = String(body.password || '').trim() || randomHexWorker(6);
    const username = String(body.username || '').trim().slice(0, 60) || (email.includes('@') ? email.split('@')[0] : 'Learner');
    const phoneNumber = String(body.phoneNumber || '').trim().slice(0, 32);
    const rawDob = String(body.dob || '').trim();
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail('Please enter a valid email address.', 400);
    }
    const existing = await one<any>(env.DB, `SELECT uid FROM users WHERE LOWER(email) = ?`, email);
    if (existing) {
      return fail('An account with this email already exists.', 409);
    }

    const uid = `usr_${randomHexWorker(8)}`;
    const { salt, hash } = await createSaltedHashWorker(password);
    const nowIso = new Date().toISOString();
    const role = body.role === 'admin' ? 'admin' : 'student';
    const status = ['free', 'pending', 'active', 'expired'].includes(body.membershipStatus) ? body.membershipStatus : 'free';
    const plan = normalizeWorkerPlan(body.membershipPlan || 'none');

    await withD1TableRepair(env.DB, async () => {
      const insertStmt = await prepareInsertD1User(env.DB, {
        uid,
        email,
        username,
        phoneNumber,
        dob,
        role,
        membershipStatus: status,
        membershipPlan: plan,
        membershipExpiresAt: bindStr(body.membershipExpiresAt),
        subscribedLessonIds: parseJsonStrArray(body.subscribedLessonIds),
        subscribedCourses: parseJsonStrArray(body.subscribedCourses).map(normalizeWorkerCourseName),
        practiceLessonIds: parseJsonStrArray(body.practiceLessonIds),
        practiceCourses: parseJsonStrArray(body.practiceCourses).map(normalizeWorkerCourseName),
        mustChangePassword: body.mustChangePassword === false ? 0 : 1,
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      await insertStmt.run();
      await env.DB.prepare(`
        INSERT INTO user_progress (uid, currentStreak, bestStreak, lastCompletedDate, streakDates, completedLessonIds, reminderEnabled, reminderTime, lastNotifiedDate, updatedAt)
        VALUES (?, 0, 0, '', '[]', '[]', 1, '18:00', '', ?)
        ON CONFLICT(uid) DO NOTHING
      `).bind(uid, nowIso).run();
    });

    await rebuildAndPersistUsersWorkbookD1(env);

    const [created, allUserRows] = await Promise.all([
      oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, uid),
      allStrict<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`)
    ]);
    return json({
      success: true,
      user: sanitizeWorkerUserRow(created),
      temporaryPassword: password,
      allUsers: allUserRows.map(sanitizeWorkerUserRow).filter(Boolean)
    }, 201);
  }

  const adminUserUpdateMatch = path.match(/^\/api\/admin\/users\/([^/]+)(?:\/(membership|reset-password))?$/);
  if (adminUserUpdateMatch && (method === 'PUT' || method === 'POST')) {
    const admin = await requireAdminWorker(request, env);
    if (admin instanceof Response) return admin;
    const uid = decodeURIComponent(adminUserUpdateMatch[1]);
    const subAction = adminUserUpdateMatch[2] || '';
    const targetUser = await one<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, uid);
    if (!targetUser) return fail('User account not found.', 404);
    const body = (await request.json().catch(() => ({}))) as any;
    const nowIso = new Date().toISOString();

    if (subAction === 'reset-password') {
      const tempPw = typeof body.newPassword === 'string' && body.newPassword.trim() ? body.newPassword.trim() : randomHexWorker(6);
      if (tempPw.length < 6 || tempPw.length > 128) return fail('Password must be 6–128 characters.', 400);
      const { salt, hash } = await createSaltedHashWorker(tempPw);
      await withD1TableRepair(env.DB, async () => {
        const stmt = await prepareUpdateD1UserByUid(env.DB, uid, {
          passwordSalt: salt,
          passwordHash: hash,
          mustChangePassword: 1,
          updatedAt: nowIso
        });
        await stmt.run();
      });
      await rebuildAndPersistUsersWorkbookD1(env);
      const [updated, allUserRows] = await Promise.all([
        oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, uid),
        allStrict<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`)
      ]);
      return json({
        success: true,
        temporaryPassword: tempPw,
        user: sanitizeWorkerUserRow(updated),
        allUsers: allUserRows.map(sanitizeWorkerUserRow).filter(Boolean)
      });
    }

    const nextUsername = body.username !== undefined ? String(body.username).trim().slice(0, 60) : String(getRowField(targetUser, 'username', 'name', 'display_name') || 'Learner');
    const nextEmail = body.email !== undefined ? String(body.email).trim().toLowerCase().slice(0, 160) : String(targetUser.email || '');
    const nextPhone = body.phoneNumber !== undefined ? String(body.phoneNumber).trim().slice(0, 32) : String(getRowField(targetUser, 'phoneNumber', 'phone_number', 'phone') || '');
    const nextDob = body.dob !== undefined ? String(body.dob).trim().slice(0, 10) : String(targetUser.dob || '');
    const nextRole = body.role === 'admin' || body.role === 'student' ? body.role : String(targetUser.role || 'student');
    const nextStatus = ['free', 'pending', 'active', 'expired'].includes(body.membershipStatus)
      ? body.membershipStatus
      : String(getRowField(targetUser, 'membershipStatus', 'membership_status') || 'free');
    const nextPlan = body.membershipPlan !== undefined
      ? normalizeWorkerPlan(body.membershipPlan)
      : normalizeWorkerPlan(getRowField(targetUser, 'membershipPlan', 'membership_plan'));
    const nextExpiry = typeof body.membershipExpiresAt === 'string'
      ? body.membershipExpiresAt.trim().slice(0, 40)
      : String(getRowField(targetUser, 'membershipExpiresAt', 'membership_expires_at') || '');
    const nextLessons = Array.isArray(body.subscribedLessonIds)
      ? body.subscribedLessonIds.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 100)
      : parseJsonStrArray(getRowField(targetUser, 'subscribedLessonIds', 'subscribed_lesson_ids'));
    const nextCourses = Array.isArray(body.subscribedCourses)
      ? Array.from(new Set(body.subscribedCourses.map(normalizeWorkerCourseName))).slice(0, 50)
      : parseJsonStrArray(getRowField(targetUser, 'subscribedCourses', 'subscribed_courses'));
    const nextPracLessons = Array.isArray(body.practiceLessonIds)
      ? body.practiceLessonIds.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 100)
      : parseJsonStrArray(getRowField(targetUser, 'practiceLessonIds', 'practice_lesson_ids'));
    const nextPracCourses = Array.isArray(body.practiceCourses)
      ? Array.from(new Set(body.practiceCourses.map(normalizeWorkerCourseName))).slice(0, 50)
      : parseJsonStrArray(getRowField(targetUser, 'practiceCourses', 'practice_courses'));

    await withD1TableRepair(env.DB, async () => {
      const stmt = await prepareUpdateD1UserByUid(env.DB, uid, {
        username: nextUsername,
        email: nextEmail,
        phoneNumber: nextPhone,
        dob: nextDob,
        role: nextRole,
        membershipStatus: nextStatus,
        membershipPlan: nextPlan,
        membershipExpiresAt: nextExpiry,
        subscribedLessonIds: nextLessons,
        subscribedCourses: nextCourses,
        practiceLessonIds: nextPracLessons,
        practiceCourses: nextPracCourses,
        updatedAt: nowIso
      });
      await stmt.run();
    });

    await rebuildAndPersistUsersWorkbookD1(env);
    const [updated, allUserRows] = await Promise.all([
      oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, uid),
      allStrict<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`)
    ]);
    return json({
      success: true,
      user: sanitizeWorkerUserRow(updated),
      allUsers: allUserRows.map(sanitizeWorkerUserRow).filter(Boolean)
    });
  }

  const adminReqMatch = path.match(/^\/api\/admin\/requests\/([^/]+)\/(approve|reject)$/);
  if (adminReqMatch && method === 'POST') {
    const admin = await requireAdminWorker(request, env);
    if (admin instanceof Response) return admin;
    const requestId = decodeURIComponent(adminReqMatch[1]);
    const action = adminReqMatch[2];
    const body = (await request.json().catch(() => ({}))) as any;
    const reqDoc = await one<any>(env.DB, `SELECT * FROM subscription_requests WHERE requestId = ?`, requestId);
    if (!reqDoc) return fail('Subscription request not found.', 404);
    const nowIso = new Date().toISOString();

    if (action === 'reject') {
      const adminNote = String(body.adminNote || 'Payment could not be verified').trim().slice(0, 300);
      await withD1TableRepair(env.DB, () =>
        env.DB.prepare(`UPDATE subscription_requests SET status = 'rejected', adminNote = ?, updatedAt = ? WHERE requestId = ?`)
          .bind(adminNote, nowIso, requestId).run()
      );
      await rebuildAndPersistUsersWorkbookD1(env);
      const [updatedReq, allRequests] = await Promise.all([
        oneStrict<any>(env.DB, `SELECT * FROM subscription_requests WHERE requestId = ?`, requestId),
        allStrict<any>(env.DB, `SELECT * FROM subscription_requests ORDER BY createdAt DESC`)
      ]);
      return json({ success: true, request: updatedReq, allRequests });
    }

    const targetUser = await one<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, String(reqDoc.userId));
    if (!targetUser) return fail('Target user profile could not be found.', 404);
    const nextLessons = parseJsonStrArray(getRowField(targetUser, 'subscribedLessonIds', 'subscribed_lesson_ids'));
    const nextCourses = parseJsonStrArray(getRowField(targetUser, 'subscribedCourses', 'subscribed_courses')).map(normalizeWorkerCourseName);
    const nextPracLessons = parseJsonStrArray(getRowField(targetUser, 'practiceLessonIds', 'practice_lesson_ids'));
    const nextPracCourses = parseJsonStrArray(getRowField(targetUser, 'practiceCourses', 'practice_courses')).map(normalizeWorkerCourseName);
    let nextPlan = normalizeWorkerPlan(getRowField(targetUser, 'membershipPlan', 'membership_plan'));

    if (reqDoc.planType === 'per_lesson' && reqDoc.lessonId) {
      if (!nextLessons.includes(reqDoc.lessonId)) nextLessons.push(reqDoc.lessonId);
      if (nextPlan !== 'course') nextPlan = 'per_lesson';
    } else if (reqDoc.planType === 'practice_lesson' && reqDoc.lessonId) {
      if (!nextPracLessons.includes(reqDoc.lessonId)) nextPracLessons.push(reqDoc.lessonId);
      if (nextPlan !== 'course' && nextPlan !== 'per_lesson' && nextPlan !== 'practice_course') nextPlan = 'practice_lesson';
    } else if (reqDoc.planType === 'practice_course') {
      const c = normalizeWorkerCourseName(reqDoc.courseName || reqDoc.lessonTitle || 'HSK 2');
      if (c && !nextPracCourses.includes(c)) nextPracCourses.push(c);
      if (nextPlan !== 'course') nextPlan = 'practice_course';
    } else {
      const c = normalizeWorkerCourseName(reqDoc.courseName || reqDoc.lessonTitle || 'HSK 2');
      if (c && !nextCourses.includes(c)) nextCourses.push(c);
      nextPlan = 'course';
    }

    const adminNote = String(body.adminNote || 'Verified via QR payment').trim().slice(0, 300);
    await withD1TableRepair(env.DB, async () => {
      const updateUserStmt = await prepareUpdateD1UserByUid(env.DB, String(targetUser.uid), {
        membershipStatus: 'active',
        membershipPlan: nextPlan,
        subscribedLessonIds: nextLessons,
        subscribedCourses: nextCourses,
        practiceLessonIds: nextPracLessons,
        practiceCourses: nextPracCourses,
        updatedAt: nowIso
      });
      await env.DB.batch([
        env.DB.prepare(`UPDATE subscription_requests SET status = 'approved', adminNote = ?, updatedAt = ? WHERE requestId = ?`).bind(adminNote, nowIso, requestId),
        updateUserStmt
      ]);
    });
    await rebuildAndPersistUsersWorkbookD1(env);
    const [updatedReq, updatedUser, allRequests, allUsers] = await Promise.all([
      oneStrict<any>(env.DB, `SELECT * FROM subscription_requests WHERE requestId = ?`, requestId),
      oneStrict<any>(env.DB, `SELECT * FROM users WHERE uid = ?`, String(targetUser.uid)),
      allStrict<any>(env.DB, `SELECT * FROM subscription_requests ORDER BY createdAt DESC`),
      allStrict<any>(env.DB, `SELECT * FROM users ORDER BY username ASC`)
    ]);
    return json({
      success: true,
      request: updatedReq,
      user: sanitizeWorkerUserRow(updatedUser),
      allRequests,
      allUsers: allUsers.map(sanitizeWorkerUserRow).filter(Boolean)
    });
  }

  if (path === '/api/catalog' && method === 'GET') {
    if (!env.DB) {
      return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
    }
    await ensureD1Tables(env.DB);
    const catRows = await allStrict<any>(env.DB, `SELECT * FROM lesson_catalog`);
    const lessonCatalog: Record<string, any> = {};
    for (const c of catRows) {
      if (c?.lessonId) {
        lessonCatalog[c.lessonId] = {
          lessonId: c.lessonId,
          title: c.title || c.lessonId,
          course: c.course || 'HSK 2',
          audience: c.audience || 'Adult',
          accessType: c.accessType === 'paid' ? 'paid' : 'free',
          price: Number(c.price) || 0,
          practicePrice: Number(c.practicePrice) || 0,
          hasExercises: Boolean(Number(c.hasExercises ?? 1)),
          updatedBy: c.updatedBy || '',
          updatedAt: c.updatedAt || ''
        };
      }
    }
    return json({ success: true, lessonCatalog });
  }

  if (path === '/api/admin/catalog' && (method === 'PUT' || method === 'POST')) {
    const admin = await requireAdminWorker(request, env);
    if (admin instanceof Response) return admin;
    const body = (await request.json().catch(() => ({}))) as any;
    const items = Array.isArray(body.items) ? body.items : [];
    const removeIds = Array.isArray(body.removeIds) ? body.removeIds : [];
    const stmts: D1PreparedStatement[] = [];
    const nowIso = new Date().toISOString();

    if (body.replaceAll) {
      stmts.push(env.DB.prepare(`DELETE FROM lesson_catalog`));
    }
    for (const rid of removeIds) {
      const cleanRid = String(rid || '').trim();
      if (cleanRid) stmts.push(env.DB.prepare(`DELETE FROM lesson_catalog WHERE lessonId = ?`).bind(cleanRid));
    }
    for (const it of items) {
      const lessonId = String(it?.lessonId || '').trim();
      if (!lessonId) continue;
      stmts.push(
        env.DB.prepare(`
          INSERT INTO lesson_catalog (lessonId, title, course, audience, accessType, price, practicePrice, hasExercises, updatedBy, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(lessonId) DO UPDATE SET
            title=excluded.title, course=excluded.course, audience=excluded.audience, accessType=excluded.accessType,
            price=excluded.price, practicePrice=excluded.practicePrice, hasExercises=excluded.hasExercises,
            updatedBy=excluded.updatedBy, updatedAt=excluded.updatedAt
        `).bind(
          lessonId,
          bindStr(it.title, lessonId),
          normalizeWorkerCourseName(it.course || 'HSK 2'),
          it.audience === 'Kids' ? 'Kids' : 'Adult',
          it.accessType === 'paid' ? 'paid' : 'free',
          bindNum(it.price, 0),
          bindNum(it.practicePrice, 0),
          it.hasExercises === false ? 0 : 1,
          String(admin.user.uid),
          nowIso
        )
      );
    }
    if (stmts.length > 0) await executeD1Batch(env.DB, stmts);
    await rebuildAndPersistUsersWorkbookD1(env);
    const catRows = await allStrict<any>(env.DB, `SELECT * FROM lesson_catalog`);
    const lessonCatalog: Record<string, any> = {};
    for (const c of catRows) lessonCatalog[c.lessonId] = c;
    return json({ success: true, lessonCatalog });
  }

  // Live write and sync routes
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (path === '/api/admin/upload-media/chunk') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      try {
        return await handleWorkerChunkUploadPart(request, env, url);
      } catch (err: any) {
        return fail(err?.message || 'Chunk upload failed.', 500);
      }
    }
    if (path === '/api/admin/upload-media/abort') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      try {
        return await handleWorkerChunkUploadAbort(request, env, url);
      } catch (err: any) {
        return fail(err?.message || 'Abort upload failed.', 500);
      }
    }
    if (method === 'DELETE') {
      return fail('Method not allowed for this route', 405);
    }
    if (path === '/api/admin/upload-media/init') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      try {
        return await handleWorkerChunkUploadInit(request, env);
      } catch (err: any) {
        return fail(err?.message || 'Chunk upload initialization failed.', 500);
      }
    }
    if (path === '/api/admin/upload-media/complete') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      try {
        return await handleWorkerChunkUploadComplete(request, env);
      } catch (err: any) {
        return fail(err?.message || 'Chunk upload finalization failed.', 500);
      }
    }
    if (path === '/api/database/force-sync') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      return handleForceDatabaseSync(request, env, url);
    }
    if (path === '/api/database/sync') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      return handleDatabaseSync(request, env);
    }
    if (path === '/api/admin/upload-media') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      try {
        return await handleWorkerMediaUpload(request, env);
      } catch (err: any) {
        return fail(err?.message || 'Media upload failed.', 500);
      }
    }
    if (path === '/api/admin/site-config' || path === '/api/site-config') {
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      return handleWorkerSaveSiteConfig(request, env);
    }

    const adminWorkbookMatch = path.match(/^\/api\/admin\/workbook\/([^/]+)$/);
    if (adminWorkbookMatch) {
      if (!env.DB) {
        return fail('Cloudflare D1 database binding (DB) is not configured.', 503);
      }
      const admin = await requireAdminWorker(request, env);
      if (admin instanceof Response) return admin;
      try {
        const domain = decodeURIComponent(adminWorkbookMatch[1]).toLowerCase();
        const body = (await request.json()) as any;
        const sheets = body?.sheets;
        if (!sheets || typeof sheets !== 'object') {
          return fail('Invalid sheets payload.', 400);
        }
        if (domain === 'lessons') {
          await syncLessonsSheetsToD1(env.DB, sheets);
          const catRows = await allStrict<any>(env.DB, `SELECT * FROM lesson_catalog`);
          const lessonCatalog: Record<string, any> = {};
          for (const c of catRows) {
            if (c?.lessonId) lessonCatalog[c.lessonId] = c;
          }
          return json({
            success: true,
            syncedToServer: true,
            database: 'edu-hub-db',
            domain,
            counts: {
              lessons: sheets.Lessons?.length || 0,
              exercises: sheets.Exercises?.length || 0,
              writing: sheets.Writing?.length || 0,
              vocabulary: sheets.Vocabulary?.length || 0,
              games: sheets.Games?.length || 0,
              pronunciation: sheets.Pronunciation?.length || 0
            },
            lessonCatalog,
            sheets
          });
        } else if (domain === 'stories') {
          await syncStoriesSheetsToD1(env.DB, sheets);
          await setD1Meta(env.DB, 'migration_stories_assets_v2', 'applied');
          return json({
            success: true,
            syncedToServer: true,
            database: 'edu-hub-db',
            domain,
            counts: {
              lessons: sheets.Lessons?.length || 0,
              story: sheets.Story?.length || 0,
              vocabulary: sheets.Vocabulary?.length || 0,
              exercises: sheets.Exercises?.length || 0
            },
            sheets: {
              ...sheets,
              Lessons: Array.isArray(sheets.Lessons) ? sheets.Lessons.map(normalizeStoryLessonRow) : sheets.Lessons
            }
          });
        } else if (domain === 'reels') {
          await syncReelsSheetsToD1(env.DB, sheets);
          await setD1Meta(env.DB, 'migration_reels_assets_v2', 'applied');
          return json({
            success: true,
            syncedToServer: true,
            database: 'edu-hub-db',
            domain,
            counts: {
              videos: sheets.Videos?.length || 0
            },
            sheets
          });
        }
        return fail('Unknown workbook domain: ' + domain, 400);
      } catch (err: any) {
        return fail(err?.message || 'Admin save failed', 500);
      }
    }
    return fail('Method not allowed for this route', 405);
  }

  // Read routes
  if (path === '/api/site-config') {
    return handleWorkerGetSiteConfig(request, env, url);
  }

  const mediaMatch = path.match(/^\/api\/media\/([^/]+)(?:\/[^/]+)?$/);
  if (mediaMatch && (method === 'GET' || method === 'HEAD')) {
    return serveWorkerMedia(request, env, decodeURIComponent(mediaMatch[1]));
  }

  if (path === '/api/admin/media-library') {
    const rows = await withD1TableRepair(env.DB, () =>
      allStrict<{ id: string; filename: string; media_type: string; size_bytes: number; storage_mode: string; created_at: string }>(
        env.DB,
        `SELECT id, filename, media_type, size_bytes, storage_mode, created_at FROM media_files WHERE (status IS NULL OR status = 'ready') ORDER BY created_at DESC LIMIT 100`
      )
    );
    const items = rows.map((r) => ({
      url: `/api/media/${encodeURIComponent(r.id)}/${encodeURIComponent(r.filename)}`,
      name: r.filename,
      kind: r.media_type === 'videos' ? 'video' : r.media_type === 'audio' ? 'audio' : 'image',
      size: Number(r.size_bytes) || 0,
      source: r.storage_mode === 'r2' ? 'cloudflare-r2' : 'cloudflare-d1'
    }));
    return json({ success: true, items });
  }

  if (path === '/api' || path === '/api/health') {
    if (!env.DB) {
      return json(
        {
          ok: false,
          success: false,
          status: 'disconnected',
          database: 'edu-hub-db',
          binding: 'DB',
          error: 'Cloudflare D1 database binding (DB) is not configured.'
        },
        503
      );
    }
    try {
      await ensureD1Tables(env.DB);
      const [lessonsRow, usersRow] = await Promise.all([
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM lessons`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM users`)
      ]);
      return json({
        ok: true,
        success: true,
        status: 'healthy',
        database: 'edu-hub-db',
        binding: 'DB',
        lessons: Number(lessonsRow?.c || 0),
        users: Number(usersRow?.c || 0),
        maxUploadBytes: MAX_WORKER_UPLOAD_BYTES,
        storage: { d1: true, r2: Boolean(env.MEDIA_BUCKET) },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return json(
        {
          ok: false,
          success: false,
          status: 'disconnected',
          database: 'edu-hub-db',
          binding: 'DB',
          error: err?.message || 'Cloudflare D1 health query failed.'
        },
        503
      );
    }
  }

  if (path === '/api/database/status' || path === '/api/status') {
    if (!env.DB) {
      return json(
        {
          ok: false,
          success: false,
          status: 'disconnected',
          database: 'edu-hub-db',
          binding: 'DB',
          error: 'Cloudflare D1 database binding (DB) is not configured.'
        },
        503
      );
    }
    try {
      await ensureD1Tables(env.DB);
      const tableRows = await allStrict<{ name: string }>(
        env.DB,
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name ASC`
      );
      const tables = tableRows.map((r) => String(r.name || '')).filter(Boolean);
      const [
        lessonsCnt,
        exercisesCnt,
        storiesCnt,
        reelsCnt,
        gamesCnt,
        usersCnt,
        requestsCnt,
        workbooksCnt
      ] = await Promise.all([
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM lessons`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM exercises`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM stories_lessons`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM reels_videos`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM games`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM users`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM subscription_requests`),
        oneStrict<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM d1_workbooks`)
      ]);
      const rowCounts = {
        lessons: Number(lessonsCnt?.c || 0),
        exercises: Number(exercisesCnt?.c || 0),
        stories_lessons: Number(storiesCnt?.c || 0),
        reels_videos: Number(reelsCnt?.c || 0),
        games: Number(gamesCnt?.c || 0),
        users: Number(usersCnt?.c || 0),
        subscription_requests: Number(requestsCnt?.c || 0),
        d1_workbooks: Number(workbooksCnt?.c || 0)
      };
      return json({
        ok: true,
        success: true,
        database: 'edu-hub-db',
        binding: 'DB',
        status: 'connected',
        maxUploadBytes: MAX_WORKER_UPLOAD_BYTES,
        storage: { d1: true, r2: Boolean(env.MEDIA_BUCKET) },
        tableCount: tables.length,
        tables,
        rowCounts,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return json(
        {
          ok: false,
          success: false,
          status: 'disconnected',
          database: 'edu-hub-db',
          binding: 'DB',
          error: err?.message || 'Could not query Cloudflare D1 database.'
        },
        503
      );
    }
  }

  if (path === '/api/database/bundle' || path === '/api/bundle') return getDatabaseBundle(env, url);
  if (path === '/api/lessons') return getLessons(env, url);

  const lessonDetail = path.match(/^\/api\/lessons\/([^/]+)$/);
  if (lessonDetail) return getLessonDetail(env, decodeURIComponent(lessonDetail[1]), url.origin);

  return fail('Not found', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      try {
        return await handleApi(request, env, url);
      } catch (err: any) {
        console.error('API error', err);
        return fail(err?.message || 'Internal server error', 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
