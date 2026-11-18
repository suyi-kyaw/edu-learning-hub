import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithPopup,
  unlink,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
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
  storiesLabel: string;
  storiesTitle: string;
  storiesSubtitle: string;
  gamesLabel: string;
  gamesTitle: string;
  gamesSubtitle: string;
  lessonsLabel: string;
  lessonsTitle: string;
  lessonsSubtitle: string;
  adultBadge: string;
  adultTitle: string;
  adultSubtitle: string;
  adultDesc: string;
  adultBullets: string[];
  adultCta: string;
  kidsBadge: string;
  kidsTitle: string;
  kidsSubtitle: string;
  kidsDesc: string;
  kidsBullets: string[];
  kidsCta: string;
  contactEmail: string;
  contactPhone: string;
  contactViber: string;
  featuredReelIds: string[];
  featuredStoryIds: string[];
  featuredGameIds: string[];
  updatedBy?: string;
  updatedAt?: unknown;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  configId: 'homepage',
  heroEyebrow: 'Learn Chinese Step by Step',
  heroTitleLine1: 'Learn Chinese',
  heroTitleHighlight: 'with Confidence.',
  heroSubtitle: 'Build your Chinese skills through pronunciation, everyday expressions, conversations, vocabulary, and practical exercises.',
  heroPrimaryCta: 'Explore Stories & Reels',
  heroSecondaryCta: 'Learning Hub',
  heroBannerUrl: 'assets/hero-banner.png',
  storiesLabel: 'Featured Stories & Reels',
  storiesTitle: 'Stories & Reels',
  storiesSubtitle: 'Watch bite-sized vertical video reels and engaging cultural narratives crafted for modern Mandarin learners.',
  gamesLabel: 'Interactive Practice',
  gamesTitle: 'Play & Practice Games',
  gamesSubtitle: 'Reinforce your Chinese tones, character recognition, and rapid recall through interactive gameplay.',
  lessonsLabel: 'Curriculum Pathways',
  lessonsTitle: 'Choose Your Learning Pathway',
  lessonsSubtitle: 'Select your track to access structured lessons, native voice recordings, dialogues, and practice exercises.',
  adultBadge: 'Adults • Comprehensive',
  adultTitle: 'Mandarin for Adults & Professionals',
  adultSubtitle: '实用成人汉语 • Practical Proficiency',
  adultDesc: 'Master practical conversation for career, travel, dining, and HSK test preparation with real-world scenarios and cultural nuance.',
  adultBullets: [
    'Everyday Living & Socializing',
    'Business Meetings & Travel Mandarin',
    'Sentence Patterns & HSK Vocabulary'
  ],
  adultCta: 'Start Learning (Adults) →',
  kidsBadge: 'Kids • Playful Immersion',
  kidsTitle: 'Chinese for Kids & Young Learners',
  kidsSubtitle: '少儿趣味中文 • Joyful Adventures',
  kidsDesc: 'Discover the joy of Mandarin through colorful stories, playful pinyin songs, animal adventures, and interactive challenges that inspire confidence.',
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

const ADMIN_EMAIL = 'syndkyaw@gmail.com';
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
    amountLabel: '$9 / lesson',
    description: 'Lifetime unlock for one selected paid lesson.'
  }
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: (auth.currentUser?.providerData || []).map((provider) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      }))
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

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

