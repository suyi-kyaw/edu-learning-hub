/**
 * =========================================================
 * JIEDEEDU - STATIC EXCEL-BACKED AUTHENTICATION & CMS CLIENT
 * Reads data/users.xlsx directly in the browser using SheetJS,
 * compares salted SHA-256 hashes or plain-text Excel edits,
 * overlays local browser registrations/progress, and lets the
 * Admin export/import updated users.xlsx workbooks with zero
 * Node server or Firebase dependency.
 * =========================================================
 */

export interface AuthUserSummary {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  mustChangePassword?: boolean;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  phoneNumber: string;
  dob: string;
  role: 'student' | 'admin';
  membershipStatus: 'free' | 'pending' | 'active' | 'expired';
  membershipPlan: 'none' | 'monthly' | 'annual' | 'per_lesson';
  membershipExpiresAt: string;
  subscribedLessonIds: string[];
  linkedProviders: string[];
  mustChangePassword?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SubscriptionRequest {
  requestId: string;
  userId: string;
  username: string;
  userEmail: string;
  userPhone: string;
  planType: 'monthly' | 'annual' | 'per_lesson';
  lessonId: string;
  lessonTitle: string;
  amountLabel: string;
  contactChannel: 'email' | 'viber';
  contactHandle: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LessonCatalogItem {
  lessonId: string;
  title: string;
  audience: 'Adult' | 'Kids';
  accessType: 'free' | 'paid';
  price: number;
  updatedBy: string;
  updatedAt?: unknown;
}

export interface UserProgress {
  uid: string;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string;
  streakDates: string[];
  completedLessonIds: string[];
  reminderEnabled: boolean;
  reminderTime: string;
  lastNotifiedDate: string;
  updatedAt?: unknown;
}

export interface SiteConfig {
  configId: string;
  heroEyebrow: string;
  heroTitleLine1: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroBannerUrl: string;
  siteLogoUrl: string;
  workerApiBaseUrl?: string;
  storiesLabel: string;
  storiesTitle: string;
  storiesSubtitle: string;
  reelsLabel?: string;
  reelsTitle?: string;
  reelsSubtitle?: string;
  gamesLabel: string;
  gamesTitle: string;
  gamesSubtitle: string;
  lessonsLabel: string;
  lessonsTitle: string;
  lessonsSubtitle: string;
  lessonsBadge?: string;
  lessonsCardTitle?: string;
  lessonsCardSubtitle?: string;
  lessonsCardDesc?: string;
  lessonsBullets?: string[];
  lessonsCta?: string;
  courses?: string[];
  coursePrices?: Record<string, number>;
  practicePrice?: number;
  adultBadge?: string;
  adultTitle?: string;
  adultSubtitle?: string;
  adultDesc?: string;
  adultBullets?: string[];
  adultCta?: string;
  kidsBadge?: string;
  kidsTitle?: string;
  kidsSubtitle?: string;
  kidsDesc?: string;
  kidsBullets?: string[];
  kidsCta?: string;
  contactEmail: string;
  contactPhone: string;
  contactViber: string;
  featuredReelIds: string[];
  featuredStoryIds: string[];
  featuredGameIds: string[];
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface ExcelSyncSummary {
  baseUsersCount: number;
  overlayDeltaCount: number;
  totalMergedUsers: number;
  workbookLoaded: boolean;
  lastLoadedAt: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  configId: 'homepage',
  heroEyebrow: 'Learn Chinese Step by Step',
  heroTitleLine1: 'Learn Chinese',
  heroTitleHighlight: 'with Confidence.',
  heroSubtitle:
    'Build your Chinese skills through pronunciation, everyday expressions, conversations, vocabulary, and practical exercises.',
  heroPrimaryCta: 'Explore Stories & Reels',
  heroSecondaryCta: 'Learning Hub',
  heroBannerUrl: 'assets/hero-banner.png',
  siteLogoUrl: 'assets/images/logo.svg',
  workerApiBaseUrl: '',
  storiesLabel: 'Featured Stories & Reels',
  storiesTitle: 'Stories & Reels',
  storiesSubtitle:
    'Watch bite-sized vertical video reels and engaging cultural narratives crafted for modern Mandarin learners.',
  gamesLabel: 'Interactive Practice',
  gamesTitle: 'Play & Practice Games',
  gamesSubtitle: 'Reinforce your Chinese tones, character recognition, and rapid recall through interactive gameplay.',
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

export const CONTACT_INFO = {
  email: 'syndkyaw@gmail.com',
  viber: '+95 9 798 123 456',
  viberUri: 'viber://chat?number=%2B959798123456'
};

export const MEMBERSHIP_PLANS = {
  monthly: {
    id: 'monthly' as const,
    name: 'Monthly All-Access',
    price: 19,
    amountLabel: '$19 / month',
    description: 'Unlock all Adult & Kids paid lessons for 30 days.'
  },
  annual: {
    id: 'annual' as const,
    name: 'Annual All-Access',
    price: 149,
    amountLabel: '$149 / year',
    description: 'Full curriculum access for 12 months (Save 35%).'
  },
  per_lesson: {
    id: 'per_lesson' as const,
    name: 'Single Lesson Pass',
    price: 9,
    amountLabel: '9 Kyat / lesson',
    description: 'Lifetime unlock for one selected paid lesson.'
  }
};

const USERS_EXCEL_PATH = 'data/users.xlsx';
const OVERLAY_STORAGE_KEY = 'linguapath_excel_overlay_v1';
const SITE_CONFIG_STORAGE_KEY = 'linguapath_site_config_v1';
const LEGACY_LOCAL_STORE_KEY = 'linguapath_local_auth_store_v1';
const SESSION_UID_STORAGE_KEY = 'linguapath_local_session_uid';
const ADMIN_EMAIL = 'syndkyaw@gmail.com';

// --- SheetJS Typings ---
interface XlsxModuleLike {
  read: (data: ArrayBuffer | Uint8Array, opts?: { type: string }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T = Record<string, unknown>>(sheet: unknown, opts?: { defval?: unknown }) => T[];
    json_to_sheet: (rows: unknown[], opts?: { header?: string[] }) => unknown;
    aoa_to_sheet: (rows: unknown[][]) => unknown;
    book_new: () => { SheetNames: string[]; Sheets: Record<string, unknown> };
    book_append_sheet: (wb: unknown, sheet: unknown, name: string) => void;
  };
  writeFile: (wb: unknown, filename: string) => void;
}

function getXlsxGlobal(): XlsxModuleLike | null {
  return (window as unknown as { XLSX?: XlsxModuleLike }).XLSX || null;
}

function loadScriptTag(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    } catch {
      resolve(false);
    }
  });
}

let xlsxLoadPromise: Promise<XlsxModuleLike | null> | null = null;
async function ensureXlsxLoaded(): Promise<XlsxModuleLike | null> {
  const existing = getXlsxGlobal();
  if (existing) return existing;
  if (!xlsxLoadPromise) {
    xlsxLoadPromise = (async () => {
      await loadScriptTag('vendor/xlsx.full.min.js');
      if (getXlsxGlobal()) return getXlsxGlobal();
      await loadScriptTag('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js');
      return getXlsxGlobal();
    })();
  }
  const mod = await xlsxLoadPromise;
  if (!mod) xlsxLoadPromise = null;
  return mod;
}

// --- Pure Utility Functions ---

export function calculateAge(dobString?: string | null): number | null {
  if (!dobString || !/^\d{4}-\d{2}-\d{2}$/.test(dobString)) return null;
  const parts = dobString.split('-').map(Number);
  const birth = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  if (age < 0 || age > 125) return null;
  return age;
}

function sanitizeDocId(raw: string): string {
  const cleaned = String(raw || '').trim().replace(/[^a-zA-Z0-9_\-]+/g, '-');
  return cleaned.slice(0, 128) || 'item-' + Date.now();
}

function generateRandomHex(bytes = 16): string {
  try {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(bytes);
      window.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback below
  }
  let out = '';
  for (let i = 0; i < bytes * 2; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

// Standard pure-JS SHA-256 fallback (for environments without crypto.subtle)
function sha256HexSync(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, '0')).join('');
}

async function computeSha256Hex(input: string): Promise<string> {
  try {
    if (window.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const data = new TextEncoder().encode(input);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback below
  }
  return sha256HexSync(input);
}

async function createSaltedPasswordHash(password: string): Promise<string> {
  const salt = generateRandomHex(16);
  const hex = await computeSha256Hex(`${salt}:${password}`);
  return `sha256$${salt}$${hex}`;
}

async function verifyPasswordCredential(candidatePassword: string, storedCredential: string): Promise<boolean> {
  const raw = String(storedCredential ?? '');
  if (!raw) return false;
  const match = raw.match(/^sha256\$([^$]+)\$([a-f0-9]{64})$/i);
  if (match) {
    const [, salt, expectedHex] = match;
    const computedHex = await computeSha256Hex(`${salt}:${candidatePassword}`);
    return computedHex.toLowerCase() === expectedHex.toLowerCase();
  }
  // Support plain-text edits made directly in Excel (users.xlsx)
  return candidatePassword === raw;
}

function normalizePhoneCompare(raw?: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/[\s\-().+]+/g, '');
}

function canonicalPhoneVariants(raw?: unknown): string[] {
  const digits = String(raw ?? '').replace(/\D+/g, '');
  if (!digits) return [];
  const variants = new Set<string>([digits]);
  if (digits.startsWith('950') && digits.length >= 10) {
    const local = '0' + digits.slice(3);
    variants.add(local);
    variants.add(local.slice(1));
  } else if (digits.startsWith('95') && digits.length >= 10) {
    const local = '0' + digits.slice(2);
    variants.add(local);
    variants.add(digits.slice(2));
  } else if (digits.startsWith('0') && digits.length >= 8) {
    variants.add(digits.slice(1));
    variants.add('95' + digits.slice(1));
  }
  return Array.from(variants);
}

function phonesMatch(a?: unknown, b?: unknown): boolean {
  const normA = normalizePhoneCompare(a);
  const normB = normalizePhoneCompare(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const varsA = canonicalPhoneVariants(a);
  const varsB = new Set(canonicalPhoneVariants(b));
  return varsA.some((v) => varsB.has(v));
}

function normalizeExcelDob(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 1000 && raw < 100000) {
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  const str = String(raw).trim().replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return str.slice(0, 20);
}

function normalizeBool(raw: unknown, fallback = false): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

function parseCommaList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map((x) => String(x || '').trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(
      String(raw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function parseIsoTimestamp(val: unknown): number {
  if (typeof val !== 'string' || !val.trim()) return 0;
  const ms = Date.parse(val);
  return Number.isNaN(ms) ? 0 : ms;
}

// --- Excel Store & Local Overlay Architecture ---

interface ExcelUserRecord {
  profile: UserProfile;
  passwordHash: string;
}

interface ExcelDataset {
  users: Record<string, ExcelUserRecord>;
  requests: Record<string, SubscriptionRequest>;
  progress: Record<string, UserProgress>;
  lessonCatalog: Record<string, LessonCatalogItem>;
  siteConfig?: Partial<SiteConfig>;
}

const baseWorkbookStore: ExcelDataset & { loaded: boolean; lastLoadedAt: string; lastError: string } = {
  users: {},
  requests: {},
  progress: {},
  lessonCatalog: {},
  loaded: false,
  lastLoadedAt: '',
  lastError: ''
};

function createEmptyDataset(): ExcelDataset {
  return {
    users: {},
    requests: {},
    progress: {},
    lessonCatalog: {}
  };
}

function readOverlayStore(): ExcelDataset {
  const empty = createEmptyDataset();
  try {
    const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExcelDataset>;
      let cfg = parsed?.siteConfig && typeof parsed.siteConfig === 'object' ? parsed.siteConfig : undefined;
      if (!cfg) {
        try {
          const backupRaw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
          if (backupRaw) {
            cfg = JSON.parse(backupRaw) as Partial<SiteConfig>;
          }
        } catch (_) {}
      }
      return {
        users: parsed?.users && typeof parsed.users === 'object' ? parsed.users : {},
        requests: parsed?.requests && typeof parsed.requests === 'object' ? parsed.requests : {},
        progress: parsed?.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
        lessonCatalog:
          parsed?.lessonCatalog && typeof parsed.lessonCatalog === 'object' ? parsed.lessonCatalog : {},
        siteConfig: cfg
      };
    }

    // Try standalone site config backup if overlay store is empty
    let backupCfg: Partial<SiteConfig> | undefined;
    try {
      const backupRaw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
      if (backupRaw) {
        backupCfg = JSON.parse(backupRaw) as Partial<SiteConfig>;
      }
    } catch (_) {}

    // Smoothly migrate any earlier local-mode browser registrations if present
    const legacyRaw = localStorage.getItem(LEGACY_LOCAL_STORE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as {
        users?: Record<string, { profile: UserProfile; salt?: string; passwordHash?: string }>;
        requests?: SubscriptionRequest[];
        progress?: Record<string, UserProgress>;
        lessonCatalog?: Record<string, LessonCatalogItem>;
        siteConfig?: Partial<SiteConfig>;
      };
      const migrated: ExcelDataset = createEmptyDataset();
      if (legacy.users) {
        for (const [uid, entry] of Object.entries(legacy.users)) {
          if (entry?.profile?.email) {
            const formattedHash =
              entry.salt && entry.passwordHash && !String(entry.passwordHash).startsWith('sha256$')
                ? `sha256$${entry.salt}$${entry.passwordHash}`
                : String(entry.passwordHash || '');
            migrated.users[uid] = { profile: entry.profile, passwordHash: formattedHash };
          }
        }
      }
      if (Array.isArray(legacy.requests)) {
        for (const req of legacy.requests) {
          if (req?.requestId) migrated.requests[req.requestId] = req;
        }
      }
      if (legacy.progress) migrated.progress = legacy.progress;
      if (legacy.lessonCatalog) migrated.lessonCatalog = legacy.lessonCatalog;
      migrated.siteConfig = legacy.siteConfig || backupCfg;
      return migrated;
    }
    if (backupCfg) {
      empty.siteConfig = backupCfg;
    }
  } catch {
    // ignore storage errors
  }
  return empty;
}

function writeOverlayStore(overlay: ExcelDataset): void {
  try {
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
  } catch (err) {
    console.warn('Could not write full overlay store to localStorage:', err);
  }
  if (overlay && overlay.siteConfig) {
    try {
      localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(overlay.siteConfig));
    } catch (err) {
      console.warn('Could not write site config backup to localStorage:', err);
    }
  }
}

function getSessionUid(): string | null {
  try {
    const val = localStorage.getItem(SESSION_UID_STORAGE_KEY);
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

function setSessionUid(uid: string | null): void {
  try {
    if (uid) {
      localStorage.setItem(SESSION_UID_STORAGE_KEY, uid);
    } else {
      localStorage.removeItem(SESSION_UID_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function parseWorkbookToDataset(wb: { SheetNames: string[]; Sheets: Record<string, unknown> }, xlsx: XlsxModuleLike): ExcelDataset {
  const dataset = createEmptyDataset();
  const findSheet = (name: string) => {
    const matchName = wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());
    return matchName ? wb.Sheets[matchName] : null;
  };

  // 1. Users Sheet
  const usersSheet = findSheet('Users') || (wb.SheetNames.length ? wb.Sheets[wb.SheetNames[0]] : null);
  if (usersSheet) {
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(usersSheet, { defval: '' });
    for (const row of rows) {
      const email = String(row.email || row.Email || '').trim().toLowerCase().slice(0, 160);
      if (!email) continue;
      const uid = String(row.uid || row.UID || '').trim() || `usr_${email.replace(/[^a-z0-9]/g, '_')}`;
      const rawPwHash = String(row.passwordHash || '').trim();
      const rawPlainPw = String(row.password || row.Password || '').trim();
      // If Admin filled a plain `password` column in Excel, prioritize it; otherwise use `passwordHash`
      const effectiveCredential = rawPlainPw || rawPwHash;

      const rawRole = String(row.role || 'student').trim().toLowerCase();
      const role: 'admin' | 'student' = rawRole === 'admin' ? 'admin' : 'student';

      const rawStatus = String(row.membershipStatus || 'free').trim().toLowerCase();
      const membershipStatus: UserProfile['membershipStatus'] =
        rawStatus === 'active' || rawStatus === 'pending' || rawStatus === 'expired' ? rawStatus : 'free';

      const rawPlan = String(row.membershipPlan || 'none').trim().toLowerCase();
      const membershipPlan: UserProfile['membershipPlan'] =
        rawPlan === 'monthly' || rawPlan === 'annual' || rawPlan === 'per_lesson' ? rawPlan : 'none';

      const profile: UserProfile = {
        uid,
        username: String(row.username || row.name || email.split('@')[0] || 'Learner').trim().slice(0, 60),
        email,
        phoneNumber: String(row.phoneNumber || row.phone || '').trim().slice(0, 32),
        dob: normalizeExcelDob(row.dob),
        role,
        membershipStatus,
        membershipPlan,
        membershipExpiresAt: normalizeExcelDob(row.membershipExpiresAt),
        subscribedLessonIds: parseCommaList(row.subscribedLessonIds),
        linkedProviders: ['password'],
        mustChangePassword: normalizeBool(row.mustChangePassword, false),
        createdAt: String(row.createdAt || '').trim(),
        updatedAt: String(row.updatedAt || '').trim()
      };

      dataset.users[uid] = { profile, passwordHash: effectiveCredential };
    }
  }

  // 2. Requests Sheet
  const reqSheet = findSheet('Requests');
  if (reqSheet) {
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(reqSheet, { defval: '' });
    for (const row of rows) {
      const requestId = String(row.requestId || '').trim();
      const userId = String(row.userId || '').trim();
      if (!requestId || !userId) continue;
      const planRaw = String(row.planType || 'monthly').trim().toLowerCase();
      const planType: SubscriptionRequest['planType'] =
        planRaw === 'annual' || planRaw === 'per_lesson' ? planRaw : 'monthly';
      const statusRaw = String(row.status || 'pending').trim().toLowerCase();
      const status: SubscriptionRequest['status'] =
        statusRaw === 'approved' || statusRaw === 'rejected' ? statusRaw : 'pending';
      dataset.requests[requestId] = {
        requestId,
        userId,
        username: String(row.username || '').trim(),
        userEmail: String(row.userEmail || '').trim().toLowerCase(),
        userPhone: String(row.userPhone || '').trim(),
        planType,
        lessonId: String(row.lessonId || '').trim(),
        lessonTitle: String(row.lessonTitle || '').trim(),
        amountLabel: String(row.amountLabel || '').trim(),
        contactChannel: String(row.contactChannel || '').trim().toLowerCase() === 'email' ? 'email' : 'viber',
        contactHandle: String(row.contactHandle || '').trim(),
        note: String(row.note || '').trim(),
        status,
        adminNote: String(row.adminNote || '').trim(),
        createdAt: String(row.createdAt || '').trim(),
        updatedAt: String(row.updatedAt || '').trim()
      };
    }
  }

  // 3. Progress Sheet
  const progSheet = findSheet('Progress');
  if (progSheet) {
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(progSheet, { defval: '' });
    for (const row of rows) {
      const uid = String(row.uid || '').trim();
      if (!uid) continue;
      dataset.progress[uid] = {
        uid,
        currentStreak: Number(row.currentStreak) || 0,
        bestStreak: Number(row.bestStreak) || 0,
        lastCompletedDate: normalizeExcelDob(row.lastCompletedDate),
        streakDates: parseCommaList(row.streakDates),
        completedLessonIds: parseCommaList(row.completedLessonIds),
        reminderEnabled: normalizeBool(row.reminderEnabled, true),
        reminderTime: sanitizeTimeStr(String(row.reminderTime || '18:00')),
        lastNotifiedDate: normalizeExcelDob(row.lastNotifiedDate),
        updatedAt: String(row.updatedAt || '').trim()
      };
    }
  }

  // 4. Catalog Sheet
  const catSheet = findSheet('Catalog');
  if (catSheet) {
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(catSheet, { defval: '' });
    for (const row of rows) {
      const lessonId = sanitizeDocId(String(row.lessonId || ''));
      if (!row.lessonId) continue;
      dataset.lessonCatalog[lessonId] = {
        lessonId,
        title: String(row.title || lessonId).trim(),
        audience: String(row.audience || '').trim().toLowerCase() === 'kids' ? 'Kids' : 'Adult',
        accessType: String(row.accessType || '').trim().toLowerCase() === 'paid' ? 'paid' : 'free',
        price: Math.max(0, Number(row.price) || 0),
        updatedBy: String(row.updatedBy || '').trim(),
        updatedAt: String(row.updatedAt || '').trim()
      };
    }
  }

  return dataset;
}

async function loadBaseWorkbookFromExcel(forceReload = false): Promise<void> {
  if (baseWorkbookStore.loaded && !forceReload) return;
  try {
    const xlsx = await ensureXlsxLoaded();
    if (!xlsx) {
      baseWorkbookStore.lastError = 'Excel reader (SheetJS) failed to load.';
      return;
    }
    const res = await fetch(`${USERS_EXCEL_PATH}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      baseWorkbookStore.lastError = `Could not load ${USERS_EXCEL_PATH} (HTTP ${res.status}).`;
      return;
    }
    const buf = await res.arrayBuffer();
    const wb = xlsx.read(buf, { type: 'array' });
    const parsed = parseWorkbookToDataset(wb, xlsx);
    baseWorkbookStore.users = parsed.users;
    baseWorkbookStore.requests = parsed.requests;
    baseWorkbookStore.progress = parsed.progress;
    baseWorkbookStore.lessonCatalog = parsed.lessonCatalog;
    baseWorkbookStore.loaded = true;
    baseWorkbookStore.lastLoadedAt = new Date().toISOString();
    baseWorkbookStore.lastError = '';
  } catch (err) {
    baseWorkbookStore.lastError = err instanceof Error ? err.message : 'Failed to parse users.xlsx.';
  }
}

function getMergedDataset(): ExcelDataset {
  const overlay = readOverlayStore();
  const merged = createEmptyDataset();

  // Merge Users (newer timestamp wins; ties favor Excel unless overlay was created by local registration)
  for (const [uid, rec] of Object.entries(baseWorkbookStore.users)) {
    merged.users[uid] = { profile: { ...rec.profile }, passwordHash: rec.passwordHash };
  }
  for (const [uid, ovRec] of Object.entries(overlay.users)) {
    if (!ovRec?.profile?.email) continue;
    const existingByUid = merged.users[uid];
    const existingByEmailKey = Object.keys(merged.users).find(
      (k) => merged.users[k].profile.email.toLowerCase() === ovRec.profile.email.toLowerCase()
    );
    const targetKey = existingByUid ? uid : existingByEmailKey || uid;
    const baseTarget = merged.users[targetKey];
    if (!baseTarget) {
      merged.users[targetKey] = { profile: { ...ovRec.profile }, passwordHash: ovRec.passwordHash };
    } else {
      const ovTime = parseIsoTimestamp(ovRec.profile.updatedAt);
      const baseTime = parseIsoTimestamp(baseTarget.profile.updatedAt);
      if (ovTime >= baseTime) {
        merged.users[targetKey] = { profile: { ...ovRec.profile }, passwordHash: ovRec.passwordHash };
      }
    }
  }

  // Merge Requests
  for (const [id, r] of Object.entries(baseWorkbookStore.requests)) {
    merged.requests[id] = { ...r };
  }
  for (const [id, r] of Object.entries(overlay.requests)) {
    const baseR = merged.requests[id];
    if (!baseR || parseIsoTimestamp(r.updatedAt) >= parseIsoTimestamp(baseR.updatedAt)) {
      merged.requests[id] = { ...r };
    }
  }

  // Merge Progress
  for (const [uid, p] of Object.entries(baseWorkbookStore.progress)) {
    merged.progress[uid] = { ...p };
  }
  for (const [uid, p] of Object.entries(overlay.progress)) {
    const baseP = merged.progress[uid];
    if (!baseP || parseIsoTimestamp(p.updatedAt) >= parseIsoTimestamp(baseP.updatedAt)) {
      merged.progress[uid] = { ...p };
    }
  }

  // Merge Catalog
  for (const [id, c] of Object.entries(baseWorkbookStore.lessonCatalog)) {
    merged.lessonCatalog[id] = { ...c };
  }
  for (const [id, c] of Object.entries(overlay.lessonCatalog)) {
    const baseC = merged.lessonCatalog[id];
    if (!baseC || parseIsoTimestamp(c.updatedAt) >= parseIsoTimestamp(baseC.updatedAt)) {
      merged.lessonCatalog[id] = { ...c };
    }
  }

  merged.siteConfig = overlay.siteConfig;
  return merged;
}

function getExcelSyncSummary(): ExcelSyncSummary {
  const overlay = readOverlayStore();
  const merged = getMergedDataset();
  const baseCount = Object.keys(baseWorkbookStore.users).length;
  let delta = 0;
  for (const [uid, ovRec] of Object.entries(overlay.users)) {
    const baseRec =
      baseWorkbookStore.users[uid] ||
      Object.values(baseWorkbookStore.users).find(
        (b) => b.profile.email.toLowerCase() === ovRec.profile.email.toLowerCase()
      );
    if (!baseRec) {
      delta++;
    } else if (parseIsoTimestamp(ovRec.profile.updatedAt) > parseIsoTimestamp(baseRec.profile.updatedAt)) {
      delta++;
    }
  }
  return {
    baseUsersCount: baseCount,
    overlayDeltaCount: delta,
    totalMergedUsers: Object.keys(merged.users).length,
    workbookLoaded: baseWorkbookStore.loaded,
    lastLoadedAt: baseWorkbookStore.lastLoadedAt
  };
}

function isAdminClaimedInDataset(dataset: ExcelDataset): boolean {
  return Object.values(dataset.users).some(
    (entry) =>
      entry?.profile?.role === 'admin' ||
      String(entry?.profile?.email || '').trim().toLowerCase() === ADMIN_EMAIL
  );
}

function sortedRequestsList(dataset: ExcelDataset): SubscriptionRequest[] {
  return Object.values(dataset.requests).sort(
    (a, b) => parseIsoTimestamp(b.createdAt) - parseIsoTimestamp(a.createdAt)
  );
}

function buildSessionPayload(dataset: ExcelDataset, uid: string): Record<string, unknown> | null {
  const entry = dataset.users[uid];
  if (!entry || !entry.profile) return null;
  const profile = { ...entry.profile };
  const isAdm = profile.role === 'admin';
  const allReqs = sortedRequestsList(dataset);
  const myRequests = allReqs.filter((r) => r.userId === uid);
  const userProgress = dataset.progress[uid] || createDefaultUserProgress(uid);
  const allUsers = isAdm ? Object.values(dataset.users).map((u) => ({ ...u.profile })) : [];

  return {
    user: {
      uid: profile.uid,
      email: profile.email,
      displayName: profile.username,
      role: profile.role,
      mustChangePassword: Boolean(profile.mustChangePassword)
    },
    profile,
    userProgress,
    myRequests,
    lessonCatalog: dataset.lessonCatalog || {},
    adminClaimed: isAdminClaimedInDataset(dataset),
    allUsers,
    allRequests: isAdm ? allReqs : []
  };
}

// --- Client Reactive Store ---

export interface AuthState {
  ready: boolean;
  user: AuthUserSummary | null;
  profile: UserProfile | null;
  userProgress: UserProgress | null;
  isAdmin: boolean;
  adminClaimed: boolean;
  excelSummary: ExcelSyncSummary;
  myRequests: SubscriptionRequest[];
  allRequests: SubscriptionRequest[];
  allUsers: UserProfile[];
  lessonCatalog: Record<string, LessonCatalogItem>;
  siteConfig: SiteConfig;
  lastError: string | null;
}

const state: AuthState = {
  ready: false,
  user: null,
  profile: null,
  userProgress: null,
  isAdmin: false,
  adminClaimed: false,
  excelSummary: {
    baseUsersCount: 0,
    overlayDeltaCount: 0,
    totalMergedUsers: 0,
    workbookLoaded: false,
    lastLoadedAt: ''
  },
  myRequests: [],
  allRequests: [],
  allUsers: [],
  lessonCatalog: {},
  siteConfig: { ...DEFAULT_SITE_CONFIG },
  lastError: null
};

const subscribers = new Set<(s: AuthState) => void>();

function getComputedAdmin(): boolean {
  return Boolean(state.user?.role === 'admin' || state.profile?.role === 'admin');
}

function refreshExcelSummaryState(): void {
  state.excelSummary = getExcelSyncSummary();
}

function emitState(): void {
  refreshExcelSummaryState();
  const snapshot: AuthState = {
    ...state,
    isAdmin: getComputedAdmin()
  };
  for (const cb of subscribers) {
    try {
      cb(snapshot);
    } catch (err) {
      console.error('LinguaAuth subscriber error:', err);
    }
  }
  if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('lingua-auth-change', { detail: snapshot }));
  }
}

function emitSiteConfigChange(): void {
  if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('lingua-site-config-change', { detail: state.siteConfig }));
  }
}

function normalizeStrList(raw: unknown, maxItems: number, maxLen: number, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  return raw
    .map((x) => String(x || '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeLogoUrl(val: unknown): string {
  if (typeof val !== 'string') return DEFAULT_SITE_CONFIG.siteLogoUrl;
  const clean = val.trim();
  if (!clean) return '';
  if (/^\/?public\/assets\/aistudio\//i.test(clean)) {
    return DEFAULT_SITE_CONFIG.siteLogoUrl;
  }
  if (/^data:image\//i.test(clean)) {
    return clean.length <= 2500000 ? clean : DEFAULT_SITE_CONFIG.siteLogoUrl;
  }
  return clean.slice(0, 1000);
}

function sanitizeBannerUrl(val: unknown): string {
  if (typeof val !== 'string') return DEFAULT_SITE_CONFIG.heroBannerUrl;
  const clean = val.trim();
  if (!clean) return DEFAULT_SITE_CONFIG.heroBannerUrl;
  if (/^data:image\//i.test(clean)) {
    return clean.length <= 2500000 ? clean : DEFAULT_SITE_CONFIG.heroBannerUrl;
  }
  return clean.slice(0, 1000);
}

function normalizeSiteConfig(raw: Partial<SiteConfig> | null | undefined): SiteConfig {
  const s = (val: unknown, maxLen: number, fb: string): string => {
    if (typeof val !== 'string') return fb;
    const trimmed = val.trim();
    return (trimmed || fb).slice(0, maxLen);
  };
  return {
    configId: 'homepage',
    heroEyebrow: s(raw?.heroEyebrow, 100, DEFAULT_SITE_CONFIG.heroEyebrow),
    heroTitleLine1: s(raw?.heroTitleLine1, 120, DEFAULT_SITE_CONFIG.heroTitleLine1),
    heroTitleHighlight: s(raw?.heroTitleHighlight, 120, DEFAULT_SITE_CONFIG.heroTitleHighlight),
    heroSubtitle: s(raw?.heroSubtitle, 400, DEFAULT_SITE_CONFIG.heroSubtitle),
    heroPrimaryCta: s(raw?.heroPrimaryCta, 60, DEFAULT_SITE_CONFIG.heroPrimaryCta),
    heroSecondaryCta: s(raw?.heroSecondaryCta, 60, DEFAULT_SITE_CONFIG.heroSecondaryCta),
    heroBannerUrl: sanitizeBannerUrl(raw?.heroBannerUrl),
    siteLogoUrl: raw && 'siteLogoUrl' in raw ? sanitizeLogoUrl(raw.siteLogoUrl) : DEFAULT_SITE_CONFIG.siteLogoUrl,
    workerApiBaseUrl: typeof raw?.workerApiBaseUrl === 'string' && /^https?:\/\/[^/\s]+/i.test(raw.workerApiBaseUrl.trim())
      ? raw.workerApiBaseUrl.trim().replace(/\/+$/, '').slice(0, 240)
      : '',
    storiesLabel: s(raw?.storiesLabel, 100, DEFAULT_SITE_CONFIG.storiesLabel),
    storiesTitle: s(raw?.storiesTitle, 120, DEFAULT_SITE_CONFIG.storiesTitle),
    storiesSubtitle: s(raw?.storiesSubtitle, 400, DEFAULT_SITE_CONFIG.storiesSubtitle),
    reelsLabel: s(raw?.reelsLabel, 100, DEFAULT_SITE_CONFIG.reelsLabel || 'Short Reels'),
    reelsTitle: s(raw?.reelsTitle, 120, DEFAULT_SITE_CONFIG.reelsTitle || 'Short Reels'),
    reelsSubtitle: s(raw?.reelsSubtitle, 400, DEFAULT_SITE_CONFIG.reelsSubtitle || ''),
    gamesLabel: s(raw?.gamesLabel, 100, DEFAULT_SITE_CONFIG.gamesLabel),
    gamesTitle: s(raw?.gamesTitle, 120, DEFAULT_SITE_CONFIG.gamesTitle),
    gamesSubtitle: s(raw?.gamesSubtitle, 400, DEFAULT_SITE_CONFIG.gamesSubtitle),
    lessonsLabel: s(raw?.lessonsLabel, 100, DEFAULT_SITE_CONFIG.lessonsLabel),
    lessonsTitle: s(raw?.lessonsTitle, 120, DEFAULT_SITE_CONFIG.lessonsTitle),
    lessonsSubtitle: s(raw?.lessonsSubtitle, 400, DEFAULT_SITE_CONFIG.lessonsSubtitle),
    lessonsBadge: s(raw?.lessonsBadge, 100, (raw as any)?.lessonsBadge || 'HSK 2 • Structured Course'),
    lessonsCardTitle: s(raw?.lessonsCardTitle, 140, (raw as any)?.lessonsCardTitle || 'Explore HSK 2 Courses & Lessons'),
    lessonsCardSubtitle: s(raw?.lessonsCardSubtitle, 140, (raw as any)?.lessonsCardSubtitle || ''),
    lessonsCardDesc: s(raw?.lessonsCardDesc, 400, (raw as any)?.lessonsCardDesc || ''),
    lessonsBullets: Array.isArray(raw?.lessonsBullets) ? normalizeStrList(raw.lessonsBullets, 6, 140, []) : undefined,
    lessonsCta: s(raw?.lessonsCta, 80, (raw as any)?.lessonsCta || 'Go to Lessons →'),
    courses: Array.isArray(raw?.courses) ? normalizeStrList(raw.courses, 60, 80, ['HSK 2']) : ['HSK 2'],
    coursePrices: raw?.coursePrices && typeof raw.coursePrices === 'object' ? { ...raw.coursePrices } : { 'HSK 2': 120 },
    practicePrice: typeof raw?.practicePrice === 'number' && Number.isFinite(raw.practicePrice) ? Math.round(raw.practicePrice) : 55000,
    adultBadge: s(raw?.adultBadge, 80, DEFAULT_SITE_CONFIG.adultBadge || 'Adults • Comprehensive'),
    adultTitle: s(raw?.adultTitle, 140, DEFAULT_SITE_CONFIG.adultTitle || 'Mandarin for Adults & Professionals'),
    adultSubtitle: s(raw?.adultSubtitle, 140, DEFAULT_SITE_CONFIG.adultSubtitle || ''),
    adultDesc: s(raw?.adultDesc, 400, DEFAULT_SITE_CONFIG.adultDesc || ''),
    adultBullets: normalizeStrList(raw?.adultBullets, 6, 140, DEFAULT_SITE_CONFIG.adultBullets || []),
    adultCta: s(raw?.adultCta, 80, DEFAULT_SITE_CONFIG.adultCta || 'Start Learning →'),
    kidsBadge: s(raw?.kidsBadge, 80, DEFAULT_SITE_CONFIG.kidsBadge || 'Kids • Playful Immersion'),
    kidsTitle: s(raw?.kidsTitle, 140, DEFAULT_SITE_CONFIG.kidsTitle || 'Chinese for Kids & Young Learners'),
    kidsSubtitle: s(raw?.kidsSubtitle, 140, DEFAULT_SITE_CONFIG.kidsSubtitle || ''),
    kidsDesc: s(raw?.kidsDesc, 400, DEFAULT_SITE_CONFIG.kidsDesc || ''),
    kidsBullets: normalizeStrList(raw?.kidsBullets, 6, 140, DEFAULT_SITE_CONFIG.kidsBullets || []),
    kidsCta: s(raw?.kidsCta, 80, DEFAULT_SITE_CONFIG.kidsCta || 'Start Learning →'),
    contactEmail: s(raw?.contactEmail, 160, DEFAULT_SITE_CONFIG.contactEmail),
    contactPhone: s(raw?.contactPhone, 40, DEFAULT_SITE_CONFIG.contactPhone),
    contactViber: s(raw?.contactViber, 40, DEFAULT_SITE_CONFIG.contactViber),
    featuredReelIds: Array.isArray(raw?.featuredReelIds)
      ? normalizeStrList(raw.featuredReelIds, 12, 128, [])
      : [...DEFAULT_SITE_CONFIG.featuredReelIds],
    featuredStoryIds: Array.isArray(raw?.featuredStoryIds)
      ? normalizeStrList(raw.featuredStoryIds, 12, 128, [])
      : [...DEFAULT_SITE_CONFIG.featuredStoryIds],
    featuredGameIds: Array.isArray(raw?.featuredGameIds)
      ? normalizeStrList(raw.featuredGameIds, 12, 128, [])
      : [...DEFAULT_SITE_CONFIG.featuredGameIds],
    updatedBy: raw?.updatedBy,
    updatedAt: raw?.updatedAt
  };
}

function applySessionPayload(data: Record<string, unknown>): void {
  if (data.user && typeof data.user === 'object') {
    state.user = data.user as AuthUserSummary;
  }
  if (data.profile && typeof data.profile === 'object') {
    state.profile = data.profile as UserProfile;
  }
  if (data.userProgress && typeof data.userProgress === 'object') {
    state.userProgress = normalizeUserProgress(
      data.userProgress as Partial<UserProgress>,
      state.user?.uid || ''
    );
  } else if (state.user) {
    state.userProgress = createDefaultUserProgress(state.user.uid);
  }
  if (Array.isArray(data.myRequests)) {
    state.myRequests = data.myRequests as SubscriptionRequest[];
  }
  if (data.lessonCatalog && typeof data.lessonCatalog === 'object') {
    state.lessonCatalog = data.lessonCatalog as Record<string, LessonCatalogItem>;
  }
  if (typeof data.adminClaimed === 'boolean') {
    state.adminClaimed = data.adminClaimed;
  }
  if (state.user?.role === 'admin' || state.profile?.role === 'admin') {
    if (Array.isArray(data.allRequests)) {
      state.allRequests = data.allRequests as SubscriptionRequest[];
    }
    if (Array.isArray(data.allUsers)) {
      state.allUsers = data.allUsers as UserProfile[];
    }
  } else {
    state.allRequests = [];
    state.allUsers = [];
  }
  state.isAdmin = getComputedAdmin();
  state.lastError = null;
}

function clearAuthSession(): void {
  setSessionUid(null);
  state.user = null;
  state.profile = null;
  state.userProgress = null;
  state.isAdmin = false;
  state.myRequests = [];
  state.allRequests = [];
  state.allUsers = [];
}

function syncMemoryFromDataset(dataset: ExcelDataset, uidOverride?: string | null): void {
  state.lessonCatalog = dataset.lessonCatalog || {};
  state.adminClaimed = isAdminClaimedInDataset(dataset);
  const uid = uidOverride !== undefined ? uidOverride : getSessionUid();
  if (uid) {
    const payload = buildSessionPayload(dataset, uid);
    if (payload) {
      applySessionPayload(payload);
      return;
    }
  }
  clearAuthSession();
}

async function hydratePublicAndSession(forceExcelReload = false): Promise<void> {
  // 1. Load static site-config.json first so any configured Worker URL activates immediately
  let baseCfg: Partial<SiteConfig> = {};
  let serverCfg: Partial<SiteConfig> | null = null;

  try {
    const staticCfg = await fetch('data/site-config.json?t=' + Date.now(), { cache: 'no-store' });
    if (staticCfg.ok) {
      baseCfg = (await staticCfg.json()) as Partial<SiteConfig>;
    }
  } catch {
    // keep defaults
  }

  // 2. Load data/users.xlsx and merge browser overlay
  await loadBaseWorkbookFromExcel(forceExcelReload);
  const dataset = getMergedDataset();

  const lb = typeof window !== 'undefined' ? (window as any).LinguaBackend : null;
  const candidateWorkerBase = String(dataset.siteConfig?.workerApiBaseUrl || baseCfg?.workerApiBaseUrl || '').trim();
  if (candidateWorkerBase && lb && typeof lb.setSiteWorkerBase === 'function') {
    lb.setSiteWorkerBase(candidateWorkerBase);
  }

  const canReachBackend = !lb || typeof lb.hasBackend !== 'function' || lb.hasBackend();
  if (canReachBackend) {
    try {
      const apiPath = '/api/site-config?t=' + Date.now();
      const apiUrl = lb?.apiUrl ? lb.apiUrl(apiPath) : apiPath;
      const sRes = await fetch(apiUrl, { cache: 'no-store' });
      if (sRes.ok) {
        const sData = (await sRes.json().catch(() => null)) as any;
        if (sData && sData.success && sData.config && typeof sData.config === 'object') {
          serverCfg = sData.config as Partial<SiteConfig>;
        }
      }
    } catch (_) {
      // API unreachable or static host
    }
  }

  let effectiveCfg: Partial<SiteConfig>;
  if (serverCfg) {
    const serverTime = parseIsoTimestamp(serverCfg.updatedAt);
    const localTime = parseIsoTimestamp(dataset.siteConfig?.updatedAt);
    if (dataset.siteConfig && localTime > serverTime) {
      effectiveCfg = { ...baseCfg, ...serverCfg, ...dataset.siteConfig };
    } else {
      effectiveCfg = { ...baseCfg, ...serverCfg };
      // Refresh local overlay store with fresh server config
      const overlay = readOverlayStore();
      overlay.siteConfig = { ...effectiveCfg };
      writeOverlayStore(overlay);
    }
  } else {
    effectiveCfg = dataset.siteConfig ? { ...baseCfg, ...dataset.siteConfig } : baseCfg;
  }

  state.siteConfig = normalizeSiteConfig(effectiveCfg);
  if (state.siteConfig.workerApiBaseUrl && lb && typeof lb.setSiteWorkerBase === 'function') {
    lb.setSiteWorkerBase(state.siteConfig.workerApiBaseUrl);
  }
  emitSiteConfigChange();

  syncMemoryFromDataset(dataset);
  state.ready = true;
  emitState();
}

hydratePublicAndSession();

// --- Public Auth, Profile, Subscription & Admin Methods ---

async function registerWithEmail(params: {
  username: string;
  email: string;
  phoneNumber: string;
  dob: string;
  password: string;
}): Promise<UserProfile> {
  const cleanUsername = String(params.username || '').trim().slice(0, 60);
  const cleanEmail = String(params.email || '').trim().toLowerCase().slice(0, 160);
  const cleanPhone = String(params.phoneNumber || '').trim().slice(0, 32);
  const cleanDob = normalizeExcelDob(params.dob);
  const rawPassword = String(params.password || '');

  if (!cleanUsername || !cleanEmail) {
    throw new Error('User Name and Email Address are required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (rawPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  await loadBaseWorkbookFromExcel(false);
  const merged = getMergedDataset();
  const duplicate = Object.values(merged.users).find(
    (u) => u.profile.email.toLowerCase() === cleanEmail
  );
  if (duplicate) {
    throw new Error('An account with this email address already exists. Please sign in instead.');
  }

  const uid = `usr_${Date.now().toString(36)}_${generateRandomHex(4)}`;
  const nowIso = new Date().toISOString();
  const shouldClaimAdmin = cleanEmail === ADMIN_EMAIL && !isAdminClaimedInDataset(merged);
  const passwordHash = await createSaltedPasswordHash(rawPassword);

  const profile: UserProfile = {
    uid,
    username: cleanUsername,
    email: cleanEmail,
    phoneNumber: cleanPhone,
    dob: cleanDob,
    role: shouldClaimAdmin ? 'admin' : 'student',
    membershipStatus: shouldClaimAdmin ? 'active' : 'free',
    membershipPlan: shouldClaimAdmin ? 'annual' : 'none',
    membershipExpiresAt: '',
    subscribedLessonIds: [],
    linkedProviders: ['password'],
    mustChangePassword: false,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const overlay = readOverlayStore();
  overlay.users[uid] = { profile, passwordHash };
  overlay.progress[uid] = createDefaultUserProgress(uid);
  writeOverlayStore(overlay);
  setSessionUid(uid);

  const nextDataset = getMergedDataset();
  syncMemoryFromDataset(nextDataset, uid);
  state.ready = true;
  emitState();
  return state.profile as UserProfile;
}

async function loginWithEmail(email: string, password: string): Promise<AuthUserSummary> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');
  if (!cleanEmail || !rawPassword) {
    throw new Error('Please enter both your email and password.');
  }

  // Always check fresh data/users.xlsx merged with browser registrations
  await loadBaseWorkbookFromExcel(true);
  const dataset = getMergedDataset();
  const matchedEntry = Object.values(dataset.users).find(
    (entry) => entry.profile.email.toLowerCase() === cleanEmail
  );
  if (!matchedEntry) {
    if (!baseWorkbookStore.loaded && baseWorkbookStore.lastError) {
      throw new Error(baseWorkbookStore.lastError);
    }
    throw new Error(`No account found in users.xlsx for ${cleanEmail}. Click Register to create one.`);
  }

  const valid = await verifyPasswordCredential(rawPassword, matchedEntry.passwordHash);
  if (!valid) {
    throw new Error('Incorrect email or password.');
  }

  const uid = matchedEntry.profile.uid;
  setSessionUid(uid);
  syncMemoryFromDataset(dataset, uid);
  state.ready = true;
  emitState();
  return state.user as AuthUserSummary;
}

async function resetPasswordWithVerification(params: {
  email: string;
  dob: string;
  phoneNumber: string;
  newPassword: string;
}): Promise<string> {
  const cleanEmail = String(params.email || '').trim().toLowerCase();
  const cleanDob = normalizeExcelDob(params.dob);
  const cleanPhone = normalizePhoneCompare(params.phoneNumber);
  const newPassword = String(params.newPassword || '');

  if (!cleanEmail || !cleanDob || !cleanPhone) {
    throw new Error('Please enter your Email, Date of Birth, and Phone / Viber Number to verify your identity.');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  await loadBaseWorkbookFromExcel(false);
  const dataset = getMergedDataset();
  const matchedEntry = Object.values(dataset.users).find(
    (entry) => entry.profile.email.toLowerCase() === cleanEmail
  );
  if (!matchedEntry) {
    throw new Error(`No account found for ${cleanEmail}.`);
  }

  const storedDob = normalizeExcelDob(matchedEntry.profile.dob);
  const storedPhone = normalizePhoneCompare(matchedEntry.profile.phoneNumber);
  if (!storedDob || !storedPhone) {
    throw new Error(
      'This account cannot be self-reset without both Date of Birth and Phone saved. Ask the site Admin to reset your password in Admin Portal or users.xlsx.'
    );
  }
  if (storedDob !== cleanDob || !phonesMatch(matchedEntry.profile.phoneNumber, params.phoneNumber)) {
    throw new Error('Verification details did not match our records. Check your Date of Birth and Phone Number.');
  }

  const nextHash = await createSaltedPasswordHash(newPassword);
  const nowIso = new Date().toISOString();
  const overlay = readOverlayStore();
  overlay.users[matchedEntry.profile.uid] = {
    profile: {
      ...matchedEntry.profile,
      mustChangePassword: false,
      updatedAt: nowIso
    },
    passwordHash: nextHash
  };
  writeOverlayStore(overlay);
  emitState();
  return 'Password reset successfully! Sign in now with your new password.';
}

async function sendPasswordReset(email: string): Promise<string> {
  return resetPasswordWithVerification({
    email,
    dob: '',
    phoneNumber: '',
    newPassword: ''
  });
}

async function changePassword(currentPassword: string, newPassword: string): Promise<UserProfile> {
  if (!state.user) throw new Error('Please sign in first.');
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    throw new Error('Enter your current password and a new password (min. 6 characters).');
  }

  const dataset = getMergedDataset();
  const entry = dataset.users[state.user.uid];
  if (!entry) throw new Error('Account record not found.');

  const valid = await verifyPasswordCredential(currentPassword, entry.passwordHash);
  if (!valid) {
    throw new Error('Current password is incorrect.');
  }

  const nextHash = await createSaltedPasswordHash(newPassword);
  const nowIso = new Date().toISOString();
  const nextProfile: UserProfile = {
    ...entry.profile,
    mustChangePassword: false,
    updatedAt: nowIso
  };

  const overlay = readOverlayStore();
  overlay.users[state.user.uid] = { profile: nextProfile, passwordHash: nextHash };
  writeOverlayStore(overlay);

  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
  return state.profile as UserProfile;
}

async function reloadAuthSession(): Promise<AuthState> {
  await hydratePublicAndSession(true);
  return getState();
}

async function logout(): Promise<void> {
  clearAuthSession();
  state.ready = true;
  emitState();
  try {
    if (typeof window !== 'undefined' && window.location) {
      const currentPath = window.location.pathname || '';
      if (!currentPath.endsWith('index.html') && currentPath !== '/' && currentPath !== '') {
        window.location.href = 'index.html';
      }
    }
  } catch (_) {}
}

async function adminUpdateUserDetails(
  userId: string,
  updates: {
    username?: string;
    email?: string;
    phoneNumber?: string;
    dob?: string;
    role?: 'admin' | 'student';
    membershipStatus?: UserProfile['membershipStatus'];
    membershipPlan?: UserProfile['membershipPlan'];
    membershipExpiresAt?: string;
  }
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const dataset = getMergedDataset();
  const entry = dataset.users[userId];
  if (!entry) throw new Error('User not found.');

  const nowIso = new Date().toISOString();
  const nextProfile: UserProfile = {
    ...entry.profile,
    username: updates.username !== undefined ? String(updates.username).trim().slice(0, 60) : entry.profile.username,
    email: updates.email !== undefined ? String(updates.email).trim().toLowerCase().slice(0, 160) : entry.profile.email,
    phoneNumber: updates.phoneNumber !== undefined ? String(updates.phoneNumber).trim().slice(0, 32) : entry.profile.phoneNumber,
    dob: updates.dob !== undefined ? normalizeExcelDob(updates.dob) : entry.profile.dob,
    role: updates.role === 'admin' || updates.role === 'student' ? updates.role : entry.profile.role,
    membershipStatus: updates.membershipStatus !== undefined ? updates.membershipStatus : entry.profile.membershipStatus,
    membershipPlan: updates.membershipPlan !== undefined ? updates.membershipPlan : entry.profile.membershipPlan,
    membershipExpiresAt: updates.membershipExpiresAt !== undefined ? normalizeExcelDob(updates.membershipExpiresAt) : entry.profile.membershipExpiresAt,
    updatedAt: nowIso
  };

  const overlay = readOverlayStore();
  overlay.users[userId] = { profile: nextProfile, passwordHash: entry.passwordHash };
  writeOverlayStore(overlay);

  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
}

async function updateProfileDetails(params: {
  username: string;
  phoneNumber: string;
  dob: string;
}): Promise<void> {
  if (!state.user) throw new Error('Please sign in first.');
  const cleanUsername = String(params.username || '').trim().slice(0, 60);
  const cleanPhone = String(params.phoneNumber || '').trim().slice(0, 32);
  const cleanDob = normalizeExcelDob(params.dob);
  if (!cleanUsername) throw new Error('User Name cannot be empty.');

  const dataset = getMergedDataset();
  const entry = dataset.users[state.user.uid];
  if (!entry) throw new Error('Account record not found.');

  const overlay = readOverlayStore();
  overlay.users[state.user.uid] = {
    profile: {
      ...entry.profile,
      username: cleanUsername,
      phoneNumber: cleanPhone,
      dob: cleanDob,
      updatedAt: new Date().toISOString()
    },
    passwordHash: entry.passwordHash
  };
  writeOverlayStore(overlay);

  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
}

async function submitSubscriptionRequest(params: {
  planType: 'monthly' | 'annual' | 'per_lesson';
  lessonId?: string;
  lessonTitle?: string;
  amountLabel?: string;
  contactChannel: 'email' | 'viber';
  contactHandle: string;
  note?: string;
}): Promise<SubscriptionRequest> {
  if (!state.user || !state.profile) throw new Error('Please sign in first.');
  const nowIso = new Date().toISOString();
  const planType = params.planType === 'annual' || params.planType === 'per_lesson' ? params.planType : 'monthly';
  const request: SubscriptionRequest = {
    requestId: `req_${Date.now().toString(36)}_${generateRandomHex(3)}`,
    userId: state.user.uid,
    username: state.profile.username || state.user.displayName || 'Learner',
    userEmail: state.profile.email || state.user.email,
    userPhone: state.profile.phoneNumber || '',
    planType,
    lessonId: params.lessonId ? sanitizeDocId(params.lessonId) : '',
    lessonTitle:
      String(params.lessonTitle || '').trim() ||
      (planType === 'annual'
        ? 'Annual All-Access'
        : planType === 'per_lesson'
        ? 'Single Lesson Pass'
        : 'Monthly All-Access'),
    amountLabel:
      String(params.amountLabel || '').trim() ||
      (planType === 'annual' ? '$149 / yr' : planType === 'per_lesson' ? '9 Kyat' : '$19 / mo'),
    contactChannel: params.contactChannel === 'email' ? 'email' : 'viber',
    contactHandle: String(params.contactHandle || '').trim(),
    note: String(params.note || '').trim().slice(0, 400),
    status: 'pending',
    adminNote: '',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const overlay = readOverlayStore();
  overlay.requests[request.requestId] = request;
  writeOverlayStore(overlay);

  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
  return request;
}

async function cancelPendingRequest(requestId: string): Promise<void> {
  if (!state.user) throw new Error('Please sign in first.');
  const dataset = getMergedDataset();
  const target = dataset.requests[requestId];
  if (!target || target.userId !== state.user.uid || target.status !== 'pending') return;

  const overlay = readOverlayStore();
  overlay.requests[requestId] = {
    ...target,
    status: 'rejected',
    adminNote: 'Cancelled by learner',
    updatedAt: new Date().toISOString()
  };
  writeOverlayStore(overlay);

  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
}

// --- Admin Management Methods ---

async function approveSubscriptionRequest(
  reqDoc: SubscriptionRequest,
  adminNote = 'Verified via QR payment'
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const dataset = getMergedDataset();
  const targetReq = dataset.requests[reqDoc.requestId];
  if (!targetReq) throw new Error('Subscription request not found.');

  const nowIso = new Date().toISOString();
  const overlay = readOverlayStore();
  overlay.requests[reqDoc.requestId] = {
    ...targetReq,
    status: 'approved',
    adminNote,
    updatedAt: nowIso
  };

  const userEntry = dataset.users[targetReq.userId];
  if (userEntry) {
    const nextProfile: UserProfile = {
      ...userEntry.profile,
      membershipStatus: 'active',
      membershipPlan: targetReq.planType,
      updatedAt: nowIso
    };
    if (targetReq.planType === 'per_lesson' && targetReq.lessonId) {
      const set = new Set(nextProfile.subscribedLessonIds || []);
      set.add(targetReq.lessonId);
      nextProfile.subscribedLessonIds = Array.from(set);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + (targetReq.planType === 'annual' ? 365 : 30));
      nextProfile.membershipExpiresAt = d.toISOString().slice(0, 10);
    }
    overlay.users[targetReq.userId] = {
      profile: nextProfile,
      passwordHash: userEntry.passwordHash
    };
  }

  writeOverlayStore(overlay);
  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
}

async function rejectSubscriptionRequest(
  requestId: string,
  adminNote = 'Payment could not be verified'
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const dataset = getMergedDataset();
  const targetReq = dataset.requests[requestId];
  if (targetReq) {
    const overlay = readOverlayStore();
    overlay.requests[requestId] = {
      ...targetReq,
      status: 'rejected',
      adminNote,
      updatedAt: new Date().toISOString()
    };
    writeOverlayStore(overlay);
  }
  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
}

async function updateUserMembershipAdmin(
  userId: string,
  updates: {
    membershipStatus: UserProfile['membershipStatus'];
    membershipPlan: UserProfile['membershipPlan'];
    membershipExpiresAt?: string;
    subscribedLessonIds?: string[];
  }
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const dataset = getMergedDataset();
  const entry = dataset.users[userId];
  if (!entry) throw new Error('User not found.');

  const nextProfile: UserProfile = {
    ...entry.profile,
    membershipStatus: updates.membershipStatus,
    membershipPlan: updates.membershipPlan,
    membershipExpiresAt:
      updates.membershipExpiresAt !== undefined
        ? normalizeExcelDob(updates.membershipExpiresAt)
        : entry.profile.membershipExpiresAt,
    subscribedLessonIds: Array.isArray(updates.subscribedLessonIds)
      ? updates.subscribedLessonIds.map((x) => sanitizeDocId(x))
      : entry.profile.subscribedLessonIds,
    updatedAt: new Date().toISOString()
  };

  const overlay = readOverlayStore();
  overlay.users[userId] = { profile: nextProfile, passwordHash: entry.passwordHash };
  writeOverlayStore(overlay);

  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
}

function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  try {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const buf = new Uint8Array(12);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < buf.length; i++) {
        pw += alphabet[buf[i] % alphabet.length];
      }
      return pw;
    }
  } catch {
    // fallback below
  }
  for (let i = 0; i < 12; i++) {
    pw += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return pw;
}

async function adminResetUserPassword(
  userId: string,
  options: { newPassword?: string } = {}
): Promise<{ temporaryPassword: string; user?: UserProfile }> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const dataset = getMergedDataset();
  const entry = dataset.users[userId];
  if (!entry) throw new Error('User not found.');

  const temporaryPassword = options.newPassword?.trim() || generateTempPassword();
  if (temporaryPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const nextHash = await createSaltedPasswordHash(temporaryPassword);
  const nextProfile: UserProfile = {
    ...entry.profile,
    mustChangePassword: true,
    updatedAt: new Date().toISOString()
  };

  const overlay = readOverlayStore();
  overlay.users[userId] = { profile: nextProfile, passwordHash: nextHash };
  writeOverlayStore(overlay);

  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
  return {
    temporaryPassword,
    user: nextProfile
  };
}

async function saveLessonCatalogItems(
  items: Array<{
    lessonId: string;
    title: string;
    audience: 'Adult' | 'Kids' | string;
    accessType: 'free' | 'paid' | string;
    price: number;
  }>
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const overlay = readOverlayStore();
  const nowIso = new Date().toISOString();
  for (const item of items || []) {
    const id = sanitizeDocId(item.lessonId);
    overlay.lessonCatalog[id] = {
      lessonId: id,
      title: String(item.title || id).trim(),
      audience: item.audience === 'Kids' ? 'Kids' : 'Adult',
      accessType: item.accessType === 'paid' ? 'paid' : 'free',
      price: Math.max(0, Number(item.price) || 0),
      updatedBy: state.user.email,
      updatedAt: nowIso
    };
  }
  writeOverlayStore(overlay);
  syncMemoryFromDataset(getMergedDataset(), state.user.uid);
  emitState();
}

async function getIdToken(): Promise<string | null> {
  return state.user ? state.user.uid : null;
}

function getSiteConfig(): SiteConfig {
  return normalizeSiteConfig(state.siteConfig);
}

async function saveSiteConfig(partial: Partial<SiteConfig>): Promise<SiteConfig> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const nowIso = new Date().toISOString();
  const merged = normalizeSiteConfig({
    ...state.siteConfig,
    ...partial,
    updatedBy: state.user.email,
    updatedAt: nowIso
  });
  const overlay = readOverlayStore();
  overlay.siteConfig = { ...merged };
  writeOverlayStore(overlay);

  state.siteConfig = normalizeSiteConfig(overlay.siteConfig);
  emitSiteConfigChange();
  emitState();

  // Push to live backend / Cloudflare D1 whenever on server host OR connected to Worker URL
  const lb = typeof window !== 'undefined' ? (window as any).LinguaBackend : null;
  const isStaticHost = lb?.isStaticGithubHost ? lb.isStaticGithubHost() : false;
  const hasRemoteBackend = lb?.hasBackend ? lb.hasBackend() : !isStaticHost;

  if (!isStaticHost || hasRemoteBackend) {
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (state.user?.uid) {
        headers['X-Admin-Uid'] = state.user.uid;
        headers['X-User-Uid'] = state.user.uid;
      }
      const apiPath = '/api/admin/site-config';
      const apiUrl =
        typeof window !== 'undefined' && (window as any).LinguaBackend?.apiUrl
          ? (window as any).LinguaBackend.apiUrl(apiPath)
          : apiPath;
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(merged)
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        if (data && data.success && data.config) {
          const serverConfig = normalizeSiteConfig(data.config);
          overlay.siteConfig = { ...serverConfig };
          writeOverlayStore(overlay);
          state.siteConfig = serverConfig;
          emitSiteConfigChange();
          emitState();
        }
      }
    } catch (netErr) {
      console.warn('Could not sync site-config to server:', netErr);
    }
  }

  return state.siteConfig;
}

function exportSiteConfigJson(): void {
  const cfg = getSiteConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'site-config.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 150);
}

async function exportUsersWorkbook(): Promise<{
  fileName: string;
  userCount: number;
  requestCount: number;
  progressCount: number;
  catalogCount: number;
}> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const xlsx = await ensureXlsxLoaded();
  if (!xlsx) throw new Error('SheetJS library is not loaded.');

  const dataset = getMergedDataset();
  const userRows = Object.values(dataset.users).map(({ profile, passwordHash }) => ({
    uid: profile.uid,
    username: profile.username || '',
    email: profile.email || '',
    phoneNumber: profile.phoneNumber || '',
    dob: profile.dob || '',
    passwordHash: passwordHash || '',
    role: profile.role || 'student',
    membershipStatus: profile.membershipStatus || 'free',
    membershipPlan: profile.membershipPlan || 'none',
    membershipExpiresAt: profile.membershipExpiresAt || '',
    subscribedLessonIds: (profile.subscribedLessonIds || []).join(','),
    mustChangePassword: profile.mustChangePassword ? 'true' : 'false',
    createdAt: String(profile.createdAt || ''),
    updatedAt: String(profile.updatedAt || '')
  }));

  const reqRows = sortedRequestsList(dataset).map((r) => ({
    requestId: r.requestId,
    userId: r.userId,
    username: r.username,
    userEmail: r.userEmail,
    userPhone: r.userPhone,
    planType: r.planType,
    lessonId: r.lessonId,
    lessonTitle: r.lessonTitle,
    amountLabel: r.amountLabel,
    contactChannel: r.contactChannel,
    contactHandle: r.contactHandle,
    note: r.note,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || '')
  }));

  const progRows = Object.values(dataset.progress).map((p) => ({
    uid: p.uid,
    currentStreak: p.currentStreak || 0,
    bestStreak: p.bestStreak || 0,
    lastCompletedDate: p.lastCompletedDate || '',
    streakDates: (p.streakDates || []).join(','),
    completedLessonIds: (p.completedLessonIds || []).join(','),
    reminderEnabled: p.reminderEnabled !== false ? 'true' : 'false',
    reminderTime: p.reminderTime || '18:00',
    lastNotifiedDate: p.lastNotifiedDate || '',
    updatedAt: String(p.updatedAt || '')
  }));

  const catRows = Object.values(dataset.lessonCatalog).map((c) => ({
    lessonId: c.lessonId,
    title: c.title,
    audience: c.audience,
    accessType: c.accessType,
    price: Number(c.price) || 0,
    updatedBy: c.updatedBy || '',
    updatedAt: String(c.updatedAt || '')
  }));

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    wb,
    userRows.length
      ? xlsx.utils.json_to_sheet(userRows)
      : xlsx.utils.aoa_to_sheet([
          ['uid', 'username', 'email', 'phoneNumber', 'dob', 'passwordHash', 'role', 'membershipStatus', 'membershipPlan', 'membershipExpiresAt', 'subscribedLessonIds', 'mustChangePassword', 'createdAt', 'updatedAt']
        ]),
    'Users'
  );
  xlsx.utils.book_append_sheet(
    wb,
    reqRows.length
      ? xlsx.utils.json_to_sheet(reqRows)
      : xlsx.utils.aoa_to_sheet([
          ['requestId', 'userId', 'username', 'userEmail', 'userPhone', 'planType', 'lessonId', 'lessonTitle', 'amountLabel', 'contactChannel', 'contactHandle', 'note', 'status', 'adminNote', 'createdAt', 'updatedAt']
        ]),
    'Requests'
  );
  xlsx.utils.book_append_sheet(
    wb,
    progRows.length
      ? xlsx.utils.json_to_sheet(progRows)
      : xlsx.utils.aoa_to_sheet([
          ['uid', 'currentStreak', 'bestStreak', 'lastCompletedDate', 'streakDates', 'completedLessonIds', 'reminderEnabled', 'reminderTime', 'lastNotifiedDate', 'updatedAt']
        ]),
    'Progress'
  );
  xlsx.utils.book_append_sheet(
    wb,
    catRows.length
      ? xlsx.utils.json_to_sheet(catRows)
      : xlsx.utils.aoa_to_sheet([
          ['lessonId', 'title', 'audience', 'accessType', 'price', 'updatedBy', 'updatedAt']
        ]),
    'Catalog'
  );

  xlsx.writeFile(wb, 'users.xlsx');
  return {
    fileName: 'users.xlsx',
    userCount: userRows.length,
    requestCount: reqRows.length,
    progressCount: progRows.length,
    catalogCount: catRows.length
  };
}

async function importUsersWorkbook(arrayBuffer: ArrayBuffer): Promise<{
  userCount: number;
  requestCount: number;
  progressCount: number;
  catalogCount: number;
}> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const xlsx = await ensureXlsxLoaded();
  if (!xlsx) throw new Error('SheetJS library is not loaded.');

  const wb = xlsx.read(arrayBuffer, { type: 'array' });
  const parsed = parseWorkbookToDataset(wb, xlsx);
  const userCount = Object.keys(parsed.users).length;
  if (userCount === 0) {
    throw new Error('No valid user rows with email column found in the uploaded Excel file.');
  }

  // Stamp imported entries cleanly so they apply immediately in the active browser
  const stamp = new Date().toISOString();
  const overlay = readOverlayStore();
  overlay.users = {};
  overlay.requests = {};
  overlay.progress = {};
  overlay.lessonCatalog = {};

  for (const [uid, rec] of Object.entries(parsed.users)) {
    const baseRec = baseWorkbookStore.users[uid];
    const baseMs = baseRec ? parseIsoTimestamp(baseRec.profile.updatedAt) : 0;
    const recMs = parseIsoTimestamp(rec.profile.updatedAt);
    overlay.users[uid] = {
      profile: {
        ...rec.profile,
        updatedAt: recMs >= baseMs && rec.profile.updatedAt ? rec.profile.updatedAt : stamp
      },
      passwordHash: rec.passwordHash
    };
  }
  for (const [id, r] of Object.entries(parsed.requests)) {
    overlay.requests[id] = { ...r, updatedAt: r.updatedAt || stamp };
  }
  for (const [uid, p] of Object.entries(parsed.progress)) {
    overlay.progress[uid] = { ...p, updatedAt: p.updatedAt || stamp };
  }
  for (const [id, c] of Object.entries(parsed.lessonCatalog)) {
    overlay.lessonCatalog[id] = { ...c, updatedAt: c.updatedAt || stamp };
  }
  writeOverlayStore(overlay);

  const merged = getMergedDataset();
  syncMemoryFromDataset(merged, state.user.uid);
  emitState();

  return {
    userCount,
    requestCount: Object.keys(parsed.requests).length,
    progressCount: Object.keys(parsed.progress).length,
    catalogCount: Object.keys(parsed.lessonCatalog).length
  };
}

async function reloadUsersWorkbookFromRepo(): Promise<ExcelSyncSummary> {
  await loadBaseWorkbookFromExcel(true);
  const merged = getMergedDataset();
  syncMemoryFromDataset(merged);
  emitState();
  return getExcelSyncSummary();
}

// --- Access Evaluation Helpers ---

function getLessonPricing(lesson: {
  id?: string;
  lessonId?: string;
  categoryKey?: string;
  accessType?: string;
  access?: string;
  isFree?: unknown;
  price?: unknown;
}): { accessType: 'free' | 'paid'; price: number } {
  const id = sanitizeDocId(lesson?.id || lesson?.lessonId || '');
  const catalogEntry = state.lessonCatalog[id];
  if (catalogEntry) {
    return {
      accessType: catalogEntry.accessType === 'paid' ? 'paid' : 'free',
      price: Number(catalogEntry.price) || (catalogEntry.accessType === 'paid' ? 9 : 0)
    };
  }

  const rawAccess = String(lesson?.accessType || lesson?.access || '').trim().toLowerCase();
  if (rawAccess === 'free' || lesson?.isFree === true || String(lesson?.isFree).toLowerCase() === 'true') {
    return { accessType: 'free', price: 0 };
  }
  if (rawAccess === 'paid' || rawAccess === 'premium' || lesson?.isFree === false || String(lesson?.isFree).toLowerCase() === 'false') {
    const p = Number(lesson?.price);
    return { accessType: 'paid', price: Number.isFinite(p) && p > 0 ? p : 9 };
  }

  const cat = String(lesson?.categoryKey || '').toLowerCase();
  if (cat === 'basics' || cat === 'pinyin' || id.includes('basics') || id.includes('pinyin')) {
    return { accessType: 'free', price: 0 };
  }
  const parsedPrice = Number(lesson?.price);
  return { accessType: 'paid', price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 9 };
}

function hasActiveMembership(): boolean {
  const profile = state.profile;
  if (!profile) return false;
  if (getComputedAdmin()) return true;
  if (profile.membershipStatus !== 'active') return false;

  if (profile.membershipPlan === 'monthly' || profile.membershipPlan === 'annual') {
    if (!profile.membershipExpiresAt) return true;
    const expTime = Date.parse(profile.membershipExpiresAt + 'T23:59:59Z');
    return Number.isNaN(expTime) || expTime >= Date.now();
  }
  return false;
}

function hasPendingRequest(): boolean {
  return state.myRequests.some((r) => r.status === 'pending');
}

function canAccessLesson(lesson: {
  id?: string;
  lessonId?: string;
  categoryKey?: string;
  accessType?: string;
  access?: string;
  isFree?: unknown;
  price?: unknown;
}): boolean {
  const pricing = getLessonPricing(lesson);
  if (pricing.accessType === 'free') return true;
  if (getComputedAdmin()) return true;
  if (hasActiveMembership()) return true;

  const id = sanitizeDocId(lesson?.id || lesson?.lessonId || '');
  const unlocked = state.profile?.subscribedLessonIds || [];
  return unlocked.includes(id);
}

// --- Authenticated User Progress, Streak, Rank & Reminder Persistence ---

function getLocalDateStr(date = new Date()): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateDiffDays(dateStr1: string, dateStr2: string): number {
  if (!dateStr1 || !dateStr2) return Infinity;
  const d1 = new Date(`${dateStr1}T00:00:00`);
  const d2 = new Date(`${dateStr2}T00:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function sanitizeDateStr(raw?: string | null): string {
  const val = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : '';
}

function sanitizeTimeStr(raw?: string | null): string {
  const val = String(raw || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(val) ? val : '18:00';
}

function createDefaultUserProgress(uid: string): UserProgress {
  return {
    uid,
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: '',
    streakDates: [],
    completedLessonIds: [],
    reminderEnabled: true,
    reminderTime: '18:00',
    lastNotifiedDate: ''
  };
}

function normalizeUserProgress(raw: Partial<UserProgress> | null | undefined, uid: string): UserProgress {
  const base = createDefaultUserProgress(uid);
  if (!raw) return base;
  const lastCompletedDate = sanitizeDateStr(raw.lastCompletedDate);
  const storedStreak = Math.min(10000, Math.max(0, Math.round(Number(raw.currentStreak) || 0)));
  const today = getLocalDateStr();
  let effectiveStreak = storedStreak;
  if (!lastCompletedDate) {
    effectiveStreak = 0;
  } else {
    const diff = getDateDiffDays(lastCompletedDate, today);
    if (diff > 1) {
      effectiveStreak = 0;
    } else if (diff === 0 || diff === 1) {
      effectiveStreak = Math.max(1, storedStreak);
    }
  }
  const bestStreak = Math.min(10000, Math.max(effectiveStreak, Math.round(Number(raw.bestStreak) || 0)));
  const streakDates = Array.isArray(raw.streakDates)
    ? Array.from(new Set(raw.streakDates.map((d) => sanitizeDateStr(d)).filter(Boolean))).slice(-366)
    : [];
  const completedLessonIds = Array.isArray(raw.completedLessonIds)
    ? Array.from(
        new Set(raw.completedLessonIds.map((id) => String(id || '').trim().slice(0, 128)).filter(Boolean))
      ).slice(-200)
    : [];
  return {
    uid,
    currentStreak: effectiveStreak,
    bestStreak,
    lastCompletedDate,
    streakDates,
    completedLessonIds,
    reminderEnabled: raw.reminderEnabled !== false,
    reminderTime: sanitizeTimeStr(raw.reminderTime),
    lastNotifiedDate: sanitizeDateStr(raw.lastNotifiedDate),
    updatedAt: raw.updatedAt
  };
}

function getUserProgress(): UserProgress | null {
  if (!state.user) return null;
  return normalizeUserProgress(state.userProgress, state.user.uid);
}

async function persistUserProgress(next: UserProgress): Promise<UserProgress> {
  if (!state.user) throw new Error('Sign in required to save progress.');

  const payload: UserProgress = {
    uid: state.user.uid,
    currentStreak: Math.min(10000, Math.max(0, Math.round(next.currentStreak || 0))),
    bestStreak: Math.min(10000, Math.max(0, Math.round(next.bestStreak || 0))),
    lastCompletedDate: sanitizeDateStr(next.lastCompletedDate),
    streakDates: Array.from(new Set((next.streakDates || []).map((d) => sanitizeDateStr(d)).filter(Boolean))).slice(-366),
    completedLessonIds: Array.from(
      new Set((next.completedLessonIds || []).map((id) => String(id || '').trim().slice(0, 128)).filter(Boolean))
    ).slice(-200),
    reminderEnabled: Boolean(next.reminderEnabled),
    reminderTime: sanitizeTimeStr(next.reminderTime),
    lastNotifiedDate: sanitizeDateStr(next.lastNotifiedDate),
    updatedAt: new Date().toISOString()
  };

  state.userProgress = { ...payload };
  const overlay = readOverlayStore();
  overlay.progress[state.user.uid] = { ...payload };
  writeOverlayStore(overlay);
  emitState();

  return state.userProgress as UserProgress;
}

async function recordLessonCompletedProgress(lessonId: string, completed = true): Promise<UserProgress | null> {
  if (!state.user) return null;

  const cleanId = String(lessonId || '').trim().slice(0, 128);
  const current = getUserProgress() || createDefaultUserProgress(state.user.uid);
  const completedSet = new Set(current.completedLessonIds || []);

  if (cleanId) {
    if (completed) {
      completedSet.add(cleanId);
    } else {
      completedSet.delete(cleanId);
    }
  }

  let currentStreak = current.currentStreak;
  let bestStreak = current.bestStreak;
  let lastCompletedDate = current.lastCompletedDate;
  const streakDates = [...(current.streakDates || [])];

  if (completed) {
    const today = getLocalDateStr();
    if (!lastCompletedDate) {
      currentStreak = 1;
    } else {
      const diff = getDateDiffDays(lastCompletedDate, today);
      if (diff === 0) {
        currentStreak = Math.max(1, currentStreak);
      } else if (diff === 1) {
        currentStreak = currentStreak + 1;
      } else {
        currentStreak = 1;
      }
    }
    lastCompletedDate = today;
    if (!streakDates.includes(today)) {
      streakDates.push(today);
    }
    bestStreak = Math.max(bestStreak, currentStreak);
  }

  return persistUserProgress({
    ...current,
    currentStreak,
    bestStreak,
    lastCompletedDate,
    streakDates: streakDates.slice(-366),
    completedLessonIds: Array.from(completedSet).slice(-200)
  });
}

async function saveReminderPreferences(prefs: {
  enabled?: boolean;
  time?: string;
  lastNotifiedDate?: string;
}): Promise<UserProgress | null> {
  if (!state.user) return null;

  const current = getUserProgress() || createDefaultUserProgress(state.user.uid);
  return persistUserProgress({
    ...current,
    reminderEnabled: typeof prefs.enabled === 'boolean' ? prefs.enabled : current.reminderEnabled,
    reminderTime: prefs.time !== undefined ? sanitizeTimeStr(prefs.time) : current.reminderTime,
    lastNotifiedDate:
      prefs.lastNotifiedDate !== undefined ? sanitizeDateStr(prefs.lastNotifiedDate) : current.lastNotifiedDate
  });
}

function subscribe(cb: (s: AuthState) => void): () => void {
  subscribers.add(cb);
  cb(getState());
  return () => {
    subscribers.delete(cb);
  };
}

function getState(): AuthState {
  return {
    ...state,
    excelSummary: getExcelSyncSummary(),
    isAdmin: getComputedAdmin()
  };
}

const LinguaAuth = {
  CONTACT_INFO,
  MEMBERSHIP_PLANS,
  DEFAULT_SITE_CONFIG,
  calculateAge,
  getState,
  subscribe,
  getIdToken,
  getSiteConfig,
  saveSiteConfig,
  exportSiteConfigJson,
  registerWithEmail,
  loginWithEmail,
  resetPasswordWithVerification,
  sendPasswordReset,
  changePassword,
  reloadAuthSession,
  logout,
  updateProfileDetails,
  submitSubscriptionRequest,
  cancelPendingRequest,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  updateUserMembershipAdmin,
  adminUpdateUserDetails,
  adminResetUserPassword,
  saveLessonCatalogItems,
  exportUsersWorkbook,
  importUsersWorkbook,
  reloadUsersWorkbookFromRepo,
  getExcelSyncSummary,
  getLessonPricing,
  hasActiveMembership,
  hasPendingRequest,
  canAccessLesson,
  getUserProgress,
  recordLessonCompletedProgress,
  saveReminderPreferences
};

declare global {
  interface Window {
    LinguaAuth?: typeof LinguaAuth;
  }
}

window.LinguaAuth = LinguaAuth;
export default LinguaAuth;
