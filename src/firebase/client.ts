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

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as fbUpdateProfile,
  updatePassword as fbUpdatePassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo:
        firebaseAuth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline or unreachable. Continuing with backend & Excel store.');
    }
  }
}

void testFirestoreConnection();

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
  membershipPlan:
    | 'none'
    | 'monthly'
    | 'annual'
    | 'per_lesson'
    | 'course'
    | 'practice_lesson'
    | 'practice_course';
  membershipExpiresAt: string;
  subscribedLessonIds: string[];
  subscribedCourses?: string[];
  practiceLessonIds?: string[];
  practiceCourses?: string[];
  coursePasses?: string[];
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
  planType: 'monthly' | 'annual' | 'per_lesson' | 'course' | 'practice_lesson' | 'practice_course';
  lessonId: string;
  courseName?: string;
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
  course?: string;
  audience: 'Adult' | 'Kids' | string;
  accessType: 'free' | 'paid';
  price: number;
  practicePrice?: number;
  hasExercises?: boolean;
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
  coursePracticePrices?: Record<string, number>;
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
  featuredGameIds: ['game-01'],
  courses: ['HSK 2'],
  coursePrices: { 'HSK 2': 280000 },
  coursePracticePrices: { 'HSK 2': 55000 },
  practicePrice: 55000
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
const API_TOKEN_STORAGE_KEY = 'linguapath_api_token';
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

function normalizeCourseName(raw?: unknown): string {
  const str = String(raw || '').trim();
  if (!str) return 'HSK 2';
  const compact = str.toLowerCase().replace(/[\s_-]+/g, '');
  if (compact === 'hsk1') return 'HSK 1';
  if (compact === 'hsk2') return 'HSK 2';
  if (compact === 'hsk3') return 'HSK 3';
  if (compact === 'hsk4') return 'HSK 4';
  return str.slice(0, 80);
}

function courseSlug(raw?: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
}

function getLessonCourseName(lesson?: { course?: string; courseName?: string; category?: string } | null): string {
  if (!lesson || typeof lesson !== 'object') return 'HSK 2';
  const raw = String(lesson.course || lesson.courseName || lesson.category || '').trim();
  return raw ? normalizeCourseName(raw) : 'HSK 2';
}

function normalizePlan(raw?: unknown): UserProfile['membershipPlan'] {
  const p = String(raw || 'none').trim().toLowerCase();
  if (p === 'practice_lesson' || p === 'practice-lesson') return 'practice_lesson';
  if (p === 'practice_course' || p === 'practice-course') return 'practice_course';
  if (p === 'per_lesson' || p === 'lesson') return 'per_lesson';
  if (p === 'course' || p === 'hsk') return 'course';
  if (p === 'monthly') return 'monthly';
  if (p === 'annual') return 'annual';
  return 'none';
}

function normalizeLessonIdKey(raw?: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]+/g, '-')
    .toLowerCase();
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

function getApiToken(): string {
  try {
    const val = localStorage.getItem(API_TOKEN_STORAGE_KEY);
    return val ? val.trim() : '';
  } catch {
    return '';
  }
}

function setApiToken(token: string | null): void {
  try {
    if (token && token.trim()) {
      localStorage.setItem(API_TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(API_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function getBackendBridge(): { lb: any; hasBackend: boolean; isStaticHost: boolean } {
  const lb = typeof window !== 'undefined' ? (window as any).LinguaBackend : null;
  const isStaticHost = lb && typeof lb.isStaticGithubHost === 'function' ? Boolean(lb.isStaticGithubHost()) : false;
  const hasBackend = lb && typeof lb.hasBackend === 'function' ? Boolean(lb.hasBackend()) : !isStaticHost;
  return { lb, hasBackend, isStaticHost };
}

async function backendApiFetch(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any; rawText: string; isHtml: boolean }> {
  const { lb } = getBackendBridge();
  const url = lb && typeof lb.apiUrl === 'function' ? lb.apiUrl(path) : path;
  const token = getApiToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined)
  };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers
  });
  const rawText = await res.text().catch(() => '');
  const trimmed = rawText.trim();
  const ctype = String(res.headers.get('content-type') || '').toLowerCase();
  const isHtml =
    ctype.includes('text/html') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');
  if (isHtml) {
    return {
      ok: false,
      status: res.status || 404,
      rawText,
      isHtml: true,
      data: {
        success: false,
        error: 'Backend API returned an HTML page instead of JSON. Check your Cloudflare Worker URL in Admin Settings.'
      }
    };
  }
  let parsed: any = null;
  if (trimmed) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = null;
    }
  }
  return {
    ok: res.ok && Boolean(parsed),
    status: res.status,
    rawText,
    isHtml: false,
    data: parsed || (!res.ok && trimmed ? { success: false, error: trimmed.slice(0, 300) } : null)
  };
}

function firestoreTimestampToIso(val: unknown): string {
  if (!val) return '';
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return '';
    }
  }
  return typeof val === 'string' ? val : '';
}

async function fetchSiteConfigFromFirestore(): Promise<Partial<SiteConfig> | null> {
  try {
    const ref = doc(firestoreDb, 'siteConfig', 'homepage');
    let snap;
    try {
      snap = await getDocFromServer(ref);
    } catch {
      snap = await getDoc(ref);
    }
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    return {
      ...raw,
      updatedAt: firestoreTimestampToIso(raw.updatedAt)
    } as Partial<SiteConfig>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg && !/offline|unavailable|permission/i.test(msg)) {
      console.warn('Firestore siteConfig read skipped:', msg);
    }
    return null;
  }
}

async function ensureFirebaseAuthSession(
  email: string,
  password: string,
  displayName?: string,
  mode: 'login' | 'register' = 'login'
): Promise<void> {
  try {
    if (!email || !password) return;
    if (firebaseAuth.currentUser && String(firebaseAuth.currentUser.email || '').toLowerCase() === email.toLowerCase()) {
      return;
    }
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (signErr: any) {
      const code = String(signErr?.code || '');
      if (mode === 'register' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        try {
          const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          if (displayName && cred.user) {
            await fbUpdateProfile(cred.user, { displayName }).catch(() => {});
          }
        } catch {
          // Ignore if email already exists in Firebase Auth with an older password
        }
      }
    }
  } catch {
    // Firebase Auth mirror must never break backend auth
  }
}

async function canWriteFirestoreAsAdmin(): Promise<boolean> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return false;
  const fbEmail = String(fbUser.email || '').trim().toLowerCase();
  if (fbEmail === ADMIN_EMAIL && fbUser.emailVerified) {
    try {
      const admRef = doc(firestoreDb, 'admins', fbUser.uid);
      const admSnap = await getDoc(admRef);
      if (!admSnap.exists()) {
        await setDoc(admRef, {
          uid: fbUser.uid,
          email: fbEmail,
          grantedAt: serverTimestamp()
        });
      }
      return true;
    } catch {
      return true;
    }
  }
  try {
    const admSnap = await getDoc(doc(firestoreDb, 'admins', fbUser.uid));
    return admSnap.exists();
  } catch {
    return false;
  }
}

async function syncSiteConfigToFirestore(cfg: SiteConfig): Promise<boolean> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return false;
  const allowed = await canWriteFirestoreAsAdmin();
  if (!allowed) return false;

  try {
    const safeLogoUrl =
      /^data:/i.test(cfg.siteLogoUrl) && cfg.siteLogoUrl.length > 1950
        ? DEFAULT_SITE_CONFIG.siteLogoUrl
        : String(cfg.siteLogoUrl || '').slice(0, 1950);
    const safeBannerUrl =
      /^data:/i.test(cfg.heroBannerUrl) && cfg.heroBannerUrl.length > 480
        ? DEFAULT_SITE_CONFIG.heroBannerUrl
        : String(cfg.heroBannerUrl || DEFAULT_SITE_CONFIG.heroBannerUrl).slice(0, 480);

    const firestoreDoc: Record<string, unknown> = {
      configId: 'homepage',
      heroEyebrow: cfg.heroEyebrow,
      heroTitleLine1: cfg.heroTitleLine1,
      heroTitleHighlight: cfg.heroTitleHighlight,
      heroSubtitle: cfg.heroSubtitle,
      heroPrimaryCta: cfg.heroPrimaryCta,
      heroSecondaryCta: cfg.heroSecondaryCta,
      heroBannerUrl: safeBannerUrl,
      siteLogoUrl: safeLogoUrl,
      workerApiBaseUrl: String(cfg.workerApiBaseUrl || '').slice(0, 290),
      storiesLabel: cfg.storiesLabel,
      storiesTitle: cfg.storiesTitle,
      storiesSubtitle: cfg.storiesSubtitle,
      reelsLabel: cfg.reelsLabel || 'Short Reels',
      reelsTitle: cfg.reelsTitle || 'Short Reels',
      reelsSubtitle: cfg.reelsSubtitle || '',
      gamesLabel: cfg.gamesLabel,
      gamesTitle: cfg.gamesTitle,
      gamesSubtitle: cfg.gamesSubtitle,
      lessonsLabel: cfg.lessonsLabel,
      lessonsTitle: cfg.lessonsTitle,
      lessonsSubtitle: cfg.lessonsSubtitle,
      lessonsBadge: cfg.lessonsBadge || '',
      lessonsCardTitle: cfg.lessonsCardTitle || '',
      lessonsCardSubtitle: cfg.lessonsCardSubtitle || '',
      lessonsCardDesc: cfg.lessonsCardDesc || '',
      lessonsBullets: Array.isArray(cfg.lessonsBullets) ? cfg.lessonsBullets.slice(0, 6) : [],
      lessonsCta: cfg.lessonsCta || '',
      courses: Array.isArray(cfg.courses) ? cfg.courses.slice(0, 50) : ['HSK 2'],
      coursePrices: cfg.coursePrices || { 'HSK 2': 280000 },
      coursePracticePrices: cfg.coursePracticePrices || { 'HSK 2': 55000 },
      practicePrice: typeof cfg.practicePrice === 'number' ? cfg.practicePrice : 55000,
      adultBadge: cfg.adultBadge || '',
      adultTitle: cfg.adultTitle || '',
      adultSubtitle: cfg.adultSubtitle || '',
      adultDesc: cfg.adultDesc || '',
      adultBullets: Array.isArray(cfg.adultBullets) ? cfg.adultBullets.slice(0, 6) : [],
      adultCta: cfg.adultCta || '',
      kidsBadge: cfg.kidsBadge || '',
      kidsTitle: cfg.kidsTitle || '',
      kidsSubtitle: cfg.kidsSubtitle || '',
      kidsDesc: cfg.kidsDesc || '',
      kidsBullets: Array.isArray(cfg.kidsBullets) ? cfg.kidsBullets.slice(0, 6) : [],
      kidsCta: cfg.kidsCta || '',
      contactEmail: cfg.contactEmail,
      contactPhone: cfg.contactPhone,
      contactViber: cfg.contactViber,
      featuredReelIds: Array.isArray(cfg.featuredReelIds) ? cfg.featuredReelIds.slice(0, 24) : [],
      featuredStoryIds: Array.isArray(cfg.featuredStoryIds) ? cfg.featuredStoryIds.slice(0, 24) : [],
      featuredGameIds: Array.isArray(cfg.featuredGameIds) ? cfg.featuredGameIds.slice(0, 24) : [],
      updatedBy: fbUser.uid,
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(firestoreDb, 'siteConfig', 'homepage'), firestoreDoc);
    return true;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, 'siteConfig/homepage');
    } catch {
      return false;
    }
    return false;
  }
}

async function syncUserProfileToFirestore(profile: UserProfile): Promise<void> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser || !profile?.email) return;
  if (String(fbUser.email || '').trim().toLowerCase() !== profile.email.trim().toLowerCase()) return;
  const docPath = `users/${fbUser.uid}`;
  try {
    const ref = doc(firestoreDb, 'users', fbUser.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        username: String(profile.username || 'Learner').slice(0, 60),
        email: String(profile.email || '').slice(0, 160),
        phoneNumber: String(profile.phoneNumber || '').slice(0, 32),
        dob: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.dob || '')) ? profile.dob : '',
        role: 'student',
        membershipStatus: 'free',
        membershipPlan: 'none',
        membershipExpiresAt: '',
        subscribedLessonIds: [],
        subscribedCourses: [],
        practiceLessonIds: [],
        practiceCourses: [],
        linkedProviders: ['password'],
        mustChangePassword: Boolean(profile.mustChangePassword),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(
        ref,
        {
          username: String(profile.username || 'Learner').slice(0, 60),
          email: String(profile.email || '').slice(0, 160),
          phoneNumber: String(profile.phoneNumber || '').slice(0, 32),
          dob: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.dob || '')) ? profile.dob : '',
          linkedProviders: Array.isArray(profile.linkedProviders) && profile.linkedProviders.length ? profile.linkedProviders.slice(0, 5) : ['password'],
          mustChangePassword: Boolean(profile.mustChangePassword),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    } catch {
      // Non-fatal mirror
    }
  }
}

async function syncUserProgressToFirestore(progress: UserProgress): Promise<void> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser) return;
  const docPath = `userProgress/${fbUser.uid}`;
  try {
    await setDoc(doc(firestoreDb, 'userProgress', fbUser.uid), {
      uid: fbUser.uid,
      currentStreak: Math.min(10000, Math.max(0, Math.round(progress.currentStreak || 0))),
      bestStreak: Math.min(10000, Math.max(0, Math.round(progress.bestStreak || 0))),
      lastCompletedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(progress.lastCompletedDate || '')) ? progress.lastCompletedDate : '',
      streakDates: Array.isArray(progress.streakDates) ? progress.streakDates.slice(-366) : [],
      completedLessonIds: Array.isArray(progress.completedLessonIds) ? progress.completedLessonIds.slice(-200) : [],
      reminderEnabled: Boolean(progress.reminderEnabled),
      reminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(progress.reminderTime || '')) ? progress.reminderTime : '18:00',
      lastNotifiedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(progress.lastNotifiedDate || '')) ? progress.lastNotifiedDate : '',
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    } catch {
      // Non-fatal mirror
    }
  }
}

