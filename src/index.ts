/**
 * edu-learning-hub — Cloudflare Worker
 *
 * Database-first curriculum retrieval with static asset (Excel/JSON) fallback,
 * backed by Cloudflare D1 (binding: DB) and ASSETS binding.
 */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function fail(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status);
}

async function one<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  try {
    return await db.prepare(sql).bind(...params).first<T>();
  } catch (_) {
    return null;
  }
}

async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  try {
    const { results } = await db.prepare(sql).bind(...params).all<T>();
    return results ?? [];
  } catch (_) {
    return [];
  }
}

async function getLessons(env: Env, url: URL): Promise<Response> {
  const level = url.searchParams.get('level');
  const accessType = url.searchParams.get('access_type');
  const category = url.searchParams.get('category');

  const where: string[] = [];
  const params: unknown[] = [];

  if (level) {
    where.push('level = ?');
    params.push(level);
  }
  if (accessType) {
    where.push('access_type = ?');
    params.push(accessType);
  }
  if (category) {
    where.push('category_key = ?');
    params.push(category);
  }

  const sql = `
    SELECT id, course, category, category_key, category_num,
           title, chinese_title, pinyin, meaning, level, description,
           video_url, poster_url, full_audio, keywords, access_type, price,
           updated_at
    FROM lessons
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY category_num, title
  `;

  let lessons = await all<Record<string, unknown>>(env.DB, sql, ...params);
  if (!lessons.length) {
    // Fallback to static JSON asset if D1 is uninitialized or empty
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', url.origin)));
      if (assetRes.ok) {
        const data = await assetRes.json<{ sheets?: { Lessons?: Record<string, unknown>[] } }>();
        if (data?.sheets?.Lessons) {
          lessons = data.sheets.Lessons;
        }
      }
    } catch (_) {}
  }

  return json({ ok: true, lessons });
}

