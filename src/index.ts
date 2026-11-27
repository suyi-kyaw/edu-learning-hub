/**
 * edu-learning-hub — Cloudflare Worker
 *
 * Database-first curriculum retrieval with automatic DB-vs-Excel/JSON auto-reconciliation,
 * live Admin writes, and Cloudflare D1 (binding: DB) + ASSETS binding.
 */

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
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization, Range, X-Admin-Uid, X-User-Uid',
  'access-control-expose-headers': 'Content-Range, Content-Length, Accept-Ranges, Content-Type',
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

function fail(message: string, status = 400): Response {
  return json({ ok: false, success: false, error: message }, status);
}

function isMissingTableError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return msg.includes('no such table') || msg.includes('no such column');
}

async function one<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  if (!db) return null;
  try {
    return await db.prepare(sql).bind(...params).first<T>();
  } catch (err) {
    if (isMissingTableError(err)) {
      try {
        await ensureD1Tables(db, true);
        return await db.prepare(sql).bind(...params).first<T>();
      } catch (_) {}
    }
    return null;
  }
}

async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  if (!db) return [];
  try {
    const { results } = await db.prepare(sql).bind(...params).all<T>();
    return results ?? [];
  } catch (err) {
    if (isMissingTableError(err)) {
      try {
        await ensureD1Tables(db, true);
        const { results } = await db.prepare(sql).bind(...params).all<T>();
        return results ?? [];
      } catch (_) {}
    }
    return [];
  }
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
    price
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
  `CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, course TEXT, category TEXT, categoryKey TEXT, categoryNum TEXT, title TEXT, chineseTitle TEXT, pinyin TEXT, meaning TEXT, level TEXT, description TEXT, videoUrl TEXT, posterUrl TEXT, fullAudio TEXT, keywords TEXT, accessType TEXT, price REAL, updated_at TEXT)`,
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
  `CREATE TABLE IF NOT EXISTS d1_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`
];

const MEDIA_FILES_UPGRADE_COLUMNS: readonly string[] = [
  `ALTER TABLE media_files ADD COLUMN storage_mode TEXT DEFAULT 'd1'`,
  `ALTER TABLE media_files ADD COLUMN object_key TEXT DEFAULT ''`,
  `ALTER TABLE media_files ADD COLUMN upload_id TEXT DEFAULT ''`,
  `ALTER TABLE media_files ADD COLUMN status TEXT DEFAULT 'ready'`,
  `ALTER TABLE exercises ADD COLUMN audioText TEXT DEFAULT ''`,
  `ALTER TABLE stories_exercises ADD COLUMN audioText TEXT DEFAULT ''`
];

let d1SchemaReady = false;
let d1SchemaPromise: Promise<void> | null = null;

async function ensureD1Tables(db: D1Database, force = false): Promise<void> {
  if (!db) return;
  if (d1SchemaReady && !force) return;
  if (d1SchemaPromise && !force) return d1SchemaPromise;

  const runInit = async () => {
    try {
      const stmts = D1_TABLE_STATEMENTS.map((sql) => db.prepare(sql));
      await db.batch(stmts);
    } catch (_) {
      for (const sql of D1_TABLE_STATEMENTS) {
        await db.prepare(sql).run();
      }
    }
    for (const alterSql of MEDIA_FILES_UPGRADE_COLUMNS) {
      try {
        await db.prepare(alterSql).run();
      } catch (_) {
        // Column already exists on fresh or already-migrated DB
      }
    }
    d1SchemaReady = true;
  };

  d1SchemaPromise = runInit().catch((err) => {
    d1SchemaReady = false;
    throw err;
  }).finally(() => {
    d1SchemaPromise = null;
  });

  return d1SchemaPromise;
}