async function syncCatalogToFirestore(items: LessonCatalogItem[]): Promise<void> {
  const fbUser = firebaseAuth.currentUser;
  if (!fbUser || !items.length) return;
  const allowed = await canWriteFirestoreAsAdmin();
  if (!allowed) return;
  for (const item of items) {
    const lessonId = sanitizeDocId(item.lessonId);
    if (!lessonId) continue;
    try {
      await setDoc(doc(firestoreDb, 'lessonCatalog', lessonId), {
        lessonId,
        title: String(item.title || lessonId).slice(0, 160),
        course: normalizeCourseName(item.course || 'HSK 2').slice(0, 80),
        audience: ['Adult', 'Kids', 'HSK 1', 'HSK 2'].includes(String(item.audience)) ? item.audience : 'Adult',
        accessType: item.accessType === 'paid' ? 'paid' : 'free',
        price: Math.max(0, Number(item.price) || 0),
        practicePrice: Math.max(0, Number(item.practicePrice) || 0),
        hasExercises: item.hasExercises !== false,
        updatedBy: fbUser.uid,
        updatedAt: serverTimestamp()
      });
    } catch {
      // Ignore individual mirror failures
    }
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

      const membershipPlan = normalizePlan(row.membershipPlan);

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
        subscribedLessonIds: parseCommaList(row.subscribedLessonIds).map((id) => sanitizeDocId(id)),
        subscribedCourses: parseCommaList(row.subscribedCourses || row.SubscribedCourses).map((c) => normalizeCourseName(c)),
        practiceLessonIds: parseCommaList(row.practiceLessonIds || row.PracticeLessonIds).map((id) => sanitizeDocId(id)),
        practiceCourses: parseCommaList(row.practiceCourses || row.PracticeCourses).map((c) => normalizeCourseName(c)),
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
      const planRaw = String(row.planType || 'course').trim().toLowerCase();
      const planType: SubscriptionRequest['planType'] =
        planRaw === 'annual' ||
        planRaw === 'monthly' ||
        planRaw === 'per_lesson' ||
        planRaw === 'practice_lesson' ||
        planRaw === 'course' ||
        planRaw === 'practice_course'
          ? planRaw
          : 'course';
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
        lessonId: row.lessonId ? sanitizeDocId(String(row.lessonId)) : '',
        courseName: row.courseName ? normalizeCourseName(row.courseName) : '',
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
      const rawPrac = Number(String(row.practicePrice ?? '').replace(/,/g, '').trim());
      const rawHasEx = row.hasExercises;
      const hasExParsed =
        rawHasEx === '' || rawHasEx === undefined || rawHasEx === null
          ? undefined
          : normalizeBool(rawHasEx, true);
      dataset.lessonCatalog[lessonId] = {
        lessonId,
        title: String(row.title || lessonId).trim(),
        course: row.course ? normalizeCourseName(row.course) : undefined,
        audience: String(row.audience || '').trim().toLowerCase() === 'kids' ? 'Kids' : 'Adult',
        accessType: String(row.accessType || '').trim().toLowerCase() === 'paid' ? 'paid' : 'free',
        price: Math.max(0, Number(row.price) || 0),
        practicePrice: Number.isFinite(rawPrac) && rawPrac > 0 ? Math.round(rawPrac) : 0,
        ...(typeof hasExParsed === 'boolean' ? { hasExercises: hasExParsed } : {}),
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

let linguaSyncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    linguaSyncChannel = new BroadcastChannel('lingua-sync');
    linguaSyncChannel.onmessage = (event) => {
      if (event?.data?.type === 'site-config' && event?.data?.config) {
        state.siteConfig = normalizeSiteConfig(event.data.config);
        (window as any).__INITIAL_SITE_CONFIG_CACHE__ = state.siteConfig;
        emitSiteConfigChange(false);
      }
    };
  }
} catch (_) {}

function emitSiteConfigChange(broadcast = true): void {
  if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('lingua-site-config-change', { detail: state.siteConfig }));
  }
  if (broadcast && linguaSyncChannel) {
    try {
      linguaSyncChannel.postMessage({ type: 'site-config', config: state.siteConfig });
    } catch (_) {}
  }
  try {
    if (typeof localStorage !== 'undefined' && broadcast) {
      localStorage.setItem('linguapath_sync_timestamp', String(Date.now()));
    }
  } catch (_) {}
}

function normalizeStrList(
  raw: unknown,
  maxItems: number,
  maxLen: number,
  fallback: string[],
  dedupeCaseInsensitive = false
): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const clean = String(x || '').trim().slice(0, maxLen);
    if (!clean) continue;
    if (dedupeCaseInsensitive) {
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
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
    coursePrices: (() => {
      const rawMap = raw?.coursePrices && typeof raw.coursePrices === 'object' ? raw.coursePrices : (DEFAULT_SITE_CONFIG.coursePrices || { 'HSK 2': 280000 });
      const cleanMap: Record<string, number> = {};
      const slugToKey: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawMap)) {
        const key = String(k || '').trim();
        if (!key) continue;
        const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const cleanVal = typeof v === 'string' ? Number(String(v).replace(/,/g, '').trim()) : Number(v);
        if (!Number.isFinite(cleanVal) || cleanVal < 0) continue;
        if (slug && slugToKey[slug] && slugToKey[slug] !== key) {
          delete cleanMap[slugToKey[slug]];
        }
        if (slug) slugToKey[slug] = key;
        cleanMap[key] = Math.round(cleanVal);
      }
      return Object.keys(cleanMap).length > 0 ? cleanMap : { ...(DEFAULT_SITE_CONFIG.coursePrices || { 'HSK 2': 280000 }) };
    })(),
    coursePracticePrices: (() => {
      const defaultPrac =
        typeof raw?.practicePrice === 'number' && Number.isFinite(raw.practicePrice) && raw.practicePrice > 0
          ? Math.round(raw.practicePrice)
          : DEFAULT_SITE_CONFIG.practicePrice || 55000;
      const rawMap =
        raw?.coursePracticePrices && typeof raw.coursePracticePrices === 'object'
          ? raw.coursePracticePrices
          : DEFAULT_SITE_CONFIG.coursePracticePrices || { 'HSK 2': defaultPrac };
      const cleanMap: Record<string, number> = {};
      const slugToKey: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawMap)) {
        const key = String(k || '').trim();
        if (!key) continue;
        const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const cleanVal = typeof v === 'string' ? Number(String(v).replace(/,/g, '').trim()) : Number(v);
        if (!Number.isFinite(cleanVal) || cleanVal < 0) continue;
        if (slug && slugToKey[slug] && slugToKey[slug] !== key) {
          delete cleanMap[slugToKey[slug]];
        }
        if (slug) slugToKey[slug] = key;
        cleanMap[key] = Math.round(cleanVal);
      }
      return cleanMap;
    })(),
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
      ? normalizeStrList(raw.featuredReelIds, 24, 128, [], true)
      : [...DEFAULT_SITE_CONFIG.featuredReelIds],
    featuredStoryIds: Array.isArray(raw?.featuredStoryIds)
      ? normalizeStrList(raw.featuredStoryIds, 24, 128, [], true)
      : [...DEFAULT_SITE_CONFIG.featuredStoryIds],
    featuredGameIds: Array.isArray(raw?.featuredGameIds)
      ? normalizeStrList(raw.featuredGameIds, 24, 128, [], true)
      : [...DEFAULT_SITE_CONFIG.featuredGameIds],
    updatedBy: raw?.updatedBy,
    updatedAt: raw?.updatedAt
  };
}

function getInitialSynchronousSiteConfig(): SiteConfig {
  try {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_SITE_CONFIG_CACHE__) {
      return normalizeSiteConfig((window as any).__INITIAL_SITE_CONFIG_CACHE__);
    }
    if (typeof localStorage !== 'undefined') {
      const backupRaw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
      if (backupRaw) {
        const parsed = JSON.parse(backupRaw);
        if (parsed && typeof parsed === 'object') {
          return normalizeSiteConfig(parsed);
        }
      }
      const overlayRaw = localStorage.getItem(OVERLAY_STORAGE_KEY);
      if (overlayRaw) {
        const parsedOverlay = JSON.parse(overlayRaw);
        if (parsedOverlay?.siteConfig && typeof parsedOverlay.siteConfig === 'object') {
          return normalizeSiteConfig(parsedOverlay.siteConfig);
        }
      }
    }
  } catch (_) {}
  return { ...DEFAULT_SITE_CONFIG };
}

state.siteConfig = getInitialSynchronousSiteConfig();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SITE_CONFIG_STORAGE_KEY || e.key === 'linguapath_sync_timestamp') {
      try {
        const freshRaw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
        if (freshRaw) {
          const parsed = JSON.parse(freshRaw);
          if (parsed && typeof parsed === 'object') {
            state.siteConfig = normalizeSiteConfig(parsed);
            (window as any).__INITIAL_SITE_CONFIG_CACHE__ = state.siteConfig;
            emitSiteConfigChange(false);
          }
        }
      } catch (_) {}
    }
    if (e.key === 'linguapath_cms_lessons_v2') {
      try {
        const draftRaw = localStorage.getItem('linguapath_cms_lessons_v2');
        if (draftRaw) {
          const parsed = JSON.parse(draftRaw) as { sheets?: { Lessons?: unknown[]; Exercises?: Array<{ lessonId?: string }> } };
          if (Array.isArray(parsed?.sheets?.Lessons)) {
            updateActiveLessonsRegistry(parsed.sheets.Lessons, {
              allowEmpty: true,
              exercises: Array.isArray(parsed?.sheets?.Exercises) ? parsed.sheets.Exercises : undefined
            });
          }
        }
      } catch (_) {}
    }
    if (e.key === OVERLAY_STORAGE_KEY || e.key === 'linguapath_sync_timestamp') {
      try {
        const merged = getMergedDataset();
        reconcileDatasetWithLessons(merged);
        syncMemoryFromDataset(merged);
        emitState();
      } catch (_) {}
    }
  });

  window.addEventListener('linguapath-content-change', (e: Event) => {
    const detail = (e as CustomEvent)?.detail as {
      domain?: string;
      sheets?: { Lessons?: unknown[]; Exercises?: Array<{ lessonId?: string }> };
    } | undefined;
    if (detail?.domain === 'lessons' && Array.isArray(detail?.sheets?.Lessons)) {
      updateActiveLessonsRegistry(detail.sheets.Lessons, {
        allowEmpty: true,
        exercises: Array.isArray(detail?.sheets?.Exercises) ? detail.sheets.Exercises : undefined
      });
    }
  });
}

// --- Active Curriculum Lesson Registry & Deleted-Lesson Reconciliation ---

let validLessonIdsLoaded = false;
let validExercisesLoaded = false;
const validLessonIdMap = new Map<string, string>(); // normalized lower key -> canonical id
const validLessonTitleMap = new Map<string, string>(); // normalized lower key -> display title
const validLessonCourseMap = new Map<string, string>(); // normalized lower key -> normalized course name
const validLessonExerciseMap = new Map<string, number>(); // normalized lower key -> exercise count
const validCourseExerciseMap = new Map<string, number>(); // course slug -> total exercises in course
let validStoryIdSet: Set<string> | null = null;

function isLessonIdActive(lessonId: string): boolean {
  const key = normalizeLessonIdKey(lessonId);
  if (!key) return false;
  if (!validLessonIdsLoaded) return true;
  return validLessonIdMap.has(key);
}

function getValidLessonIds(): string[] | null {
  if (!validLessonIdsLoaded) return null;
  return Array.from(validLessonIdMap.values());
}

function getLessonTitle(lessonId: string): string {
  const key = normalizeLessonIdKey(lessonId);
  if (!key) return '';
  if (validLessonTitleMap.has(key)) {
    return validLessonTitleMap.get(key) || '';
  }
  const cat = state.lessonCatalog[sanitizeDocId(lessonId)] || state.lessonCatalog[lessonId];
  return cat?.title ? String(cat.title) : '';
}

function getLessonExerciseCount(lessonOrId: string | { id?: string; lessonId?: string }): number | null {
  const rawId = typeof lessonOrId === 'string' ? lessonOrId : String(lessonOrId?.id || lessonOrId?.lessonId || '');
  const key = normalizeLessonIdKey(rawId);
  if (!key) return 0;
  if (validExercisesLoaded) {
    return validLessonExerciseMap.get(key) || 0;
  }
  return null;
}

function lessonHasExercises(
  lessonOrId: string | { id?: string; lessonId?: string; hasExercises?: boolean; exerciseCount?: number }
): boolean {
  if (!lessonOrId) return false;
  if (typeof lessonOrId === 'object' && typeof lessonOrId.exerciseCount === 'number') {
    return lessonOrId.exerciseCount > 0;
  }
  const rawId = typeof lessonOrId === 'string' ? lessonOrId : String(lessonOrId?.id || lessonOrId?.lessonId || '');
  const key = normalizeLessonIdKey(rawId);
  if (!key) return false;
  if (validExercisesLoaded) {
    return (validLessonExerciseMap.get(key) || 0) > 0;
  }
  if (typeof lessonOrId === 'object' && typeof lessonOrId.hasExercises === 'boolean') {
    return lessonOrId.hasExercises;
  }
  const cat = state.lessonCatalog[sanitizeDocId(rawId)] || state.lessonCatalog[rawId];
  if (cat && typeof cat.hasExercises === 'boolean') {
    return cat.hasExercises;
  }
  return true;
}