function sanitizeDob(raw?: string | null): string {
  const v = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function sanitizeUsername(raw?: string | null, fallbackEmail?: string | null): string {
  const cleaned = String(raw || '').trim().slice(0, 60);
  if (cleaned) return cleaned;
  if (fallbackEmail && fallbackEmail.includes('@')) {
    return fallbackEmail.split('@')[0].slice(0, 60) || 'Learner';
  }
  return 'Learner';
}

function extractProviders(user: User): string[] {
  const set = new Set<string>();
  for (const p of user.providerData || []) {
    if (p.providerId) {
      set.add(String(p.providerId).slice(0, 40));
    }
  }
  return Array.from(set).slice(0, 5);
}

function isTokenAdminUser(user: User | null): boolean {
  return Boolean(
    user &&
    user.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    user.emailVerified
  );
}

type CodedAuthError = Error & { code?: string };

function formatAuthError(err: unknown): CodedAuthError {
  const code = (err as { code?: string })?.code || '';
  const rawMsg = err instanceof Error ? err.message : String(err);
  let out: CodedAuthError;
  switch (code) {
    case 'auth/operation-not-allowed':
      out = new Error(
        'Email/Password sign-in is not yet enabled in Firebase Authentication Console. Click "Continue with Google" at the top now, or enable Email/Password under Firebase Console > Authentication > Sign-in method.'
      );
      break;
    case 'auth/email-already-in-use':
      out = new Error('An account with this email already exists. Please sign in instead, or link Google after signing in.');
      break;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      out = new Error('Invalid email or password. Please check your credentials and try again.');
      break;
    case 'auth/weak-password':
      out = new Error('Password is too weak. Please enter at least 6 characters.');
      break;
    case 'auth/invalid-email':
      out = new Error('Please enter a valid email address.');
      break;
    case 'auth/popup-closed-by-user':
      out = new Error(
        'Google sign-in popup was closed before completing. Try again or open the app in a new browser tab if the preview window closed the popup.'
      );
      break;
    case 'auth/popup-blocked':
      out = new Error(
        'Google sign-in popup was blocked by your browser or embedded preview frame. Allow popups for this site or click Open in New Tab to sign in.'
      );
      break;
    case 'auth/cancelled-popup-request':
      out = new Error('A previous Google sign-in popup was cancelled. Please click Continue with Google once and finish signing in.');
      break;
    case 'auth/unauthorized-domain':
      out = new Error(
        `This domain (${typeof window !== 'undefined' ? window.location.hostname : 'preview'}) is not yet authorized for Firebase OAuth popups (auth/unauthorized-domain).`
      );
      break;
    case 'auth/web-storage-unsupported':
      out = new Error(
        'Browser storage or third-party cookies are blocked in this embedded frame. Please open the app in a new browser tab to sign in with Google.'
      );
      break;
    case 'auth/account-exists-with-different-credential':
      out = new Error(
        'An account already exists with this email under another sign-in method. Sign in with that method first, then link Google in your profile.'
      );
      break;
    case 'auth/network-request-failed':
      out = new Error('Network error while contacting Google/Firebase Authentication. Please check your connection and try again.');
      break;
    case 'auth/internal-error':
      out = new Error(
        'Google sign-in encountered an internal popup/iframe error (auth/internal-error). Allow popups/third-party cookies or open the app in a new tab to sign in.'
      );
      break;
    case 'auth/credential-already-in-use':
      out = new Error('That Google account is already linked to another user.');
      break;
    case 'auth/provider-already-linked':
      out = new Error('Google sign-in is already linked to your account.');
      break;
    case 'auth/requires-recent-login':
      out = new Error('Please sign out and sign back in before modifying linked sign-in providers.');
      break;
    default: {
      let friendly = rawMsg.replace(/^Firebase:\s*/i, '').trim();
      if (friendly.startsWith('Firestore Error:')) {
        try {
          const parsed = JSON.parse(friendly.slice('Firestore Error:'.length).trim());
          friendly = `Profile sync error (${parsed.operationType || 'write'} on ${parsed.path || 'users'}): ${parsed.error || 'Permission denied'}`;
        } catch (_) {
          // keep original
        }
      }
      if (!code && !friendly) {
        friendly = 'Authentication failed.';
      }
      out = new Error(friendly);
      break;
    }
  }
  out.code = code;
  return out;
}

// --- Client Reactive Store ---

interface AuthState {
  ready: boolean;
  user: User | null;
  profile: UserProfile | null;
  userProgress: UserProgress | null;
  isAdmin: boolean;
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
  myRequests: [],
  allRequests: [],
  allUsers: [],
  lessonCatalog: {},
  siteConfig: { ...DEFAULT_SITE_CONFIG },
  lastError: null
};

let unsubProfile: Unsubscribe | null = null;
let unsubProgress: Unsubscribe | null = null;
let unsubMyRequests: Unsubscribe | null = null;
let unsubAllRequests: Unsubscribe | null = null;
let unsubAllUsers: Unsubscribe | null = null;
let unsubCatalog: Unsubscribe | null = null;
let unsubSiteConfig: Unsubscribe | null = null;

const subscribers = new Set<(s: AuthState) => void>();

function emitState(): void {
  const snapshot: AuthState = {
    ...state,
    isAdmin: isTokenAdminUser(state.user) || state.profile?.role === 'admin'
  };
  for (const cb of subscribers) {
    try {
      cb(snapshot);
    } catch (err) {
      console.error('LinguaAuth subscriber error:', err);
    }
  }
  window.dispatchEvent(new CustomEvent('lingua-auth-change', { detail: snapshot }));
}

function clearUserListeners(): void {
  if (unsubProfile) {
    unsubProfile();
    unsubProfile = null;
  }
  if (unsubProgress) {
    unsubProgress();
    unsubProgress = null;
  }
  if (unsubMyRequests) {
    unsubMyRequests();
    unsubMyRequests = null;
  }
  if (unsubAllRequests) {
    unsubAllRequests();
    unsubAllRequests = null;
  }
  if (unsubAllUsers) {
    unsubAllUsers();
    unsubAllUsers = null;
  }
}

function normalizeStrList(raw: unknown, maxItems: number, maxLen: number, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  return raw
    .map((x) => String(x || '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeSiteConfig(raw: Partial<SiteConfig> | null | undefined): SiteConfig {
  const s = (val: unknown, maxLen: number, fb: string): string => {
    if (typeof val !== 'string') return fb;
    const trimmed = val.trim();
    return (trimmed || fb).slice(0, maxLen);
  };
  const opt = (val: unknown, maxLen: number, fb: string): string => {
    if (typeof val !== 'string') return fb;
    return val.trim().slice(0, maxLen);
  };
  return {
    configId: 'homepage',
    heroEyebrow: s(raw?.heroEyebrow, 100, DEFAULT_SITE_CONFIG.heroEyebrow),
    heroTitleLine1: s(raw?.heroTitleLine1, 120, DEFAULT_SITE_CONFIG.heroTitleLine1),
    heroTitleHighlight: s(raw?.heroTitleHighlight, 120, DEFAULT_SITE_CONFIG.heroTitleHighlight),
    heroSubtitle: s(raw?.heroSubtitle, 400, DEFAULT_SITE_CONFIG.heroSubtitle),
    heroPrimaryCta: s(raw?.heroPrimaryCta, 60, DEFAULT_SITE_CONFIG.heroPrimaryCta),
    heroSecondaryCta: s(raw?.heroSecondaryCta, 60, DEFAULT_SITE_CONFIG.heroSecondaryCta),
    heroBannerUrl: opt(raw?.heroBannerUrl, 500, DEFAULT_SITE_CONFIG.heroBannerUrl) || DEFAULT_SITE_CONFIG.heroBannerUrl,
    storiesLabel: s(raw?.storiesLabel, 100, DEFAULT_SITE_CONFIG.storiesLabel),
    storiesTitle: s(raw?.storiesTitle, 120, DEFAULT_SITE_CONFIG.storiesTitle),
    storiesSubtitle: s(raw?.storiesSubtitle, 400, DEFAULT_SITE_CONFIG.storiesSubtitle),
    gamesLabel: s(raw?.gamesLabel, 100, DEFAULT_SITE_CONFIG.gamesLabel),
    gamesTitle: s(raw?.gamesTitle, 120, DEFAULT_SITE_CONFIG.gamesTitle),
    gamesSubtitle: s(raw?.gamesSubtitle, 400, DEFAULT_SITE_CONFIG.gamesSubtitle),
    lessonsLabel: s(raw?.lessonsLabel, 100, DEFAULT_SITE_CONFIG.lessonsLabel),
    lessonsTitle: s(raw?.lessonsTitle, 120, DEFAULT_SITE_CONFIG.lessonsTitle),
    lessonsSubtitle: s(raw?.lessonsSubtitle, 400, DEFAULT_SITE_CONFIG.lessonsSubtitle),
    adultBadge: s(raw?.adultBadge, 80, DEFAULT_SITE_CONFIG.adultBadge),
    adultTitle: s(raw?.adultTitle, 140, DEFAULT_SITE_CONFIG.adultTitle),
    adultSubtitle: s(raw?.adultSubtitle, 140, DEFAULT_SITE_CONFIG.adultSubtitle),
    adultDesc: s(raw?.adultDesc, 400, DEFAULT_SITE_CONFIG.adultDesc),
    adultBullets: normalizeStrList(raw?.adultBullets, 6, 140, DEFAULT_SITE_CONFIG.adultBullets),
    adultCta: s(raw?.adultCta, 80, DEFAULT_SITE_CONFIG.adultCta),
    kidsBadge: s(raw?.kidsBadge, 80, DEFAULT_SITE_CONFIG.kidsBadge),
    kidsTitle: s(raw?.kidsTitle, 140, DEFAULT_SITE_CONFIG.kidsTitle),
    kidsSubtitle: s(raw?.kidsSubtitle, 140, DEFAULT_SITE_CONFIG.kidsSubtitle),
    kidsDesc: s(raw?.kidsDesc, 400, DEFAULT_SITE_CONFIG.kidsDesc),
    kidsBullets: normalizeStrList(raw?.kidsBullets, 6, 140, DEFAULT_SITE_CONFIG.kidsBullets),
    kidsCta: s(raw?.kidsCta, 80, DEFAULT_SITE_CONFIG.kidsCta),
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

function emitSiteConfigChange(): void {
  window.dispatchEvent(new CustomEvent('lingua-site-config-change', { detail: state.siteConfig }));
}

function startCatalogListener(): void {
  if (unsubCatalog) return;
  const catalogRef = collection(db, 'lessonCatalog');
  unsubCatalog = onSnapshot(
    catalogRef,
    (snap) => {
      const map: Record<string, LessonCatalogItem> = {};
      snap.forEach((d) => {
        const item = d.data() as LessonCatalogItem;
        if (item && item.lessonId) {
          map[item.lessonId] = item;
        }
      });
      state.lessonCatalog = map;
      emitState();
    },
    (err) => {
      console.warn('lessonCatalog listener warning:', err.message);
    }
  );
}

function startSiteConfigListener(): void {
  if (unsubSiteConfig) return;

  // Hydrate initially from server/static JSON cache so visitors get instant saved copy
  fetch('/api/site-config?t=' + Date.now())
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((json) => {
      if (json && json.config) {
        state.siteConfig = normalizeSiteConfig(json.config);
        emitSiteConfigChange();
        emitState();
      }
    });

  const cfgRef = doc(db, 'siteConfig', 'homepage');
  unsubSiteConfig = onSnapshot(
    cfgRef,
    (snap) => {
      if (snap.exists()) {
        state.siteConfig = normalizeSiteConfig(snap.data() as Partial<SiteConfig>);
        emitSiteConfigChange();
        emitState();
      }
    },
    (err) => {
      console.warn('siteConfig listener warning:', err.message);
    }
  );
}

const inFlightProfileEnsures = new Map<string, Promise<UserProfile>>();

async function ensureUserProfileDoc(
  user: User,
  overrides?: Partial<{ username: string; phoneNumber: string; dob: string }>
): Promise<UserProfile> {
  const existingPromise = inFlightProfileEnsures.get(user.uid);
  if (existingPromise && !overrides) {
    return existingPromise;
  }
  const run = ensureUserProfileDocInner(user, overrides).finally(() => {
    inFlightProfileEnsures.delete(user.uid);
  });
  inFlightProfileEnsures.set(user.uid, run);
  return run;
}

async function ensureUserProfileDocInner(
  user: User,
  overrides?: Partial<{ username: string; phoneNumber: string; dob: string }>
): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const providers = extractProviders(user);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (existingSnap && existingSnap.exists()) {
    const existing = existingSnap.data() as UserProfile;
    const nextProviders = Array.from(new Set([...(existing.linkedProviders || []), ...providers])).slice(0, 5);
    const needsProviderSync =
      nextProviders.length !== (existing.linkedProviders || []).length ||
      nextProviders.some((p, i) => p !== existing.linkedProviders?.[i]);

    const nextEmail = String(user.email || existing.email || '').slice(0, 160);
    const isRootAdmin = isTokenAdminUser(user);
    const needsRoleUpgrade = isRootAdmin && existing.role !== 'admin';

    if (needsProviderSync || (nextEmail && nextEmail !== existing.email) || needsRoleUpgrade) {
      const updatePayload: Record<string, unknown> = {
        email: nextEmail,
        linkedProviders: nextProviders,
        updatedAt: serverTimestamp()
      };
      if (needsRoleUpgrade) {
        updatePayload.role = 'admin';
      }
      try {
        await updateDoc(ref, updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    }

    if (isRootAdmin) {
      try {
        const adminRef = doc(db, 'admins', user.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: user.uid,
            email: nextEmail,
            grantedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn('Admin doc sync skipped:', err);
      }
    }
    return isRootAdmin && existing.role !== 'admin' ? { ...existing, role: 'admin', linkedProviders: nextProviders } : existing;
  }

  const username = sanitizeUsername(overrides?.username || user.displayName, user.email);
  const email = String(user.email || '').trim().slice(0, 160);
  const phoneNumber = String(overrides?.phoneNumber || user.phoneNumber || '').trim().slice(0, 32);
  const dob = sanitizeDob(overrides?.dob);
  const isRootAdmin = isTokenAdminUser(user);

  const newProfile: UserProfile = {
    uid: user.uid,
    username,
    email,
    phoneNumber,
    dob,
    role: isRootAdmin ? 'admin' : 'student',
    membershipStatus: 'free',
    membershipPlan: 'none',
    membershipExpiresAt: '',
    subscribedLessonIds: [],
    linkedProviders: providers,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(ref, newProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
  }

  if (isRootAdmin) {
    const adminPath = `admins/${user.uid}`;
    try {
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        email,
        grantedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Admin doc bootstrap skipped:', err);
    }
  }

  return newProfile;
}

function startUserListeners(user: User): void {
  clearUserListeners();

  const userPath = `users/${user.uid}`;
  unsubProfile = onSnapshot(
    doc(db, 'users', user.uid),
    (snap) => {
      if (snap.exists()) {
        state.profile = snap.data() as UserProfile;
      }
      emitState();
    },
    (err) => {
      if (auth.currentUser) {
        try {
          handleFirestoreError(err, OperationType.GET, userPath);
        } catch (wrapped) {
          state.lastError = wrapped instanceof Error ? wrapped.message : String(wrapped);
          emitState();
        }
      }
    }
  );

  const progressPath = `userProgress/${user.uid}`;
  unsubProgress = onSnapshot(
    doc(db, 'userProgress', user.uid),
    (snap) => {
      if (snap.exists()) {
        state.userProgress = normalizeUserProgress(snap.data() as Partial<UserProgress>, user.uid);
      } else {
        state.userProgress = createDefaultUserProgress(user.uid);
      }
      emitState();
    },
    (err) => {
      if (auth.currentUser) {
        try {
          handleFirestoreError(err, OperationType.GET, progressPath);
        } catch (wrapped) {
          console.warn('userProgress listener warning:', wrapped);
        }
      }
    }
  );

  const myReqQuery = query(
    collection(db, 'subscriptionRequests'),
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );
  unsubMyRequests = onSnapshot(
    myReqQuery,
    (snap) => {
      const list: SubscriptionRequest[] = [];
      snap.forEach((d) => list.push(d.data() as SubscriptionRequest));
      state.myRequests = list;
      emitState();
    },
    (err) => {
      if (auth.currentUser) {
        // Fallback query without composite index if index isn't ready yet
        const fallbackQuery = query(collection(db, 'subscriptionRequests'), where('userId', '==', user.uid));
        unsubMyRequests = onSnapshot(
          fallbackQuery,
          (snap2) => {
            const list: SubscriptionRequest[] = [];
            snap2.forEach((d) => list.push(d.data() as SubscriptionRequest));
            list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
            state.myRequests = list;
            emitState();
          },
          (err2) => {
            console.warn('subscriptionRequests listener error:', err2.message, err.message);
          }
        );
      }
    }
  );

  if (isTokenAdminUser(user)) {
    const allReqQuery = query(collection(db, 'subscriptionRequests'), orderBy('createdAt', 'desc'));
    unsubAllRequests = onSnapshot(
      allReqQuery,
      (snap) => {
        const list: SubscriptionRequest[] = [];
        snap.forEach((d) => list.push(d.data() as SubscriptionRequest));
        state.allRequests = list;
        emitState();
      },
      (err) => {
        if (auth.currentUser) {
          console.warn('Admin allRequests listener error:', err.message);
        }
      }
    );

    const allUsersQuery = query(collection(db, 'users'));
    unsubAllUsers = onSnapshot(
      allUsersQuery,
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push(d.data() as UserProfile));
        list.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        state.allUsers = list;
        emitState();
      },
      (err) => {
        if (auth.currentUser) {
          console.warn('Admin allUsers listener error:', err.message);
        }
      }
    );
  } else {
    state.allRequests = [];
    state.allUsers = [];
  }
}

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return Date.parse(ts) || 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return ((ts as { seconds: number }).seconds || 0) * 1000;
  }
  return 0;
}

// Bootstrap listeners & handle any pending redirect sign-in result
startCatalogListener();
startSiteConfigListener();
getRedirectResult(auth).catch((err) => {
  console.warn('getRedirectResult note:', err?.code || err?.message || err);
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.lastError = null;

  if (!user) {
    clearUserListeners();
    state.profile = null;
    state.userProgress = null;
    state.myRequests = [];
    state.allRequests = [];
    state.allUsers = [];
    state.ready = true;
    emitState();
    return;
  }

  try {
    await ensureUserProfileDoc(user);
    startUserListeners(user);
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  } finally {
    state.ready = true;
    emitState();
  }
});

// --- Public Auth, Profile, Subscription & Admin Methods ---

async function registerWithEmail(params: {
  username: string;
  email: string;
  phoneNumber: string;
  dob: string;
  password: string;
}): Promise<UserProfile> {
  const email = String(params.email || '').trim();
  const password = String(params.password || '');
  const username = sanitizeUsername(params.username, email);
  const phoneNumber = String(params.phoneNumber || '').trim().slice(0, 32);
  const dob = sanitizeDob(params.dob);

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw formatAuthError(err);
  }

  try {
    await updateProfile(cred.user, { displayName: username });
  } catch (err) {
    console.warn('updateProfile skipped:', err);
  }

  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn('sendEmailVerification skipped:', err);
  }

  const profile = await ensureUserProfileDoc(cred.user, { username, phoneNumber, dob });
  startUserListeners(cred.user);
  emitState();
  return profile;
}

async function loginWithEmail(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    const profile = await ensureUserProfileDoc(cred.user);
    state.user = cred.user;
    state.profile = profile;
    state.ready = true;
    startUserListeners(cred.user);
    emitState();
    return cred.user;
  } catch (err) {
    throw formatAuthError(err);
  }
}

let inFlightGoogleSignIn: Promise<User> | null = null;

async function signInWithGoogle(): Promise<User> {
  if (inFlightGoogleSignIn) {
    return inFlightGoogleSignIn;
  }
  const run = (async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      let profile: UserProfile | null = null;
      try {
        profile = await ensureUserProfileDoc(cred.user);
      } catch (profileErr) {
        console.warn('Profile bootstrap delayed after Google login:', profileErr);
      }
      state.user = cred.user;
      if (profile) {
        state.profile = profile;
      }
      state.ready = true;
      startUserListeners(cred.user);
      emitState();
      return cred.user;
    } catch (err) {
      throw formatAuthError(err);
    } finally {
      inFlightGoogleSignIn = null;
    }
  })();
  inFlightGoogleSignIn = run;
  return run;
}

