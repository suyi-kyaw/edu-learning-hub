/**
 * edu-learning-hub — Cloudflare Worker
 *
 * Serves the static site via the ASSETS binding and exposes a JSON API
 * backed by the D1 database (binding: DB).
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
  return await db.prepare(sql).bind(...params).first<T>();
}

async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const { results } = await db.prepare(sql).bind(...params).all<T>();
  return results ?? [];
}

/* ------------------------------------------------------------------ */
/* Route handlers                                                      */
/* ------------------------------------------------------------------ */

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
    SELECT id, content_type, audience, category, category_key, category_num,
           title, chinese_title, pinyin, meaning, level, description,
           video_url, poster_url, full_audio, keywords, access_type, price,
           updated_at
    FROM lessons
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY category_num, title
  `;

  return json({ ok: true, lessons: await all(env.DB, sql, ...params) });
}

async function getLessonDetail(env: Env, id: string): Promise<Response> {
  const lesson = await one<Record<string, unknown>>(
    env.DB,
    `SELECT * FROM lessons WHERE id = ?`,
    id,
  );

  if (!lesson) return fail('Lesson not found', 404);

  const [vocabulary, exercises, storySegments, writingCharacters] = await Promise.all([
    all(env.DB, `SELECT * FROM vocabulary WHERE lesson_id = ? ORDER BY sort_order`, id),
    all(env.DB, `SELECT * FROM exercises WHERE lesson_id = ? ORDER BY sort_order`, id),
    all(env.DB, `SELECT * FROM story_segments WHERE lesson_id = ? ORDER BY sort_order`, id),
    all(env.DB, `SELECT * FROM writing_characters WHERE lesson_id = ? ORDER BY sort_order`, id),
  ]);

  return json({
    ok: true,
    lesson,
    vocabulary,
    exercises,
    story_segments: storySegments,
    writing_characters: writingCharacters,
  });
}

async function getGames(env: Env): Promise<Response> {
  const games = await all(
    env.DB,
    `SELECT id, sort_order, title, category, badge, description,
            embed_code, embed_url, width, height
     FROM games
     WHERE active = 1
     ORDER BY sort_order`,
  );
  return json({ ok: true, games });
}

async function getReels(env: Env, url: URL): Promise<Response> {
  const holidayId = url.searchParams.get('holiday_id');
  const sql = holidayId
    ? `SELECT * FROM reels_videos WHERE status = 'active' AND holiday_id = ? ORDER BY title`
    : `SELECT * FROM reels_videos WHERE status = 'active' ORDER BY holiday_id, title`;
  const params = holidayId ? [holidayId] : [];
  return json({ ok: true, reels: await all(env.DB, sql, ...params) });
}

async function getVocabulary(env: Env, lessonId: string): Promise<Response> {
  return json({
    ok: true,
    vocabulary: await all(
      env.DB,
      `SELECT * FROM vocabulary WHERE lesson_id = ? ORDER BY sort_order`,
      lessonId,
    ),
  });
}

async function getHealth(env: Env): Promise<Response> {
  const row = await one<{ c: number }>(env.DB, `SELECT COUNT(*) AS c FROM lessons`);
  return json({ ok: true, status: 'healthy', lessons: row?.c ?? 0 });
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  const method = request.method;

  if (method !== 'GET' && method !== 'HEAD') {
    return fail('Method not allowed', 405);
  }

  if (path === '/api' || path === '/api/health') return getHealth(env);
  if (path === '/api/lessons') return getLessons(env, url);
  if (path === '/api/games') return getGames(env);
  if (path === '/api/reels') return getReels(env, url);

  const lessonDetail = path.match(/^\/api\/lessons\/([^/]+)$/);
  if (lessonDetail) return getLessonDetail(env, decodeURIComponent(lessonDetail[1]));

  const vocab = path.match(/^\/api\/lessons\/([^/]+)\/vocabulary$/);
  if (vocab) return getVocabulary(env, decodeURIComponent(vocab[1]));

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

    // Everything else is a static asset.
    return env.ASSETS.fetch(request);
  },
};