function courseHasExercises(courseName: string): boolean {
  const slug = courseSlug(normalizeCourseName(courseName));
  if (!slug) return false;
  if (validExercisesLoaded) {
    return (validCourseExerciseMap.get(slug) || 0) > 0;
  }
  const matchingCatalog = Object.values(state.lessonCatalog).filter(
    (c) => courseSlug(normalizeCourseName(c.course || 'HSK 2')) === slug
  );
  if (matchingCatalog.length > 0 && matchingCatalog.some((c) => typeof c.hasExercises === 'boolean')) {
    return matchingCatalog.some((c) => c.hasExercises === true);
  }
  return true;
}

function isTimePassActive(profile: UserProfile): boolean {
  if (profile.membershipPlan !== 'monthly' && profile.membershipPlan !== 'annual') return false;
  if (!profile.membershipExpiresAt) return true;
  const expTime = Date.parse(profile.membershipExpiresAt + 'T23:59:59Z');
  return Number.isNaN(expTime) || expTime >= Date.now();
}

function arraysEqualStr(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function reconcileProfileEntitlements(
  profile: UserProfile,
  explicitDeletedSet: Set<string>
): { profile: UserProfile; changed: boolean } {
  const origLessons = Array.isArray(profile.subscribedLessonIds) ? profile.subscribedLessonIds : [];
  const origPracticeLessons = Array.isArray(profile.practiceLessonIds) ? profile.practiceLessonIds : [];
  const origCourses = Array.isArray(profile.subscribedCourses) ? profile.subscribedCourses : [];
  const origPracticeCourses = Array.isArray(profile.practiceCourses) ? profile.practiceCourses : [];

  const filterLessonArr = (arr: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const rawId of arr) {
      const cleanId = String(rawId || '').trim();
      const key = normalizeLessonIdKey(cleanId);
      if (!key) continue;
      if (explicitDeletedSet.has(key)) continue;
      if (validLessonIdsLoaded && !validLessonIdMap.has(key)) continue;
      const canonical = validLessonIdMap.get(key) || sanitizeDocId(cleanId);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(canonical);
      }
    }
    return out;
  };

  const dedupeCourses = (arr: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const c of arr) {
      const norm = normalizeCourseName(c);
      const slug = courseSlug(norm);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(norm);
    }
    return out;
  };

  const nextLessons = filterLessonArr(origLessons);
  const nextPracticeLessons = filterLessonArr(origPracticeLessons);
  const nextCourses = dedupeCourses(origCourses);
  const nextPracticeCourses = dedupeCourses(origPracticeCourses);

  let changed =
    !arraysEqualStr(nextLessons, origLessons) ||
    !arraysEqualStr(nextPracticeLessons, origPracticeLessons) ||
    !arraysEqualStr(nextCourses, origCourses) ||
    !arraysEqualStr(nextPracticeCourses, origPracticeCourses);

  let nextStatus = profile.membershipStatus || 'free';
  let nextPlan = normalizePlan(profile.membershipPlan);

  const isAdm = profile.role === 'admin' || String(profile.email || '').trim().toLowerCase() === ADMIN_EMAIL;
  if (!isAdm) {
    const hasFullCourses = nextCourses.length > 0;
    const hasPracCourses = nextPracticeCourses.length > 0;
    const hasFullLessons = nextLessons.length > 0;
    const hasPracLessons = nextPracticeLessons.length > 0;
    const hasAnyEntitlement = hasFullCourses || hasPracCourses || hasFullLessons || hasPracLessons;
    const hasTimePass = isTimePassActive({ ...profile, membershipPlan: nextPlan });

    if (!hasAnyEntitlement && !hasTimePass) {
      if (nextStatus === 'active') {
        nextStatus = 'free';
        changed = true;
      }
      if (nextPlan !== 'none' && nextStatus === 'free') {
        nextPlan = 'none';
        changed = true;
      }
    } else if (hasAnyEntitlement && nextStatus === 'active') {
      const matchesCurrent =
        (nextPlan === 'course' && hasFullCourses) ||
        (nextPlan === 'practice_course' && hasPracCourses) ||
        (nextPlan === 'per_lesson' && hasFullLessons) ||
        (nextPlan === 'practice_lesson' && hasPracLessons) ||
        hasTimePass;
      if (!matchesCurrent) {
        nextPlan = hasFullCourses
          ? 'course'
          : hasPracCourses
          ? 'practice_course'
          : hasFullLessons
          ? 'per_lesson'
          : 'practice_lesson';
        changed = true;
      }
    }
  }

  if (nextPlan !== profile.membershipPlan || nextStatus !== profile.membershipStatus) {
    changed = true;
  }

  const nextProfile: UserProfile = {
    ...profile,
    membershipStatus: nextStatus,
    membershipPlan: nextPlan,
    subscribedLessonIds: nextLessons,
    subscribedCourses: nextCourses,
    practiceLessonIds: nextPracticeLessons,
    practiceCourses: nextPracticeCourses
  };

  return { profile: nextProfile, changed };
}