async function linkGoogleAccount(): Promise<string[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  try {
    const res = await linkWithPopup(user, googleProvider);
    const providers = extractProviders(res.user);
    const userPath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        linkedProviders: providers,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
    return providers;
  } catch (err) {
    throw formatAuthError(err);
  }
}

async function unlinkGoogleAccount(): Promise<string[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  const providers = extractProviders(user);
  if (providers.length <= 1) {
    throw new Error('Cannot unlink your only remaining sign-in method.');
  }
  try {
    const updatedUser = await unlink(user, 'google.com');
    const nextProviders = extractProviders(updatedUser);
    const userPath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        linkedProviders: nextProviders,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
    return nextProviders;
  } catch (err) {
    throw formatAuthError(err);
  }
}

async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  try {
    await sendEmailVerification(user);
  } catch (err) {
    throw formatAuthError(err);
  }
}

async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, String(email || '').trim());
  } catch (err) {
    throw formatAuthError(err);
  }
}

async function reloadAuthSession(): Promise<AuthState> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  try {
    await user.reload();
    await user.getIdToken(true);
    const refreshedUser = auth.currentUser;
    if (refreshedUser) {
      state.user = refreshedUser;
      await ensureUserProfileDoc(refreshedUser);
      startUserListeners(refreshedUser);
    }
    emitState();
    return getState();
  } catch (err) {
    throw formatAuthError(err);
  }
}