async function withD1TableRepair<T>(db: D1Database, fn: () => Promise<T>): Promise<T> {
  await ensureD1Tables(db);
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

async function syncLessonsSheetsToD1(db: D1Database, sheets: Record<string, any[]>): Promise<void> {
  if (!db || !sheets) return;
  await ensureD1Tables(db);

  const stmts: D1PreparedStatement[] = [];

  if (Array.isArray(sheets.Lessons) && sheets.Lessons.length > 0) {
    for (const l of sheets.Lessons) {
      const id = String(l.id || l.lessonId || '').trim();
      if (!id) continue;
      stmts.push(
        db.prepare(`
          INSERT INTO lessons (id, course, category, categoryKey, categoryNum, title, chineseTitle, pinyin, meaning, level, description, videoUrl, posterUrl, fullAudio, keywords, accessType, price, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            course=excluded.course, category=excluded.category, categoryKey=excluded.categoryKey,
            categoryNum=excluded.categoryNum, title=excluded.title, chineseTitle=excluded.chineseTitle,
            pinyin=excluded.pinyin, meaning=excluded.meaning, level=excluded.level, description=excluded.description,
            videoUrl=excluded.videoUrl, posterUrl=excluded.posterUrl, fullAudio=excluded.fullAudio,
            keywords=excluded.keywords, accessType=excluded.accessType, price=excluded.price, updated_at=excluded.updated_at
        `).bind(
          id,
          l.course || 'HSK 2',
          l.category || l.course || 'HSK 2',
          l.categoryKey || l.category_key || 'hsk2',
          l.categoryNum || l.category_num || 'Course 1',
          l.title || id,
          l.chineseTitle || l.chinese_title || '',
          l.pinyin || '',
          l.meaning || '',
          l.level || 'HSK 2',
          l.description || '',
          l.videoUrl || l.video_url || '',
          l.posterUrl || l.poster_url || '',
          l.fullAudio || l.full_audio || '',
          l.keywords || '',
          l.accessType || l.access_type || 'paid',
          Number(l.price) || 0,
          new Date().toISOString()
        )
      );
    }
  }

  if (Array.isArray(sheets.Exercises) && sheets.Exercises.length > 0) {
    stmts.push(db.prepare(`DELETE FROM exercises`));
    for (let i = 0; i < sheets.Exercises.length; i++) {
      const ex = sheets.Exercises[i];
      stmts.push(
        db.prepare(`
          INSERT INTO exercises (lessonId, "order", type, groupId, groupTitle, pinyin, question, audioUrl, audioText, optionA, optionB, optionC, optionD, optionE, optionAImage, optionBImage, optionCImage, optionDImage, optionEImage, answer, explanation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          ex.lessonId || ex.lesson_id || 'hsk2-01',
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

  if (Array.isArray(sheets.Writing) && sheets.Writing.length > 0) {
    stmts.push(db.prepare(`DELETE FROM writing_characters`));
    for (let i = 0; i < sheets.Writing.length; i++) {
      const w = sheets.Writing[i];
      stmts.push(
        db.prepare(`
          INSERT INTO writing_characters (lessonId, "order", character, pinyin, meaning, strokeCount, radical, strokeAnimationUrl, svgPath, strokeOrderSteps)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          w.lessonId || w.lesson_id || 'hsk2-01',
          Number(w.order || w.order_num) || i + 1,
          w.character || '',
          w.pinyin || '',
          w.meaning || '',
          Number(w.strokeCount || w.stroke_count) || 6,
          w.radical || '',
          w.strokeAnimationUrl || w.stroke_animation_url || '',
          w.svgPath || w.svg_path || '',
          w.strokeOrderSteps || w.stroke_order_steps || ''
        )
      );
    }
  }

  if (Array.isArray(sheets.Vocabulary) && sheets.Vocabulary.length > 0) {
    stmts.push(db.prepare(`DELETE FROM vocabulary`));
    for (let i = 0; i < sheets.Vocabulary.length; i++) {
      const v = sheets.Vocabulary[i];
      stmts.push(
        db.prepare(`
          INSERT INTO vocabulary (lessonId, "order", character, pinyin, meaning, audio)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          v.lessonId || v.lesson_id || 'hsk2-01',
          Number(v.order || v.order_num) || i + 1,
          v.character || '',
          v.pinyin || '',
          v.meaning || '',
          v.audio || v.audio_url || ''
        )
      );
    }
  }

  if (Array.isArray(sheets.Pronunciation) && sheets.Pronunciation.length > 0) {
    stmts.push(db.prepare(`DELETE FROM pronunciation`));
    for (let i = 0; i < sheets.Pronunciation.length; i++) {
      const p = sheets.Pronunciation[i];
      stmts.push(
        db.prepare(`
          INSERT INTO pronunciation (lessonId, "order", chinese, pinyin, meaning, focus)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          p.lessonId || p.lesson_id || 'hsk2-01',
          Number(p.order || p.order_num) || i + 1,
          p.chinese || '',
          p.pinyin || '',
          p.meaning || '',
          p.focus || ''
        )
      );
    }
  }

  if (stmts.length > 0) {
    await withD1TableRepair(db, () => db.batch(stmts));
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
    stmts.push(db.prepare(`DELETE FROM stories_lessons`));
    for (const l of sheets.Lessons) {
      const id = String(l.id || l.lessonId || '').trim();
      if (!id) continue;
      stmts.push(
        db.prepare(`
          INSERT INTO stories_lessons (id, title, chineseTitle, pinyin, meaning, level, description, video, poster)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    await withD1TableRepair(db, () => db.batch(stmts));
  }
}

async function syncReelsSheetsToD1(db: D1Database, sheets: Record<string, any[]>): Promise<void> {
  if (!db || !sheets) return;
  await ensureD1Tables(db);
  assertSafeD1WorkbookSheets(sheets);

  const stmts: D1PreparedStatement[] = [];
  const videos = Array.isArray(sheets.Videos) ? sheets.Videos : null;

  if (videos) {
    stmts.push(db.prepare(`DELETE FROM reels_videos`));
    for (const v of videos) {
      const id = String(v.id || '').trim();
      if (!id) continue;
      stmts.push(
        db.prepare(`
          INSERT INTO reels_videos (id, type, holiday_id, title, video_path, thumbnail_path, duration_sec, status, text_cn, text_pinyin, text_en, text_my)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  }

  if (stmts.length > 0) {
    await withD1TableRepair(db, () => db.batch(stmts));
  }
}

async function getLessons(env: Env, url: URL): Promise<Response> {
  const level = url.searchParams.get('level');
  const accessType = url.searchParams.get('access_type');
  const category = url.searchParams.get('category');

  await ensureD1Tables(env.DB);

  let rawLessons = await all<Record<string, unknown>>(env.DB, `SELECT * FROM lessons ORDER BY rowid ASC`);
  if (!rawLessons.length) {
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', url.origin)));
      if (assetRes.ok) {
        const data = await assetRes.json<{ sheets?: { Lessons?: Record<string, unknown>[] } }>();
        if (data?.sheets?.Lessons) {
          rawLessons = data.sheets.Lessons;
          syncLessonsSheetsToD1(env.DB, data.sheets as any).catch(() => {});
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
  await ensureD1Tables(env.DB);
  const cleanId = String(id || '').trim();

  // Try D1 first
  let lessonRaw = await one<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM lessons WHERE id = ? OR id = ? OR id = ?`,
    cleanId,
    `lesson-${cleanId}`,
    cleanId.replace(/^lesson-/, '')
  );

  let vocabulary = (await all<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM vocabulary WHERE lessonId = ? OR lesson_id = ? ORDER BY "order" ASC`,
    cleanId,
    cleanId
  )).map(normalizeVocabularyRow);

  let exercises = (await all<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM exercises WHERE lessonId = ? OR lesson_id = ? ORDER BY "order" ASC`,
    cleanId,
    cleanId
  )).map(normalizeExerciseRow);

  let writingCharacters = (await all<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM writing_characters WHERE lessonId = ? OR lesson_id = ? ORDER BY "order" ASC`,
    cleanId,
    cleanId
  )).map(normalizeWritingRow);

  let pronunciation = (await all<Record<string, unknown>>(
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
  const domain = String(url.searchParams.get('domain') || 'lessons').toLowerCase();
  await ensureD1Tables(env.DB);

  if (domain === 'lessons') {
    let [rawLessons, rawExercises, rawWriting, rawVocab, rawGames, rawPron] = await Promise.all([
      all<Record<string, unknown>>(env.DB, `SELECT * FROM lessons ORDER BY rowid ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM exercises ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM writing_characters ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM vocabulary ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM games ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM pronunciation ORDER BY "order" ASC`)
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

      // Seed D1 in background
      syncLessonsSheetsToD1(env.DB, {
        Lessons: rawLessons,
        Exercises: rawExercises,
        Writing: rawWriting,
        Vocabulary: rawVocab,
        Games: rawGames,
        Pronunciation: rawPron
      }).catch(() => {});
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
      all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_lessons ORDER BY rowid ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM story_scenes ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_vocabulary ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_exercises ORDER BY "order" ASC`)
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
      all<Record<string, unknown>>(env.DB, `SELECT * FROM reels_videos ORDER BY rowid ASC`)
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
  await ensureD1Tables(env.DB);
  try {
    const body = (await request.json()) as any;
    const domain = String(body?.domain || 'lessons').toLowerCase();
    const sheets = body?.sheets;

    if (!sheets || typeof sheets !== 'object') {
      return fail('Invalid sheets payload');
    }

    if (domain === 'lessons') {
      await syncLessonsSheetsToD1(env.DB, sheets);
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
        }
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
  await ensureD1Tables(env.DB);
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
  const row = await withD1TableRepair(env.DB, () =>
    one<{ config_json: string; updated_at: string }>(
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

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Live write and sync routes
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (path === '/api/admin/upload-media/chunk') {
      try {
        return await handleWorkerChunkUploadPart(request, env, url);
      } catch (err: any) {
        return fail(err?.message || 'Chunk upload failed.', 500);
      }
    }
    if (path === '/api/admin/upload-media/abort') {
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
      try {
        return await handleWorkerChunkUploadInit(request, env);
      } catch (err: any) {
        return fail(err?.message || 'Chunk upload initialization failed.', 500);
      }
    }
    if (path === '/api/admin/upload-media/complete') {
      try {
        return await handleWorkerChunkUploadComplete(request, env);
      } catch (err: any) {
        return fail(err?.message || 'Chunk upload finalization failed.', 500);
      }
    }
    if (path === '/api/database/force-sync') {
      return handleForceDatabaseSync(request, env, url);
    }
    if (path === '/api/database/sync') {
      return handleDatabaseSync(request, env);
    }
    if (path === '/api/admin/upload-media') {
      try {
        return await handleWorkerMediaUpload(request, env);
      } catch (err: any) {
        return fail(err?.message || 'Media upload failed.', 500);
      }
    }
    if (path === '/api/admin/site-config' || path === '/api/site-config') {
      return handleWorkerSaveSiteConfig(request, env);
    }

    const adminWorkbookMatch = path.match(/^\/api\/admin\/workbook\/([^/]+)$/);
    if (adminWorkbookMatch) {
      try {
        const domain = decodeURIComponent(adminWorkbookMatch[1]).toLowerCase();
        const body = (await request.json()) as any;
        if (domain === 'lessons' && body?.sheets) {
          await syncLessonsSheetsToD1(env.DB, body.sheets);
        } else if (domain === 'stories' && body?.sheets) {
          await syncStoriesSheetsToD1(env.DB, body.sheets);
          await setD1Meta(env.DB, 'migration_stories_assets_v2', 'applied');
        } else if (domain === 'reels' && body?.sheets) {
          await syncReelsSheetsToD1(env.DB, body.sheets);
          await setD1Meta(env.DB, 'migration_reels_assets_v2', 'applied');
        }
        return json({
          success: true,
          syncedToServer: true,
          database: 'edu-hub-db',
          domain,
          sheets: body?.sheets || {}
        });
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
      all<{ id: string; filename: string; media_type: string; size_bytes: number; storage_mode: string; created_at: string }>(
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
    const row = await one<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM lessons`);
    return json({
      ok: true,
      status: 'healthy',
      database: 'edu-hub-db',
      lessons: row?.c ?? 0,
      maxUploadBytes: MAX_WORKER_UPLOAD_BYTES,
      storage: { d1: true, r2: Boolean(env.MEDIA_BUCKET) }
    });
  }

  if (path === '/api/database/status' || path === '/api/status') {
    return json({
      success: true,
      database: 'edu-hub-db',
      status: 'connected',
      maxUploadBytes: MAX_WORKER_UPLOAD_BYTES,
      storage: { d1: true, r2: Boolean(env.MEDIA_BUCKET) },
      tables: [
        'lessons',
        'exercises',
        'writing_characters',
        'vocabulary',
        'games',
        'pronunciation',
        'stories_lessons',
        'story_scenes',
        'stories_vocabulary',
        'stories_exercises',
        'reels_videos',
        'media_files',
        'media_chunks',
        'site_config',
        'd1_meta'
      ],
      timestamp: new Date().toISOString()
    });
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
      } catch (err) {
        console.error('API error', err);
        return fail('Internal server error', 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