function cleanLocalLessonArtifacts(explicitDeletedSet: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const pricingRaw = localStorage.getItem('linguapath_local_lesson_pricing');
    if (pricingRaw) {
      const pricingMap = JSON.parse(pricingRaw) as Record<string, unknown>;
      if (pricingMap && typeof pricingMap === 'object') {
        let mapChanged = false;
        for (const key of Object.keys(pricingMap)) {
          const normKey = normalizeLessonIdKey(key);
          if (explicitDeletedSet.has(normKey) || (validLessonIdsLoaded && !validLessonIdMap.has(normKey))) {
            delete pricingMap[key];
            mapChanged = true;
          }
        }
        if (mapChanged) {
          localStorage.setItem('linguapath_local_lesson_pricing', JSON.stringify(pricingMap));
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  try {
    const activeRaw = localStorage.getItem('linguapath_active_lesson');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw) as { id?: string; lessonId?: string };
      const activeKey = normalizeLessonIdKey(parsed?.id || parsed?.lessonId || '');
      if (activeKey && (explicitDeletedSet.has(activeKey) || (validLessonIdsLoaded && !validLessonIdMap.has(activeKey)))) {
        localStorage.removeItem('linguapath_active_lesson');
      }
    }
  } catch {
    // ignore storage errors
  }
}

function reconcileDatasetWithLessons(
  dataset: ExcelDataset,
  explicitDeletedIds: string[] = []
): { dataset: ExcelDataset; changed: boolean } {
  const explicitDeletedSet = new Set(
    (explicitDeletedIds || []).map((id) => normalizeLessonIdKey(id)).filter(Boolean)
  );
  if (!validLessonIdsLoaded && explicitDeletedSet.size === 0) {
    return { dataset, changed: false };
  }

  const nowIso = new Date().toISOString();
  const overlay = readOverlayStore();
  let overlayDirty = false;
  let datasetDirty = false;

  // 1. Prune lessonCatalog
  for (const catKey of Object.keys(dataset.lessonCatalog || {})) {
    const normKey = normalizeLessonIdKey(catKey);
    if (explicitDeletedSet.has(normKey) || (validLessonIdsLoaded && !validLessonIdMap.has(normKey))) {
      delete dataset.lessonCatalog[catKey];
      datasetDirty = true;
    }
  }
  for (const catKey of Object.keys(overlay.lessonCatalog || {})) {
    const normKey = normalizeLessonIdKey(catKey);
    if (explicitDeletedSet.has(normKey) || (validLessonIdsLoaded && !validLessonIdMap.has(normKey))) {
      delete overlay.lessonCatalog[catKey];
      overlayDirty = true;
    }
  }
  for (const catKey of Object.keys(baseWorkbookStore.lessonCatalog || {})) {
    const normKey = normalizeLessonIdKey(catKey);
    if (explicitDeletedSet.has(normKey) || (validLessonIdsLoaded && !validLessonIdMap.has(normKey))) {
      delete baseWorkbookStore.lessonCatalog[catKey];
    }
  }

  // 2. Reconcile user accounts in merged dataset & overlay
  for (const [uid, rec] of Object.entries(dataset.users || {})) {
    if (!rec?.profile) continue;
    const { profile: cleaned, changed } = reconcileProfileEntitlements(rec.profile, explicitDeletedSet);
    if (changed) {
      cleaned.updatedAt = nowIso;
      dataset.users[uid] = { ...rec, profile: cleaned };
      overlay.users[uid] = { profile: cleaned, passwordHash: rec.passwordHash };
      overlayDirty = true;
      datasetDirty = true;
    }
  }
  for (const [uid, ovRec] of Object.entries(overlay.users || {})) {
    if (!ovRec?.profile) continue;
    const { profile: cleaned, changed } = reconcileProfileEntitlements(ovRec.profile, explicitDeletedSet);
    if (changed) {
      cleaned.updatedAt = nowIso;
      overlay.users[uid] = { ...ovRec, profile: cleaned };
      overlayDirty = true;
    }
  }

  // 3. Prune deleted lessons from userProgress.completedLessonIds (preserve story IDs!)
  const pruneCompleted = (ids: string[] | undefined): { next: string[]; changed: boolean } => {
    const orig = Array.isArray(ids) ? ids : [];
    const next = orig.filter((id) => {
      const key = normalizeLessonIdKey(id);
      if (!key) return false;
      if (explicitDeletedSet.has(key)) return false;
      if (validLessonIdsLoaded && validStoryIdSet && !validLessonIdMap.has(key) && !validStoryIdSet.has(key)) {
        return false;
      }
      return true;
    });
    return { next, changed: !arraysEqualStr(next, orig) };
  };

  for (const [uid, prog] of Object.entries(dataset.progress || {})) {
    if (!prog) continue;
    const { next, changed } = pruneCompleted(prog.completedLessonIds);
    if (changed) {
      const updated = { ...prog, completedLessonIds: next, updatedAt: nowIso };
      dataset.progress[uid] = updated;
      overlay.progress[uid] = updated;
      overlayDirty = true;
      datasetDirty = true;
    }
  }
  for (const [uid, prog] of Object.entries(overlay.progress || {})) {
    if (!prog) continue;
    const { next, changed } = pruneCompleted(prog.completedLessonIds);
    if (changed) {
      overlay.progress[uid] = { ...prog, completedLessonIds: next, updatedAt: nowIso };
      overlayDirty = true;
    }
  }

  // 4. Mark pending lesson-specific requests for deleted lessons as rejected
  const checkReqDeleted = (req: SubscriptionRequest | undefined): SubscriptionRequest | null => {
    if (!req || req.status !== 'pending') return null;
    if (req.planType !== 'per_lesson' && req.planType !== 'practice_lesson') return null;
    const key = normalizeLessonIdKey(req.lessonId);
    if (!key) return null;
    if (explicitDeletedSet.has(key) || (validLessonIdsLoaded && !validLessonIdMap.has(key))) {
      return {
        ...req,
        status: 'rejected',
        adminNote: 'Lesson removed from curriculum',
        updatedAt: nowIso
      };
    }
    return null;
  };

  for (const [reqId, req] of Object.entries(dataset.requests || {})) {
    const updatedReq = checkReqDeleted(req);
    if (updatedReq) {
      dataset.requests[reqId] = updatedReq;
      overlay.requests[reqId] = updatedReq;
      overlayDirty = true;
      datasetDirty = true;
    }
  }
  for (const [reqId, req] of Object.entries(overlay.requests || {})) {
    const updatedReq = checkReqDeleted(req);
    if (updatedReq) {
      overlay.requests[reqId] = updatedReq;
      overlayDirty = true;
    }
  }

  cleanLocalLessonArtifacts(explicitDeletedSet);

  if (overlayDirty) {
    writeOverlayStore(overlay);
  }

  return { dataset, changed: datasetDirty || overlayDirty };
}

function updateActiveLessonsRegistry(
  lessonsOrIds: unknown[],
  options?: { allowEmpty?: boolean; explicitDeletedIds?: string[]; exercises?: Array<{ lessonId?: string }> }
): boolean {
  if (!Array.isArray(lessonsOrIds)) return false;
  if (lessonsOrIds.length === 0 && !options?.allowEmpty) {
    if (options?.explicitDeletedIds?.length) {
      const merged = getMergedDataset();
      const { changed } = reconcileDatasetWithLessons(merged, options.explicitDeletedIds);
      if (changed) {
        syncMemoryFromDataset(merged);
        emitState();
      }
      return changed;
    }
    return false;
  }

  const prevKeys = validLessonIdsLoaded ? new Set(validLessonIdMap.keys()) : new Set<string>();
  const nextIdMap = new Map<string, string>();
  const nextTitleMap = new Map<string, string>();
  const nextCourseMap = new Map<string, string>();

  for (const entry of lessonsOrIds) {
    if (typeof entry === 'string') {
      const rawId = entry.trim();
      const key = normalizeLessonIdKey(rawId);
      if (key) nextIdMap.set(key, rawId);
    } else if (entry && typeof entry === 'object') {
      const obj = entry as { id?: string; lessonId?: string; title?: string; course?: string; category?: string };
      const rawId = String(obj.id || obj.lessonId || '').trim();
      const key = normalizeLessonIdKey(rawId);
      if (key) {
        nextIdMap.set(key, rawId);
        if (obj.title) {
          nextTitleMap.set(key, String(obj.title).trim());
        }
        const cName = getLessonCourseName(obj);
        if (cName) {
          nextCourseMap.set(key, cName);
        }
      }
    }
  }

  const newlyMissing: string[] = [...(options?.explicitDeletedIds || [])];
  if (validLessonIdsLoaded) {
    for (const oldKey of prevKeys) {
      if (!nextIdMap.has(oldKey)) {
        newlyMissing.push(oldKey);
      }
    }
  }

  validLessonIdMap.clear();
  for (const [k, v] of nextIdMap.entries()) validLessonIdMap.set(k, v);
  validLessonTitleMap.clear();
  for (const [k, v] of nextTitleMap.entries()) validLessonTitleMap.set(k, v);
  validLessonCourseMap.clear();
  for (const [k, v] of nextCourseMap.entries()) validLessonCourseMap.set(k, v);
  validLessonIdsLoaded = true;

  if (Array.isArray(options?.exercises)) {
    validLessonExerciseMap.clear();
    validCourseExerciseMap.clear();
    for (const ex of options.exercises) {
      const key = normalizeLessonIdKey(ex?.lessonId || '');
      if (!key) continue;
      validLessonExerciseMap.set(key, (validLessonExerciseMap.get(key) || 0) + 1);
      const cName = validLessonCourseMap.get(key) || state.lessonCatalog[key]?.course || '';
      const cSlug = courseSlug(normalizeCourseName(cName));
      if (cSlug) {
        validCourseExerciseMap.set(cSlug, (validCourseExerciseMap.get(cSlug) || 0) + 1);
      }
    }
    validExercisesLoaded = true;
  }

  const merged = getMergedDataset();
  const { changed } = reconcileDatasetWithLessons(merged, newlyMissing);
  if (changed) {
    syncMemoryFromDataset(merged);
    emitState();
  }
  return changed;
}

async function resolveActiveCurriculumForHydration(): Promise<void> {
  const lb = typeof window !== 'undefined' ? (window as any).LinguaBackend : null;
  const hasBackend = lb && typeof lb.hasBackend === 'function' ? lb.hasBackend() : false;
  let loadedLessons: unknown[] | null = null;
  let loadedExercises: Array<{ lessonId?: string }> | undefined = undefined;
  let authoritativeEmptyAllowed = false;

  // Fetch story IDs lightly in parallel so completedLessonIds keeps valid Story IDs
  const storiesPromise = (async () => {
    try {
      const sRes = await fetch(`data/stories.json?t=${Date.now()}`, { cache: 'no-store' });
      if (sRes.ok) {
        const sJson = (await sRes.json().catch(() => null)) as { sheets?: { Lessons?: Array<{ id?: string }> } } | null;
        if (Array.isArray(sJson?.sheets?.Lessons)) {
          validStoryIdSet = new Set(
            sJson!.sheets!.Lessons.map((s) => normalizeLessonIdKey(s?.id)).filter(Boolean)
          );
        }
      }
    } catch {
      // ignore story preload error
    }
  })();

  // 1. Live D1 / Express backend lessons bundle when backend exists
  if (hasBackend) {
    try {
      const apiPath = `/api/database/bundle?domain=lessons&t=${Date.now()}`;
      const apiUrl = lb?.apiUrl ? lb.apiUrl(apiPath) : apiPath;
      const res = await fetch(apiUrl, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          success?: boolean;
          sheets?: { Lessons?: unknown[]; Exercises?: Array<{ lessonId?: string }> };
        } | null;
        if (data?.success && Array.isArray(data?.sheets?.Lessons)) {
          loadedLessons = data.sheets.Lessons;
          if (Array.isArray(data?.sheets?.Exercises)) loadedExercises = data.sheets.Exercises;
          authoritativeEmptyAllowed = true;
        }
      }
    } catch {
      // fall through
    }
  }

  // 2. Pending or static local draft if no live server data
  if (!loadedLessons) {
    try {
      const draftRaw = localStorage.getItem('linguapath_cms_lessons_v2');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as {
          sheets?: { Lessons?: unknown[]; Exercises?: Array<{ lessonId?: string }> };
          pendingSync?: boolean;
        };
        if (Array.isArray(draft?.sheets?.Lessons) && (!hasBackend || draft?.pendingSync)) {
          loadedLessons = draft.sheets.Lessons;
          if (Array.isArray(draft?.sheets?.Exercises)) loadedExercises = draft.sheets.Exercises;
          authoritativeEmptyAllowed = true;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Express /api/lessons-data or static data/lessons.json
  if (!loadedLessons) {
    try {
      const res = await fetch(`data/lessons.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          sheets?: { Lessons?: unknown[]; Exercises?: Array<{ lessonId?: string }> };
        } | null;
        if (Array.isArray(data?.sheets?.Lessons)) {
          loadedLessons = data.sheets.Lessons;
          if (Array.isArray(data?.sheets?.Exercises)) loadedExercises = data.sheets.Exercises;
          authoritativeEmptyAllowed = true;
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Fallback to data/lessons.xlsx if SheetJS is present
  if (!loadedLessons) {
    try {
      const xlsx = getXlsxGlobal();
      if (xlsx) {
        const res = await fetch(`data/lessons.xlsx?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const wb = xlsx.read(buf, { type: 'array' });
          const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'lessons');
          if (sheetName) {
            loadedLessons = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
            const exSheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'exercises');
            if (exSheetName) {
              loadedExercises = xlsx.utils.sheet_to_json(wb.Sheets[exSheetName], { defval: '' });
            }
            authoritativeEmptyAllowed = true;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  await storiesPromise;

  if (loadedLessons && (loadedLessons.length > 0 || authoritativeEmptyAllowed)) {
    updateActiveLessonsRegistry(loadedLessons, {
      allowEmpty: authoritativeEmptyAllowed,
      exercises: loadedExercises
    });
  }
}

function syncBaseWorkbookFromServerPayload(data: Record<string, unknown>): void {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data.allUsers)) {
    const nextUsers: Record<string, ExcelUserRecord> = {};
    for (const rawU of data.allUsers as UserProfile[]) {
      if (!rawU?.uid || !rawU?.email) continue;
      const prevHash = baseWorkbookStore.users[rawU.uid]?.passwordHash || '';
      nextUsers[rawU.uid] = { profile: { ...rawU }, passwordHash: prevHash };
    }
    baseWorkbookStore.users = nextUsers;
    baseWorkbookStore.loaded = true;
  } else if (data.profile && typeof data.profile === 'object') {
    const prof = data.profile as UserProfile;
    if (prof.uid && prof.email) {
      const prevHash = baseWorkbookStore.users[prof.uid]?.passwordHash || '';
      baseWorkbookStore.users[prof.uid] = { profile: { ...prof }, passwordHash: prevHash };
      baseWorkbookStore.loaded = true;
    }
  }
  if (Array.isArray(data.allRequests)) {
    const nextReqs: Record<string, SubscriptionRequest> = {};
    for (const r of data.allRequests as SubscriptionRequest[]) {
      if (r?.requestId) nextReqs[r.requestId] = { ...r };
    }
    baseWorkbookStore.requests = nextReqs;
  }
  if (data.lessonCatalog && typeof data.lessonCatalog === 'object') {
    if (Array.isArray(data.lessonCatalog)) {
      const nextCat: Record<string, LessonCatalogItem> = {};
      for (const c of data.lessonCatalog as LessonCatalogItem[]) {
        if (c?.lessonId) nextCat[c.lessonId] = { ...c };
      }
      baseWorkbookStore.lessonCatalog = nextCat;
    } else {
      baseWorkbookStore.lessonCatalog = { ...(data.lessonCatalog as Record<string, LessonCatalogItem>) };
    }
  }
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
    if (Array.isArray(data.lessonCatalog)) {
      const catMap: Record<string, LessonCatalogItem> = {};
      for (const item of data.lessonCatalog as LessonCatalogItem[]) {
        if (item?.lessonId) catMap[item.lessonId] = item;
      }
      state.lessonCatalog = catMap;
    } else {
      state.lessonCatalog = data.lessonCatalog as Record<string, LessonCatalogItem>;
    }
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

async function migrateOverlayAccountsToBackend(emailFilter?: string): Promise<boolean> {
  const { hasBackend } = getBackendBridge();
  if (!hasBackend) return false;
  const overlay = readOverlayStore();
  const candidates: Array<Record<string, unknown>> = [];
  const targetEmail = String(emailFilter || '').trim().toLowerCase();

  for (const [uid, entry] of Object.entries(overlay.users || {})) {
    if (!entry?.profile?.email) continue;
    const em = String(entry.profile.email).trim().toLowerCase();
    if (targetEmail && em !== targetEmail) continue;
    if ((entry as any)._syncedToBackend && !targetEmail) continue;
    const pwHash = String(entry.passwordHash || '').trim();
    if (!/^sha256\$[a-f0-9]+\$[a-f0-9]{64}$/i.test(pwHash)) continue;
    candidates.push({
      uid,
      username: entry.profile.username,
      email: em,
      phoneNumber: entry.profile.phoneNumber || '',
      dob: entry.profile.dob || '',
      passwordHash: pwHash,
      createdAt: entry.profile.createdAt || '',
      updatedAt: entry.profile.updatedAt || ''
    });
  }

  if (!candidates.length) return false;
  try {
    const res = await backendApiFetch('/api/auth/migrate-browser-users', {
      method: 'POST',
      body: JSON.stringify({ users: candidates })
    });
    if (res.ok && res.data?.success) {
      const freshOverlay = readOverlayStore();
      for (const c of candidates) {
        const cUid = String(c.uid || '');
        if (freshOverlay.users[cUid]) {
          (freshOverlay.users[cUid] as any)._syncedToBackend = true;
          if (!baseWorkbookStore.users[cUid]) {
            baseWorkbookStore.users[cUid] = {
              profile: { ...freshOverlay.users[cUid].profile },
              passwordHash: String(c.passwordHash || '')
            };
          }
        }
      }
      writeOverlayStore(freshOverlay);
      return true;
    }
  } catch {
    // non-fatal background migration retry on next open/login
  }
  return false;
}

async function pushPendingLocalProgressIfNeeded(serverProgress?: UserProgress | null): Promise<UserProgress | null> {
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken() || !state.user?.uid) return serverProgress || null;
  const overlay = readOverlayStore();
  const localProg = overlay.progress?.[state.user.uid];
  if (!localProg) return serverProgress || null;

  const serverIds = new Set(serverProgress?.completedLessonIds || []);
  const localIds = Array.isArray(localProg.completedLessonIds) ? localProg.completedLessonIds : [];
  const hasMoreLessons = localIds.some((id) => !serverIds.has(id));
  const localTs = parseIsoTimestamp(localProg.updatedAt);
  const serverTs = parseIsoTimestamp(serverProgress?.updatedAt);
  if (!hasMoreLessons && localTs <= serverTs) return serverProgress || null;

  const mergedCompleted = Array.from(new Set([...(serverProgress?.completedLessonIds || []), ...localIds])).slice(-200);
  const mergedDates = Array.from(
    new Set([...(serverProgress?.streakDates || []), ...(localProg.streakDates || [])])
  ).slice(-366);
  const mergedPayload: UserProgress = {
    uid: state.user.uid,
    currentStreak: Math.max(Number(serverProgress?.currentStreak) || 0, Number(localProg.currentStreak) || 0),
    bestStreak: Math.max(Number(serverProgress?.bestStreak) || 0, Number(localProg.bestStreak) || 0),
    lastCompletedDate:
      (localProg.lastCompletedDate || '') > (serverProgress?.lastCompletedDate || '')
        ? localProg.lastCompletedDate
        : serverProgress?.lastCompletedDate || '',
    streakDates: mergedDates,
    completedLessonIds: mergedCompleted,
    reminderEnabled: localTs >= serverTs ? Boolean(localProg.reminderEnabled) : Boolean(serverProgress?.reminderEnabled ?? true),
    reminderTime: localTs >= serverTs ? sanitizeTimeStr(localProg.reminderTime) : sanitizeTimeStr(serverProgress?.reminderTime),
    lastNotifiedDate:
      (localProg.lastNotifiedDate || '') > (serverProgress?.lastNotifiedDate || '')
        ? localProg.lastNotifiedDate
        : serverProgress?.lastNotifiedDate || '',
    updatedAt: new Date().toISOString()
  };

  try {
    const res = await backendApiFetch('/api/progress', {
      method: 'PUT',
      body: JSON.stringify(mergedPayload)
    });
    if (res.ok && res.data?.userProgress) {
      state.userProgress = normalizeUserProgress(res.data.userProgress, state.user.uid);
      return state.userProgress;
    }
  } catch {
    // ignore non-fatal progress sync failure
  }
  return serverProgress || null;
}

async function refreshUsersFromBackend(): Promise<UserProfile[]> {
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken() || !getComputedAdmin()) return [...state.allUsers];
  const res = await backendApiFetch('/api/admin/users', { method: 'GET' });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || `Failed to load users from database (HTTP ${res.status}).`);
  }
  applySessionPayload(res.data);
  syncBaseWorkbookFromServerPayload(res.data);
  emitState();
  return [...state.allUsers];
}