async function logout(): Promise<void> {
  clearUserListeners();
  await signOut(auth);
}

async function updateProfileDetails(params: {
  username: string;
  phoneNumber: string;
  dob: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  const username = sanitizeUsername(params.username, user.email);
  const phoneNumber = String(params.phoneNumber || '').trim().slice(0, 32);
  const dob = sanitizeDob(params.dob);

  if (params.dob && !dob) {
    throw new Error('Please enter Date of Birth in YYYY-MM-DD format.');
  }

  try {
    await updateProfile(user, { displayName: username });
  } catch (err) {
    console.warn('Auth displayName update skipped:', err);
  }

  const userPath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      username,
      phoneNumber,
      dob,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
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
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in or register first to subscribe.');

  const profile = state.profile || (await ensureUserProfileDoc(user));
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const reqPath = `subscriptionRequests/${requestId}`;

  const plan = MEMBERSHIP_PLANS[params.planType] || MEMBERSHIP_PLANS.monthly;
  const lessonId = params.planType === 'per_lesson' ? sanitizeDocId(params.lessonId || '') : '';
  const lessonTitle =
    params.planType === 'per_lesson'
      ? String(params.lessonTitle || 'Paid Lesson Unlock').trim().slice(0, 160)
      : plan.name;
  const amountLabel = String(params.amountLabel || plan.amountLabel).trim().slice(0, 40);

  const payload: SubscriptionRequest = {
    requestId,
    userId: user.uid,
    username: sanitizeUsername(profile.username || user.displayName, user.email),
    userEmail: String(profile.email || user.email || '').trim().slice(0, 160),
    userPhone: String(profile.phoneNumber || '').trim().slice(0, 32),
    planType: params.planType,
    lessonId,
    lessonTitle,
    amountLabel,
    contactChannel: params.contactChannel === 'viber' ? 'viber' : 'email',
    contactHandle: String(params.contactHandle || profile.email || profile.phoneNumber || '').trim().slice(0, 80),
    note: String(params.note || '').trim().slice(0, 400),
    status: 'pending',
    adminNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'subscriptionRequests', requestId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, reqPath);
  }

  return payload;
}

