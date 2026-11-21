/**
 * edu-learning-hub — Cloudflare Worker
 *
 * Database-first curriculum retrieval with automatic DB-vs-Excel/JSON auto-reconciliation,
 * live Admin writes, and Cloudflare D1 (binding: DB) + ASSETS binding.
 */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
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

async function one<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  if (!db) return null;
  try {
    return await db.prepare(sql).bind(...params).first<T>();
  } catch (err) {
    return null;
  }
}

async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  if (!db) return [];
  try {
    const { results } = await db.prepare(sql).bind(...params).all<T>();
    return results ?? [];
  } catch (err) {
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

async function ensureD1Tables(db: D1Database): Promise<void> {
  if (!db) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        course TEXT,
        category TEXT,
        categoryKey TEXT,
        categoryNum TEXT,
        title TEXT,
        chineseTitle TEXT,
        pinyin TEXT,
        meaning TEXT,
        level TEXT,
        description TEXT,
        videoUrl TEXT,
        posterUrl TEXT,
        fullAudio TEXT,
        keywords TEXT,
        accessType TEXT,
        price REAL,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId TEXT,
        "order" INTEGER,
        type TEXT,
        groupId TEXT,
        groupTitle TEXT,
        pinyin TEXT,
        question TEXT,
        audioUrl TEXT,
        optionA TEXT,
        optionB TEXT,
        optionC TEXT,
        optionD TEXT,
        optionE TEXT,
        optionAImage TEXT,
        optionBImage TEXT,
        optionCImage TEXT,
        optionDImage TEXT,
        optionEImage TEXT,
        answer TEXT,
        explanation TEXT
      );
      CREATE TABLE IF NOT EXISTS writing_characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId TEXT,
        "order" INTEGER,
        character TEXT,
        pinyin TEXT,
        meaning TEXT,
        strokeCount INTEGER,
        radical TEXT,
        strokeAnimationUrl TEXT,
        svgPath TEXT,
        strokeOrderSteps TEXT
      );
      CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId TEXT,
        "order" INTEGER,
        character TEXT,
        pinyin TEXT,
        meaning TEXT,
        audio TEXT
      );
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        "order" INTEGER,
        title TEXT,
        category TEXT,
        badge TEXT,
        description TEXT,
        embed_code TEXT,
        embed_url TEXT,
        width INTEGER,
        height INTEGER,
        active TEXT
      );
      CREATE TABLE IF NOT EXISTS pronunciation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId TEXT,
        "order" INTEGER,
        chinese TEXT,
        pinyin TEXT,
        meaning TEXT,
        focus TEXT
      );
      CREATE TABLE IF NOT EXISTS stories_lessons (
        id TEXT PRIMARY KEY,
        title TEXT,
        chineseTitle TEXT,
        pinyin TEXT,
        meaning TEXT,
        level TEXT,
        description TEXT,
        video TEXT,
        poster TEXT
      );
      CREATE TABLE IF NOT EXISTS story_scenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId TEXT,
        "order" INTEGER,
        chinese TEXT,
        pinyin TEXT,
        english TEXT,
        image TEXT,
        audio TEXT
      );
      CREATE TABLE IF NOT EXISTS stories_vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId TEXT,
        "order" INTEGER,
        character TEXT,
        pinyin TEXT,
        meaning TEXT,
        audio TEXT
      );
      CREATE TABLE IF NOT EXISTS stories_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId TEXT,
        "order" INTEGER,
        type TEXT,
        groupId TEXT,
        groupTitle TEXT,
        pinyin TEXT,
        question TEXT,
        audioUrl TEXT,
        optionA TEXT,
        optionB TEXT,
        optionC TEXT,
        optionD TEXT,
        optionE TEXT,
        optionAImage TEXT,
        optionBImage TEXT,
        optionCImage TEXT,
        optionDImage TEXT,
        optionEImage TEXT,
        answer TEXT,
        explanation TEXT
      );
      CREATE TABLE IF NOT EXISTS reels_videos (
        id TEXT PRIMARY KEY,
        type TEXT,
        holiday_id TEXT,
        title TEXT,
        video_path TEXT,
        thumbnail_path TEXT,
        duration_sec INTEGER,
        status TEXT,
        text_cn TEXT,
        text_pinyin TEXT,
        text_en TEXT,
        text_my TEXT
      );
    `);
  } catch (err) {
    console.warn('ensureD1Tables warning:', err);
  }
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
          INSERT INTO exercises (lessonId, "order", type, groupId, groupTitle, pinyin, question, audioUrl, optionA, optionB, optionC, optionD, optionE, optionAImage, optionBImage, optionCImage, optionDImage, optionEImage, answer, explanation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          ex.lessonId || ex.lesson_id || 'hsk2-01',
          Number(ex.order || ex.order_num) || i + 1,
          ex.type || 'multiple-choice',
          ex.groupId || ex.group_id || '',
          ex.groupTitle || ex.group_title || '',
          ex.pinyin || '',
          ex.question || '',
          ex.audioUrl || ex.audio_url || '',
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
    try {
      await db.batch(stmts);
    } catch (e) {
      console.warn('Batch execution error in D1:', e);
    }
  }
}

async function syncStoriesSheetsToD1(db: D1Database, sheets: Record<string, any[]>): Promise<void> {
  if (!db || !sheets) return;
  await ensureD1Tables(db);

  const stmts: D1PreparedStatement[] = [];

  if (Array.isArray(sheets.Lessons) && sheets.Lessons.length > 0) {
    for (const l of sheets.Lessons) {
      const id = String(l.id || l.lessonId || '').trim();
      if (!id) continue;
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
          l.level || 'HSK 1-2',
          l.description || '',
          l.video || l.videoUrl || '',
          l.poster || l.posterUrl || ''
        )
      );
    }
  }

  if (Array.isArray(sheets.Story) && sheets.Story.length > 0) {
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

  if (Array.isArray(sheets.Vocabulary) && sheets.Vocabulary.length > 0) {
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

  if (Array.isArray(sheets.Exercises) && sheets.Exercises.length > 0) {
    stmts.push(db.prepare(`DELETE FROM stories_exercises`));
    for (let i = 0; i < sheets.Exercises.length; i++) {
      const ex = sheets.Exercises[i];
      stmts.push(
        db.prepare(`
          INSERT INTO stories_exercises (lessonId, "order", type, groupId, groupTitle, pinyin, question, audioUrl, optionA, optionB, optionC, optionD, optionE, optionAImage, optionBImage, optionCImage, optionDImage, optionEImage, answer, explanation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          ex.lessonId || ex.lesson_id || 'lesson-01',
          Number(ex.order || ex.order_num) || i + 1,
          ex.type || 'multiple-choice',
          ex.groupId || ex.group_id || '',
          ex.groupTitle || ex.group_title || '',
          ex.pinyin || '',
          ex.question || '',
          ex.audioUrl || ex.audio_url || '',
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
    try {
      await db.batch(stmts);
    } catch (e) {
      console.warn('Batch execution error in D1 (stories):', e);
    }
  }
}