async function syncLocalDataToDatabase(options: { silent?: boolean } = {}): Promise<{
  migratedUsers: number;
  mergedCount: number;
  requestsCount: number;
  totalUsers: number;
  siteConfigSynced: boolean;
}> {
  const { hasBackend } = getBackendBridge();
  if (!hasBackend) {
    if (!options.silent) {
      throw new Error('Connect a Cloudflare Worker URL or start the Node server to sync local data.');
    }
    return {
      migratedUsers: 0,
      mergedCount: state.allUsers.length,
      requestsCount: state.allRequests.length,
      totalUsers: state.allUsers.length,
      siteConfigSynced: false
    };
  }

  let migratedUsersCount = 0;
  const overlay = readOverlayStore();
  const migrateCandidates = Object.entries(overlay.users || {})
    .filter(([, entry]) => entry?.profile?.email && /^sha256\$[a-f0-9]+\$[a-f0-9]{64}$/i.test(String(entry.passwordHash || '')))
    .map(([uid, entry]) => ({
      uid,
      username: entry.profile.username,
      email: entry.profile.email.toLowerCase(),
      phoneNumber: entry.profile.phoneNumber || '',
      dob: entry.profile.dob || '',
      passwordHash: entry.passwordHash,
      createdAt: entry.profile.createdAt || '',
      updatedAt: entry.profile.updatedAt || ''
    }));

  if (migrateCandidates.length > 0) {
    const migRes = await backendApiFetch('/api/auth/migrate-browser-users', {
      method: 'POST',
      body: JSON.stringify({ users: migrateCandidates })
    }).catch(() => null);
    if (migRes?.ok && migRes.data?.success) {
      migratedUsersCount = Number(migRes.data.migratedCount) || 0;
    } else if (!options.silent && migRes && !migRes.ok && migRes.data?.error && !(getApiToken() && getComputedAdmin())) {
      throw new Error(String(migRes.data.error));
    }
  }

  let siteConfigSynced = false;
  if (getApiToken() && getComputedAdmin()) {
    const overlayUsersPayload = Object.values(overlay.users || {}).map((rec) => ({
      ...rec.profile,
      passwordHash: rec.passwordHash || ''
    }));
    const overlayRequestsPayload = Object.values(overlay.requests || {});
    const overlayProgressPayload = Object.values(overlay.progress || {});
    const overlayCatalogPayload = Object.values(overlay.lessonCatalog || {});

    const syncRes = await backendApiFetch('/api/admin/users/sync', {
      method: 'POST',
      body: JSON.stringify({
        users: overlayUsersPayload,
        requests: overlayRequestsPayload,
        progress: overlayProgressPayload,
        lessonCatalog: overlayCatalogPayload
      })
    });
    if (!syncRes.ok || !syncRes.data?.success) {
      if (!options.silent) {
        throw new Error((syncRes.data && syncRes.data.error) || 'Could not push local users to database & Excel.');
      }
    } else {
      applySessionPayload(syncRes.data);
      syncBaseWorkbookFromServerPayload(syncRes.data);
      const cleanOverlay = readOverlayStore();
      cleanOverlay.users = {};
      cleanOverlay.requests = {};
      cleanOverlay.progress = {};
      cleanOverlay.lessonCatalog = {};
      writeOverlayStore(cleanOverlay);
    }

    if ((overlay.siteConfig as any)?._pendingServerSync && overlay.siteConfig) {
      try {
        await saveSiteConfig(overlay.siteConfig);
        siteConfigSynced = true;
      } catch {
        // ignore if offline
      }
    }

    await refreshUsersFromBackend().catch(() => {});
  } else if (!options.silent) {
    throw new Error('Sign in as Admin to sync all users and site settings to the database & Excel.');
  }

  emitState();
  return {
    migratedUsers: migratedUsersCount,
    mergedCount: state.allUsers.length,
    requestsCount: state.allRequests.length,
    totalUsers: state.allUsers.length,
    siteConfigSynced
  };
}

async function hydratePublicAndSession(forceExcelReload = false): Promise<void> {
  // 1. Load static data/site-config.json and public Firestore siteConfig/homepage in parallel
  let baseCfg: Partial<SiteConfig> = {};
  let firestoreCfg: Partial<SiteConfig> | null = null;
  let serverCfg: Partial<SiteConfig> | null = null;

  const [staticCfgRes, fsCfgRes] = await Promise.all([
    fetch('data/site-config.json?t=' + Date.now(), { cache: 'no-store' }).catch(() => null),
    fetchSiteConfigFromFirestore().catch(() => null)
  ]);
  if (staticCfgRes && staticCfgRes.ok) {
    baseCfg = (await staticCfgRes.json().catch(() => ({}))) as Partial<SiteConfig>;
  }
  if (fsCfgRes) {
    firestoreCfg = fsCfgRes;
  }

  // 2. Load data/users.xlsx and merge browser overlay
  await loadBaseWorkbookFromExcel(forceExcelReload);
  const initialOverlay = readOverlayStore();

  const { lb } = getBackendBridge();
  const candidateWorkerBase = String(
    initialOverlay.siteConfig?.workerApiBaseUrl ||
      firestoreCfg?.workerApiBaseUrl ||
      baseCfg?.workerApiBaseUrl ||
      ''
  ).trim();
  if (candidateWorkerBase && lb && typeof lb.setSiteWorkerBase === 'function') {
    lb.setSiteWorkerBase(candidateWorkerBase);
  }

  // 3. Auto-push any legacy Chrome-only student accounts to D1 & Excel right when backend is reachable
  const canReachBackend = getBackendBridge().hasBackend;
  if (canReachBackend) {
    await migrateOverlayAccountsToBackend().catch(() => false);
  }

  // 4. Resolve active lessons catalog and fetch authoritative /api/site-config in parallel
  const curriculumPromise = resolveActiveCurriculumForHydration().catch(() => {});
  const siteConfigPromise = canReachBackend
    ? backendApiFetch('/api/site-config?t=' + Date.now(), { method: 'GET' }).catch(() => null)
    : Promise.resolve(null);

  const [, siteApiRes] = await Promise.all([curriculumPromise, siteConfigPromise]);
  if (siteApiRes && siteApiRes.ok && siteApiRes.data?.success && siteApiRes.data?.config) {
    serverCfg = siteApiRes.data.config as Partial<SiteConfig>;
  }

  const dataset = getMergedDataset();
  reconcileDatasetWithLessons(dataset);

  // Pick authoritative newest siteConfig across Server D1/Excel, Firestore, static site-config.json, and pending local edit
  let bestRemoteCfg: Partial<SiteConfig> | null = serverCfg || firestoreCfg || null;
  if (serverCfg && firestoreCfg) {
    bestRemoteCfg =
      parseIsoTimestamp(firestoreCfg.updatedAt) > parseIsoTimestamp(serverCfg.updatedAt)
        ? { ...serverCfg, ...firestoreCfg }
        : { ...firestoreCfg, ...serverCfg };
  }

  const localPending = Boolean((initialOverlay.siteConfig as any)?._pendingServerSync);
  const localTime = parseIsoTimestamp(initialOverlay.siteConfig?.updatedAt);
  const remoteTime = parseIsoTimestamp(bestRemoteCfg?.updatedAt);

  let effectiveCfg: Partial<SiteConfig>;
  if (initialOverlay.siteConfig && localPending && (!bestRemoteCfg || localTime >= remoteTime)) {
    effectiveCfg = { ...baseCfg, ...(bestRemoteCfg || {}), ...initialOverlay.siteConfig };
    // Auto-push pending local siteConfig (e.g. logo update) if admin is authenticated
    if (canReachBackend && getApiToken()) {
      const normalizedPending = normalizeSiteConfig(effectiveCfg);
      const pushRes = await backendApiFetch('/api/admin/site-config', {
        method: 'PUT',
        body: JSON.stringify(normalizedPending)
      }).catch(() => null);
      if (pushRes?.ok && pushRes.data?.success && pushRes.data?.config) {
        effectiveCfg = { ...baseCfg, ...(pushRes.data.config as Partial<SiteConfig>) };
        const cleanOv = readOverlayStore();
        cleanOv.siteConfig = { ...effectiveCfg };
        writeOverlayStore(cleanOv);
        void syncSiteConfigToFirestore(normalizeSiteConfig(effectiveCfg));
      }
    }
  } else if (bestRemoteCfg) {
    effectiveCfg = { ...baseCfg, ...bestRemoteCfg };
    const cleanOv = readOverlayStore();
    cleanOv.siteConfig = { ...effectiveCfg };
    writeOverlayStore(cleanOv);
  } else {
    effectiveCfg = initialOverlay.siteConfig ? { ...baseCfg, ...initialOverlay.siteConfig } : baseCfg;
  }

  state.siteConfig = normalizeSiteConfig(effectiveCfg);
  if (typeof window !== 'undefined') {
    (window as any).__INITIAL_SITE_CONFIG_CACHE__ = state.siteConfig;
  }
  if (state.siteConfig.workerApiBaseUrl && lb && typeof lb.setSiteWorkerBase === 'function') {
    lb.setSiteWorkerBase(state.siteConfig.workerApiBaseUrl);
  }
  emitSiteConfigChange(false);

  // 5. Authenticate session strictly against DB & Excel when backend is active
  if (canReachBackend) {
    const token = getApiToken();
    if (token) {
      const meRes = await backendApiFetch('/api/auth/me?t=' + Date.now(), { method: 'GET' }).catch(() => null);
      if (meRes && meRes.ok && meRes.data?.success && meRes.data?.user) {
        setSessionUid(String(meRes.data.user.uid));
        applySessionPayload(meRes.data);
        syncBaseWorkbookFromServerPayload(meRes.data);
        await pushPendingLocalProgressIfNeeded(state.userProgress);
        if (state.isAdmin) {
          await syncLocalDataToDatabase({ silent: true }).catch(() => {});
          if (!Array.isArray(meRes.data.allUsers)) {
            await refreshUsersFromBackend().catch(() => {});
          }
        }
      } else {
        setApiToken(null);
        clearAuthSession();
      }
    } else {
      clearAuthSession();
    }
  } else {
    // Offline static fallback when no backend Worker URL is connected
    syncMemoryFromDataset(dataset);
  }

  state.ready = true;
  emitState();
}

const initialHydrationPromise = hydratePublicAndSession();

function waitUntilReady(): Promise<void> {
  return state.ready ? Promise.resolve() : initialHydrationPromise;
}

async function reloadSiteConfig(): Promise<SiteConfig> {
  await hydratePublicAndSession(false);
  return getSiteConfig();
}

// --- Public Auth, Profile, Subscription & Admin Methods ---

type RegistrationProgressStep = 'validate' | 'saving' | 'verifying' | 'done';

