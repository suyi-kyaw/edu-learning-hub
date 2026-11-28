-- JiedeEdu Cloudflare D1 Reference Schema (edu-hub-db)
-- Tables are also auto-created safely at runtime by src/index.ts via db.batch(),
-- or you can run: npx wrangler d1 execute edu-hub-db --remote --file=./schema.sql

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
  practicePrice REAL,
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
  audioText TEXT,
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
  audioText TEXT,
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

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  filename TEXT,
  mime_type TEXT,
  media_type TEXT,
  size_bytes INTEGER,
  chunk_size INTEGER,
  chunk_count INTEGER,
  storage_mode TEXT DEFAULT 'd1',
  object_key TEXT DEFAULT '',
  upload_id TEXT DEFAULT '',
  status TEXT DEFAULT 'ready',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS media_chunks (
  media_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data_b64 TEXT NOT NULL,
  PRIMARY KEY (media_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS site_config (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS d1_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  phoneNumber TEXT DEFAULT '',
  dob TEXT DEFAULT '',
  role TEXT DEFAULT 'student',
  membershipStatus TEXT DEFAULT 'free',
  membershipPlan TEXT DEFAULT 'none',
  membershipExpiresAt TEXT DEFAULT '',
  subscribedLessonIds TEXT DEFAULT '[]',
  subscribedCourses TEXT DEFAULT '[]',
  practiceLessonIds TEXT DEFAULT '[]',
  practiceCourses TEXT DEFAULT '[]',
  linkedProviders TEXT DEFAULT '["password"]',
  mustChangePassword INTEGER DEFAULT 0,
  passwordSalt TEXT DEFAULT '',
  passwordHash TEXT DEFAULT '',
  password_salt TEXT DEFAULT '',
  password_hash TEXT DEFAULT '',
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS subscription_requests (
  requestId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  username TEXT,
  userEmail TEXT,
  userPhone TEXT,
  planType TEXT,
  lessonId TEXT DEFAULT '',
  courseName TEXT DEFAULT '',
  lessonTitle TEXT DEFAULT '',
  amountLabel TEXT DEFAULT '',
  contactChannel TEXT DEFAULT 'viber',
  contactHandle TEXT DEFAULT '',
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  adminNote TEXT DEFAULT '',
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS user_progress (
  uid TEXT PRIMARY KEY,
  currentStreak INTEGER DEFAULT 0,
  bestStreak INTEGER DEFAULT 0,
  lastCompletedDate TEXT DEFAULT '',
  streakDates TEXT DEFAULT '[]',
  completedLessonIds TEXT DEFAULT '[]',
  reminderEnabled INTEGER DEFAULT 1,
  reminderTime TEXT DEFAULT '18:00',
  lastNotifiedDate TEXT DEFAULT '',
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS lesson_catalog (
  lessonId TEXT PRIMARY KEY,
  title TEXT,
  course TEXT,
  audience TEXT DEFAULT 'Adult',
  accessType TEXT DEFAULT 'free',
  price REAL DEFAULT 0,
  practicePrice REAL DEFAULT 0,
  hasExercises INTEGER DEFAULT 1,
  updatedBy TEXT DEFAULT '',
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS d1_workbooks (
  name TEXT PRIMARY KEY,
  xlsx_b64 TEXT NOT NULL,
  row_count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

