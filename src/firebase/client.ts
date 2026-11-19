/**
 * =========================================================
 * LINGUAPATH - AUTHENTICATION, MEMBERSHIP & PROGRESS CLIENT
 * Pure Node/Express REST client (no Firebase SDK).
 * Supports both local/same-origin preview and GitHub Pages
 * connected to an external HTTPS Node server via LinguaBackend.
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
  heroSubtitle:
    'Build your Chinese skills through pronunciation, everyday expressions, conversations, vocabulary, and practical exercises.',
  heroPrimaryCta: 'Explore Stories & Reels',
  heroSecondaryCta: 'Learning Hub',
  heroBannerUrl: 'assets/hero-banner.png',
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
    amountLabel: '$9 / lesson',
    description: 'Lifetime unlock for one selected paid lesson.'
  }
};

const AUTH_TOKEN_STORAGE_KEY = 'linguapath_auth_token';

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

function resolveBackendApiUrl(path: string): string {
  const resolver = (window as unknown as { LinguaBackend?: { apiUrl?: (p: string) => string } }).LinguaBackend;
  return resolver && typeof resolver.apiUrl === 'function' ? resolver.apiUrl(path) : path;
}

function hasBackendAvailable(): boolean {
  const resolver = (window as unknown as { LinguaBackend?: { hasBackend?: () => boolean } }).LinguaBackend;
  return resolver && typeof resolver.hasBackend === 'function' ? resolver.hasBackend() : true;
}

function getStoredToken(): string | null {
  try {
    const val = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

type CodedAuthError = Error & { code?: string; status?: number };

async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; requireAuth?: boolean } = {}
): Promise<T> {
  if (!hasBackendAvailable()) {
    const err: CodedAuthError = new Error(
      'Node backend URL is not configured for this static site. Open Admin Portal -> Hosted Node Backend Connection or set DEFAULT_PRODUCTION_BACKEND_URL in backend-config.js.'
    );
    err.code = 'no-backend';
    throw err;
  }

  const token = getStoredToken();
  if (options.requireAuth && !token) {
    const err: CodedAuthError = new Error('Please sign in first.');
    err.code = 'unauthenticated';
    throw err;
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(resolveBackendApiUrl(path), {
      method: options.method || 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers,
      body: bodyStr
    });
  } catch {
    const netErr: CodedAuthError = new Error(
      'Could not reach the LinguaPath server. Check your internet connection or hosted Node backend URL.'
    );
    netErr.code = 'network-error';
    throw netErr;
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!res.ok || data.success === false) {
    const err: CodedAuthError = new Error(
      typeof data.error === 'string' && data.error ? data.error : `Request failed (HTTP ${res.status}).`
    );
    if (typeof data.code === 'string') err.code = data.code;
    err.status = res.status;
    throw err;
  }

  return data as T;
}

// --- Client Reactive Store ---

export interface AuthState {
  ready: boolean;
  user: AuthUserSummary | null;
  profile: UserProfile | null;
  userProgress: UserProgress | null;
  isAdmin: boolean;
  adminClaimed: boolean;
  smtpConfigured: boolean;
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
  smtpConfigured: false,
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

function emitState(): void {
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
  window.dispatchEvent(new CustomEvent('lingua-auth-change', { detail: snapshot }));
}

function emitSiteConfigChange(): void {
  window.dispatchEvent(new CustomEvent('lingua-site-config-change', { detail: state.siteConfig }));
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

function applySessionPayload(data: Record<string, unknown>): void {
  if (typeof data.token === 'string' && data.token) {
    setStoredToken(data.token);
  }
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
  if (typeof data.smtpConfigured === 'boolean') {
    state.smtpConfigured = data.smtpConfigured;
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
  setStoredToken(null);
  state.user = null;
  state.profile = null;
  state.userProgress = null;
  state.isAdmin = false;
  state.myRequests = [];
  state.allRequests = [];
  state.allUsers = [];
}

async function hydratePublicAndSession(): Promise<void> {
  // 1. Hydrate siteConfig (from backend or static fallback data/site-config.json)
  if (hasBackendAvailable()) {
    try {
      const cfgRes = await fetch(resolveBackendApiUrl('/api/site-config?t=' + Date.now()), {
        mode: 'cors',
        cache: 'no-store'
      });
      if (cfgRes.ok) {
        const cfgJson = (await cfgRes.json()) as { config?: Partial<SiteConfig> };
        if (cfgJson && cfgJson.config) {
          state.siteConfig = normalizeSiteConfig(cfgJson.config);
          emitSiteConfigChange();
        }
      }
    } catch {
      // Fallback below
    }
  } else {
    try {
      const staticCfg = await fetch('data/site-config.json?t=' + Date.now(), { cache: 'no-store' });
      if (staticCfg.ok) {
        const parsed = (await staticCfg.json()) as Partial<SiteConfig>;
        state.siteConfig = normalizeSiteConfig(parsed);
        emitSiteConfigChange();
      }
    } catch {
      // keep defaults
    }
  }

  // 2. Hydrate public catalog, auth status, and current user session if a token exists
  if (hasBackendAvailable()) {
    const token = getStoredToken();
    try {
      const [statusJson, catalogJson] = await Promise.all([
        fetch(resolveBackendApiUrl('/api/auth/status?t=' + Date.now()), { mode: 'cors', cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(resolveBackendApiUrl('/api/catalog?t=' + Date.now()), { mode: 'cors', cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);
      if (statusJson) {
        if (typeof statusJson.adminClaimed === 'boolean') state.adminClaimed = statusJson.adminClaimed;
        if (typeof statusJson.smtpConfigured === 'boolean') state.smtpConfigured = statusJson.smtpConfigured;
      }
      if (catalogJson && catalogJson.lessonCatalog && typeof catalogJson.lessonCatalog === 'object') {
        state.lessonCatalog = catalogJson.lessonCatalog as Record<string, LessonCatalogItem>;
      }
    } catch {
      // ignore
    }

    if (token) {
      try {
        const me = await apiRequest<Record<string, unknown>>('/api/auth/me?t=' + Date.now(), { requireAuth: true });
        applySessionPayload(me);
      } catch (err) {
        const coded = err as CodedAuthError;
        if (coded.status === 401 || coded.code === 'unauthenticated') {
          clearAuthSession();
        } else {
          state.lastError = coded.message;
        }
      }
    }
  }

  state.ready = true;
  emitState();
}

hydratePublicAndSession();
window.addEventListener('linguapath-backend-change', () => {
  hydratePublicAndSession();
});

// --- Public Auth, Profile, Subscription & Admin Methods ---

async function registerWithEmail(params: {
  username: string;
  email: string;
  phoneNumber: string;
  dob: string;
  password: string;
}): Promise<UserProfile> {
  const data = await apiRequest<Record<string, unknown>>('/api/auth/register', {
    method: 'POST',
    body: {
      username: String(params.username || '').trim(),
      email: String(params.email || '').trim(),
      phoneNumber: String(params.phoneNumber || '').trim(),
      dob: String(params.dob || '').trim(),
      password: String(params.password || '')
    }
  });
  applySessionPayload(data);
  state.ready = true;
  emitState();
  return state.profile as UserProfile;
}

async function loginWithEmail(email: string, password: string): Promise<AuthUserSummary> {
  const data = await apiRequest<Record<string, unknown>>('/api/auth/login', {
    method: 'POST',
    body: {
      email: String(email || '').trim(),
      password: String(password || '')
    }
  });
  applySessionPayload(data);
  state.ready = true;
  emitState();
  return state.user as AuthUserSummary;
}

async function sendPasswordReset(email: string): Promise<string> {
  const data = await apiRequest<{ message?: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: String(email || '').trim() }
  });
  return String(data.message || 'If an account exists for that email, a temporary password has been sent.');
}

async function changePassword(currentPassword: string, newPassword: string): Promise<UserProfile> {
  const data = await apiRequest<{ profile?: UserProfile }>('/api/auth/change-password', {
    method: 'POST',
    requireAuth: true,
    body: { currentPassword, newPassword }
  });
  if (data.profile) {
    state.profile = data.profile;
    if (state.user) {
      state.user.mustChangePassword = Boolean(data.profile.mustChangePassword);
    }
    emitState();
  }
  return state.profile as UserProfile;
}

async function reloadAuthSession(): Promise<AuthState> {
  if (!getStoredToken()) {
    throw new Error('Please sign in first.');
  }
  const me = await apiRequest<Record<string, unknown>>('/api/auth/me?t=' + Date.now(), { requireAuth: true });
  applySessionPayload(me);
  state.ready = true;
  emitState();
  return getState();
}

async function logout(): Promise<void> {
  clearAuthSession();
  state.ready = true;
  emitState();
}

async function updateProfileDetails(params: {
  username: string;
  phoneNumber: string;
  dob: string;
}): Promise<void> {
  const data = await apiRequest<{ profile?: UserProfile }>('/api/auth/profile', {
    method: 'PUT',
    requireAuth: true,
    body: {
      username: String(params.username || '').trim(),
      phoneNumber: String(params.phoneNumber || '').trim(),
      dob: String(params.dob || '').trim()
    }
  });
  if (data.profile) {
    state.profile = data.profile;
    if (state.user) {
      state.user.displayName = data.profile.username;
    }
    emitState();
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
  const data = await apiRequest<{ request: SubscriptionRequest; myRequests?: SubscriptionRequest[] }>('/api/requests', {
    method: 'POST',
    requireAuth: true,
    body: params
  });
  if (Array.isArray(data.myRequests)) {
    state.myRequests = data.myRequests;
  } else if (data.request) {
    state.myRequests = [data.request, ...state.myRequests];
  }
  emitState();
  return data.request;
}

async function cancelPendingRequest(requestId: string): Promise<void> {
  const data = await apiRequest<{ myRequests?: SubscriptionRequest[] }>(
    `/api/requests/${encodeURIComponent(requestId)}`,
    {
      method: 'DELETE',
      requireAuth: true
    }
  );
  if (Array.isArray(data.myRequests)) {
    state.myRequests = data.myRequests;
  } else {
    state.myRequests = state.myRequests.filter((r) => r.requestId !== requestId);
  }
  emitState();
}

// --- Admin Management Methods ---

async function approveSubscriptionRequest(
  reqDoc: SubscriptionRequest,
  adminNote = 'Verified via QR payment'
): Promise<void> {
  const data = await apiRequest<{
    allRequests?: SubscriptionRequest[];
    allUsers?: UserProfile[];
  }>(`/api/admin/requests/${encodeURIComponent(reqDoc.requestId)}/approve`, {
    method: 'POST',
    requireAuth: true,
    body: { adminNote }
  });
  if (Array.isArray(data.allRequests)) state.allRequests = data.allRequests;
  if (Array.isArray(data.allUsers)) state.allUsers = data.allUsers;
  emitState();
}

async function rejectSubscriptionRequest(requestId: string, adminNote = 'Payment could not be verified'): Promise<void> {
  const data = await apiRequest<{ allRequests?: SubscriptionRequest[] }>(
    `/api/admin/requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: 'POST',
      requireAuth: true,
      body: { adminNote }
    }
  );
  if (Array.isArray(data.allRequests)) state.allRequests = data.allRequests;
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
  const data = await apiRequest<{ user?: UserProfile; allUsers?: UserProfile[] }>(
    `/api/admin/users/${encodeURIComponent(userId)}/membership`,
    {
      method: 'PUT',
      requireAuth: true,
      body: updates
    }
  );
  if (Array.isArray(data.allUsers)) state.allUsers = data.allUsers;
  if (data.user && state.user && data.user.uid === state.user.uid) {
    state.profile = data.user;
  }
  emitState();
}

async function adminResetUserPassword(
  userId: string,
  options: { newPassword?: string; sendEmail?: boolean } = {}
): Promise<{ emailed: boolean; emailError?: string | null; temporaryPassword: string; user?: UserProfile }> {
  const data = await apiRequest<{
    emailed: boolean;
    emailError?: string | null;
    temporaryPassword: string;
    user?: UserProfile;
    allUsers?: UserProfile[];
  }>(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    requireAuth: true,
    body: options
  });
  if (Array.isArray(data.allUsers)) state.allUsers = data.allUsers;
  emitState();
  return data;
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
  const data = await apiRequest<{ lessonCatalog?: Record<string, LessonCatalogItem> }>('/api/admin/catalog', {
    method: 'PUT',
    requireAuth: true,
    body: { items }
  });
  if (data.lessonCatalog) {
    state.lessonCatalog = data.lessonCatalog;
    emitState();
  }
}

async function getIdToken(): Promise<string | null> {
  return getStoredToken();
}

function getSiteConfig(): SiteConfig {
  return normalizeSiteConfig(state.siteConfig);
}

async function saveSiteConfig(partial: Partial<SiteConfig>): Promise<SiteConfig> {
  const merged = normalizeSiteConfig({ ...state.siteConfig, ...partial });
  const data = await apiRequest<{ config?: Partial<SiteConfig> }>('/api/admin/site-config', {
    method: 'PUT',
    requireAuth: true,
    body: merged
  });
  state.siteConfig = normalizeSiteConfig(data.config || merged);
  emitSiteConfigChange();
  emitState();
  return state.siteConfig;
}

async function getSmtpStatus(): Promise<{
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  userMasked: string;
  from: string;
}> {
  return apiRequest('/api/admin/smtp-status', { requireAuth: true });
}

async function sendTestSmtpEmail(to?: string): Promise<{ message: string }> {
  return apiRequest('/api/admin/test-smtp', {
    method: 'POST',
    requireAuth: true,
    body: to ? { to } : {}
  });
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
    lastNotifiedDate: sanitizeDateStr(next.lastNotifiedDate)
  };

  state.userProgress = { ...payload };
  emitState();

  const data = await apiRequest<{ userProgress?: UserProgress }>('/api/progress', {
    method: 'PUT',
    requireAuth: true,
    body: payload
  });
  if (data.userProgress) {
    state.userProgress = normalizeUserProgress(data.userProgress, state.user.uid);
    emitState();
  }
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
  registerWithEmail,
  loginWithEmail,
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
  adminResetUserPassword,
  saveLessonCatalogItems,
  getSmtpStatus,
  sendTestSmtpEmail,
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