async function registerWithEmail(
  params: {
    username: string;
    email: string;
    phoneNumber: string;
    dob: string;
    password: string;
  },
  options?: { onProgress?: (step: RegistrationProgressStep, detail?: string) => void }
): Promise<UserProfile> {
  const onProgress = options?.onProgress;
  onProgress?.('validate', 'Validating your profile details…');

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

  const { hasBackend } = getBackendBridge();
  if (!hasBackend) {
    throw new Error(
      'Unable to reach the Database & Excel server. Account registration is only completed after saving to the Database & Excel store.'
    );
  }

  onProgress?.('saving', 'Saving your account to the Database & Excel store…');

  let res: { ok: boolean; status: number; data: any };
  try {
    res = await backendApiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: cleanUsername,
        email: cleanEmail,
        phoneNumber: cleanPhone,
        dob: cleanDob,
        password: rawPassword
      })
    });
  } catch (err: any) {
    setApiToken(null);
    clearAuthSession();
    throw new Error(
      err?.message || 'Network error while saving your account to the Database & Excel store. Please retry.'
    );
  }

  if (!res.ok || !res.data?.success || !res.data?.token || !res.data?.user?.uid) {
    setApiToken(null);
    clearAuthSession();
    if (res.status === 409 || (res.data && res.data.code === 'email-already-in-use')) {
      throw new Error(res.data?.error || 'An account with this email already exists. Please sign in instead.');
    }
    throw new Error(
      (res.data && res.data.error) ||
        `Database & Excel save did not complete (HTTP ${res.status || 0}). Please retry.`
    );
  }

  if (res.data.persistedToDatabase === false || res.data.persistedToExcel === false) {
    setApiToken(null);
    clearAuthSession();
    throw new Error('Your registration has not finished saving to the Database & Excel store yet. Please retry.');
  }

  const newToken = String(res.data.token);
  const newUid = String(res.data.user.uid);

  onProgress?.('verifying', 'Verifying your account in Database & Excel before enabling login…');

  try {
    setApiToken(newToken);
    const meRes = await backendApiFetch('/api/auth/me?t=' + Date.now(), { method: 'GET' });
    if (!meRes.ok || !meRes.data?.success || !meRes.data?.user?.uid || String(meRes.data.user.uid) !== newUid) {
      throw new Error(
        (meRes.data && meRes.data.error) ||
          'Account could not be confirmed in the database yet. Sign-in stays locked until saving completes.'
      );
    }

    setSessionUid(newUid);
    applySessionPayload(meRes.data);
    syncBaseWorkbookFromServerPayload(meRes.data);

    // Ensure no un-synced browser overlay copy exists for this verified DB account
    const overlay = readOverlayStore();
    if (overlay.users[newUid]) {
      delete overlay.users[newUid];
      writeOverlayStore(overlay);
    }
  } catch (verifyErr: any) {
    setApiToken(null);
    clearAuthSession();
    throw new Error(
      verifyErr?.message ||
        'Could not verify your account in the database yet. Please retry before signing in.'
    );
  }

  // Non-blocking Firebase mirror (DB + Excel are already verified)
  try {
    await ensureFirebaseAuthSession(cleanEmail, rawPassword, cleanUsername, 'register');
    if (state.profile) {
      void syncUserProfileToFirestore(state.profile);
    }
    if (state.userProgress) {
      void syncUserProgressToFirestore(state.userProgress);
    }
  } catch {
    // non-fatal mirror failure
  }

  onProgress?.('done', 'Stored and verified in Database & Excel.');
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

  const { hasBackend } = getBackendBridge();
  if (hasBackend) {
    // Auto-push any legacy Chrome-only account matching this email into DB & Excel before verifying login
    await migrateOverlayAccountsToBackend(cleanEmail).catch(() => false);

    const res = await backendApiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password: rawPassword })
    });

    if (!res.ok || !res.data?.success || !res.data?.token || !res.data?.user?.uid) {
      throw new Error(
        (res.data && res.data.error) ||
          'Invalid email or password. Only accounts saved in the database and Excel sheet can sign in.'
      );
    }

    setApiToken(String(res.data.token));
    setSessionUid(String(res.data.user.uid));
    applySessionPayload(res.data);
    syncBaseWorkbookFromServerPayload(res.data);

    // Clear duplicate un-synced overlay credential for this user
    const overlay = readOverlayStore();
    if (overlay.users[String(res.data.user.uid)]) {
      delete overlay.users[String(res.data.user.uid)];
      writeOverlayStore(overlay);
    }

    await pushPendingLocalProgressIfNeeded(state.userProgress);
    if (state.isAdmin) {
      await syncLocalDataToDatabase({ silent: true }).catch(() => {});
    }

    await ensureFirebaseAuthSession(cleanEmail, rawPassword, state.profile?.username, 'login');
    if (state.profile) {
      void syncUserProfileToFirestore(state.profile);
    }
    if (state.userProgress) {
      void syncUserProgressToFirestore(state.userProgress);
    }

    state.ready = true;
    emitState();
    return state.user as AuthUserSummary;
  }

  // Offline static host fallback (only when no Worker/Node backend is connected):
  // strictly verify against repository data/users.xlsx, NOT unpushed browser registrations
  await loadBaseWorkbookFromExcel(true);
  if (!validLessonIdsLoaded) {
    await resolveActiveCurriculumForHydration().catch(() => {});
  }
  const excelOnlyEntry = Object.values(baseWorkbookStore.users).find(
    (entry) => entry.profile.email.toLowerCase() === cleanEmail
  );
  if (!excelOnlyEntry) {
    if (!baseWorkbookStore.loaded && baseWorkbookStore.lastError) {
      throw new Error(baseWorkbookStore.lastError);
    }
    throw new Error(
      `Account ${cleanEmail} is not saved in users.xlsx or connected database yet. Connect the Worker URL or sync users.xlsx to sign in.`
    );
  }
  const valid = await verifyPasswordCredential(rawPassword, excelOnlyEntry.passwordHash);
  if (!valid) {
    throw new Error('Incorrect email or password.');
  }
  const dataset = getMergedDataset();
  reconcileDatasetWithLessons(dataset);
  const uid = excelOnlyEntry.profile.uid;
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
  const cleanPhone = String(params.phoneNumber || '').trim();
  const newPassword = String(params.newPassword || '');

  if (!cleanEmail || !cleanDob || !cleanPhone) {
    throw new Error('Please enter your Email, Date of Birth, and Phone / Viber Number to verify your identity.');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const { hasBackend } = getBackendBridge();
  if (!hasBackend) {
    throw new Error('Connect the Worker URL or server to reset your password in the database & Excel.');
  }

  const res = await backendApiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email: cleanEmail,
      dob: cleanDob,
      phoneNumber: cleanPhone,
      newPassword
    })
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Could not reset password.');
  }
  emitState();
  return String(res.data.message || 'Password reset successfully! Sign in now with your new password.');
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

  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Sign in with an active server connection to change your password.');
  }

  const res = await backendApiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (!res.ok || !res.data?.success || !res.data?.profile) {
    throw new Error((res.data && res.data.error) || 'Could not update password.');
  }

  state.profile = res.data.profile as UserProfile;
  if (state.user) state.user.mustChangePassword = false;
  syncBaseWorkbookFromServerPayload({ profile: state.profile });
  if (firebaseAuth.currentUser) {
    await fbUpdatePassword(firebaseAuth.currentUser, newPassword).catch(() => {});
    void syncUserProfileToFirestore(state.profile);
  }
  emitState();
  return state.profile as UserProfile;
}

async function reloadAuthSession(): Promise<AuthState> {
  await hydratePublicAndSession(true);
  return getState();
}

async function logout(): Promise<void> {
  setApiToken(null);
  clearAuthSession();
  await signOut(firebaseAuth).catch(() => {});
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

async function adminCreateUserAccount(params: {
  username: string;
  email: string;
  phoneNumber?: string;
  dob?: string;
  password?: string;
  role?: 'admin' | 'student';
  membershipStatus?: UserProfile['membershipStatus'];
  membershipPlan?: UserProfile['membershipPlan'];
  membershipExpiresAt?: string;
  subscribedLessonIds?: string[];
  subscribedCourses?: string[];
  practiceLessonIds?: string[];
  practiceCourses?: string[];
}): Promise<{ user: UserProfile; temporaryPassword: string }> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Administrator server session required.');
  }
  const res = await backendApiFetch('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  if (!res.ok || !res.data?.success || !res.data?.user) {
    throw new Error((res.data && res.data.error) || 'Failed to create user account in database & Excel.');
  }
  applySessionPayload(res.data);
  syncBaseWorkbookFromServerPayload(res.data);
  emitState();
  return {
    user: res.data.user as UserProfile,
    temporaryPassword: String(res.data.temporaryPassword || '')
  };
}

async function verifyAdminWithGoogle(): Promise<boolean> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    const user = result.user;
    if (user && String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL) {
      const admRef = doc(firestoreDb, 'admins', user.uid);
      await setDoc(admRef, {
        uid: user.uid,
        email: ADMIN_EMAIL,
        grantedAt: serverTimestamp()
      }, { merge: true });
      await syncSiteConfigToFirestore(state.siteConfig);
      await syncLocalDataToDatabase({ silent: true });
      emitState();
      return true;
    }
    throw new Error('Signed-in Google account is not the designated admin (syndkyaw@gmail.com).');
  } catch (err) {
    console.error('Google Admin verification error:', err);
    throw err;
  }
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
    subscribedLessonIds?: string[];
    subscribedCourses?: string[];
    practiceLessonIds?: string[];
    practiceCourses?: string[];
  }
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Administrator server session required. Please sign out and sign in again.');
  }

  const res = await backendApiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Failed to update user details in database & Excel.');
  }
  applySessionPayload(res.data);
  syncBaseWorkbookFromServerPayload(res.data);
  const overlay = readOverlayStore();
  if (overlay.users[userId]) {
    delete overlay.users[userId];
    writeOverlayStore(overlay);
  }
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

  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Active server connection required to update your profile.');
  }

  const res = await backendApiFetch('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({
      username: cleanUsername,
      phoneNumber: cleanPhone,
      dob: cleanDob
    })
  });
  if (!res.ok || !res.data?.success || !res.data?.profile) {
    throw new Error((res.data && res.data.error) || 'Could not update profile.');
  }
  state.profile = res.data.profile as UserProfile;
  if (state.user) state.user.displayName = state.profile.username;
  syncBaseWorkbookFromServerPayload({ profile: state.profile });
  void syncUserProfileToFirestore(state.profile);
  emitState();
}

async function submitSubscriptionRequest(params: {
  planType: 'monthly' | 'annual' | 'per_lesson' | 'course' | 'practice_lesson' | 'practice_course';
  lessonId?: string;
  courseName?: string;
  lessonTitle?: string;
  amountLabel?: string;
  contactChannel: 'email' | 'viber';
  contactHandle: string;
  note?: string;
}): Promise<SubscriptionRequest> {
  if (!state.user || !state.profile) throw new Error('Please sign in first.');
  const rawPlan = String(params.planType || 'course').trim().toLowerCase();
  const planType: SubscriptionRequest['planType'] =
    rawPlan === 'annual' ||
    rawPlan === 'monthly' ||
    rawPlan === 'per_lesson' ||
    rawPlan === 'practice_lesson' ||
    rawPlan === 'practice_course' ||
    rawPlan === 'course'
      ? rawPlan
      : 'course';
  const cleanCourse = params.courseName ? normalizeCourseName(params.courseName) : 'HSK 2';
  if (planType === 'practice_lesson' && params.lessonId && validExercisesLoaded && !lessonHasExercises(params.lessonId)) {
    throw new Error('Practice Only is unavailable because this lesson has no exercises.');
  }
  if (planType === 'practice_course' && validExercisesLoaded && !courseHasExercises(cleanCourse)) {
    throw new Error('Practice Only is unavailable because this course has no exercises yet.');
  }
  const resolvedLessonPricing = params.lessonId
    ? getLessonPricing({ id: params.lessonId, course: cleanCourse })
    : null;
  const resolvedPracticeAmt =
    planType === 'practice_lesson'
      ? resolvedLessonPricing
        ? resolvedLessonPricing.practicePrice
        : getCoursePracticePrice(cleanCourse)
      : getCoursePracticePrice(cleanCourse);
  const defaultTitle =
    planType === 'course'
      ? `${cleanCourse} Full Course`
      : planType === 'practice_course'
      ? `${cleanCourse} Course (Practice Only)`
      : planType === 'practice_lesson'
      ? 'Single Lesson (Practice Only)'
      : planType === 'per_lesson'
      ? 'Single Lesson Pass'
      : planType === 'annual'
      ? 'Annual All-Access'
      : 'Monthly All-Access';
  const defaultAmt =
    planType === 'course'
      ? `${Number(getCoursePrice(cleanCourse)).toLocaleString('en-US')} Kyat`
      : planType === 'practice_course' || planType === 'practice_lesson'
      ? `${Number(resolvedPracticeAmt).toLocaleString('en-US')} Kyat`
      : planType === 'per_lesson'
      ? `${Number(resolvedLessonPricing?.price || 75000).toLocaleString('en-US')} Kyat`
      : planType === 'annual'
      ? '$149 / yr'
      : '$19 / mo';

  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Active server connection required to submit a subscription request.');
  }

  const res = await backendApiFetch('/api/requests', {
    method: 'POST',
    body: JSON.stringify({
      planType,
      lessonId: params.lessonId ? sanitizeDocId(params.lessonId) : '',
      courseName: cleanCourse,
      lessonTitle: String(params.lessonTitle || '').trim() || defaultTitle,
      amountLabel: String(params.amountLabel || '').trim() || defaultAmt,
      contactChannel: params.contactChannel === 'email' ? 'email' : 'viber',
      contactHandle: String(params.contactHandle || '').trim(),
      note: String(params.note || '').trim().slice(0, 400)
    })
  });
  if (!res.ok || !res.data?.success || !res.data?.request) {
    throw new Error((res.data && res.data.error) || 'Could not submit subscription request.');
  }
  applySessionPayload(res.data);
  emitState();
  return res.data.request as SubscriptionRequest;
}

async function cancelPendingRequest(requestId: string): Promise<void> {
  if (!state.user) throw new Error('Please sign in first.');
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Active server connection required to cancel a request.');
  }
  const res = await backendApiFetch(`/api/requests/${encodeURIComponent(requestId)}`, {
    method: 'DELETE'
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Could not cancel request.');
  }
  applySessionPayload(res.data);
  emitState();
}

// --- Admin Management Methods ---

async function approveSubscriptionRequest(
  reqDoc: SubscriptionRequest,
  adminNote = 'Verified via QR payment'
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Administrator server session required. Please sign out and sign in again.');
  }
  const res = await backendApiFetch(`/api/admin/requests/${encodeURIComponent(reqDoc.requestId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminNote })
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Failed to approve request.');
  }
  applySessionPayload(res.data);
  syncBaseWorkbookFromServerPayload(res.data);
  emitState();
}

async function rejectSubscriptionRequest(
  requestId: string,
  adminNote = 'Payment could not be verified'
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Administrator server session required. Please sign out and sign in again.');
  }
  const res = await backendApiFetch(`/api/admin/requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ adminNote })
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Failed to reject request.');
  }
  applySessionPayload(res.data);
  syncBaseWorkbookFromServerPayload(res.data);
  emitState();
}

async function updateUserMembershipAdmin(
  userId: string,
  updates: {
    membershipStatus: UserProfile['membershipStatus'];
    membershipPlan: UserProfile['membershipPlan'];
    membershipExpiresAt?: string;
    subscribedLessonIds?: string[];
    subscribedCourses?: string[];
    practiceLessonIds?: string[];
    practiceCourses?: string[];
  }
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Administrator server session required. Please sign out and sign in again.');
  }

  const res = await backendApiFetch(`/api/admin/users/${encodeURIComponent(userId)}/membership`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Failed to update user membership in database & Excel.');
  }

  applySessionPayload(res.data);
  syncBaseWorkbookFromServerPayload(res.data);
  const overlay = readOverlayStore();
  if (overlay.users[userId]) {
    delete overlay.users[userId];
    writeOverlayStore(overlay);
  }
  emitState();
}

async function adminResetUserPassword(
  userId: string,
  options: { newPassword?: string } = {}
): Promise<{ temporaryPassword: string; user?: UserProfile }> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Administrator server session required. Please sign out and sign in again.');
  }

  const res = await backendApiFetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword: options.newPassword?.trim() || '' })
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Failed to reset user password.');
  }
  applySessionPayload(res.data);
  syncBaseWorkbookFromServerPayload(res.data);
  emitState();
  return {
    temporaryPassword: String(res.data.temporaryPassword || ''),
    user: res.data.user as UserProfile | undefined
  };
}

