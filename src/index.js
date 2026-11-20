/**
 * Cloudflare Worker API & Static Asset Handler
 * Database: Cloudflare D1 (edu-hub-db) bound as env.DB
 * Tables (12):
 * - lessons
 * - exercises
 * - vocabulary
 * - writing_characters
 * - story_segments
 * - games
 * - reels_videos
 * - users
 * - subscription_requests
 * - user_subscriptions
 * - user_progress
 * - sqlite_sequence
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

async function safeAll(db, sql, params = []) {
  if (!db) return [];
  try {
    const stmt = params && params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const { results } = await stmt.all();
    return Array.isArray(results) ? results : [];
  } catch (err) {
    console.warn(`[Cloudflare D1 Query Note] ${sql}:`, err.message || err);
    return [];
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Handle preflight CORS requests
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const db = env && env.DB ? env.DB : null;

    // --- 1. Cloudflare D1 Database Health & Status Endpoint ---
    if (path === "/api/database/status" || path === "/api/status") {
      if (!db) {
        return jsonResponse({
          success: false,
          database: "edu-hub-db",
          status: "unbound",
          message: "env.DB is not bound. Bind D1 database named 'edu-hub-db' in wrangler.toml.",
        }, 503);
      }

      try {
        const tableCheck = await safeAll(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC");
        const tableNames = tableCheck.map((t) => t.name);
        return jsonResponse({
          success: true,
          database: "edu-hub-db",
          status: "connected",
          tables: tableNames,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          database: "edu-hub-db",
          status: "error",
          error: err.message || String(err),
        }, 500);
      }
    }

    // --- 2. Composite Domain Bundle Endpoint for Frontend Content Stores ---
    // GET /api/database/bundle?domain=lessons|stories|reels|all
    if (path === "/api/database/bundle" || path === "/api/bundle") {
      if (!db) {
        return jsonResponse({
          success: false,
          error: "D1 database not bound to env.DB",
          source: "unbound",
        }, 503);
      }

      const domain = (url.searchParams.get("domain") || "all").toLowerCase();

      try {
        if (domain === "lessons") {
          const [lessons, vocab, writing, exercises, games] = await Promise.all([
            safeAll(db, "SELECT * FROM lessons ORDER BY rowid ASC"),
            safeAll(db, "SELECT * FROM vocabulary ORDER BY rowid ASC"),
            safeAll(db, "SELECT * FROM writing_characters ORDER BY rowid ASC"),
            safeAll(db, "SELECT * FROM exercises ORDER BY rowid ASC"),
            safeAll(db, "SELECT * FROM games ORDER BY rowid ASC"),
          ]);

          return jsonResponse({
            success: true,
            source: "cloudflare-d1",
            database: "edu-hub-db",
            domain: "lessons",
            sheets: {
              Lessons: lessons,
              Vocabulary: vocab,
              Writing: writing,
              Exercises: exercises,
              Games: games,
              Pronunciation: [],
            },
          }, 200, { "Cache-Control": "public, max-age=60" });
        }

        if (domain === "stories") {
          const [stories, vocab, exercises] = await Promise.all([
            safeAll(db, "SELECT * FROM story_segments ORDER BY rowid ASC"),
            safeAll(db, "SELECT * FROM vocabulary ORDER BY rowid ASC"),
            safeAll(db, "SELECT * FROM exercises ORDER BY rowid ASC"),
          ]);

          // Derive distinct story lesson rows
          const lessonMap = new Map();
          stories.forEach((s) => {
            const id = s.lessonId || s.id;
            if (id && !lessonMap.has(id)) {
              lessonMap.set(id, {
                id,
                title: s.title || `Story ${id}`,
                chineseTitle: s.chineseTitle || s.chinese || "",
                pinyin: s.pinyin || "",
                meaning: s.meaning || s.english || "",
                level: s.level || "Elementary",
                description: s.description || "",
                video: s.video || "",
                poster: s.poster || s.image || "",
              });
            }
          });

          return jsonResponse({
            success: true,
            source: "cloudflare-d1",
            database: "edu-hub-db",
            domain: "stories",
            sheets: {
              Lessons: Array.from(lessonMap.values()),
              Story: stories,
              Vocabulary: vocab,
              Exercises: exercises,
            },
          }, 200, { "Cache-Control": "public, max-age=60" });
        }

        if (domain === "reels") {
          const reels = await safeAll(db, "SELECT * FROM reels_videos ORDER BY rowid ASC");
          return jsonResponse({
            success: true,
            source: "cloudflare-d1",
            database: "edu-hub-db",
            domain: "reels",
            sheets: {
              Videos: reels,
            },
          }, 200, { "Cache-Control": "public, max-age=60" });
        }

        // Default: All 12 tables bundle
        const [
          lessons,
          exercises,
          vocabulary,
          writingCharacters,
          storySegments,
          games,
          reelsVideos,
          users,
          subscriptionRequests,
          userSubscriptions,
          userProgress,
        ] = await Promise.all([
          safeAll(db, "SELECT * FROM lessons ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM exercises ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM vocabulary ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM writing_characters ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM story_segments ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM games ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM reels_videos ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM users ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM subscription_requests ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM user_subscriptions ORDER BY rowid ASC"),
          safeAll(db, "SELECT * FROM user_progress ORDER BY rowid ASC"),
        ]);

        return jsonResponse({
          success: true,
          source: "cloudflare-d1",
          database: "edu-hub-db",
          data: {
            lessons,
            exercises,
            vocabulary,
            writing_characters: writingCharacters,
            story_segments: storySegments,
            games,
            reels_videos: reelsVideos,
            users,
            subscription_requests: subscriptionRequests,
            user_subscriptions: userSubscriptions,
            user_progress: userProgress,
          },
        }, 200, { "Cache-Control": "public, max-age=60" });
      } catch (err) {
        return jsonResponse({
          success: false,
          source: "cloudflare-d1",
          error: err.message || String(err),
        }, 500);
      }
    }

    // --- 3. Individual Table Endpoints ---
    const TABLE_ROUTES = {
      "/api/lessons": "SELECT * FROM lessons ORDER BY rowid ASC",
      "/api/exercises": "SELECT * FROM exercises ORDER BY rowid ASC",
      "/api/vocabulary": "SELECT * FROM vocabulary ORDER BY rowid ASC",
      "/api/writing": "SELECT * FROM writing_characters ORDER BY rowid ASC",
      "/api/writing_characters": "SELECT * FROM writing_characters ORDER BY rowid ASC",
      "/api/stories": "SELECT * FROM story_segments ORDER BY rowid ASC",
      "/api/story_segments": "SELECT * FROM story_segments ORDER BY rowid ASC",
      "/api/games": "SELECT * FROM games ORDER BY rowid ASC",
      "/api/reels": "SELECT * FROM reels_videos ORDER BY rowid ASC",
      "/api/reels_videos": "SELECT * FROM reels_videos ORDER BY rowid ASC",
      "/api/users": "SELECT * FROM users ORDER BY rowid ASC",
      "/api/subscriptions": "SELECT * FROM subscription_requests ORDER BY rowid ASC",
      "/api/subscription_requests": "SELECT * FROM subscription_requests ORDER BY rowid ASC",
      "/api/user_subscriptions": "SELECT * FROM user_subscriptions ORDER BY rowid ASC",
      "/api/progress": "SELECT * FROM user_progress ORDER BY rowid ASC",
      "/api/user_progress": "SELECT * FROM user_progress ORDER BY rowid ASC",
    };

    if (TABLE_ROUTES[path]) {
      if (!db) {
        return jsonResponse({
          success: false,
          error: "D1 database not bound to env.DB",
        }, 503);
      }

      const results = await safeAll(db, TABLE_ROUTES[path]);
      return jsonResponse(results, 200, {
        "Cache-Control": "public, max-age=120",
      });
    }

    // --- 4. Static Asset Passthrough via Cloudflare Workers Assets ---
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