async function cancelPendingRequest(requestId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  const reqPath = `subscriptionRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'subscriptionRequests', requestId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, reqPath);
  }
}

// --- Admin Management Methods ---

async function approveSubscriptionRequest(
  reqDoc: SubscriptionRequest,
  adminNote = 'Verified via QR payment'
): Promise<void> {
  if (!auth.currentUser) throw new Error('Admin sign-in required.');

  const reqPath = `subscriptionRequests/${reqDoc.requestId}`;
  const userPath = `users/${reqDoc.userId}`;

  let targetUserSnap;
  try {
    targetUserSnap = await getDoc(doc(db, 'users', reqDoc.userId));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (!targetUserSnap || !targetUserSnap.exists()) {
    throw new Error('Target user profile could not be found.');
  }

  const targetUser = targetUserSnap.data() as UserProfile;
  const now = new Date();
  let nextStatus: UserProfile['membershipStatus'] = 'active';
  let nextPlan: UserProfile['membershipPlan'] = targetUser.membershipPlan || 'none';
  let nextExpires = targetUser.membershipExpiresAt || '';
  const nextLessons = Array.isArray(targetUser.subscribedLessonIds)
    ? [...targetUser.subscribedLessonIds]
    : [];

  if (reqDoc.planType === 'monthly') {
    const exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    nextPlan = 'monthly';
    nextExpires = exp.toISOString().slice(0, 10);
  } else if (reqDoc.planType === 'annual') {
    const exp = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    nextPlan = 'annual';
    nextExpires = exp.toISOString().slice(0, 10);
  } else if (reqDoc.planType === 'per_lesson') {
    if (reqDoc.lessonId && !nextLessons.includes(reqDoc.lessonId) && nextLessons.length < 100) {
      nextLessons.push(reqDoc.lessonId);
    }
    if (nextPlan !== 'monthly' && nextPlan !== 'annual') {
      nextPlan = 'per_lesson';
      nextExpires = '';
    }
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'subscriptionRequests', reqDoc.requestId), {
      status: 'approved',
      adminNote: String(adminNote || '').slice(0, 300),
      updatedAt: serverTimestamp()
    });
    batch.update(doc(db, 'users', reqDoc.userId), {
      membershipStatus: nextStatus,
      membershipPlan: nextPlan,
      membershipExpiresAt: nextExpires,
      subscribedLessonIds: nextLessons,
      updatedAt: serverTimestamp()
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${reqPath} + ${userPath}`);
  }
}