async function syncCatalogToBackend(
  payload: { items?: LessonCatalogItem[]; removeIds?: string[] }
): Promise<void> {
  const { hasBackend } = getBackendBridge();
  if (!hasBackend || !getApiToken()) {
    throw new Error('Administrator server session required to sync lesson catalog.');
  }
  const res = await backendApiFetch('/api/admin/catalog', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  if (!res.ok || !res.data?.success) {
    throw new Error((res.data && res.data.error) || 'Failed to sync lesson catalog to database & Excel.');
  }
  if (res.data.lessonCatalog) {
    state.lessonCatalog = res.data.lessonCatalog as Record<string, LessonCatalogItem>;
    syncBaseWorkbookFromServerPayload({ lessonCatalog: res.data.lessonCatalog });
  }
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    void syncCatalogToFirestore(payload.items);
  }
}

async function saveLessonCatalogItems(
  items: Array<{
    lessonId: string;
    title: string;
    course?: string;
    audience?: 'Adult' | 'Kids' | string;
    accessType: 'free' | 'paid' | string;
    price: number;
    practicePrice?: number;
    hasExercises?: boolean;
  }>
): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const nowIso = new Date().toISOString();
  const cleanItems: LessonCatalogItem[] = [];
  for (const item of items || []) {
    const id = sanitizeDocId(item.lessonId);
    const rawPrac = Number(item.practicePrice);
    const entry: LessonCatalogItem = {
      lessonId: id,
      title: String(item.title || id).trim(),
      course: item.course ? normalizeCourseName(item.course) : undefined,
      audience: item.audience === 'Kids' ? 'Kids' : 'Adult',
      accessType: item.accessType === 'paid' ? 'paid' : 'free',
      price: Math.max(0, Number(item.price) || 0),
      practicePrice: Number.isFinite(rawPrac) && rawPrac > 0 ? Math.round(rawPrac) : 0,
      ...(typeof item.hasExercises === 'boolean' ? { hasExercises: item.hasExercises } : {}),
      updatedBy: state.user.email,
      updatedAt: nowIso
    };
    state.lessonCatalog[id] = entry;
    if (validLessonIdsLoaded) {
      const key = normalizeLessonIdKey(id);
      if (key) {
        validLessonIdMap.set(key, id);
        if (entry.title) validLessonTitleMap.set(key, entry.title);
      }
    }
    cleanItems.push(entry);
  }
  await syncCatalogToBackend({ items: cleanItems });
  emitState();
}

async function removeLessonCatalogItems(lessonIds: string[]): Promise<void> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const cleanIds = Array.from(
    new Set((lessonIds || []).map((id) => sanitizeDocId(String(id || ''))).filter(Boolean))
  );
  if (!cleanIds.length) return;

  for (const id of cleanIds) {
    const key = normalizeLessonIdKey(id);
    if (key) {
      validLessonIdMap.delete(key);
      validLessonTitleMap.delete(key);
    }
  }

  const merged = getMergedDataset();
  reconcileDatasetWithLessons(merged, cleanIds);
  syncMemoryFromDataset(merged, state.user.uid);
  await syncCatalogToBackend({ removeIds: cleanIds });
  emitState();
}

async function getIdToken(): Promise<string | null> {
  const token = getApiToken();
  return token || null;
}

function getSiteConfig(): SiteConfig {
  return normalizeSiteConfig(state.siteConfig);
}