async function getLessonDetail(env: Env, id: string): Promise<Response> {
  const lesson = await one<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM lessons WHERE id = ?`,
    id,
  );

  if (!lesson) {
    // Try fallback from static JSON
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', url.origin)));
      if (assetRes.ok) {
        const data = await assetRes.json<{ sheets?: { Lessons?: Record<string, unknown>[]; Exercises?: Record<string, unknown>[]; Writing?: Record<string, unknown>[]; Vocabulary?: Record<string, unknown>[]; Pronunciation?: Record<string, unknown>[] } }>();
        const found = (data?.sheets?.Lessons || []).find((l) => String(l.id || '').toLowerCase() === String(id).toLowerCase());
        if (found) {
          const lid = String(found.id);
          return json({
            ok: true,
            lesson: found,
            vocabulary: (data?.sheets?.Vocabulary || []).filter((v) => String(v.lessonId || '').toLowerCase() === lid.toLowerCase()),
            exercises: (data?.sheets?.Exercises || []).filter((e) => String(e.lessonId || '').toLowerCase() === lid.toLowerCase()),
            story_segments: [],
            writing_characters: (data?.sheets?.Writing || []).filter((w) => String(w.lessonId || '').toLowerCase() === lid.toLowerCase()),
            pronunciation: (data?.sheets?.Pronunciation || []).filter((p) => String(p.lessonId || '').toLowerCase() === lid.toLowerCase()),
          });
        }
      }
    } catch (_) {}
    return fail('Lesson not found', 404);
  }

  const [vocabulary, exercises, storySegments, writingCharacters, pronunciation] = await Promise.all([
    all(env.DB, `SELECT * FROM vocabulary WHERE lesson_id = ? ORDER BY sort_order`, id),
    all(env.DB, `SELECT * FROM exercises WHERE lesson_id = ? ORDER BY sort_order`, id),
    all(env.DB, `SELECT * FROM story_segments WHERE lesson_id = ? ORDER BY sort_order`, id),
    all(env.DB, `SELECT * FROM writing_characters WHERE lesson_id = ? ORDER BY sort_order`, id),
    all(env.DB, `SELECT * FROM pronunciation WHERE lesson_id = ? ORDER BY sort_order`, id),
  ]);

  return json({
    ok: true,
    lesson,
    vocabulary,
    exercises,
    story_segments: storySegments,
    writing_characters: writingCharacters,
    pronunciation,
  });
}

async function getDatabaseBundle(env: Env, url: URL): Promise<Response> {
  const domain = String(url.searchParams.get('domain') || 'lessons').toLowerCase();

  if (domain === 'lessons') {
    let Lessons = await all<Record<string, unknown>>(env.DB, `SELECT * FROM lessons`);
    let Exercises = await all<Record<string, unknown>>(env.DB, `SELECT * FROM exercises`);
    let Writing = await all<Record<string, unknown>>(env.DB, `SELECT * FROM writing_characters`);
    let Vocabulary = await all<Record<string, unknown>>(env.DB, `SELECT * FROM vocabulary`);
    let Games = await all<Record<string, unknown>>(env.DB, `SELECT * FROM games`);
    let Pronunciation = await all<Record<string, unknown>>(env.DB, `SELECT * FROM pronunciation`);

    if (!Lessons.length) {
      try {
        const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', url.origin)));
        if (assetRes.ok) {
          const data = await assetRes.json<{ sheets?: { Lessons?: Record<string, unknown>[]; Exercises?: Record<string, unknown>[]; Writing?: Record<string, unknown>[]; Vocabulary?: Record<string, unknown>[]; Games?: Record<string, unknown>[]; Pronunciation?: Record<string, unknown>[] } }>();
          if (data?.sheets) {
            Lessons = data.sheets.Lessons || [];
            Exercises = data.sheets.Exercises || [];
            Writing = data.sheets.Writing || [];
            Vocabulary = data.sheets.Vocabulary || [];
            Games = data.sheets.Games || [];
            Pronunciation = data.sheets.Pronunciation || [];
          }
        }
      } catch (_) {}
    }

    return json({
      success: true,
      database: 'edu-hub-db',
      source: 'cloudflare-d1',
      domain: 'lessons',
      sheets: { Lessons, Exercises, Writing, Vocabulary, Games, Pronunciation }
    });
  }

  if (domain === 'stories') {
    let Lessons = await all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_lessons`);
    let Story = await all<Record<string, unknown>>(env.DB, `SELECT * FROM story_scenes`);
    let Vocabulary = await all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_vocabulary`);
    let Exercises = await all<Record<string, unknown>>(env.DB, `SELECT * FROM stories_exercises`);

    if (!Lessons.length) {
      try {
        const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/stories.json', url.origin)));
        if (assetRes.ok) {
          const data = await assetRes.json<{ sheets?: { Lessons?: Record<string, unknown>[]; Story?: Record<string, unknown>[]; Vocabulary?: Record<string, unknown>[]; Exercises?: Record<string, unknown>[] } }>();
          if (data?.sheets) {
            Lessons = data.sheets.Lessons || [];
            Story = data.sheets.Story || [];
            Vocabulary = data.sheets.Vocabulary || [];
            Exercises = data.sheets.Exercises || [];
          }
        }
      } catch (_) {}
    }

    return json({
      success: true,
      database: 'edu-hub-db',
      source: 'cloudflare-d1',
      domain: 'stories',
      sheets: { Lessons, Story, Vocabulary, Exercises }
    });
  }

  if (domain === 'reels') {
    let Videos = await all<Record<string, unknown>>(env.DB, `SELECT * FROM reels_videos`);
    if (!Videos.length) {
      try {
        const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/reels_stories.json', url.origin)));
        if (assetRes.ok) {
          const data = await assetRes.json<{ sheets?: { Videos?: Record<string, unknown>[] } }>();
          if (data?.sheets?.Videos) {
            Videos = data.sheets.Videos;
          }
        }
      } catch (_) {}
    }

    return json({
      success: true,
      database: 'edu-hub-db',
      source: 'cloudflare-d1',
      domain: 'reels',
      sheets: { Videos }
    });
  }

  return fail('Unknown domain', 400);
}

async function getGames(env: Env, url: URL): Promise<Response> {
  let games = await all<Record<string, unknown>>(
    env.DB,
    `SELECT id, sort_order AS "order", title, category, badge, description,
            embed_code, embed_url, width, height, active
     FROM games
     WHERE active = 1 OR active = 'TRUE'
     ORDER BY sort_order`,
  );
  if (!games.length) {
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/lessons.json', url.origin)));
      if (assetRes.ok) {
        const data = await assetRes.json<{ sheets?: { Games?: Record<string, unknown>[] } }>();
        if (data?.sheets?.Games) {
          games = data.sheets.Games;
        }
      }
    } catch (_) {}
  }
  return json({ ok: true, games });
}

async function getReels(env: Env, url: URL): Promise<Response> {
  const holidayId = url.searchParams.get('holiday_id');
  const sql = holidayId
    ? `SELECT * FROM reels_videos WHERE status = 'active' AND holiday_id = ? ORDER BY title`
    : `SELECT * FROM reels_videos WHERE status = 'active' ORDER BY holiday_id, title`;
  const params = holidayId ? [holidayId] : [];
  let reels = await all<Record<string, unknown>>(env.DB, sql, ...params);
  if (!reels.length) {
    try {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/reels_stories.json', url.origin)));
      if (assetRes.ok) {
        const data = await assetRes.json<{ sheets?: { Videos?: Record<string, unknown>[] } }>();
        if (data?.sheets?.Videos) {
          reels = data.sheets.Videos.filter((v) => holidayId ? String(v.holiday_id || '').toLowerCase() === String(holidayId).toLowerCase() : true);
        }
      }
    } catch (_) {}
  }
  return json({ ok: true, reels });
}

async function getHealth(env: Env): Promise<Response> {
  const row = await one<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM lessons`);
  return json({ ok: true, status: 'healthy', database: 'edu-hub-db', lessons: row?.c ?? 0 });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  const method = request.method;

  if (method !== 'GET' && method !== 'HEAD') {
    return fail('Method not allowed', 405);
  }

  if (path === '/api' || path === '/api/health') return getHealth(env);
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
  if (path === '/api/games') return getGames(env, url);
  if (path === '/api/reels') return getReels(env, url);

  const lessonDetail = path.match(/^\/api\/lessons\/([^/]+)$/);
  if (lessonDetail) return getLessonDetail(env, decodeURIComponent(lessonDetail[1]));

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