async function rejectSubscriptionRequest(requestId: string, adminNote = 'Payment could not be verified'): Promise<void> {
  if (!auth.currentUser) throw new Error('Admin sign-in required.');
  const reqPath = `subscriptionRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'subscriptionRequests', requestId), {
      status: 'rejected',
      adminNote: String(adminNote || '').slice(0, 300),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, reqPath);
  }
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
  if (!auth.currentUser) throw new Error('Admin sign-in required.');
  const userPath = `users/${userId}`;
  try {
    const payload: Record<string, unknown> = {
      membershipStatus: updates.membershipStatus,
      membershipPlan: updates.membershipPlan,
      membershipExpiresAt: String(updates.membershipExpiresAt || '').slice(0, 40),
      updatedAt: serverTimestamp()
    };
    if (Array.isArray(updates.subscribedLessonIds)) {
      payload.subscribedLessonIds = updates.subscribedLessonIds.slice(0, 100);
    }
    await updateDoc(doc(db, 'users', userId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
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
  const user = auth.currentUser;
  if (!user) throw new Error('Admin sign-in required to save lesson pricing.');

  try {
    // Firestore batch supports up to 500 writes
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const lessonId = sanitizeDocId(item.lessonId);
        const audience = String(item.audience || '').toLowerCase() === 'kids' ? 'Kids' : 'Adult';
        const accessType = String(item.accessType || '').toLowerCase() === 'paid' ? 'paid' : 'free';
        const rawPrice = Number(item.price);
        const price = accessType === 'free' ? 0 : Math.min(9999, Math.max(0, Number.isFinite(rawPrice) ? rawPrice : 9));

        batch.set(doc(db, 'lessonCatalog', lessonId), {
          lessonId,
          title: String(item.title || lessonId).trim().slice(0, 160) || lessonId,
          audience,
          accessType,
          price,
          updatedBy: user.uid,
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'lessonCatalog');
  }
}

async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

function getSiteConfig(): SiteConfig {
  return normalizeSiteConfig(state.siteConfig);
}

async function saveSiteConfig(partial: Partial<SiteConfig>): Promise<SiteConfig> {
  const user = auth.currentUser;
  if (!user) throw new Error('Admin sign-in required to update site configuration.');

  const merged = normalizeSiteConfig({ ...state.siteConfig, ...partial });
  const payload = {
    ...merged,
    configId: 'homepage',
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  };

  const cfgPath = 'siteConfig/homepage';
  try {
    await setDoc(doc(db, 'siteConfig', 'homepage'), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, cfgPath);
  }

  state.siteConfig = merged;
  emitSiteConfigChange();
  emitState();

  // Also sync local JSON cache on the Express backend when available
  try {
    const token = await user.getIdToken();
    await fetch('/api/admin/site-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(merged)
    });
  } catch (err) {
    console.warn('Backend site-config cache sync note:', err);
  }

  return merged;
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

  // Fallback to spreadsheet metadata fields if present
  const rawAccess = String(lesson?.accessType || lesson?.access || '').trim().toLowerCase();
  if (rawAccess === 'free' || lesson?.isFree === true || String(lesson?.isFree).toLowerCase() === 'true') {
    return { accessType: 'free', price: 0 };
  }
  if (rawAccess === 'paid' || rawAccess === 'premium' || lesson?.isFree === false || String(lesson?.isFree).toLowerCase() === 'false') {
    const p = Number(lesson?.price);
    return { accessType: 'paid', price: Number.isFinite(p) && p > 0 ? p : 9 };
  }

  // Curriculum defaults: Foundations/Basics/Pinyin are free; higher tracks are paid
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
  if (profile.role === 'admin' || isTokenAdminUser(state.user)) return true;
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
  if (isTokenAdminUser(state.user) || state.profile?.role === 'admin') return true;
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
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to save progress.');
  const path = `userProgress/${user.uid}`;
  const ref = doc(db, 'userProgress', user.uid);

  const payload: UserProgress = {
    uid: user.uid,
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
    updatedAt: serverTimestamp()
  };

  state.userProgress = { ...payload };
  emitState();

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        currentStreak: payload.currentStreak,
        bestStreak: payload.bestStreak,
        lastCompletedDate: payload.lastCompletedDate,
        streakDates: payload.streakDates,
        completedLessonIds: payload.completedLessonIds,
        reminderEnabled: payload.reminderEnabled,
        reminderTime: payload.reminderTime,
        lastNotifiedDate: payload.lastNotifiedDate,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
  return payload;
}

async function recordLessonCompletedProgress(lessonId: string, completed = true): Promise<UserProgress | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const cleanId = String(lessonId || '').trim().slice(0, 128);
  const current = getUserProgress() || createDefaultUserProgress(user.uid);
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
  const user = auth.currentUser;
  if (!user) return null;

  const current = getUserProgress() || createDefaultUserProgress(user.uid);
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
  cb({
    ...state,
    isAdmin: isTokenAdminUser(state.user) || state.profile?.role === 'admin'
  });
  return () => {
    subscribers.delete(cb);
  };
}

function getState(): AuthState {
  return {
    ...state,
    isAdmin: isTokenAdminUser(state.user) || state.profile?.role === 'admin'
  };
}

const LinguaAuth = {
  projectId: firebaseConfig.projectId || 'melodic-ace-2lvvl',
  CONTACT_INFO,
  MEMBERSHIP_PLANS,
  DEFAULT_SITE_CONFIG,
  calculateAge,
  getState,
  subscribe,
  getIdToken,
  getSiteConfig,
  saveSiteConfig,
  registerWithEmail,
  loginWithEmail,
  signInWithGoogle,
  linkGoogleAccount,
  unlinkGoogleAccount,
  resendVerificationEmail,
  sendPasswordReset,
  reloadAuthSession,
  logout,
  updateProfileDetails,
  submitSubscriptionRequest,
  cancelPendingRequest,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  updateUserMembershipAdmin,
  saveLessonCatalogItems,
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