async function syncReelsSheetsToD1(db: D1Database, sheets: Record<string, any[]>): Promise<void> {
  if (!db || !sheets) return;
  await ensureD1Tables(db);

  const stmts: D1PreparedStatement[] = [];
  const videos = Array.isArray(sheets.Videos) ? sheets.Videos : [];

  if (videos.length > 0) {
    for (const v of videos) {
      const id = String(v.id || '').trim();
      if (!id) continue;
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
  }

  if (stmts.length > 0) {
    try {
      await db.batch(stmts);
    } catch (e) {
      console.warn('Batch execution error in D1 (reels):', e);
    }
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
    let [rawLessons, rawStory, rawVocab, rawExercises] = await Promise.all([
      all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_lessons ORDER BY rowid ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM story_scenes ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_vocabulary ORDER BY "order" ASC`),
      all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_exercises ORDER BY "order" ASC`)
    ]);

    let staticData: any = null;
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/stories.json', url.origin)));
      if (assetRes.ok) {
        staticData = await assetRes.json();
      }
    } catch (_) {}

    const staticSheets = staticData?.sheets || {};
    const d1RowCount = rawLessons.length + rawStory.length + rawVocab.length + rawExercises.length;
    const staticRowCount =
      (staticSheets.Lessons?.length || 0) +
      (staticSheets.Story?.length || 0) +
      (staticSheets.Vocabulary?.length || 0) +
      (staticSheets.Exercises?.length || 0);

    if (staticRowCount > 0 && (d1RowCount === 0 || staticRowCount > d1RowCount)) {
      if (staticSheets.Lessons?.length) rawLessons = staticSheets.Lessons;
      if (staticSheets.Story?.length) rawStory = staticSheets.Story;
      if (staticSheets.Vocabulary?.length) rawVocab = staticSheets.Vocabulary;
      if (staticSheets.Exercises?.length) rawExercises = staticSheets.Exercises;

      syncStoriesSheetsToD1(env.DB, {
        Lessons: rawLessons,
        Story: rawStory,
        Vocabulary: rawVocab,
        Exercises: rawExercises
      }).catch(() => {});
    }

    return json({
      success: true,
      database: 'edu-hub-db',
      source: 'cloudflare-d1',
      domain: 'stories',
      counts: {
        lessons: rawLessons.length,
        story: rawStory.length,
        vocabulary: rawVocab.length,
        exercises: rawExercises.length
      },
      sheets: {
        Lessons: rawLessons,
        Story: rawStory,
        Vocabulary: rawVocab,
        Exercises: rawExercises.map(normalizeExerciseRow)
      }
    });
  }

  if (domain === 'reels') {
    let rawVideos = await all<Record<string, unknown>>(env.DB, `SELECT * FROM reels_videos ORDER BY rowid ASC`);
    let staticData: any = null;
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/reels_stories.json', url.origin)));
      if (assetRes.ok) {
        staticData = await assetRes.json();
      }
    } catch (_) {}

    const staticVideos = staticData?.sheets?.Videos || [];
    if (staticVideos.length > 0 && (rawVideos.length === 0 || staticVideos.length > rawVideos.length)) {
      rawVideos = staticVideos;
      syncReelsSheetsToD1(env.DB, { Videos: staticVideos }).catch(() => {});
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
        }
      });
    }

    if (domain === 'reels') {
      await syncReelsSheetsToD1(env.DB, sheets);
      return json({
        success: true,
        syncedToServer: true,
        database: 'edu-hub-db',
        domain: 'reels',
        counts: {
          videos: sheets.Videos?.length || 0
        }
      });
    }

    return json({ success: true, syncedToServer: true, database: 'edu-hub-db', domain });
  } catch (err: any) {
    return fail(err?.message || 'Sync failed', 500);
  }
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Live write and sync routes
  if (method === 'POST' || method === 'PUT') {
    if (path === '/api/database/sync') {
      return handleDatabaseSync(request, env);
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
        } else if (domain === 'reels' && body?.sheets) {
          await syncReelsSheetsToD1(env.DB, body.sheets);
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
  if (path === '/api' || path === '/api/health') {
    const row = await one<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM lessons`);
    return json({ ok: true, status: 'healthy', database: 'edu-hub-db', lessons: row?.c ?? 0 });
  }

  if (path === '/api/database/status' || path === '/api/status') {
    return json({
      success: true,
      database: 'edu-hub-db',
      status: 'connected',
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