async function saveSiteConfig(partial: Partial<SiteConfig>): Promise<SiteConfig & { _savedLocallyOnly?: boolean }> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  await waitUntilReady().catch(() => {});

  const nowIso = new Date().toISOString();
  const merged = normalizeSiteConfig({
    ...state.siteConfig,
    ...partial,
    updatedBy: state.user.email,
    updatedAt: nowIso
  });

  // Immediately persist locally with _pendingServerSync until backend confirms
  const overlay = readOverlayStore();
  overlay.siteConfig = { ...merged, _pendingServerSync: true } as SiteConfig;
  writeOverlayStore(overlay);
  state.siteConfig = merged;
  if (typeof window !== 'undefined') {
    (window as any).__INITIAL_SITE_CONFIG_CACHE__ = state.siteConfig;
  }
  emitSiteConfigChange(true);
  emitState();

  const { lb, hasBackend: hasRemoteBackend, isStaticHost } = getBackendBridge();
  const bearerToken = getApiToken();

  if (hasRemoteBackend && bearerToken) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`
    };
    const apiPath = '/api/admin/site-config';
    const apiUrl = lb?.apiUrl ? lb.apiUrl(apiPath) : apiPath;

    let remoteSavedConfig: SiteConfig | null = null;
    try {
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(merged)
      });
      const text = await res.text().catch(() => '');
      const trimmed = text.trim();
      const data = trimmed && !trimmed.startsWith('<') ? (JSON.parse(trimmed) as any) : null;
      if (res.ok && data && data.success !== false) {
        remoteSavedConfig = normalizeSiteConfig(data.config || merged);
      } else {
        const serverErr =
          (data && (data.error || data.message)) || `Server rejected site configuration save (HTTP ${res.status}).`;
        console.warn('Remote site-config save error, local changes retained:', serverErr);
      }
    } catch (err) {
      console.warn('Network error saving site-config to backend, local changes retained:', err);
    }

    const storedOverride = lb?.getStoredOverride ? lb.getStoredOverride() : '';
    if (!isStaticHost && storedOverride && apiUrl !== apiPath) {
      try {
        const localRes = await fetch(apiPath, {
          method: 'PUT',
          headers,
          body: JSON.stringify(remoteSavedConfig || merged)
        });
        const localData = (await localRes.json().catch(() => null)) as any;
        if (!remoteSavedConfig && localRes.ok && localData && localData.success !== false) {
          remoteSavedConfig = normalizeSiteConfig(localData.config || merged);
        }
      } catch (_) {}
    }

    const firestoreSynced = await syncSiteConfigToFirestore(remoteSavedConfig || merged);

    if (remoteSavedConfig) {
      const freshOverlay = readOverlayStore();
      freshOverlay.siteConfig = { ...remoteSavedConfig };
      writeOverlayStore(freshOverlay);
      state.siteConfig = remoteSavedConfig;
      if (typeof window !== 'undefined') {
        (window as any).__INITIAL_SITE_CONFIG_CACHE__ = state.siteConfig;
      }
      emitSiteConfigChange(true);
      emitState();
      return state.siteConfig;
    }

    if (firestoreSynced) {
      const freshOverlay = readOverlayStore();
      freshOverlay.siteConfig = { ...merged };
      writeOverlayStore(freshOverlay);
      return state.siteConfig;
    }
  }

  return Object.assign({}, state.siteConfig, { _savedLocallyOnly: true });
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

function getCoursePrice(courseName: string): number {
  const cfg = getSiteConfig();
  const target = String(courseName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const [c, p] of Object.entries(cfg.coursePrices || {})) {
    const cSlug = String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (cSlug === target) {
      const n = Number(p);
      if (p !== undefined && p !== null && Number.isFinite(n)) return Math.max(0, n);
    }
  }
  // Secondary check: look directly in head cache or localStorage in case state.siteConfig was not yet hydrated
  try {
    const winCache = typeof window !== 'undefined' ? (window as any).__INITIAL_SITE_CONFIG_CACHE__ : null;
    if (winCache?.coursePrices && typeof winCache.coursePrices === 'object') {
      for (const [c, p] of Object.entries(winCache.coursePrices)) {
        const cSlug = String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (cSlug === target) {
          const n = Number(p);
          if (p !== undefined && p !== null && Number.isFinite(n)) return Math.max(0, n);
        }
      }
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.coursePrices && typeof parsed.coursePrices === 'object') {
          for (const [c, p] of Object.entries(parsed.coursePrices)) {
            const cSlug = String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
            if (cSlug === target) {
              const n = Number(p);
              if (p !== undefined && p !== null && Number.isFinite(n)) return Math.max(0, n);
            }
          }
        }
      }
    }
  } catch (_) {}
  return target.includes('hsk2') ? 280000 : 100;
}

function getDefaultPracticePrice(): number {
  const cfg = getSiteConfig();
  return typeof cfg.practicePrice === 'number' && cfg.practicePrice > 0 ? Math.round(cfg.practicePrice) : 55000;
}

function getCoursePracticePrice(courseName: string): number {
  const cfg = getSiteConfig();
  const target = String(courseName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const readPositiveFromMap = (map: unknown): number | null => {
    if (!map || typeof map !== 'object') return null;
    for (const [c, p] of Object.entries(map as Record<string, unknown>)) {
      const cSlug = String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (cSlug === target) {
        const n = typeof p === 'string' ? Number(String(p).replace(/,/g, '').trim()) : Number(p);
        if (Number.isFinite(n) && n > 0) return Math.round(n);
      }
    }
    return null;
  };
  const fromState = readPositiveFromMap(cfg.coursePracticePrices);
  if (fromState !== null) return fromState;
  try {
    const winCache = typeof window !== 'undefined' ? (window as any).__INITIAL_SITE_CONFIG_CACHE__ : null;
    const fromCache = readPositiveFromMap(winCache?.coursePracticePrices);
    if (fromCache !== null) return fromCache;
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const fromStorage = readPositiveFromMap(parsed?.coursePracticePrices);
        if (fromStorage !== null) return fromStorage;
      }
    }
  } catch (_) {}
  return getDefaultPracticePrice();
}

function getPracticePrice(lessonOrCourse?: string | { id?: string; lessonId?: string; course?: string; category?: string; practicePrice?: unknown }): number {
  if (!lessonOrCourse) return getDefaultPracticePrice();
  if (typeof lessonOrCourse === 'string') return getCoursePracticePrice(lessonOrCourse);
  return getLessonPricing(lessonOrCourse).practicePrice;
}

async function createCourseAdmin(
  courseName: string,
  price: number,
  _lessons?: any[],
  practicePrice?: number
): Promise<{ config: SiteConfig }> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const trimmed = String(courseName || '').trim();
  if (!trimmed) throw new Error('Course name cannot be empty.');
  const newSlug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cfg = getSiteConfig();
  const currentCourses = Array.isArray(cfg.courses) ? [...cfg.courses] : ['HSK 2'];
  const exists = currentCourses.some((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '') === newSlug);
  const nextCourses = exists ? currentCourses : [...currentCourses, trimmed];
  const nextPrices: Record<string, number> = {};
  Object.entries(cfg.coursePrices || {}).forEach(([k, v]) => {
    if (k.toLowerCase().replace(/[^a-z0-9]+/g, '') !== newSlug) {
      nextPrices[k] = Number(v) || 0;
    }
  });
  nextPrices[trimmed] = Math.max(0, Number(price) || 0);

  const nextPracticePrices: Record<string, number> = {};
  Object.entries(cfg.coursePracticePrices || {}).forEach(([k, v]) => {
    if (k.toLowerCase().replace(/[^a-z0-9]+/g, '') !== newSlug) {
      nextPracticePrices[k] = Number(v) || 0;
    }
  });
  if (typeof practicePrice === 'number' && Number.isFinite(practicePrice) && practicePrice > 0) {
    nextPracticePrices[trimmed] = Math.round(practicePrice);
  } else {
    nextPracticePrices[trimmed] = getDefaultPracticePrice();
  }

  const updatedConfig = await saveSiteConfig({
    courses: nextCourses,
    coursePrices: nextPrices,
    coursePracticePrices: nextPracticePrices
  });
  return { config: updatedConfig };
}

async function renameCourseAdmin(
  oldCourseName: string,
  newCourseName: string,
  price: number,
  lessons?: any[],
  practicePrice?: number
): Promise<{ config: SiteConfig; lessonsSheets?: { Lessons: any[] } }> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const oldTrimmed = String(oldCourseName || '').trim();
  const newTrimmed = String(newCourseName || '').trim();
  if (!newTrimmed) throw new Error('Course name cannot be empty.');

  const oldSlug = oldTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const newSlug = newTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');

  const cfg = getSiteConfig();
  const currentCourses = Array.isArray(cfg.courses) ? [...cfg.courses] : ['HSK 2'];
  const nextCourses = currentCourses.map((c) => (c.toLowerCase().replace(/[^a-z0-9]+/g, '') === oldSlug ? newTrimmed : c));
  if (!nextCourses.some((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '') === newSlug)) {
    nextCourses.push(newTrimmed);
  }
  const nextPrices: Record<string, number> = { ...(cfg.coursePrices || {}) };
  Object.keys(nextPrices).forEach((k) => {
    const kSlug = k.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (kSlug === oldSlug || kSlug === newSlug) {
      delete nextPrices[k];
    }
  });
  nextPrices[newTrimmed] = Math.max(0, Number(price) || 0);

  const existingCoursePrac = getCoursePracticePrice(oldTrimmed);
  const nextPracticePrices: Record<string, number> = { ...(cfg.coursePracticePrices || {}) };
  Object.keys(nextPracticePrices).forEach((k) => {
    const kSlug = k.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (kSlug === oldSlug || kSlug === newSlug) {
      delete nextPracticePrices[k];
    }
  });
  if (typeof practicePrice === 'number' && Number.isFinite(practicePrice) && practicePrice > 0) {
    nextPracticePrices[newTrimmed] = Math.round(practicePrice);
  } else if (existingCoursePrac > 0) {
    nextPracticePrices[newTrimmed] = existingCoursePrac;
  }

  // If overlay user subscriptions or course passes have oldCourseName, rename them as well
  const overlay = readOverlayStore();
  let overlayChanged = false;
  if (oldSlug !== newSlug) {
    Object.keys(overlay.users || {}).forEach((uid) => {
      const u = overlay.users[uid];
      if (!u?.profile) return;
      const mapCourseArr = (arr?: string[]) =>
        Array.isArray(arr)
          ? arr.map((cp: string) => {
              const cpSlug = courseSlug(cp);
              if (cpSlug === oldSlug) {
                overlayChanged = true;
                return newTrimmed;
              }
              return cp;
            })
          : arr;
      u.profile.coursePasses = mapCourseArr(u.profile.coursePasses);
      u.profile.subscribedCourses = mapCourseArr(u.profile.subscribedCourses);
      u.profile.practiceCourses = mapCourseArr(u.profile.practiceCourses);
    });
  }
  if (overlayChanged) {
    writeOverlayStore(overlay);
  }

  // Handle lesson updates if lessons list is provided
  let updatedLessons: any[] | undefined = undefined;
  if (Array.isArray(lessons) && oldSlug !== newSlug) {
    updatedLessons = lessons.map((l: any) => {
      const lCourse = String(l?.course || l?.category || '').trim();
      const lSlug = lCourse.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (lSlug !== oldSlug) return l;
      return {
        ...l,
        course: newTrimmed,
        category: newTrimmed,
        categoryKey: newSlug || 'course',
        categoryNum: newTrimmed,
        level: (!l.level || l.level.toLowerCase().replace(/[^a-z0-9]+/g, '') === oldSlug) ? newTrimmed : l.level
      };
    });
  }

  const updatedConfig = await saveSiteConfig({
    courses: nextCourses,
    coursePrices: nextPrices,
    coursePracticePrices: nextPracticePrices
  });

  return {
    config: updatedConfig,
    ...(updatedLessons ? { lessonsSheets: { Lessons: updatedLessons } } : {})
  };
}

async function deleteCourseAdmin(
  courseName: string,
  _lessons?: any[]
): Promise<{ config: SiteConfig }> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');
  const trimmed = String(courseName || '').trim();
  const delSlug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cfg = getSiteConfig();
  const currentCourses = Array.isArray(cfg.courses) ? [...cfg.courses] : ['HSK 2'];
  const nextCourses = currentCourses.filter((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '') !== delSlug);
  const nextPrices: Record<string, number> = { ...(cfg.coursePrices || {}) };
  Object.keys(nextPrices).forEach((k) => {
    if (k.toLowerCase().replace(/[^a-z0-9]+/g, '') === delSlug) {
      delete nextPrices[k];
    }
  });
  const nextPracticePrices: Record<string, number> = { ...(cfg.coursePracticePrices || {}) };
  Object.keys(nextPracticePrices).forEach((k) => {
    if (k.toLowerCase().replace(/[^a-z0-9]+/g, '') === delSlug) {
      delete nextPracticePrices[k];
    }
  });

  const updatedConfig = await saveSiteConfig({
    courses: nextCourses,
    coursePrices: nextPrices,
    coursePracticePrices: nextPracticePrices
  });
  return { config: updatedConfig };
}

async function exportUsersWorkbook(): Promise<{
  fileName: string;
  userCount: number;
  requestCount: number;
  progressCount: number;
  catalogCount: number;
}> {
  if (!state.user || !getComputedAdmin()) throw new Error('Administrator access required.');

  const { lb, hasBackend } = getBackendBridge();
  const token = getApiToken();
  if (hasBackend && token) {
    const endpoint = '/api/admin/users/export.xlsx?t=' + Date.now();
    const url = lb && typeof lb.apiUrl === 'function' ? lb.apiUrl(endpoint) : endpoint;
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errMsg = `Could not export users.xlsx from server (HTTP ${res.status}).`;
      try {
        const parsedErr = JSON.parse(errText);
        if (parsedErr?.error) errMsg = String(parsedErr.error);
      } catch {
        if (errText.trim()) errMsg = errText.trim().slice(0, 240);
      }
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'users.xlsx';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }
    const userCount = Number(res.headers.get('x-user-count')) || state.allUsers.length;
    const requestCount = Number(res.headers.get('x-request-count')) || state.allRequests.length;
    const progressCount = Number(res.headers.get('x-progress-count')) || Object.keys(baseWorkbookStore.progress || {}).length;
    const catalogCount = Number(res.headers.get('x-catalog-count')) || Object.keys(state.lessonCatalog || {}).length;
    return {
      fileName: 'users.xlsx',
      userCount,
      requestCount,
      progressCount,
      catalogCount
    };
  }

  const xlsx = await ensureXlsxLoaded();
  if (!xlsx) throw new Error('SheetJS library is not loaded.');

  const dataset = getMergedDataset();
  reconcileDatasetWithLessons(dataset);
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
    subscribedCourses: (profile.subscribedCourses || []).join(','),
    practiceLessonIds: (profile.practiceLessonIds || []).join(','),
    practiceCourses: (profile.practiceCourses || []).join(','),
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
    courseName: r.courseName || '',
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
    course: c.course || '',
    audience: c.audience,
    accessType: c.accessType,
    price: Number(c.price) || 0,
    practicePrice: Number(c.practicePrice) || 0,
    hasExercises: typeof c.hasExercises === 'boolean' ? (c.hasExercises ? 'true' : 'false') : 'true',
    updatedBy: c.updatedBy || '',
    updatedAt: String(c.updatedAt || '')
  }));

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    wb,
    userRows.length
      ? xlsx.utils.json_to_sheet(userRows)
      : xlsx.utils.aoa_to_sheet([
          ['uid', 'username', 'email', 'phoneNumber', 'dob', 'passwordHash', 'role', 'membershipStatus', 'membershipPlan', 'membershipExpiresAt', 'subscribedLessonIds', 'subscribedCourses', 'practiceLessonIds', 'practiceCourses', 'mustChangePassword', 'createdAt', 'updatedAt']
        ]),
    'Users'
  );
  xlsx.utils.book_append_sheet(
    wb,
    reqRows.length
      ? xlsx.utils.json_to_sheet(reqRows)
      : xlsx.utils.aoa_to_sheet([
          ['requestId', 'userId', 'username', 'userEmail', 'userPhone', 'planType', 'lessonId', 'courseName', 'lessonTitle', 'amountLabel', 'contactChannel', 'contactHandle', 'note', 'status', 'adminNote', 'createdAt', 'updatedAt']
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
          ['lessonId', 'title', 'course', 'audience', 'accessType', 'price', 'practicePrice', 'hasExercises', 'updatedBy', 'updatedAt']
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
  reconcileDatasetWithLessons(merged);
  syncMemoryFromDataset(merged, state.user.uid);
  emitState();

  const { hasBackend } = getBackendBridge();
  if (hasBackend && getApiToken()) {
    await syncLocalDataToDatabase({ silent: false });
  }

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
  reconcileDatasetWithLessons(merged);
  syncMemoryFromDataset(merged);
  emitState();
  return getExcelSyncSummary();
}

// --- Access Evaluation Helpers ---

function getLessonPricing(lesson: {
  id?: string;
  lessonId?: string;
  course?: string;
  category?: string;
  categoryKey?: string;
  accessType?: string;
  access?: string;
  isFree?: unknown;
  price?: unknown;
  practicePrice?: unknown;
  hasExercises?: unknown;
  exerciseCount?: unknown;
}): { accessType: 'free' | 'paid'; price: number; practicePrice: number; hasExercises: boolean } {
  const id = sanitizeDocId(lesson?.id || lesson?.lessonId || '');
  const catalogEntry = state.lessonCatalog[id];
  const courseName = getLessonCourseName({
    course: lesson?.course || catalogEntry?.course || '',
    category: lesson?.category || ''
  });
  const coursePracticeDefault = getCoursePracticePrice(courseName);

  const parsePositive = (val: unknown): number => {
    const cleaned = typeof val === 'string' ? Number(val.replace(/,/g, '').trim()) : Number(val);
    return Number.isFinite(cleaned) && cleaned > 0 ? Math.round(cleaned) : 0;
  };

  const hasEx = lessonHasExercises({
    id,
    lessonId: id,
    hasExercises: typeof lesson?.hasExercises === 'boolean' ? lesson.hasExercises : catalogEntry?.hasExercises,
    exerciseCount: typeof lesson?.exerciseCount === 'number' ? lesson.exerciseCount : undefined
  });

  const catPrac = parsePositive(catalogEntry?.practicePrice);
  const lessonPrac = parsePositive(lesson?.practicePrice);
  const resolvedPracticePrice = catPrac || lessonPrac || coursePracticeDefault;

  if (catalogEntry) {
    return {
      accessType: catalogEntry.accessType === 'paid' ? 'paid' : 'free',
      price: Number(catalogEntry.price) || (catalogEntry.accessType === 'paid' ? 75000 : 0),
      practicePrice: resolvedPracticePrice,
      hasExercises: hasEx
    };
  }

  const rawAccess = String(lesson?.accessType || lesson?.access || '').trim().toLowerCase();
  if (rawAccess === 'free' || lesson?.isFree === true || String(lesson?.isFree).toLowerCase() === 'true') {
    return { accessType: 'free', price: 0, practicePrice: resolvedPracticePrice, hasExercises: hasEx };
  }
  if (rawAccess === 'paid' || rawAccess === 'premium' || lesson?.isFree === false || String(lesson?.isFree).toLowerCase() === 'false') {
    const p = parsePositive(lesson?.price);
    return { accessType: 'paid', price: p > 0 ? p : 75000, practicePrice: resolvedPracticePrice, hasExercises: hasEx };
  }

  const cat = String(lesson?.categoryKey || '').toLowerCase();
  if (cat === 'basics' || cat === 'pinyin' || id.includes('basics') || id.includes('pinyin')) {
    return { accessType: 'free', price: 0, practicePrice: resolvedPracticePrice, hasExercises: hasEx };
  }
  const parsedPrice = parsePositive(lesson?.price);
  return { accessType: 'paid', price: parsedPrice > 0 ? parsedPrice : 75000, practicePrice: resolvedPracticePrice, hasExercises: hasEx };
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

function getCourseAccessMode(courseName: string): 'full' | 'practice' | 'none' {
  const profile = state.profile;
  if (!profile) return 'none';
  if (getComputedAdmin() || hasActiveMembership()) return 'full';

  const targetSlug = courseSlug(normalizeCourseName(courseName));
  if (!targetSlug) return 'none';

  const fullCourses = [...(profile.subscribedCourses || []), ...(profile.coursePasses || [])];
  if (fullCourses.some((c) => courseSlug(normalizeCourseName(c)) === targetSlug)) {
    return 'full';
  }
  if ((profile.practiceCourses || []).some((c) => courseSlug(normalizeCourseName(c)) === targetSlug)) {
    return 'practice';
  }
  return 'none';
}

function hasCourseAccess(courseName: string): boolean {
  return getCourseAccessMode(courseName) === 'full';
}

function hasPendingRequest(): boolean {
  return state.myRequests.some((r) => r.status === 'pending');
}

function getLessonAccessMode(lesson: {
  id?: string;
  lessonId?: string;
  course?: string;
  category?: string;
  categoryKey?: string;
  accessType?: string;
  access?: string;
  isFree?: unknown;
  price?: unknown;
}): 'full' | 'practice' | 'none' {
  const pricing = getLessonPricing(lesson);
  if (pricing.accessType === 'free') return 'full';
  if (getComputedAdmin() || hasActiveMembership()) return 'full';

  const profile = state.profile;
  if (!profile) return 'none';

  const cMode = getCourseAccessMode(getLessonCourseName(lesson));
  if (cMode === 'full') return 'full';

  const idKey = normalizeLessonIdKey(lesson?.id || lesson?.lessonId || '');
  if (idKey && !isLessonIdActive(idKey)) return 'none';

  if (idKey && (profile.subscribedLessonIds || []).some((x) => normalizeLessonIdKey(x) === idKey)) {
    return 'full';
  }
  if (cMode === 'practice') return 'practice';
  if (idKey && (profile.practiceLessonIds || []).some((x) => normalizeLessonIdKey(x) === idKey)) {
    return 'practice';
  }
  return 'none';
}

function canAccessLesson(lesson: {
  id?: string;
  lessonId?: string;
  course?: string;
  category?: string;
  categoryKey?: string;
  accessType?: string;
  access?: string;
  isFree?: unknown;
  price?: unknown;
}): boolean {
  return getLessonAccessMode(lesson) !== 'none';
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

  const { hasBackend } = getBackendBridge();
  if (hasBackend && getApiToken()) {
    const res = await backendApiFetch('/api/progress', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }).catch(() => null);
    if (res?.ok && res.data?.userProgress) {
      state.userProgress = normalizeUserProgress(res.data.userProgress, state.user.uid);
    }
    void syncUserProgressToFirestore(state.userProgress as UserProgress);
  }

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
  normalizeCourseName,
  getLessonCourseName,
  getState,
  subscribe,
  waitUntilReady,
  getIdToken,
  getSiteConfig,
  reloadSiteConfig,
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
  adminCreateUserAccount,
  verifyAdminWithGoogle,
  saveLessonCatalogItems,
  removeLessonCatalogItems,
  syncValidLessonIds: updateActiveLessonsRegistry,
  getValidLessonIds,
  getLessonTitle,
  isLessonIdActive,
  exportUsersWorkbook,
  importUsersWorkbook,
  reloadUsersWorkbookFromRepo,
  syncLocalDataToDatabase,
  refreshUsersFromBackend,
  getExcelSyncSummary,
  getLessonPricing,
  getCoursePrice,
  getCoursePracticePrice,
  getPracticePrice,
  lessonHasExercises,
  courseHasExercises,
  getLessonExerciseCount,
  createCourseAdmin,
  renameCourseAdmin,
  deleteCourseAdmin,
  hasActiveMembership,
  hasCourseAccess,
  getCourseAccessMode,
  getLessonAccessMode,
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
