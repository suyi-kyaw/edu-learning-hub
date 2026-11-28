/**
 * =========================================================
 * JIEDEEDU - AUTHENTICATION, PROFILE & SUBSCRIPTION UI
 * Handles Account Modal (Email & Password Auth),
 * Profile + DOB/Age + Change Password, Membership Plans,
 * Email/Viber QR Payment Request Flow, and Admin Approvals.
 * =========================================================
 */

(function () {
  'use strict';

  const PLAN_CATALOG = {
    per_lesson: {
      id: 'per_lesson',
      title: 'Single Lesson · Full Access',
      defaultAmount: '75,000 Kyat',
      subtitle: 'Video, Exercises, Writing & Pronunciation for one lesson'
    },
    practice_lesson: {
      id: 'practice_lesson',
      title: 'Single Lesson · Practice Only',
      defaultAmount: 'Practice Rate',
      subtitle: 'Exercises, Writing & Pronunciation for one lesson (No Video)'
    },
    course: {
      id: 'course',
      title: 'Full Course Pass',
      defaultAmount: '280,000 Kyat',
      subtitle: 'Video & Practice for every lesson inside a selected course (e.g., HSK 1, HSK 2)'
    },
    practice_course: {
      id: 'practice_course',
      title: 'Course · Practice Only',
      defaultAmount: 'Practice Rate',
      subtitle: 'Exercises, Writing & Pronunciation for every lesson in a course (No Video)'
    }
  };

  let modalMode = 'closed'; // 'closed' | 'auth' | 'registering' | 'account' | 'subscribe'
  let authTab = 'signin'; // 'signin' | 'register' | 'reset'
  let resetPrefillEmail = '';
  let accountTab = 'profile'; // 'profile' | 'plans' | 'admin'
  let subscribeContext = {
    planType: 'course',
    lessonId: '',
    lessonTitle: '',
    courseName: 'HSK 2',
    amountLabel: '280,000 Kyat',
    contactChannel: 'viber'
  };
  let pendingPostAuthSubscribe = null;
  let feedbackBanner = null; // { type: 'success' | 'error' | 'info', text: string }
  let lastAuthUserUid = null;
  let registrationState = {
    phase: 'idle', // 'idle' | 'pending' | 'success' | 'error'
    step: 'validate', // 'validate' | 'saving' | 'verifying' | 'done'
    detail: '',
    errorMessage: '',
    isDuplicateEmail: false,
    pendingCreds: null, // In-memory only during active registration/retry; cleared on success/cancel
    draftMeta: { username: '', email: '', phoneNumber: '', dob: '' }
  };

  function clearTransientRegistrationCreds() {
    if (registrationState.pendingCreds) {
      registrationState.pendingCreds = null;
    }
  }

  function resetRegistrationState(clearDraft = false) {
    clearTransientRegistrationCreds();
    registrationState.phase = 'idle';
    registrationState.step = 'validate';
    registrationState.detail = '';
    registrationState.errorMessage = '';
    registrationState.isDuplicateEmail = false;
    if (clearDraft) {
      registrationState.draftMeta = { username: '', email: '', phoneNumber: '', dob: '' };
    }
  }

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAuthApi() {
    return window.LinguaAuth || null;
  }

  function getSiteContact() {
    const api = getAuthApi();
    const cfg = api && typeof api.getSiteConfig === 'function' ? api.getSiteConfig() : null;
    const contactEmail = (cfg && cfg.contactEmail) || 'syndkyaw@gmail.com';
    const contactPhone = (cfg && cfg.contactPhone) || '+95 9 798 123 456';
    const contactViber = (cfg && cfg.contactViber) || contactPhone || '+95 9 798 123 456';
    const cleanVib = String(contactViber).replace(/[^+\d]/g, '') || '+959798123456';
    const viberHref = `viber://chat?number=${encodeURIComponent(cleanVib)}`;
    return { contactEmail, contactPhone, contactViber, viberHref };
  }

  function getAgeLabel(dob) {
    const api = getAuthApi();
    if (!api || !dob) return '';
    const age = api.calculateAge(dob);
    return age !== null ? `${age} yrs` : '';
  }

  function normalizeLessonKeyUI(raw) {
    return String(raw || '').trim().replace(/[^a-zA-Z0-9_\-]+/g, '-').toLowerCase();
  }

  function getValidatedEntitlements(state, profile) {
    const api = getAuthApi();
    let validIds = api && typeof api.getValidLessonIds === 'function' ? api.getValidLessonIds() : null;
    if (!validIds && window.LinguaLessons && typeof window.LinguaLessons.getAllLessonIds === 'function') {
      const fromPage = window.LinguaLessons.getAllLessonIds();
      if (Array.isArray(fromPage) && fromPage.length > 0) validIds = fromPage;
    }
    const validSet = Array.isArray(validIds)
      ? new Set(validIds.map(normalizeLessonKeyUI).filter(Boolean))
      : null;

    const filterLessons = (arr) => {
      if (!Array.isArray(arr)) return [];
      const out = [];
      const seen = new Set();
      for (const id of arr) {
        const key = normalizeLessonKeyUI(id);
        if (!key || seen.has(key)) continue;
        if (validSet !== null && !validSet.has(key)) continue;
        seen.add(key);
        out.push(String(id).trim());
      }
      return out;
    };

    const unlockedCourses = Array.isArray(profile?.subscribedCourses) ? profile.subscribedCourses.filter(Boolean) : [];
    const practiceCourses = Array.isArray(profile?.practiceCourses) ? profile.practiceCourses.filter(Boolean) : [];
    const unlockedLessons = filterLessons(profile?.subscribedLessonIds);
    const practiceLessons = filterLessons(profile?.practiceLessonIds);

    const hasTimePass =
      Boolean(api && typeof api.hasActiveMembership === 'function' && api.hasActiveMembership()) &&
      (profile?.membershipPlan === 'monthly' || profile?.membershipPlan === 'annual');

    const hasAnyEntitlement =
      unlockedCourses.length > 0 ||
      practiceCourses.length > 0 ||
      unlockedLessons.length > 0 ||
      practiceLessons.length > 0 ||
      hasTimePass;

    return {
      unlockedCourses,
      practiceCourses,
      unlockedLessons,
      practiceLessons,
      hasTimePass,
      isEffectivelyActive: Boolean(state?.isAdmin || hasAnyEntitlement)
    };
  }

  function formatLessonLabelUI(lessonId) {
    const api = getAuthApi();
    const title = api && typeof api.getLessonTitle === 'function' ? api.getLessonTitle(lessonId) : '';
    if (title && title.trim() && title.trim() !== String(lessonId).trim()) {
      return `${title.trim()} (${lessonId})`;
    }
    return String(lessonId);
  }

  function formatMembershipBadge(state) {
    const profile = state?.profile;
    if (!state?.user) return '';
    if (state.isAdmin) return 'Admin';
    if (!profile) return 'Free';
    const ent = getValidatedEntitlements(state, profile);
    const hasCourses = ent.unlockedCourses.length > 0;
    const hasPracticeCourses = ent.practiceCourses.length > 0;
    const hasLessons = ent.unlockedLessons.length > 0;
    const hasPracticeLessons = ent.practiceLessons.length > 0;
    if (ent.isEffectivelyActive) {
      if ((hasCourses && profile.membershipPlan !== 'practice_course') || (profile.membershipPlan === 'course' && hasCourses)) return 'Course Active';
      if (hasPracticeCourses) return 'Practice Course';
      if ((hasLessons && profile.membershipPlan !== 'practice_lesson') || (profile.membershipPlan === 'per_lesson' && hasLessons)) return 'Lesson Pass';
      if (hasPracticeLessons) return 'Practice Pass';
      return 'Active';
    }
    if ((state.myRequests || []).some((r) => r.status === 'pending')) {
      return 'Pending QR';
    }
    if (profile.membershipStatus === 'expired') return 'Expired';
    return 'Free';
  }

  // --- Header Account Button Synchronization ---
  function updateHeaderAccountUI(state) {
    const api = getAuthApi();
    const s = state || (api ? api.getState() : { ready: false, user: null, profile: null, myRequests: [] });

    const btn = document.getElementById('headerAccountBtn');
    const mobileBtn = document.getElementById('mobileAccountBtn');
    const mobileSub = document.getElementById('mobileAccountSubtext');

    if (s.user) {
      const displayName =
        s.profile?.username ||
        s.user.displayName ||
        (s.user.email ? s.user.email.split('@')[0] : 'Account');
      const shortName = displayName.length > 14 ? displayName.slice(0, 13) + '…' : displayName;
      const initial = (displayName.trim()[0] || 'L').toUpperCase();
      const statusText = formatMembershipBadge(s);

      if (btn) {
        btn.classList.add('is-signed-in');
        btn.setAttribute('aria-label', `Account: ${displayName} (${statusText})`);
        btn.innerHTML = `
          <span class="account-avatar-badge" aria-hidden="true">${escapeHTML(initial)}</span>
          <span class="account-btn-text-wrap">
            <span class="account-btn-name">${escapeHTML(shortName)}</span>
            <span class="account-btn-status">${escapeHTML(statusText)}</span>
          </span>
        `;
      }
      if (mobileBtn) {
        mobileBtn.classList.add('is-signed-in');
      }
      if (mobileSub) {
        mobileSub.textContent = `${displayName} · ${statusText}`;
      }
    } else {
      if (btn) {
        btn.classList.remove('is-signed-in');
        btn.setAttribute('aria-label', 'Sign in or register account');
        btn.innerHTML = `
          <span class="account-avatar-badge account-avatar-guest" aria-hidden="true">👤</span>
          <span class="account-btn-label">Sign In</span>
        `;
      }
      if (mobileBtn) {
        mobileBtn.classList.remove('is-signed-in');
      }
      if (mobileSub) {
        mobileSub.textContent = 'Sign in, register & manage membership';
      }
    }
  }

  // --- Modal Lifecycle ---
  function ensureModalRoot() {
    let backdrop = document.getElementById('linguaAuthModal');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'linguaAuthModal';
      backdrop.className = 'lp-auth-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('aria-labelledby', 'lpAuthModalTitle');
      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          if (modalMode === 'registering' && registrationState.phase === 'pending') {
            return;
          }
          closeModal();
        }
      });
    }
    return backdrop;
  }

  function closeModal() {
    if (modalMode === 'registering' && registrationState.phase === 'pending') {
      return;
    }
    modalMode = 'closed';
    feedbackBanner = null;
    resetRegistrationState(true);
    const backdrop = document.getElementById('linguaAuthModal');
    if (backdrop) {
      backdrop.classList.remove('is-open', 'is-fullscreen');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('lp-modal-open');
  }

  function openAuthModal(initialTab = 'signin') {
    const api = getAuthApi();
    const state = api ? api.getState() : null;
    feedbackBanner = null;
    resetRegistrationState(true);
    if (state && state.user) {
      modalMode = 'account';
      accountTab = 'profile';
    } else {
      modalMode = 'auth';
      authTab = initialTab === 'register' ? 'register' : 'signin';
    }
    renderModal();
  }

  function openAccountModal(tab = 'profile') {
    const api = getAuthApi();
    const state = api ? api.getState() : null;
    feedbackBanner = null;
    resetRegistrationState(true);
    if (!state || !state.user) {
      openAuthModal('signin');
      return;
    }
    modalMode = 'account';
    accountTab = tab;
    renderModal();
  }

  function getAvailableCoursesList() {
    const api = getAuthApi();
    const set = new Set();
    if (window.LinguaLessons && typeof window.LinguaLessons.getAllCourses === 'function') {
      (window.LinguaLessons.getAllCourses() || []).forEach((c) => {
        if (c && String(c).trim()) set.add(String(c).trim());
      });
    } else {
      const cfg = api && typeof api.getSiteConfig === 'function' ? api.getSiteConfig() : null;
      if (cfg && Array.isArray(cfg.courses)) {
        cfg.courses.forEach((c) => {
          if (c && String(c).trim()) set.add(String(c).trim());
        });
      }
      if (cfg && cfg.coursePrices && typeof cfg.coursePrices === 'object') {
        Object.keys(cfg.coursePrices).forEach((k) => {
          if (k && String(k).trim()) set.add(String(k).trim());
        });
      }
    }
    if (set.size === 0) set.add('HSK 2');
    return Array.from(set);
  }

  function resolveCoursePriceKyat(courseName) {
    const api = getAuthApi();
    if (api && typeof api.getCoursePrice === 'function') {
      const p = api.getCoursePrice(courseName);
      if (p !== undefined && p !== null && Number.isFinite(Number(p)) && Number(p) >= 0) {
        return Math.round(Number(p));
      }
    }
    const target = String(courseName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const readMap = (map) => {
      if (!map || typeof map !== 'object') return null;
      for (const [c, p] of Object.entries(map)) {
        if (String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === target) {
          const parsed = typeof p === 'string' ? Number(p.replace(/,/g, '').trim()) : Number(p);
          if (p !== undefined && p !== null && Number.isFinite(parsed) && parsed >= 0) {
            return Math.round(parsed);
          }
        }
      }
      return null;
    };
    try {
      const headPrice = readMap(window.__INITIAL_SITE_CONFIG_CACHE__?.coursePrices);
      if (headPrice !== null) return headPrice;
      const rawCfg = localStorage.getItem('linguapath_site_config_v1');
      if (rawCfg) {
        const lsPrice = readMap(JSON.parse(rawCfg)?.coursePrices);
        if (lsPrice !== null) return lsPrice;
      }
      const rawOverlay = localStorage.getItem('linguapath_excel_overlay_store');
      if (rawOverlay) {
        const ovPrice = readMap(JSON.parse(rawOverlay)?.siteConfig?.coursePrices);
        if (ovPrice !== null) return ovPrice;
      }
    } catch (_) {}
    return target.includes('hsk2') ? 280000 : 100;
  }

  function resolveCoursePracticePriceKyat(courseName) {
    const api = getAuthApi();
    if (courseName && api && typeof api.getCoursePracticePrice === 'function') {
      const p = api.getCoursePracticePrice(courseName);
      if (p !== undefined && p !== null && Number.isFinite(Number(p)) && Number(p) > 0) {
        return Math.round(Number(p));
      }
    }
    const target = String(courseName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const readPositiveMap = (map) => {
      if (!map || typeof map !== 'object' || !target) return null;
      for (const [c, p] of Object.entries(map)) {
        if (String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === target) {
          const parsed = typeof p === 'string' ? Number(p.replace(/,/g, '').trim()) : Number(p);
          if (parsed !== undefined && parsed !== null && Number.isFinite(parsed) && parsed > 0) {
            return Math.round(parsed);
          }
        }
      }
      return null;
    };
    try {
      const headPrac = readPositiveMap(window.__INITIAL_SITE_CONFIG_CACHE__?.coursePracticePrices);
      if (headPrac !== null) return headPrac;
      const rawCfg = localStorage.getItem('linguapath_site_config_v1');
      if (rawCfg) {
        const lsPrac = readPositiveMap(JSON.parse(rawCfg)?.coursePracticePrices);
        if (lsPrac !== null) return lsPrac;
      }
      const rawOverlay = localStorage.getItem('linguapath_excel_overlay_store');
      if (rawOverlay) {
        const ovPrac = readPositiveMap(JSON.parse(rawOverlay)?.siteConfig?.coursePracticePrices);
        if (ovPrac !== null) return ovPrac;
      }
    } catch (_) {}
    if (api && typeof api.getPracticePrice === 'function') {
      const def = api.getPracticePrice();
      if (Number.isFinite(Number(def)) && Number(def) > 0) return Math.round(Number(def));
    }
    return 55000;
  }

  function resolveLessonPracticePriceKyat(lessonOrOpts, courseName) {
    const api = getAuthApi();
    const fallbackCourse =
      courseName ||
      (api && typeof api.getLessonCourseName === 'function'
        ? api.getLessonCourseName(lessonOrOpts || {})
        : lessonOrOpts?.course || lessonOrOpts?.category || 'HSK 2');
    const coursePrac = resolveCoursePracticePriceKyat(fallbackCourse);
    const id = String(lessonOrOpts?.id || lessonOrOpts?.lessonId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_\-]+/g, '-');
    if (api && typeof api.getLessonPricing === 'function') {
      const p = api.getLessonPricing({
        ...(typeof lessonOrOpts === 'object' ? lessonOrOpts : {}),
        id,
        course: fallbackCourse
      });
      if (p && Number(p.practicePrice) > 0) {
        return Math.round(Number(p.practicePrice));
      }
    }
    try {
      const rawLocal = localStorage.getItem('linguapath_local_lesson_pricing');
      if (rawLocal && id) {
        const map = JSON.parse(rawLocal);
        const lp = Number(map?.[id]?.practicePrice);
        if (Number.isFinite(lp) && lp > 0) return Math.round(lp);
      }
    } catch (_) {}
    const directPrac = Number(lessonOrOpts?.practicePrice);
    if (Number.isFinite(directPrac) && directPrac > 0) return Math.round(directPrac);
    return coursePrac;
  }

  function resolvePracticePriceKyat(lessonOrCourse) {
    if (typeof lessonOrCourse === 'string') return resolveCoursePracticePriceKyat(lessonOrCourse);
    if (lessonOrCourse && typeof lessonOrCourse === 'object') return resolveLessonPracticePriceKyat(lessonOrCourse);
    return resolveCoursePracticePriceKyat('');
  }

  function lessonHasExercisesUI(lessonOrId) {
    if (!lessonOrId) return false;
    const api = getAuthApi();
    if (api && typeof api.lessonHasExercises === 'function') {
      return Boolean(api.lessonHasExercises(lessonOrId));
    }
    if (typeof lessonOrId === 'object') {
      if (typeof lessonOrId.exerciseCount === 'number') return lessonOrId.exerciseCount > 0;
      if (typeof lessonOrId.hasExercises === 'boolean') return lessonOrId.hasExercises;
    }
    return true;
  }

  function courseHasExercisesUI(courseName) {
    const api = getAuthApi();
    if (api && typeof api.courseHasExercises === 'function') {
      return Boolean(api.courseHasExercises(courseName));
    }
    return true;
  }

  function openSubscribeModal(lessonOrOpts) {
    const api = getAuthApi();
    const state = api ? api.getState() : null;
    feedbackBanner = null;

    if (lessonOrOpts && lessonOrOpts.mode === 'course') {
      const cName = api && api.normalizeCourseName
        ? api.normalizeCourseName(lessonOrOpts.courseName || 'HSK 2')
        : (lessonOrOpts.courseName || 'HSK 2');
      const hasCourseEx = courseHasExercisesUI(cName);
      const isPracticeCourse = lessonOrOpts.planType === 'practice_course' && hasCourseEx;
      const cPrice = isPracticeCourse ? resolveCoursePracticePriceKyat(cName) : resolveCoursePriceKyat(cName);
      subscribeContext = {
        planType: isPracticeCourse ? 'practice_course' : 'course',
        lessonId: '',
        lessonTitle: isPracticeCourse ? `${cName} Course (Practice Only)` : `${cName} Full Course`,
        courseName: cName,
        amountLabel: `${Number(cPrice).toLocaleString('en-US')} Kyat`,
        contactChannel: subscribeContext.contactChannel || 'viber'
      };
    } else if (lessonOrOpts && (lessonOrOpts.id || lessonOrOpts.lessonId)) {
      const pricing = api ? api.getLessonPricing(lessonOrOpts) : { accessType: 'paid', price: 75000 };
      const lessonId = String(lessonOrOpts.id || lessonOrOpts.lessonId);
      const baseTitle = String(lessonOrOpts.title || lessonId);
      const cName = api && api.getLessonCourseName
        ? api.getLessonCourseName(lessonOrOpts)
        : (lessonOrOpts.course || lessonOrOpts.category || 'HSK 2');
      const hasLessonEx = lessonHasExercisesUI({
        id: lessonId,
        hasExercises: lessonOrOpts.hasExercises,
        exerciseCount: lessonOrOpts.exerciseCount
      });
      const isPracticeLesson = lessonOrOpts.planType === 'practice_lesson' && hasLessonEx;
      const amtNum = isPracticeLesson
        ? resolveLessonPracticePriceKyat(lessonOrOpts, cName)
        : pricing.price || 75000;
      subscribeContext = {
        planType: isPracticeLesson ? 'practice_lesson' : 'per_lesson',
        lessonId,
        lessonTitle: baseTitle,
        courseName: cName,
        amountLabel: `${Number(amtNum).toLocaleString('en-US')} Kyat`,
        contactChannel: subscribeContext.contactChannel || 'viber'
      };
    } else {
      const firstCourse = getAvailableCoursesList()[0] || 'HSK 2';
      const cPrice = resolveCoursePriceKyat(firstCourse);
      subscribeContext = {
        planType: 'course',
        lessonId: '',
        lessonTitle: `${firstCourse} Full Course`,
        courseName: firstCourse,
        amountLabel: `${Number(cPrice).toLocaleString('en-US')} Kyat`,
        contactChannel: subscribeContext.contactChannel || 'viber'
      };
    }

    if (!state || !state.user) {
      pendingPostAuthSubscribe = { ...subscribeContext };
    }
    modalMode = 'subscribe';
    renderModal();
  }

  function openSubscribeCourseModal(courseName, planType) {
    openSubscribeModal({ mode: 'course', courseName: courseName || 'HSK 2', planType: planType || 'course' });
  }

  function showToast(message, type = 'success') {
    let container = document.getElementById('lpToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'lpToastContainer';
      container.className = 'lp-toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `lp-toast lp-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('is-hiding');
      setTimeout(() => toast.remove(), 260);
    }, 3600);
  }

  function copyToClipboard(text, buttonEl) {
    const originalText = buttonEl ? buttonEl.textContent : '';
    const onDone = () => {
      if (buttonEl) {
        buttonEl.textContent = 'Copied';
        setTimeout(() => {
          buttonEl.textContent = originalText;
        }, 1800);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(onDone);
    } else {
      onDone();
    }
  }

  // --- Modal Rendering ---
  function renderFeedbackHTML() {
    if (!feedbackBanner || !feedbackBanner.text) return '';
    return `
      <div class="lp-feedback lp-feedback-${escapeHTML(feedbackBanner.type || 'info')}" role="alert">
        <div>${escapeHTML(feedbackBanner.text)}</div>
      </div>
    `;
  }

  function renderAuthView(state) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const pendingHint = pendingPostAuthSubscribe
      ? `<div class="lp-context-callout">Sign in or create an account to subscribe to <strong>${escapeHTML(
          pendingPostAuthSubscribe.lessonTitle || PLAN_CATALOG[pendingPostAuthSubscribe.planType]?.title || 'Membership'
        )}</strong>.</div>`
      : '';
    const adminSetupHint =
      authTab === 'register' && state && state.ready && !state.adminClaimed
        ? `<div class="lp-context-callout"><strong>First-Time Admin Setup:</strong> Register with <strong>syndkyaw@gmail.com</strong> to claim Administrator access for the CMS Portal.</div>`
        : '';

    return `
      <div class="lp-modal-header">
        <div>
          <span class="lp-modal-eyebrow">JiedeEdu Account</span>
          <h2 id="lpAuthModalTitle">${
            authTab === 'register'
              ? 'Create Your Learner Profile'
              : authTab === 'reset'
              ? 'Reset Forgotten Password'
              : 'Welcome Back'
          }</h2>
        </div>
        <button type="button" class="lp-modal-close" id="lpCloseAuthModalBtn" aria-label="Close modal">✕</button>
      </div>

      ${pendingHint}
      ${adminSetupHint}

      ${
        authTab === 'reset'
          ? ''
          : `
        <div class="lp-tabs-bar" role="tablist">
          <button type="button" class="lp-tab-btn ${authTab === 'signin' ? 'active' : ''}" data-auth-tab="signin" role="tab" aria-selected="${authTab === 'signin'}">Sign In</button>
          <button type="button" class="lp-tab-btn ${authTab === 'register' ? 'active' : ''}" data-auth-tab="register" role="tab" aria-selected="${authTab === 'register'}">Register</button>
        </div>
      `
      }

      ${renderFeedbackHTML()}

      ${
        authTab === 'reset'
          ? `
        <div class="lp-context-callout" style="margin-bottom:14px;">
          Verify your registered <strong>Date of Birth</strong> and <strong>Phone / Viber Number</strong> to set a new password right away, or ask the site Admin to update it in <code>users.xlsx</code>.
        </div>
        <form id="lpVerifyResetForm" class="lp-form" novalidate>
          <div class="lp-field">
            <label for="lpResetEmail">Email Address *</label>
            <input type="email" id="lpResetEmail" autocomplete="email" value="${escapeHTML(
              resetPrefillEmail
            )}" placeholder="you@example.com" required />
          </div>
          <div class="lp-form-grid-2">
            <div class="lp-field">
              <label for="lpResetDob">Registered Date of Birth *</label>
              <input type="date" id="lpResetDob" max="${todayIso}" required />
            </div>
            <div class="lp-field">
              <label for="lpResetPhone">Registered Phone / Viber *</label>
              <input type="tel" id="lpResetPhone" maxlength="32" placeholder="+95 9 xxx xxx xxx" required />
            </div>
          </div>
          <div class="lp-form-grid-2">
            <div class="lp-field">
              <label for="lpResetNewPassword">New Password *</label>
              <input type="password" id="lpResetNewPassword" minlength="6" autocomplete="new-password" placeholder="Min. 6 characters" required />
            </div>
            <div class="lp-field">
              <label for="lpResetConfirmPassword">Confirm New Password *</label>
              <input type="password" id="lpResetConfirmPassword" minlength="6" autocomplete="new-password" placeholder="Repeat password" required />
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
            <button type="button" class="lp-btn lp-btn-secondary" id="lpResetBackToSignInBtn">← Back to Sign In</button>
            <button type="submit" class="lp-btn lp-btn-primary" style="flex:1;" id="lpResetSubmitBtn">Verify &amp; Set New Password</button>
          </div>
        </form>
      `
          : authTab === 'signin'
          ? `
        <form id="lpSignInForm" class="lp-form" novalidate>
          <div class="lp-field">
            <label for="lpLoginEmail">Email Address</label>
            <input type="email" id="lpLoginEmail" autocomplete="email" value="${escapeHTML(
              resetPrefillEmail
            )}" placeholder="you@example.com" required />
          </div>
          <div class="lp-field">
            <div class="lp-field-label-row">
              <label for="lpLoginPassword">Password</label>
              <button type="button" class="lp-link-btn" id="lpForgotPasswordBtn">Forgot password?</button>
            </div>
            <input type="password" id="lpLoginPassword" autocomplete="current-password" placeholder="Enter your password" required />
          </div>
          <button type="submit" class="lp-btn lp-btn-primary lp-btn-full" id="lpSignInSubmitBtn">Sign In</button>
        </form>
      `
          : `
        <form id="lpRegisterForm" class="lp-form" novalidate>
          <div class="lp-form-grid-2">
            <div class="lp-field">
              <label for="lpRegUsername">User Name *</label>
              <input type="text" id="lpRegUsername" maxlength="60" autocomplete="username" value="${escapeHTML(registrationState.draftMeta?.username || '')}" placeholder="e.g. Mei Lin" required />
            </div>
            <div class="lp-field">
              <label for="lpRegEmail">Email Address *</label>
              <input type="email" id="lpRegEmail" maxlength="160" autocomplete="email" value="${escapeHTML(registrationState.draftMeta?.email || '')}" placeholder="you@example.com" required />
            </div>
          </div>

          <div class="lp-form-grid-2">
            <div class="lp-field">
              <label for="lpRegPhone">Phone / Viber Number *</label>
              <input type="tel" id="lpRegPhone" maxlength="32" autocomplete="tel" value="${escapeHTML(registrationState.draftMeta?.phoneNumber || '')}" placeholder="+95 9 xxx xxx xxx" required />
            </div>
            <div class="lp-field">
              <div class="lp-field-label-row">
                <label for="lpRegDob">Date of Birth *</label>
                <span class="lp-age-readout" id="lpRegAgePreview">${registrationState.draftMeta?.dob && getAgeLabel(registrationState.draftMeta.dob) ? `Age: ${escapeHTML(getAgeLabel(registrationState.draftMeta.dob))}` : 'Age: --'}</span>
              </div>
              <input type="date" id="lpRegDob" max="${todayIso}" value="${escapeHTML(registrationState.draftMeta?.dob || '')}" required />
            </div>
          </div>

          <div class="lp-form-grid-2">
            <div class="lp-field">
              <label for="lpRegPassword">Password *</label>
              <input type="password" id="lpRegPassword" minlength="6" autocomplete="new-password" placeholder="Min. 6 characters" required />
            </div>
            <div class="lp-field">
              <label for="lpRegPasswordConfirm">Confirm Password *</label>
              <input type="password" id="lpRegPasswordConfirm" minlength="6" autocomplete="new-password" placeholder="Repeat password" required />
            </div>
          </div>

          <button type="submit" class="lp-btn lp-btn-primary lp-btn-full" id="lpRegisterSubmitBtn">Create Account</button>
        </form>
      `
      }
    `;
  }

  function renderRegisteringView(state) {
    const phase = registrationState.phase;
    const step = registrationState.step;
    const draft = registrationState.draftMeta || {};
    const stepOrder = { validate: 0, saving: 1, verifying: 2, done: 3 };
    const currentIdx = phase === 'success' ? 3 : stepOrder[step] ?? 0;

    const steps = [
      { id: 'validate', label: 'Validate profile details', desc: 'Check name, email, phone number, and password rules' },
      { id: 'saving', label: 'Save account to Database & Excel', desc: 'Write your profile & encrypted password to persistent storage' },
      { id: 'verifying', label: 'Confirm account is ready for login', desc: 'Verify stored record so you can sign in from any browser' }
    ];

    const heading =
      phase === 'success'
        ? 'Registration Complete'
        : phase === 'error'
        ? 'Account Not Saved Yet'
        : 'Still Registering Your Account…';

    const statusBannerClass =
      phase === 'success'
        ? 'lp-reg-notice-success'
        : phase === 'error'
        ? 'lp-reg-notice-error'
        : 'lp-reg-notice-pending';

    const statusNotice =
      phase === 'success'
        ? 'Your account has been stored and verified in the Database & Excel workbook. You can now sign in and access your account.'
        : phase === 'error'
        ? `${registrationState.errorMessage || 'Unable to store your account right now.'} Your account cannot sign in until it finishes saving to the Database & Excel store.`
        : registrationState.detail ||
          'Please wait while your registration saves to the Database & Excel store. Your account can only sign in after storage completes.';

    const canGoAdmin = Boolean(state?.isAdmin && !pendingPostAuthSubscribe);
    const continueLabel = canGoAdmin
      ? 'Open Admin Portal →'
      : pendingPostAuthSubscribe
      ? 'Continue to Subscription →'
      : 'Continue to My Account →';

    return `
      <div class="lp-reg-fullscreen-shell">
        <div class="lp-modal-header">
          <div>
            <span class="lp-modal-eyebrow">Account Registration Progress</span>
            <h2 id="lpAuthModalTitle">${escapeHTML(heading)}</h2>
          </div>
          ${
            phase === 'pending'
              ? ''
              : '<button type="button" class="lp-modal-close" id="lpCloseAuthModalBtn" aria-label="Close modal">✕</button>'
          }
        </div>

        <div class="lp-reg-identity-line">
          <strong>${escapeHTML(draft.username || 'Learner')}</strong>
          <span aria-hidden="true">·</span>
          <span>${escapeHTML(draft.email || '')}</span>
          ${draft.phoneNumber ? `<span aria-hidden="true">·</span><span>${escapeHTML(draft.phoneNumber)}</span>` : ''}
        </div>

        <div class="lp-reg-notice ${statusBannerClass}" role="status" aria-live="polite">
          <div class="lp-reg-notice-title">
            ${
              phase === 'success'
                ? 'Saved to Database & Excel'
                : phase === 'error'
                ? 'Storage Failed — Account Locked Until Saved'
                : 'Still Registering — Please Do Not Close This Window'
            }
          </div>
          <p class="lp-reg-notice-text">${escapeHTML(statusNotice)}</p>
        </div>

        <ol class="lp-reg-steps" aria-label="Registration steps">
          ${steps
            .map((s, idx) => {
              let itemState = 'waiting';
              let stateText = 'Waiting';
              let marker = String(idx + 1);
              if (phase === 'success' || idx < currentIdx) {
                itemState = 'done';
                stateText = 'Done';
                marker = '✓';
              } else if (idx === currentIdx) {
                if (phase === 'error') {
                  itemState = 'error';
                  stateText = 'Failed';
                  marker = '!';
                } else {
                  itemState = 'active';
                  stateText = 'In progress';
                  marker = '…';
                }
              }
              return `
                <li class="lp-reg-step lp-reg-step-${itemState}">
                  <span class="lp-reg-step-marker" aria-hidden="true">${marker}</span>
                  <div class="lp-reg-step-body">
                    <div class="lp-reg-step-title">${escapeHTML(s.label)}</div>
                    <div class="lp-reg-step-desc">${escapeHTML(s.desc)}</div>
                  </div>
                  <span class="lp-reg-step-status">${escapeHTML(stateText)}</span>
                </li>
              `;
            })
            .join('')}
        </ol>

        <div class="lp-reg-actions">
          ${
            phase === 'pending'
              ? `<button type="button" class="lp-btn lp-btn-primary lp-btn-full" disabled>Still Registering &amp; Saving to Database &amp; Excel…</button>`
              : phase === 'error'
              ? `
                ${
                  registrationState.isDuplicateEmail
                    ? `<button type="button" class="lp-btn lp-btn-primary" id="lpRegGoSignInBtn">Go to Sign In</button>`
                    : registrationState.pendingCreds
                    ? `<button type="button" class="lp-btn lp-btn-primary" id="lpRegRetryBtn">Retry Saving Account</button>`
                    : ''
                }
                <button type="button" class="lp-btn lp-btn-secondary" id="lpRegEditBtn">Edit Details</button>
              `
              : `<button type="button" class="lp-btn lp-btn-primary lp-btn-full" id="lpRegContinueBtn">${escapeHTML(continueLabel)}</button>`
          }
        </div>
      </div>
    `;
  }

  function renderPlanSelectionAndQrStep(state) {
    const isSignedIn = Boolean(state && state.user);
    const profile = state?.profile;
    const isLessonContext = Boolean(subscribeContext.lessonId);

    const coursesList = getAvailableCoursesList();
    const activeCourse = coursesList.includes(subscribeContext.courseName)
      ? subscribeContext.courseName
      : coursesList[0] || 'HSK 2';
    subscribeContext.courseName = activeCourse;

    const practiceEligibleCourses = coursesList.filter((c) => courseHasExercisesUI(c));
    const activeCourseHasEx = courseHasExercisesUI(activeCourse);
    const showPracticeCourseCard =
      practiceEligibleCourses.length > 0 && (isLessonContext ? activeCourseHasEx : true);
    const practiceDisplayCourse = activeCourseHasEx
      ? activeCourse
      : practiceEligibleCourses[0] || activeCourse;

    const perLessonBaseTitle = String(subscribeContext.lessonTitle || 'Selected Paid Lesson').replace(/\s*\(Practice Only\)$/i, '');
    const api = getAuthApi();
    const matchedLessonPricing =
      isLessonContext && api && typeof api.getLessonPricing === 'function'
        ? api.getLessonPricing({ id: subscribeContext.lessonId, course: activeCourse })
        : null;
    const lessonHasEx = isLessonContext ? lessonHasExercisesUI({ id: subscribeContext.lessonId }) : false;

    const perLessonPriceNum =
      subscribeContext.planType === 'per_lesson'
        ? (Number(String(subscribeContext.amountLabel || '').replace(/[^\d.]/g, '')) || (matchedLessonPricing ? matchedLessonPricing.price : 75000) || 75000)
        : ((matchedLessonPricing && matchedLessonPricing.price) || 75000);
    const perLessonPrice = `${Number(perLessonPriceNum).toLocaleString('en-US')} Kyat`;

    const lessonPracticePriceKyat = isLessonContext
      ? resolveLessonPracticePriceKyat({ id: subscribeContext.lessonId }, activeCourse)
      : resolveCoursePracticePriceKyat(activeCourse);
    const lessonPracticePriceLabel = `${Number(lessonPracticePriceKyat).toLocaleString('en-US')} Kyat`;

    const coursePracticePriceKyat = resolveCoursePracticePriceKyat(practiceDisplayCourse);
    const coursePracticePriceLabel = `${Number(coursePracticePriceKyat).toLocaleString('en-US')} Kyat`;

    const coursePriceKyat = resolveCoursePriceKyat(activeCourse);
    const coursePriceLabel = `${Number(coursePriceKyat).toLocaleString('en-US')} Kyat`;

    const allowedPlans = [];
    if (isLessonContext) {
      allowedPlans.push('per_lesson');
      if (lessonHasEx) allowedPlans.push('practice_lesson');
    }
    allowedPlans.push('course');
    if (activeCourseHasEx) {
      allowedPlans.push('practice_course');
    }

    const selectedPlan = allowedPlans.includes(subscribeContext.planType)
      ? subscribeContext.planType
      : isLessonContext
      ? 'per_lesson'
      : 'course';
    subscribeContext.planType = selectedPlan;

    let selectedRequestTitle = `${activeCourse} Full Course`;
    let selectedAmount = coursePriceLabel;
    let selectedLabel = `${activeCourse} Full Course (${coursePriceLabel})`;

    if (selectedPlan === 'per_lesson') {
      selectedRequestTitle = perLessonBaseTitle;
      selectedAmount = perLessonPrice;
      selectedLabel = `${perLessonBaseTitle} — Full Access (${perLessonPrice})`;
    } else if (selectedPlan === 'practice_lesson') {
      selectedRequestTitle = `${perLessonBaseTitle} (Practice Only)`;
      selectedAmount = lessonPracticePriceLabel;
      selectedLabel = `${perLessonBaseTitle} — Practice Only: Exercises, Writing & Pronunciation (${lessonPracticePriceLabel})`;
    } else if (selectedPlan === 'practice_course') {
      const selectedPracAmt = `${Number(resolveCoursePracticePriceKyat(activeCourse)).toLocaleString('en-US')} Kyat`;
      selectedRequestTitle = `${activeCourse} Course (Practice Only)`;
      selectedAmount = selectedPracAmt;
      selectedLabel = `${activeCourse} Course — Practice Only: Exercises, Writing & Pronunciation (${selectedPracAmt})`;
    }

    subscribeContext.amountLabel = selectedAmount;

    const { contactEmail, contactViber, viberHref } = getSiteContact();
    const channel = subscribeContext.contactChannel === 'email' ? 'email' : 'viber';
    const prefilledHandle =
      channel === 'viber'
        ? profile?.phoneNumber || ''
        : profile?.email || state?.user?.email || '';

    const subject = encodeURIComponent(`JiedeEdu QR Subscription Request: ${selectedLabel}`);
    const body = encodeURIComponent(
      `Hello JiedeEdu Team,\n\nI would like to subscribe to: ${selectedLabel}\nUsername: ${
        profile?.username || ''
      }\nEmail: ${profile?.email || state?.user?.email || ''}\nPhone/Viber: ${
        profile?.phoneNumber || ''
      }\n\nPlease share the QR code for payment so my access can be activated.\n\nThank you!`
    );
    const mailtoHref = `mailto:${encodeURIComponent(contactEmail)}?subject=${subject}&body=${body}`;

    const pendingReq = (state?.myRequests || []).find((r) => r.status === 'pending');

    return `
      ${
        isLessonContext
          ? `<div class="lp-context-callout">
               <strong>Lesson Access Options:</strong> ${escapeHTML(perLessonBaseTitle)} (${escapeHTML(activeCourse)})
               <span>· ${
                 lessonHasEx
                   ? `Choose Full Access (with Video) or Practice Only (${escapeHTML(lessonPracticePriceLabel)} — Exercises, Writing &amp; Pronunciation).`
                   : `Choose Full Access for this lesson (${escapeHTML(perLessonPrice)}) or the full ${escapeHTML(activeCourse)} course${
                       activeCourseHasEx ? ` (or ${escapeHTML(coursePracticePriceLabel)} Practice-Only for ${escapeHTML(activeCourse)} exercises)` : ''
                     }.`
               }</span>
             </div>`
          : `<div class="lp-context-callout">
               <strong>Course Access:</strong> ${
                 showPracticeCourseCard
                   ? `Choose Full Course Access (Video + Practice) or Practice Only (${escapeHTML(coursePracticePriceLabel)} for ${escapeHTML(practiceDisplayCourse)} Exercises, Writing &amp; Pronunciation without Video).`
                   : `Choose Full Course Access (Video, Writing &amp; Pronunciation) for any course (${escapeHTML(coursesList.join(', '))}).`
               }
             </div>`
      }

      <div class="lp-plan-grid">
        ${
          isLessonContext
            ? `
          <button type="button" class="lp-plan-card ${selectedPlan === 'per_lesson' ? 'is-selected' : ''}" data-select-plan="per_lesson">
            <div class="lp-plan-top">
              <strong>Single Lesson · Full Access</strong>
              <span class="lp-plan-price">${escapeHTML(perLessonPrice)}</span>
            </div>
            <p>${escapeHTML(perLessonBaseTitle)} · Video Lesson, ${lessonHasEx ? 'Exercises, ' : ''}Writing &amp; Pronunciation.</p>
          </button>

          ${
            lessonHasEx
              ? `<button type="button" class="lp-plan-card ${selectedPlan === 'practice_lesson' ? 'is-selected' : ''}" data-select-plan="practice_lesson">
                   <div class="lp-plan-top">
                     <strong>Single Lesson · Practice Only</strong>
                     <span class="lp-plan-price">${escapeHTML(lessonPracticePriceLabel)}</span>
                   </div>
                   <p>${escapeHTML(perLessonBaseTitle)} · <strong>Exercises, Writing &amp; Pronunciation only</strong> (No Video).</p>
                 </button>`
              : ''
          }
        `
            : ''
        }

        <div class="lp-plan-card ${selectedPlan === 'course' ? 'is-selected' : ''}" data-select-plan="course" role="button" tabindex="0">
          <div class="lp-plan-top">
            <strong>Full Course (${escapeHTML(activeCourse)})</strong>
            <span class="lp-plan-price">${escapeHTML(coursePriceLabel)}</span>
          </div>
          <p>Video + ${activeCourseHasEx ? 'Exercises + ' : ''}Writing + Pronunciation for all lessons in <strong>${escapeHTML(activeCourse)}</strong>.</p>
          <div style="margin-top: 8px;">
            <label for="lpSubCourseSelect" style="display:block; font-size:0.78rem; font-weight:700; margin-bottom:4px;">Select Course</label>
            <select id="lpSubCourseSelect" data-sub-course-select="course" class="lp-inline-select" style="width:100%;">
              ${coursesList
                .map((c) => {
                  const cp = resolveCoursePriceKyat(c);
                  return `<option value="${escapeHTML(c)}" ${c === activeCourse ? 'selected' : ''}>${escapeHTML(c)} — ${Number(cp).toLocaleString('en-US')} Kyat</option>`;
                })
                .join('')}
            </select>
          </div>
        </div>

        ${
          showPracticeCourseCard
            ? `<div class="lp-plan-card ${selectedPlan === 'practice_course' ? 'is-selected' : ''}" data-select-plan="practice_course" role="button" tabindex="0">
                 <div class="lp-plan-top">
                   <strong>Course · Practice Only (${escapeHTML(practiceDisplayCourse)})</strong>
                   <span class="lp-plan-price">${escapeHTML(coursePracticePriceLabel)}</span>
                 </div>
                 <p><strong>Exercises, Writing &amp; Pronunciation only</strong> (No Video) for all lessons in <strong>${escapeHTML(practiceDisplayCourse)}</strong>.</p>
                 <div style="margin-top: 8px;">
                   <label for="lpSubPracticeCourseSelect" style="display:block; font-size:0.78rem; font-weight:700; margin-bottom:4px;">Select Practice Course</label>
                   <select id="lpSubPracticeCourseSelect" data-sub-course-select="practice_course" class="lp-inline-select" style="width:100%;">
                     ${practiceEligibleCourses
                       .map((c) => {
                         const cpPrac = `${Number(resolveCoursePracticePriceKyat(c)).toLocaleString('en-US')} Kyat`;
                         return `<option value="${escapeHTML(c)}" ${c === practiceDisplayCourse ? 'selected' : ''}>${escapeHTML(c)} — ${escapeHTML(cpPrac)}</option>`;
                       })
                       .join('')}
                   </select>
                 </div>
               </div>`
            : ''
        }
      </div>

      ${
        !isSignedIn
          ? `
        <div class="lp-qr-box">
          <h3>Step 2: Sign In to Request QR Payment</h3>
          <p class="lp-muted">Please sign in or register first so we can link your QR payment and activate your lesson or course access.</p>
          <div class="lp-btn-row">
            <button type="button" class="lp-btn lp-btn-primary" id="lpSubGoSignInBtn">Sign In</button>
            <button type="button" class="lp-btn lp-btn-secondary" id="lpSubGoRegisterBtn">Create Account</button>
          </div>
        </div>
      `
          : `
        <div class="lp-qr-box">
          <h3>Request QR Code via Email or Viber</h3>
          <p class="lp-muted">
            Selected: <strong>${escapeHTML(selectedLabel)}</strong> · Contact us via Email or Viber to receive our payment QR code. After payment is confirmed, access unlocks on your profile.
          </p>

          <div class="lp-contact-cards">
            <div class="lp-contact-card">
              <span class="lp-contact-kicker">Email</span>
              <strong>${escapeHTML(contactEmail)}</strong>
              <div class="lp-contact-actions">
                <a class="lp-link-btn" href="${mailtoHref}">Open Email App</a>
                <button type="button" class="lp-link-btn" data-copy-text="${escapeHTML(contactEmail)}">Copy Email</button>
              </div>
            </div>
            <div class="lp-contact-card">
              <span class="lp-contact-kicker">Viber (Myanmar)</span>
              <strong>${escapeHTML(contactViber)}</strong>
              <div class="lp-contact-actions">
                <a class="lp-link-btn" href="${escapeHTML(viberHref)}">Chat on Viber</a>
                <button type="button" class="lp-link-btn" data-copy-text="${escapeHTML(contactViber)}">Copy Number</button>
              </div>
            </div>
          </div>

          <form id="lpSubscribeRequestForm" class="lp-form" style="margin-top: 14px;">
            <div class="lp-form-grid-2">
              <div class="lp-field">
                <label for="lpSubChannel">Preferred QR Contact Channel</label>
                <select id="lpSubChannel">
                  <option value="viber" ${channel === 'viber' ? 'selected' : ''}>Viber (${escapeHTML(contactViber)})</option>
                  <option value="email" ${channel === 'email' ? 'selected' : ''}>Email (${escapeHTML(contactEmail)})</option>
                </select>
              </div>
              <div class="lp-field">
                <label for="lpSubHandle">Your ${channel === 'viber' ? 'Viber / Phone Number' : 'Email Address'} *</label>
                <input type="text" id="lpSubHandle" maxlength="80" value="${escapeHTML(prefilledHandle)}" placeholder="${
                  channel === 'viber' ? '+95 9 xxx xxx xxx' : 'you@example.com'
                }" required />
              </div>
            </div>

            <div class="lp-field">
              <label for="lpSubNote">Message or Payment Reference (Optional)</label>
              <input type="text" id="lpSubNote" maxlength="400" placeholder="e.g. Sent message on Viber — please share KBZPay/WavePay QR" />
            </div>

            <button type="submit" class="lp-btn lp-btn-primary lp-btn-full" id="lpSubmitSubReqBtn">
              Submit Subscription Request
            </button>
          </form>

          ${
            pendingReq
              ? `<div class="lp-pending-banner">
                   <strong>Pending Request:</strong> ${escapeHTML(pendingReq.lessonTitle)} (${escapeHTML(
                  pendingReq.amountLabel
                )}) via ${escapeHTML(pendingReq.contactChannel.toUpperCase())}. Waiting for admin QR payment verification.
                 </div>`
              : ''
          }
        </div>
      `
      }
    `;
  }

  function renderProfileTab(state) {
    const api = getAuthApi();
    const user = state.user;
    const profile = state.profile;
    const todayIso = new Date().toISOString().slice(0, 10);
    const age = profile?.dob && api ? api.calculateAge(profile.dob) : null;
    const mustChangePw = Boolean(profile?.mustChangePassword || user?.mustChangePassword);

    const myRequests = state.myRequests || [];
    const pendingReq = myRequests.find((r) => r.status === 'pending');

    const ent = getValidatedEntitlements(state, profile);
    const unlockedCourses = ent.unlockedCourses;
    const practiceCourses = ent.practiceCourses;
    const unlockedLessons = ent.unlockedLessons;
    const practiceLessons = ent.practiceLessons;
    const unlockedLessonLabels = unlockedLessons.map(formatLessonLabelUI);
    const practiceLessonLabels = practiceLessons.map(formatLessonLabelUI);

    let membershipHeadline = 'Free Learner Plan';
    let membershipSub = 'Access free starter lessons. Subscribe to individual lessons, courses, or Practice-Only tiers anytime.';
    let membershipTone = 'free';

    if (state.isAdmin) {
      membershipHeadline = 'Administrator · Full Access';
      membershipSub = 'You have full access to all courses, lessons, pricing settings, and member approvals.';
      membershipTone = 'active';
    } else if (unlockedCourses.length > 0 && (profile?.membershipPlan !== 'practice_course' || practiceCourses.length === 0)) {
      membershipTone = 'active';
      membershipHeadline = `Active Course Access · ${unlockedCourses.join(', ')}`;
      membershipSub = `All lessons inside ${unlockedCourses.join(', ')} are unlocked (Video + Practice).`;
    } else if (practiceCourses.length > 0) {
      membershipTone = 'active';
      membershipHeadline = `Practice-Only Course · ${practiceCourses.join(', ')}`;
      membershipSub = `Exercises, Writing & Pronunciation unlocked for ${practiceCourses.join(', ')} (No Video). Upgrade anytime for Video Lessons.`;
    } else if (unlockedLessons.length > 0) {
      membershipTone = 'active';
      membershipHeadline = `Active · ${unlockedLessons.length} Lesson${unlockedLessons.length > 1 ? 's' : ''} Unlocked`;
      membershipSub = `Unlocked Lessons: ${unlockedLessonLabels.join(', ')}`;
    } else if (practiceLessons.length > 0) {
      membershipTone = 'active';
      membershipHeadline = `Practice-Only · ${practiceLessons.length} Lesson${practiceLessons.length > 1 ? 's' : ''} Unlocked`;
      membershipSub = `Exercises, Writing & Pronunciation unlocked (No Video) for: ${practiceLessonLabels.join(', ')}`;
    } else if (ent.hasTimePass) {
      membershipTone = 'active';
      membershipHeadline = 'Active All-Access Pass';
      membershipSub = profile?.membershipExpiresAt
        ? `All curriculum lessons unlocked through ${profile.membershipExpiresAt}.`
        : 'All curriculum lessons unlocked.';
    } else if (pendingReq) {
      membershipTone = 'pending';
      membershipHeadline = `Pending QR Verification · ${pendingReq.lessonTitle}`;
      membershipSub = `Requested ${pendingReq.amountLabel} via ${pendingReq.contactChannel.toUpperCase()}. Waiting for admin confirmation.`;
    } else if (profile?.membershipStatus === 'expired') {
      membershipTone = 'expired';
      membershipHeadline = 'Access Expired';
      membershipSub = 'Subscribe to a Lesson, Practice-Only tier, or Full Course in Kyat to unlock paid lessons.';
    }

    const canUpgradeMore =
      !state.isAdmin &&
      (membershipTone !== 'active' ||
        (unlockedCourses.length === 0 && !ent.hasTimePass) ||
        practiceCourses.length > 0 ||
        practiceLessons.length > 0);

    return `
      ${
        mustChangePw
          ? `<div class="lp-context-callout" role="status">
               <strong>Temporary Password Active:</strong> You signed in with a temporary password. Please set your own new password below.
             </div>`
          : ''
      }
      <div class="lp-membership-card lp-membership-${membershipTone}">
        <div class="lp-membership-row">
          <div>
            <span class="lp-membership-kicker">Membership Status</span>
            <h3>${escapeHTML(membershipHeadline)}</h3>
            <p>${escapeHTML(membershipSub)}</p>
          </div>
          <div class="lp-membership-actions">
            ${
              state.isAdmin
                ? `<a href="admin.html" class="lp-btn lp-btn-primary lp-btn-sm">Open Admin CMS Portal →</a>`
                : canUpgradeMore
                ? `<button type="button" class="lp-btn lp-btn-primary lp-btn-sm" id="lpOpenPlansFromProfileBtn">Upgrade / Subscribe</button>`
                : ''
            }
          </div>
        </div>
        ${
          unlockedLessons.length > 0 && unlockedCourses.length > 0
            ? `<div class="lp-membership-extra">Full Lesson Passes: ${escapeHTML(unlockedLessonLabels.join(', '))}</div>`
            : ''
        }
        ${
          practiceCourses.length > 0 && unlockedCourses.length > 0
            ? `<div class="lp-membership-extra">Practice-Only Courses (No Video): ${escapeHTML(practiceCourses.join(', '))}</div>`
            : ''
        }
        ${
          practiceLessons.length > 0 && (unlockedLessons.length > 0 || unlockedCourses.length > 0 || practiceCourses.length > 0)
            ? `<div class="lp-membership-extra">Practice-Only Lessons (No Video): ${escapeHTML(practiceLessonLabels.join(', '))}</div>`
            : ''
        }
      </div>

      <form id="lpProfileForm" class="lp-form" style="margin-top:18px;">
        <div class="lp-form-grid-2">
          <div class="lp-field">
            <label for="lpProfUsername">User Name *</label>
            <input type="text" id="lpProfUsername" maxlength="60" value="${escapeHTML(
              profile?.username || user.displayName || ''
            )}" required />
          </div>
          <div class="lp-field">
            <label for="lpProfEmail">Email Address</label>
            <input type="email" id="lpProfEmail" value="${escapeHTML(profile?.email || user.email || '')}" disabled />
          </div>
        </div>

        <div class="lp-form-grid-2">
          <div class="lp-field">
            <label for="lpProfPhone">Phone / Viber Number</label>
            <input type="tel" id="lpProfPhone" maxlength="32" value="${escapeHTML(
              profile?.phoneNumber || ''
            )}" placeholder="+95 9 xxx xxx xxx" />
          </div>
          <div class="lp-field">
            <div class="lp-field-label-row">
              <label for="lpProfDob">Date of Birth</label>
              <span class="lp-age-readout" id="lpProfAgePreview">Age: ${age !== null ? `${age} yrs` : '--'}</span>
            </div>
            <input type="date" id="lpProfDob" max="${todayIso}" value="${escapeHTML(profile?.dob || '')}" />
          </div>
        </div>

        <div class="lp-btn-row-between">
          <span></span>
          <button type="submit" class="lp-btn lp-btn-primary" id="lpSaveProfileBtn">Save Profile</button>
        </div>
      </form>

      <div class="lp-providers-box">
        <div class="lp-providers-header">
          <strong>Change Password</strong>
          <span>Update your sign-in password anytime (minimum 6 characters).</span>
        </div>
        <form id="lpChangePasswordForm" class="lp-form" style="margin-top:8px;">
          <div class="lp-field">
            <label for="lpCurrentPassword">Current Password *</label>
            <input type="password" id="lpCurrentPassword" autocomplete="current-password" placeholder="Enter current or temporary password" required />
          </div>
          <div class="lp-form-grid-2">
            <div class="lp-field">
              <label for="lpNewPassword">New Password *</label>
              <input type="password" id="lpNewPassword" minlength="6" autocomplete="new-password" placeholder="Min. 6 characters" required />
            </div>
            <div class="lp-field">
              <label for="lpConfirmNewPassword">Confirm New Password *</label>
              <input type="password" id="lpConfirmNewPassword" minlength="6" autocomplete="new-password" placeholder="Repeat new password" required />
            </div>
          </div>
          <div class="lp-btn-row-between">
            <span></span>
            <button type="submit" class="lp-btn lp-btn-secondary lp-btn-sm" id="lpChangePasswordBtn">Update Password</button>
          </div>
        </form>
      </div>

      ${
        myRequests.length > 0
          ? `
        <div class="lp-history-box">
          <strong>Your Subscription Requests</strong>
          <div class="lp-request-list">
            ${myRequests
              .map(
                (req) => `
              <div class="lp-request-item">
                <div>
                  <div class="lp-request-title">${escapeHTML(req.lessonTitle)} · ${escapeHTML(req.amountLabel)}</div>
                  <div class="lp-request-meta">
                    Via ${escapeHTML(req.contactChannel.toUpperCase())} (${escapeHTML(req.contactHandle)})
                    ${req.adminNote ? `· Note: ${escapeHTML(req.adminNote)}` : ''}
                  </div>
                </div>
                <div class="lp-request-right">
                  <span class="lp-status-text lp-status-${escapeHTML(req.status)}">${escapeHTML(
                    req.status.toUpperCase()
                  )}</span>
                  ${
                    req.status === 'pending'
                      ? `<button type="button" class="lp-link-btn" data-cancel-req="${escapeHTML(
                          req.requestId
                        )}">Cancel</button>`
                      : ''
                  }
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <div class="lp-account-footer">
        <button type="button" class="lp-btn lp-btn-secondary" id="lpLogoutBtn">Sign Out</button>
      </div>
    `;
  }

  function renderAdminTab(state) {
    const api = getAuthApi();
    const requests = state.allRequests || [];
    const pendingReqs = requests.filter((r) => r.status === 'pending');
    const pastReqs = requests.filter((r) => r.status !== 'pending');
    const users = state.allUsers || [];

    return `
      <div class="lp-admin-toolbar">
        <div>
          <strong>Full Site &amp; Content Backend CMS</strong>
          <p class="lp-muted">Manage Stories, Short Reels, Adult/Kids Lessons, Excel Exercises, Wordwall Games, Homepage Text &amp; Contact Us, and User Memberships.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="admin.html" class="lp-btn lp-btn-primary lp-btn-sm">Open Admin Portal →</a>
          <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" id="lpAdminOpenPricingBtn">
            Lesson Pricing
          </button>
        </div>
      </div>

      <div class="lp-admin-section">
        <h3>Pending QR Payment Requests (${pendingReqs.length})</h3>
        ${
          pendingReqs.length === 0
            ? `<p class="lp-muted">No pending subscription requests right now.</p>`
            : `<div class="lp-request-list">
                ${pendingReqs
                  .map(
                    (r) => `
                  <div class="lp-admin-req-card">
                    <div class="lp-admin-req-info">
                      <strong>${escapeHTML(r.username || r.userEmail)}</strong>
                      <span>${escapeHTML(r.userEmail)}${r.userPhone ? ` · ${escapeHTML(r.userPhone)}` : ''}</span>
                      <div class="lp-admin-req-plan">
                        Plan: <strong>${escapeHTML(r.lessonTitle)}</strong> (${escapeHTML(r.amountLabel)}) · Contact via ${escapeHTML(
                      r.contactChannel.toUpperCase()
                    )}: ${escapeHTML(r.contactHandle)}
                      </div>
                      ${r.note ? `<div class="lp-admin-req-note">"${escapeHTML(r.note)}"</div>` : ''}
                    </div>
                    <div class="lp-admin-req-actions">
                      <button type="button" class="lp-btn lp-btn-primary lp-btn-sm" data-approve-req="${escapeHTML(
                        r.requestId
                      )}">Approve &amp; Activate</button>
                      <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" data-reject-req="${escapeHTML(
                        r.requestId
                      )}">Reject</button>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>`
        }
      </div>

      <div class="lp-admin-section">
        <h3>Registered Users &amp; Membership Status (${users.length})</h3>
        ${
          users.length === 0
            ? `<p class="lp-muted">No user profiles loaded yet.</p>`
            : `<div class="lp-users-list">
                ${users
                  .map((u) => {
                    const uAge = api && u.dob ? api.calculateAge(u.dob) : null;
                    return `
                    <div class="lp-admin-user-row" data-admin-uid="${escapeHTML(u.uid)}">
                      <div class="lp-admin-user-meta">
                        <strong>${escapeHTML(u.username || 'Learner')}</strong>
                        <span>${escapeHTML(u.email)} · ${escapeHTML(u.phoneNumber || 'No phone')}${
                      u.dob ? ` · DOB ${escapeHTML(u.dob)}${uAge !== null ? ` (${uAge} yrs)` : ''}` : ''
                    }</span>
                      </div>
                      <div class="lp-admin-user-controls">
                        <select class="lp-inline-select" data-user-status="${escapeHTML(u.uid)}" aria-label="Membership status">
                          <option value="free" ${u.membershipStatus === 'free' ? 'selected' : ''}>free</option>
                          <option value="pending" ${u.membershipStatus === 'pending' ? 'selected' : ''}>pending</option>
                          <option value="active" ${u.membershipStatus === 'active' ? 'selected' : ''}>active</option>
                          <option value="expired" ${u.membershipStatus === 'expired' ? 'selected' : ''}>expired</option>
                        </select>
                        <select class="lp-inline-select" data-user-plan="${escapeHTML(u.uid)}" aria-label="Membership plan">
                          <option value="none" ${u.membershipPlan === 'none' ? 'selected' : ''}>none</option>
                          <option value="per_lesson" ${u.membershipPlan === 'per_lesson' ? 'selected' : ''}>per_lesson</option>
                          <option value="practice_lesson" ${u.membershipPlan === 'practice_lesson' ? 'selected' : ''}>practice_lesson (Practice Only)</option>
                          <option value="course" ${u.membershipPlan === 'course' || u.membershipPlan === 'monthly' || u.membershipPlan === 'annual' ? 'selected' : ''}>course</option>
                          <option value="practice_course" ${u.membershipPlan === 'practice_course' ? 'selected' : ''}>practice_course (Practice Only)</option>
                        </select>
                        <input type="date" class="lp-inline-date" data-user-expiry="${escapeHTML(u.uid)}" value="${escapeHTML(
                      u.membershipExpiresAt || ''
                    )}" aria-label="Expiry date" />
                        <button type="button" class="lp-btn lp-btn-primary lp-btn-sm" data-save-user-membership="${escapeHTML(
                          u.uid
                        )}">Update</button>
                      </div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>`
        }
      </div>

      ${
        pastReqs.length > 0
          ? `
        <div class="lp-admin-section">
          <h3>Processed Requests (${pastReqs.length})</h3>
          <div class="lp-request-list">
            ${pastReqs
              .slice(0, 10)
              .map(
                (r) => `
              <div class="lp-request-item">
                <div>
                  <div class="lp-request-title">${escapeHTML(r.username || r.userEmail)} · ${escapeHTML(r.lessonTitle)}</div>
                  <div class="lp-request-meta">${escapeHTML(r.amountLabel)} · ${escapeHTML(r.adminNote || '')}</div>
                </div>
                <span class="lp-status-text lp-status-${escapeHTML(r.status)}">${escapeHTML(r.status.toUpperCase())}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }
    `;
  }

  function renderAccountView(state) {
    return `
      <div class="lp-modal-header">
        <div>
          <span class="lp-modal-eyebrow">My JiedeEdu Account</span>
          <h2 id="lpAuthModalTitle">${escapeHTML(state.profile?.username || state.user?.displayName || 'Learner Profile')}</h2>
        </div>
        <button type="button" class="lp-modal-close" id="lpCloseAuthModalBtn" aria-label="Close modal">✕</button>
      </div>

      <div class="lp-tabs-bar" role="tablist">
        <button type="button" class="lp-tab-btn ${accountTab === 'profile' ? 'active' : ''}" data-account-tab="profile">Profile &amp; Membership</button>
        <button type="button" class="lp-tab-btn ${accountTab === 'plans' ? 'active' : ''}" data-account-tab="plans">Subscribe &amp; QR</button>
        ${
          state.isAdmin
            ? `<button type="button" class="lp-tab-btn ${accountTab === 'admin' ? 'active' : ''}" data-account-tab="admin">Admin Approvals${
                (state.allRequests || []).filter((r) => r.status === 'pending').length > 0
                  ? ` (${(state.allRequests || []).filter((r) => r.status === 'pending').length})`
                  : ''
              }</button>`
            : ''
        }
      </div>

      ${renderFeedbackHTML()}

      ${
        accountTab === 'profile'
          ? renderProfileTab(state)
          : accountTab === 'plans'
          ? renderPlanSelectionAndQrStep(state)
          : renderAdminTab(state)
      }
    `;
  }

  function renderSubscribeView(state) {
    return `
      <div class="lp-modal-header">
        <div>
          <span class="lp-modal-eyebrow">Membership &amp; Lesson Access</span>
          <h2 id="lpAuthModalTitle">Subscribe to Paid Lessons</h2>
        </div>
        <button type="button" class="lp-modal-close" id="lpCloseAuthModalBtn" aria-label="Close modal">✕</button>
      </div>

      ${renderFeedbackHTML()}

      ${renderPlanSelectionAndQrStep(state)}
    `;
  }

  function renderModal() {
    if (modalMode === 'closed') return;
    const backdrop = ensureModalRoot();
    const api = getAuthApi();
    const state = api ? api.getState() : { ready: false, user: null, profile: null, myRequests: [], allRequests: [], allUsers: [] };

    let inner = '';
    let isFullscreen = false;
    if (modalMode === 'registering') {
      isFullscreen = true;
      inner = renderRegisteringView(state);
    } else if (modalMode === 'subscribe') {
      inner = renderSubscribeView(state);
    } else if (modalMode === 'account' && state.user) {
      inner = renderAccountView(state);
    } else {
      modalMode = 'auth';
      inner = renderAuthView(state);
    }

    backdrop.classList.toggle('is-fullscreen', isFullscreen);
    backdrop.innerHTML = `<div class="lp-auth-card${isFullscreen ? ' lp-reg-fullscreen-card' : ''}">${inner}</div>`;
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lp-modal-open');
    bindModalEvents(state);
  }

  function bindModalEvents(state) {
    const api = getAuthApi();
    const closeBtn = document.getElementById('lpCloseAuthModalBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    // Auth tabs
    document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
      btn.onclick = () => {
        authTab = btn.dataset.authTab;
        feedbackBanner = null;
        renderModal();
      };
    });

    // Account tabs
    document.querySelectorAll('[data-account-tab]').forEach((btn) => {
      btn.onclick = () => {
        accountTab = btn.dataset.accountTab;
        feedbackBanner = null;
        renderModal();
      };
    });

    // Live DOB -> Age calculation
    const regDob = document.getElementById('lpRegDob');
    const regAge = document.getElementById('lpRegAgePreview');
    if (regDob && regAge) {
      regDob.addEventListener('input', () => {
        const label = getAgeLabel(regDob.value);
        regAge.textContent = label ? `Age: ${label}` : 'Age: --';
      });
    }

    const profDob = document.getElementById('lpProfDob');
    const profAge = document.getElementById('lpProfAgePreview');
    if (profDob && profAge) {
      profDob.addEventListener('input', () => {
        const label = getAgeLabel(profDob.value);
        profAge.textContent = label ? `Age: ${label}` : 'Age: --';
      });
    }

    // Sign In submit
    const signInForm = document.getElementById('lpSignInForm');
    if (signInForm) {
      signInForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!api) return;
        const email = document.getElementById('lpLoginEmail')?.value?.trim() || '';
        const password = document.getElementById('lpLoginPassword')?.value || '';
        const submitBtn = document.getElementById('lpSignInSubmitBtn');
        if (!email || !password) {
          feedbackBanner = { type: 'error', text: 'Please enter both your email and password.' };
          renderModal();
          return;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Signing In…';
        }
        try {
          await api.loginWithEmail(email, password);
          feedbackBanner = null;
          const nextState = api.getState();
          if (nextState?.isAdmin && !pendingPostAuthSubscribe) {
            closeModal();
            if (window.location.pathname.includes('admin.html')) {
              showToast('Signed in as Admin — CMS Portal unlocked.');
            } else {
              showToast('Signed in as Admin — opening Admin Portal…');
              setTimeout(() => {
                window.location.href = 'admin.html';
              }, 300);
            }
            return;
          }
          showToast('Signed in successfully.');
          if (pendingPostAuthSubscribe) {
            subscribeContext = { ...pendingPostAuthSubscribe };
            pendingPostAuthSubscribe = null;
            modalMode = 'subscribe';
          } else {
            modalMode = 'account';
            accountTab = 'profile';
          }
          renderModal();
        } catch (err) {
          resetPrefillEmail = email;
          feedbackBanner = {
            type: 'error',
            text: err instanceof Error ? err.message : 'Unable to sign in.'
          };
          renderModal();
        }
      };
    }

    // Forgot password -> switch to identity-verified reset view (no server/SMTP needed)
    const forgotBtn = document.getElementById('lpForgotPasswordBtn');
    if (forgotBtn) {
      forgotBtn.onclick = () => {
        resetPrefillEmail = document.getElementById('lpLoginEmail')?.value?.trim() || '';
        authTab = 'reset';
        feedbackBanner = null;
        renderModal();
      };
    }

    const backToSignInBtn = document.getElementById('lpResetBackToSignInBtn');
    if (backToSignInBtn) {
      backToSignInBtn.onclick = () => {
        authTab = 'signin';
        feedbackBanner = null;
        renderModal();
      };
    }

    const verifyResetForm = document.getElementById('lpVerifyResetForm');
    if (verifyResetForm) {
      verifyResetForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!api || typeof api.resetPasswordWithVerification !== 'function') return;
        const email = document.getElementById('lpResetEmail')?.value?.trim() || '';
        const dob = document.getElementById('lpResetDob')?.value?.trim() || '';
        const phoneNumber = document.getElementById('lpResetPhone')?.value?.trim() || '';
        const newPassword = document.getElementById('lpResetNewPassword')?.value || '';
        const confirmPw = document.getElementById('lpResetConfirmPassword')?.value || '';
        resetPrefillEmail = email;

        if (!email || !dob || !phoneNumber) {
          feedbackBanner = { type: 'error', text: 'Please fill in Email, Date of Birth, and Phone / Viber Number.' };
          renderModal();
          return;
        }
        if (newPassword.length < 6) {
          feedbackBanner = { type: 'error', text: 'New password must be at least 6 characters long.' };
          renderModal();
          return;
        }
        if (newPassword !== confirmPw) {
          feedbackBanner = { type: 'error', text: 'New passwords do not match.' };
          renderModal();
          return;
        }

        const btn = document.getElementById('lpResetSubmitBtn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Verifying…';
        }
        try {
          const msg = await api.resetPasswordWithVerification({
            email,
            dob,
            phoneNumber,
            newPassword
          });
          authTab = 'signin';
          feedbackBanner = { type: 'success', text: msg };
          showToast('Password updated — you can sign in now.');
          renderModal();
        } catch (err) {
          feedbackBanner = {
            type: 'error',
            text: err instanceof Error ? err.message : 'Verification failed.'
          };
          renderModal();
        }
      };
    }

    async function executeRegistrationFlow(creds) {
      if (!api || !creds) return;
      modalMode = 'registering';
      registrationState.phase = 'pending';
      registrationState.step = 'validate';
      registrationState.detail = 'Validating your profile details…';
      registrationState.errorMessage = '';
      registrationState.isDuplicateEmail = false;
      registrationState.pendingCreds = creds;
      registrationState.draftMeta = {
        username: creds.username,
        email: creds.email,
        phoneNumber: creds.phoneNumber,
        dob: creds.dob
      };
      renderModal();

      try {
        await api.registerWithEmail(creds, {
          onProgress: (step, detail) => {
            if (modalMode !== 'registering') return;
            registrationState.step = step;
            registrationState.detail = detail || '';
            renderModal();
          }
        });
        clearTransientRegistrationCreds();
        registrationState.phase = 'success';
        registrationState.step = 'done';
        registrationState.detail =
          'Your account is saved and verified in the Database & Excel store and is ready to log in.';
        showToast('Account registered & verified in Database & Excel!');
        renderModal();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to save registration to Database & Excel.';
        registrationState.phase = 'error';
        registrationState.errorMessage = msg;
        registrationState.isDuplicateEmail = /already exists/i.test(msg);
        if (registrationState.isDuplicateEmail) {
          clearTransientRegistrationCreds();
        }
        renderModal();
      }
    }

    // Registration progress screen controls
    const retryRegBtn = document.getElementById('lpRegRetryBtn');
    if (retryRegBtn) {
      retryRegBtn.onclick = () => {
        if (registrationState.pendingCreds) {
          void executeRegistrationFlow(registrationState.pendingCreds);
        }
      };
    }

    const editRegBtn = document.getElementById('lpRegEditBtn');
    if (editRegBtn) {
      editRegBtn.onclick = () => {
        resetRegistrationState(false);
        modalMode = 'auth';
        authTab = 'register';
        feedbackBanner = null;
        renderModal();
      };
    }

    const goSignInRegBtn = document.getElementById('lpRegGoSignInBtn');
    if (goSignInRegBtn) {
      goSignInRegBtn.onclick = () => {
        resetPrefillEmail = registrationState.draftMeta?.email || '';
        resetRegistrationState(true);
        modalMode = 'auth';
        authTab = 'signin';
        feedbackBanner = { type: 'info', text: 'An account with this email is already registered. Sign in below.' };
        renderModal();
      };
    }

    const continueRegBtn = document.getElementById('lpRegContinueBtn');
    if (continueRegBtn) {
      continueRegBtn.onclick = () => {
        const nextState = api ? api.getState() : state;
        resetRegistrationState(true);
        if (nextState?.isAdmin && !pendingPostAuthSubscribe) {
          closeModal();
          if (window.location.pathname.includes('admin.html')) {
            showToast('Admin account verified — CMS Portal unlocked.');
          } else {
            window.location.href = 'admin.html';
          }
          return;
        }
        if (pendingPostAuthSubscribe) {
          subscribeContext = { ...pendingPostAuthSubscribe };
          pendingPostAuthSubscribe = null;
          modalMode = 'subscribe';
        } else {
          modalMode = 'account';
          accountTab = 'profile';
        }
        feedbackBanner = { type: 'success', text: 'Account verified in Database & Excel and signed in!' };
        renderModal();
      };
    }

    // Register submit
    const regForm = document.getElementById('lpRegisterForm');
    if (regForm) {
      regForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!api) return;
        const username = document.getElementById('lpRegUsername')?.value?.trim() || '';
        const email = document.getElementById('lpRegEmail')?.value?.trim() || '';
        const phoneNumber = document.getElementById('lpRegPhone')?.value?.trim() || '';
        const dob = document.getElementById('lpRegDob')?.value?.trim() || '';
        const password = document.getElementById('lpRegPassword')?.value || '';
        const confirmPw = document.getElementById('lpRegPasswordConfirm')?.value || '';

        registrationState.draftMeta = { username, email, phoneNumber, dob };

        if (!username || !email || !phoneNumber || !dob) {
          feedbackBanner = { type: 'error', text: 'Please fill in User Name, Email, Phone Number, and Date of Birth.' };
          renderModal();
          return;
        }
        if (password.length < 6) {
          feedbackBanner = { type: 'error', text: 'Password must be at least 6 characters long.' };
          renderModal();
          return;
        }
        if (password !== confirmPw) {
          feedbackBanner = { type: 'error', text: 'Passwords do not match.' };
          renderModal();
          return;
        }

        await executeRegistrationFlow({ username, email, phoneNumber, dob, password });
      };
    }

    // Profile actions
    const openPlansBtn = document.getElementById('lpOpenPlansFromProfileBtn');
    if (openPlansBtn) {
      openPlansBtn.onclick = () => {
        accountTab = 'plans';
        feedbackBanner = null;
        renderModal();
      };
    }

    const profileForm = document.getElementById('lpProfileForm');
    if (profileForm) {
      profileForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!api) return;
        const username = document.getElementById('lpProfUsername')?.value?.trim() || '';
        const phoneNumber = document.getElementById('lpProfPhone')?.value?.trim() || '';
        const dob = document.getElementById('lpProfDob')?.value?.trim() || '';
        if (!username) {
          feedbackBanner = { type: 'error', text: 'User Name cannot be empty.' };
          renderModal();
          return;
        }
        try {
          await api.updateProfileDetails({ username, phoneNumber, dob });
          feedbackBanner = { type: 'success', text: 'Profile updated successfully.' };
          showToast('Profile saved.');
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Unable to save profile.' };
          renderModal();
        }
      };
    }

    const changePwForm = document.getElementById('lpChangePasswordForm');
    if (changePwForm) {
      changePwForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!api || typeof api.changePassword !== 'function') return;
        const currentPw = document.getElementById('lpCurrentPassword')?.value || '';
        const newPw = document.getElementById('lpNewPassword')?.value || '';
        const confirmPw = document.getElementById('lpConfirmNewPassword')?.value || '';

        if (!currentPw || !newPw) {
          feedbackBanner = { type: 'error', text: 'Enter your current password and a new password.' };
          renderModal();
          return;
        }
        if (newPw.length < 6) {
          feedbackBanner = { type: 'error', text: 'New password must be at least 6 characters long.' };
          renderModal();
          return;
        }
        if (newPw !== confirmPw) {
          feedbackBanner = { type: 'error', text: 'New passwords do not match.' };
          renderModal();
          return;
        }

        const btn = document.getElementById('lpChangePasswordBtn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Updating…';
        }
        try {
          await api.changePassword(currentPw, newPw);
          feedbackBanner = { type: 'success', text: 'Your password has been updated.' };
          showToast('Password updated.');
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Could not update password.' };
          renderModal();
        }
      };
    }

    const logoutBtn = document.getElementById('lpLogoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        if (!api) return;
        await api.logout();
        showToast('Signed out.', 'info');
        closeModal();
      };
    }

    // Cancel pending subscription request
    document.querySelectorAll('[data-cancel-req]').forEach((btn) => {
      btn.onclick = async () => {
        if (!api) return;
        try {
          await api.cancelPendingRequest(btn.dataset.cancelReq);
          feedbackBanner = { type: 'info', text: 'Pending request cancelled.' };
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Failed to cancel.' };
          renderModal();
        }
      };
    });

    // Subscribe plan cards & QR workflow
    document.querySelectorAll('[data-select-plan]').forEach((card) => {
      card.onclick = (e) => {
        if (e.target && e.target.closest('select[data-sub-course-select]')) return;
        const planId = card.dataset.selectPlan;
        const validPlans = ['per_lesson', 'practice_lesson', 'course', 'practice_course'];
        subscribeContext.planType = validPlans.includes(planId) ? planId : 'course';
        let cName = subscribeContext.courseName || 'HSK 2';
        if (subscribeContext.planType === 'practice_course' && !courseHasExercisesUI(cName)) {
          const eligible = getAvailableCoursesList().filter((c) => courseHasExercisesUI(c));
          if (eligible.length > 0) {
            cName = eligible[0];
            subscribeContext.courseName = cName;
          } else {
            subscribeContext.planType = 'course';
          }
        }
        if (subscribeContext.planType === 'course') {
          subscribeContext.amountLabel = `${Number(resolveCoursePriceKyat(cName)).toLocaleString('en-US')} Kyat`;
        } else if (subscribeContext.planType === 'practice_course') {
          subscribeContext.amountLabel = `${Number(resolveCoursePracticePriceKyat(cName)).toLocaleString('en-US')} Kyat`;
        } else if (subscribeContext.planType === 'practice_lesson') {
          subscribeContext.amountLabel = `${Number(
            resolveLessonPracticePriceKyat({ id: subscribeContext.lessonId }, cName)
          ).toLocaleString('en-US')} Kyat`;
        } else if (subscribeContext.planType === 'per_lesson' && api && typeof api.getLessonPricing === 'function') {
          const lp = api.getLessonPricing({ id: subscribeContext.lessonId, course: cName });
          subscribeContext.amountLabel = `${Number(lp?.price || 75000).toLocaleString('en-US')} Kyat`;
        }
        renderModal();
      };
    });

    document.querySelectorAll('select[data-sub-course-select]').forEach((sel) => {
      sel.onchange = (e) => {
        e.stopPropagation();
        const chosen = sel.value || 'HSK 2';
        const targetPlan = sel.dataset.subCourseSelect === 'practice_course' ? 'practice_course' : 'course';
        subscribeContext.planType = targetPlan;
        subscribeContext.courseName = chosen;
        if (targetPlan === 'practice_course') {
          subscribeContext.amountLabel = `${Number(resolveCoursePracticePriceKyat(chosen)).toLocaleString('en-US')} Kyat`;
        } else {
          subscribeContext.amountLabel = `${Number(resolveCoursePriceKyat(chosen)).toLocaleString('en-US')} Kyat`;
        }
        renderModal();
      };
    });

    const subGoSignIn = document.getElementById('lpSubGoSignInBtn');
    if (subGoSignIn) {
      subGoSignIn.onclick = () => {
        pendingPostAuthSubscribe = { ...subscribeContext };
        modalMode = 'auth';
        authTab = 'signin';
        renderModal();
      };
    }

    const subGoRegister = document.getElementById('lpSubGoRegisterBtn');
    if (subGoRegister) {
      subGoRegister.onclick = () => {
        pendingPostAuthSubscribe = { ...subscribeContext };
        modalMode = 'auth';
        authTab = 'register';
        renderModal();
      };
    }

    const subChannelSelect = document.getElementById('lpSubChannel');
    if (subChannelSelect) {
      subChannelSelect.onchange = () => {
        subscribeContext.contactChannel = subChannelSelect.value;
        renderModal();
      };
    }

    document.querySelectorAll('[data-copy-text]').forEach((btn) => {
      btn.onclick = () => copyToClipboard(btn.dataset.copyText, btn);
    });

    const subForm = document.getElementById('lpSubscribeRequestForm');
    if (subForm) {
      subForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!api) return;
        const contactChannel = document.getElementById('lpSubChannel')?.value || 'viber';
        const contactHandle = document.getElementById('lpSubHandle')?.value?.trim() || '';
        const note = document.getElementById('lpSubNote')?.value?.trim() || '';
        const submitBtn = document.getElementById('lpSubmitSubReqBtn');
        if (!contactHandle) {
          feedbackBanner = { type: 'error', text: 'Please provide your email or Viber contact handle.' };
          renderModal();
          return;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting Request…';
        }
        try {
          const baseLessonTitle = String(subscribeContext.lessonTitle || '').replace(/\s*\(Practice Only\)$/i, '').trim();
          const cName = subscribeContext.courseName || 'HSK 2';
          let reqTitle = subscribeContext.lessonTitle;
          let resolvedAmountLabel = subscribeContext.amountLabel;
          if (subscribeContext.planType === 'course') {
            reqTitle = `${cName} Full Course`;
            resolvedAmountLabel = `${Number(resolveCoursePriceKyat(cName)).toLocaleString('en-US')} Kyat`;
          } else if (subscribeContext.planType === 'practice_course') {
            reqTitle = `${cName} Course (Practice Only)`;
            resolvedAmountLabel = `${Number(resolveCoursePracticePriceKyat(cName)).toLocaleString('en-US')} Kyat`;
          } else if (subscribeContext.planType === 'practice_lesson') {
            reqTitle = `${baseLessonTitle || 'Lesson'} (Practice Only)`;
            resolvedAmountLabel = `${Number(
              resolveLessonPracticePriceKyat({ id: subscribeContext.lessonId }, cName)
            ).toLocaleString('en-US')} Kyat`;
          } else {
            reqTitle = baseLessonTitle || 'Lesson Pass';
          }
          await api.submitSubscriptionRequest({
            planType: subscribeContext.planType,
            lessonId: subscribeContext.lessonId,
            courseName: subscribeContext.courseName,
            lessonTitle: reqTitle,
            amountLabel: resolvedAmountLabel,
            contactChannel,
            contactHandle,
            note
          });
          feedbackBanner = {
            type: 'success',
            text: 'Subscription request submitted! Send a message via Email or Viber above to receive your QR code. Your access will unlock once payment is confirmed.'
          };
          showToast('QR payment request submitted.');
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Could not submit request.' };
          renderModal();
        }
      };
    }

    // Admin actions
    const adminPricingBtn = document.getElementById('lpAdminOpenPricingBtn');
    if (adminPricingBtn) {
      adminPricingBtn.onclick = () => {
        closeModal();
        if (window.LinguaLessons && typeof window.LinguaLessons.openExcelManagerModal === 'function') {
          window.LinguaLessons.openExcelManagerModal();
        } else {
          window.location.href = 'lessons.html?managePricing=1';
        }
      };
    }

    document.querySelectorAll('[data-approve-req]').forEach((btn) => {
      btn.onclick = async () => {
        if (!api) return;
        const reqId = btn.dataset.approveReq;
        const reqDoc = (state.allRequests || []).find((r) => r.requestId === reqId);
        if (!reqDoc) return;
        btn.disabled = true;
        try {
          await api.approveSubscriptionRequest(reqDoc, 'QR payment verified by admin');
          feedbackBanner = { type: 'success', text: `Approved ${reqDoc.lessonTitle} for ${reqDoc.username || reqDoc.userEmail}.` };
          showToast('Membership activated.');
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Approval failed.' };
          renderModal();
        }
      };
    });

    document.querySelectorAll('[data-reject-req]').forEach((btn) => {
      btn.onclick = async () => {
        if (!api) return;
        const reqId = btn.dataset.rejectReq;
        btn.disabled = true;
        try {
          await api.rejectSubscriptionRequest(reqId, 'Payment not confirmed yet — please reach out on Viber/Email');
          feedbackBanner = { type: 'info', text: 'Request marked rejected.' };
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Reject failed.' };
          renderModal();
        }
      };
    });

    document.querySelectorAll('[data-save-user-membership]').forEach((btn) => {
      btn.onclick = async () => {
        if (!api) return;
        const uid = btn.dataset.saveUserMembership;
        const statusSel = document.querySelector(`[data-user-status="${uid}"]`);
        const planSel = document.querySelector(`[data-user-plan="${uid}"]`);
        const expInput = document.querySelector(`[data-user-expiry="${uid}"]`);
        btn.disabled = true;
        try {
          await api.updateUserMembershipAdmin(uid, {
            membershipStatus: statusSel?.value || 'free',
            membershipPlan: planSel?.value || 'none',
            membershipExpiresAt: expInput?.value || ''
          });
          feedbackBanner = { type: 'success', text: 'User membership updated.' };
          showToast('Membership status saved.');
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Failed to update membership.' };
          renderModal();
        }
      };
    });
  }

  // --- Member Menu Gate & Live Badge Sync (Daily Streak, Learning Rank, Daily Reminder) ---
  const RANK_DEFS = [
    { level: 1, rank: 'Novice', chineseRank: '初学者', minCompleted: 0, icon: '🌱', cls: 'rank-novice', nextRequired: 1 },
    { level: 2, rank: 'Scholar', chineseRank: '学者', minCompleted: 1, icon: '📚', cls: 'rank-scholar', nextRequired: 2 },
    { level: 3, rank: 'Master', chineseRank: '大师', minCompleted: 2, icon: '👑', cls: 'rank-master', nextRequired: null }
  ];

  function localDateStr(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatTime12h(timeStr) {
    if (!timeStr) return '06:00 PM';
    const [hStr, mStr] = String(timeStr).split(':');
    let h = parseInt(hStr, 10) || 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${mStr || '00'} ${ampm}`;
  }

  function syncMemberMenuTools(stateOverride) {
    const api = getAuthApi();
    const s = stateOverride || (api ? api.getState() : { user: null, userProgress: null });
    const isSignedIn = Boolean(s && s.user);

    const memberWrap = document.getElementById('hideMenuMemberTools');
    if (memberWrap) {
      memberWrap.hidden = !isSignedIn;
    }

    if (!isSignedIn) {
      const remModal = document.getElementById('reminderModal');
      if (remModal && remModal.classList.contains('active')) {
        remModal.classList.remove('active');
        remModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
      return;
    }

    const progress = (api && api.getUserProgress()) || {
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDate: '',
      completedLessonIds: [],
      reminderEnabled: true,
      reminderTime: '18:00',
      lastNotifiedDate: ''
    };

    // 1. Sync Daily Streak Badge
    const streak = Number(progress.currentStreak) || 0;
    const today = localDateStr();
    const countEl = document.getElementById('dailyStreakCount');
    const streakBadge = document.getElementById('dailyStreakBadge');
    const streakTitle = document.getElementById('streakTooltipTitle');
    const streakDesc = document.getElementById('streakTooltipDesc');
    if (countEl) countEl.textContent = String(streak);
    if (streakBadge) {
      streakBadge.classList.toggle('is-active', streak > 0);
      streakBadge.setAttribute(
        'aria-label',
        streak > 0
          ? `Daily Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`
          : 'Daily Streak: 0 days. Complete a lesson today to start!'
      );
    }
    if (streakTitle && streakDesc) {
      if (streak > 0) {
        streakTitle.textContent = `🔥 ${streak}-Day Streak!`;
        streakDesc.textContent =
          progress.lastCompletedDate === today
            ? `You completed a lesson today! Come back tomorrow to keep it going. (Best: ${progress.bestStreak || streak} days)`
            : `Complete a lesson today to extend your streak to ${streak + 1} days!`;
      } else {
        streakTitle.textContent = '🔥 Start Your Daily Streak';
        streakDesc.textContent = 'Complete any lesson today to ignite your streak!';
      }
    }

    // 2. Sync Learning Rank Badge
    const completedCount = Array.isArray(progress.completedLessonIds) ? progress.completedLessonIds.length : 0;
    let rankInfo = RANK_DEFS[0];
    for (let i = RANK_DEFS.length - 1; i >= 0; i--) {
      if (completedCount >= RANK_DEFS[i].minCompleted) {
        rankInfo = RANK_DEFS[i];
        break;
      }
    }
    const levelBadge = document.getElementById('userLevelBadge');
    const levelIcon = document.getElementById('userLevelIcon');
    const levelRank = document.getElementById('userLevelRank');
    const levelSub = document.getElementById('userLevelSubtitle');
    const lvlTitle = document.getElementById('levelTooltipTitle');
    const lvlCn = document.getElementById('levelTooltipChinese');
    const lvlDesc = document.getElementById('levelTooltipDesc');
    const lvlBar = document.getElementById('levelProgressBar');
    const lvlProg = document.getElementById('levelProgressText');
    const lvlNext = document.getElementById('levelNextRank');

    if (levelBadge) {
      levelBadge.classList.remove('rank-novice', 'rank-scholar', 'rank-master');
      levelBadge.classList.add(rankInfo.cls);
      levelBadge.setAttribute('aria-label', `User Level: ${rankInfo.rank} (Level ${rankInfo.level})`);
      levelBadge.setAttribute('title', `User Learning Rank: ${rankInfo.rank} (${rankInfo.chineseRank})`);
    }
    if (levelIcon) levelIcon.textContent = rankInfo.icon;
    if (levelRank) levelRank.textContent = rankInfo.rank;
    if (levelSub) levelSub.textContent = `Lvl ${rankInfo.level}`;
    if (lvlTitle) lvlTitle.textContent = `${rankInfo.icon} ${rankInfo.rank} (Level ${rankInfo.level})`;
    if (lvlCn) lvlCn.textContent = rankInfo.chineseRank;

    if (rankInfo.nextRequired !== null) {
      const pct = Math.min(100, Math.round((Math.max(0, completedCount - rankInfo.minCompleted) / Math.max(1, rankInfo.nextRequired - rankInfo.minCompleted)) * 100));
      const nextDef = RANK_DEFS.find((d) => d.minCompleted === rankInfo.nextRequired);
      const nextName = nextDef ? nextDef.rank : 'Next Rank';
      const needed = Math.max(1, rankInfo.nextRequired - completedCount);
      if (lvlBar) lvlBar.style.width = `${pct}%`;
      if (lvlProg) lvlProg.textContent = `${completedCount} / ${rankInfo.nextRequired} completed`;
      if (lvlNext) lvlNext.textContent = `Next: ${nextName}`;
      if (lvlDesc) lvlDesc.textContent = `Complete ${needed} more ${needed === 1 ? 'lesson' : 'lessons'} to reach ${nextName} rank!`;
    } else {
      if (lvlBar) lvlBar.style.width = '100%';
      if (lvlProg) lvlProg.textContent = 'Maximum Rank Achieved!';
      if (lvlNext) lvlNext.textContent = 'Max Rank';
      if (lvlDesc) lvlDesc.textContent = 'Congratulations! You have reached Master rank!';
    }

    // 3. Sync Daily Reminder Bell Dot
    const remDot = document.getElementById('reminderStatusDot');
    const remBell = document.getElementById('reminderBellBtn');
    const remEnabled = progress.reminderEnabled !== false;
    const remTime = progress.reminderTime || '18:00';
    if (remDot) remDot.classList.toggle('active', remEnabled);
    if (remBell) {
      remBell.setAttribute(
        'title',
        remEnabled
          ? `Daily Study Reminder active for ${formatTime12h(remTime)}. Click to change settings.`
          : 'Daily Study Reminder is paused. Click to enable.'
      );
    }
  }

  // Ensure #reminderBellBtn works on ALL pages even if page doesn't statically define #reminderModal
  function openUniversalReminderModal() {
    const api = getAuthApi();
    const state = api ? api.getState() : null;
    if (!state || !state.user) {
      openAuthModal('signin');
      return;
    }

    if (typeof window.openReminderModal === 'function' && document.getElementById('reminderModal')) {
      window.openReminderModal();
      return;
    }

    let modal = document.getElementById('reminderModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reminderModal';
      modal.className = 'reminder-modal-backdrop';
      modal.setAttribute('aria-hidden', 'true');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'reminderModalTitle');
      modal.innerHTML = `
        <div class="reminder-modal-card">
          <button type="button" class="reminder-modal-close" id="closeReminderModalBtn" aria-label="Close reminder settings">✕</button>
          <div class="reminder-modal-header">
            <div class="reminder-bell-avatar" aria-hidden="true">🔔</div>
            <h2 id="reminderModalTitle">Daily Lesson Reminder</h2>
            <p class="reminder-modal-subtitle">Stay consistent on your Chinese learning journey with a daily notification.</p>
          </div>
          <div class="reminder-section">
            <div class="reminder-toggle-row">
              <div class="reminder-toggle-text">
                <strong>Daily Goal Reminder</strong>
                <span>Prompt me to complete a lesson if I haven't reached my daily goal</span>
              </div>
              <label class="switch-toggle" for="reminderToggle">
                <input type="checkbox" id="reminderToggle" checked>
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>
          <div class="reminder-section" id="reminderTimeSection">
            <label class="reminder-section-label" for="reminderCustomTime">Reminder Time</label>
            <p class="reminder-section-desc">Set what time you want your daily study reminder.</p>
            <div class="reminder-preset-chips" id="reminderTimePresets">
              <button type="button" class="time-chip" data-time="09:00">09:00 AM 🌅</button>
              <button type="button" class="time-chip" data-time="12:30">12:30 PM ☀️</button>
              <button type="button" class="time-chip active" data-time="18:00">06:00 PM 🌇</button>
              <button type="button" class="time-chip" data-time="20:30">08:30 PM 🌙</button>
            </div>
            <div class="reminder-custom-time-row">
              <label for="reminderCustomTime">Custom time:</label>
              <input type="time" id="reminderCustomTime" value="18:00" class="reminder-time-input">
            </div>
          </div>
          <div class="reminder-goal-status" id="reminderGoalStatus">
            <span class="goal-status-icon" id="goalStatusIcon">🎯</span>
            <div class="goal-status-text">
              <strong id="goalStatusTitle">Today's Lesson Status</strong>
              <p id="goalStatusDesc">Pending — complete 1 lesson today to keep your streak burning!</p>
            </div>
          </div>
          <div class="reminder-modal-actions">
            <button type="button" class="btn btn-primary" id="saveReminderBtn">Save &amp; Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeModalFn = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      };

      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) closeModalFn();
      });
      modal.querySelector('#closeReminderModalBtn').onclick = closeModalFn;

      const toggleEl = modal.querySelector('#reminderToggle');
      const customEl = modal.querySelector('#reminderCustomTime');
      const timeSecEl = modal.querySelector('#reminderTimeSection');
      const chips = modal.querySelectorAll('#reminderTimePresets .time-chip');

      toggleEl.onchange = () => {
        timeSecEl.style.opacity = toggleEl.checked ? '1' : '0.5';
        timeSecEl.style.pointerEvents = toggleEl.checked ? 'auto' : 'none';
      };
      chips.forEach((chip) => {
        chip.onclick = () => {
          chips.forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          customEl.value = chip.dataset.time;
        };
      });
      customEl.oninput = () => {
        chips.forEach((c) => c.classList.toggle('active', c.dataset.time === customEl.value));
      };
      modal.querySelector('#saveReminderBtn').onclick = async () => {
        const enabled = toggleEl.checked;
        const time = customEl.value || '18:00';
        await api.saveReminderPreferences({ enabled, time });
        syncMemberMenuTools();
        closeModalFn();
        showToast(enabled ? `Daily reminder saved for ${formatTime12h(time)}.` : 'Daily reminder paused.');
      };
    }

    const prog = api.getUserProgress();
    const enabled = prog ? prog.reminderEnabled !== false : true;
    const time = prog ? prog.reminderTime || '18:00' : '18:00';
    const doneToday = prog && prog.lastCompletedDate === localDateStr();

    const toggleEl = modal.querySelector('#reminderToggle');
    const customEl = modal.querySelector('#reminderCustomTime');
    const timeSecEl = modal.querySelector('#reminderTimeSection');
    const iconEl = modal.querySelector('#goalStatusIcon');
    const titleEl = modal.querySelector('#goalStatusTitle');
    const descEl = modal.querySelector('#goalStatusDesc');

    if (toggleEl) toggleEl.checked = enabled;
    if (customEl) customEl.value = time;
    modal.querySelectorAll('#reminderTimePresets .time-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.time === time);
    });
    if (timeSecEl) {
      timeSecEl.style.opacity = enabled ? '1' : '0.5';
      timeSecEl.style.pointerEvents = enabled ? 'auto' : 'none';
    }
    if (iconEl) iconEl.textContent = doneToday ? '🎉' : '⏳';
    if (titleEl) titleEl.textContent = doneToday ? 'Daily Goal Completed!' : 'Daily Goal Pending';
    if (descEl) {
      descEl.textContent = doneToday
        ? "Great job! You've already completed a lesson today. Your daily streak is safe!"
        : enabled
        ? `You'll be reminded at ${formatTime12h(time)} if you haven't finished a lesson today.`
        : 'Enable the reminder above to receive your daily practice alert.';
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // --- Post-Lesson Review Popup Modal (Open to all visitors who finish a lesson) ---
  const RATING_LABELS = {
    1: 'Needs Improvement',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };

  const reviewState = {
    open: false,
    lessonId: '',
    title: 'Mandarin Lesson',
    audience: 'Lesson',
    rating: 5,
    submitted: false,
    mailtoUrl: '',
    errorMsg: ''
  };

  function ensureReviewModalRoot() {
    let backdrop = document.getElementById('linguaReviewModal');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'linguaReviewModal';
      backdrop.className = 'lp-review-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('aria-labelledby', 'lpReviewModalTitle');
      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeLessonReviewModal();
        }
      });
    }
    return backdrop;
  }

  function closeLessonReviewModal() {
    reviewState.open = false;
    const backdrop = document.getElementById('linguaReviewModal');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('lp-modal-open');
  }

  function openLessonReviewModal(lessonInfo = {}) {
    const api = getAuthApi();
    const authState = api ? api.getState() : null;
    const rawId = String(lessonInfo.lessonId || lessonInfo.id || 'lesson').trim();
    const rawTitle = String(lessonInfo.title || rawId || 'Mandarin Lesson').trim();
    const rawAudience = String(lessonInfo.audience || 'Curriculum').trim();

    reviewState.open = true;
    reviewState.lessonId = rawId;
    reviewState.title = rawTitle;
    reviewState.audience = rawAudience;
    reviewState.rating = 5;
    reviewState.submitted = false;
    reviewState.mailtoUrl = '';
    reviewState.errorMsg = '';

    const defaultName =
      authState?.profile?.username || authState?.user?.displayName || '';
    const defaultEmail =
      authState?.profile?.email || authState?.user?.email || '';

    renderReviewModal(defaultName, defaultEmail, '');
  }

  function renderReviewModal(prefillName = '', prefillEmail = '', prefillComment = '') {
    if (!reviewState.open) return;
    const backdrop = ensureReviewModalRoot();
    const ratingText = RATING_LABELS[reviewState.rating] || 'Excellent';

    if (reviewState.submitted) {
      backdrop.innerHTML = `
        <div class="lp-review-card">
          <div class="lp-modal-header">
            <div>
              <span class="lp-modal-eyebrow">${escapeHTML(reviewState.audience)} · Lesson Review</span>
              <h2 id="lpReviewModalTitle">Email Draft Opened</h2>
            </div>
            <button type="button" class="lp-modal-close" id="lpCloseReviewModalBtn" aria-label="Close review modal">✕</button>
          </div>

          <div class="lp-review-sent-box">
            <div class="lp-review-sent-icon" aria-hidden="true">✉️</div>
            <h3>Thank you for reviewing "${escapeHTML(reviewState.title)}"</h3>
            <p class="lp-muted">
              Your email app has been opened with a prefilled review addressed to
              <strong>${escapeHTML(getSiteContact().contactEmail)}</strong> (${reviewState.rating}/5 · ${escapeHTML(ratingText)}).
              Please click Send in your email client to deliver it.
            </p>
            <div class="lp-review-sent-actions">
              <a class="lp-btn lp-btn-primary" href="${escapeHTML(reviewState.mailtoUrl)}">Open Email App Again</a>
              <button type="button" class="lp-btn lp-btn-secondary" id="lpReviewDoneCloseBtn">Back to Lesson</button>
            </div>
          </div>
        </div>
      `;
    } else {
      backdrop.innerHTML = `
        <div class="lp-review-card">
          <div class="lp-modal-header">
            <div>
              <span class="lp-modal-eyebrow">${escapeHTML(reviewState.audience)} · Lesson Completed</span>
              <h2 id="lpReviewModalTitle">Share Your Lesson Review</h2>
            </div>
            <button type="button" class="lp-modal-close" id="lpCloseReviewModalBtn" aria-label="Close review modal">✕</button>
          </div>

          <p class="lp-review-lesson-subtitle">
            Finished: <strong>${escapeHTML(reviewState.title)}</strong>
          </p>

          ${
            reviewState.errorMsg
              ? `<div class="lp-feedback lp-feedback-error" role="alert">${escapeHTML(reviewState.errorMsg)}</div>`
              : ''
          }

          <form id="lpLessonReviewForm" class="lp-form" novalidate>
            <div class="lp-field">
              <div class="lp-field-label-row">
                <label id="lpReviewRatingLabel">Your Rating *</label>
                <span class="lp-review-rating-text" id="lpReviewRatingValue">${reviewState.rating} / 5 · ${escapeHTML(ratingText)}</span>
              </div>
              <div class="lp-star-group" role="radiogroup" aria-labelledby="lpReviewRatingLabel">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (num) => `
                  <button
                    type="button"
                    class="lp-star-btn ${num <= reviewState.rating ? 'is-active' : ''}"
                    data-review-star="${num}"
                    role="radio"
                    aria-checked="${num === reviewState.rating ? 'true' : 'false'}"
                    aria-label="Rate ${num} out of 5 stars (${RATING_LABELS[num]})"
                  >★</button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="lp-form-grid-2">
              <div class="lp-field">
                <label for="lpReviewName">Your Name (Optional)</label>
                <input type="text" id="lpReviewName" maxlength="60" value="${escapeHTML(prefillName)}" placeholder="Guest or Learner name" />
              </div>
              <div class="lp-field">
                <label for="lpReviewEmail">Your Email (Optional)</label>
                <input type="email" id="lpReviewEmail" maxlength="160" value="${escapeHTML(prefillEmail)}" placeholder="you@example.com" />
              </div>
            </div>

            <div class="lp-field">
              <label for="lpReviewComment">Lesson Review &amp; Feedback *</label>
              <textarea id="lpReviewComment" rows="4" maxlength="1200" placeholder="How clear were the explanations, exercises, or pronunciation prompts?" required>${escapeHTML(prefillComment)}</textarea>
            </div>

            <div class="lp-review-footer-actions">
              <button type="button" class="lp-btn lp-btn-secondary" id="lpReviewSkipBtn">Maybe Later</button>
              <button type="submit" class="lp-btn lp-btn-primary" id="lpReviewSubmitBtn">Submit Review</button>
            </div>
          </form>
        </div>
      `;
    }

    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lp-modal-open');
    bindReviewModalEvents();
  }

  function bindReviewModalEvents() {
    const closeBtn = document.getElementById('lpCloseReviewModalBtn');
    if (closeBtn) closeBtn.onclick = closeLessonReviewModal;

    const skipBtn = document.getElementById('lpReviewSkipBtn');
    if (skipBtn) skipBtn.onclick = closeLessonReviewModal;

    const doneBtn = document.getElementById('lpReviewDoneCloseBtn');
    if (doneBtn) doneBtn.onclick = closeLessonReviewModal;

    document.querySelectorAll('[data-review-star]').forEach((starBtn) => {
      starBtn.onclick = () => {
        const val = parseInt(starBtn.dataset.reviewStar, 10);
        if (val >= 1 && val <= 5) {
          reviewState.rating = val;
          reviewState.errorMsg = '';
          const ratingValueEl = document.getElementById('lpReviewRatingValue');
          if (ratingValueEl) {
            ratingValueEl.textContent = `${val} / 5 · ${RATING_LABELS[val]}`;
          }
          document.querySelectorAll('[data-review-star]').forEach((b) => {
            const s = parseInt(b.dataset.reviewStar, 10);
            b.classList.toggle('is-active', s <= val);
            b.setAttribute('aria-checked', s === val ? 'true' : 'false');
          });
        }
      };
    });

    const form = document.getElementById('lpLessonReviewForm');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const nameVal = document.getElementById('lpReviewName')?.value?.trim() || '';
        const emailVal = document.getElementById('lpReviewEmail')?.value?.trim() || '';
        const commentVal = document.getElementById('lpReviewComment')?.value?.trim() || '';

        if (!commentVal || commentVal.length < 2) {
          reviewState.errorMsg = 'Please write a short comment about this lesson before submitting.';
          renderReviewModal(nameVal, emailVal, commentVal);
          return;
        }

        const ratingLabel = RATING_LABELS[reviewState.rating] || 'Rated';
        const subjectText = `JiedeEdu Lesson Review: ${reviewState.title} (${reviewState.rating}/5)`;
        const bodyText = [
          `Lesson: ${reviewState.title}`,
          `Lesson ID: ${reviewState.lessonId}`,
          `Track: ${reviewState.audience}`,
          `Rating: ${reviewState.rating} / 5 (${ratingLabel})`,
          `Reviewer Name: ${nameVal || 'Guest Visitor'}`,
          `Reviewer Email: ${emailVal || 'Not provided'}`,
          '',
          'Review Feedback:',
          commentVal
        ].join('\n');

        const targetEmail = getSiteContact().contactEmail || 'syndkyaw@gmail.com';
        const mailtoHref = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
        reviewState.mailtoUrl = mailtoHref;
        reviewState.submitted = true;
        reviewState.errorMsg = '';

        // Open prefilled mailto email draft without using window.open
        try {
          const tempLink = document.createElement('a');
          tempLink.href = mailtoHref;
          tempLink.style.display = 'none';
          document.body.appendChild(tempLink);
          tempLink.click();
          setTimeout(() => tempLink.remove(), 120);
        } catch (err) {
          window.location.href = mailtoHref;
        }

        showToast('Email draft ready for your lesson review.');
        renderReviewModal();
      };
    }
  }

  // Global button delegation for Account & Member Reminder triggers
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('#headerAccountBtn, #mobileAccountBtn, [data-open-account]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.closeLinguaMenu === 'function') {
        window.closeLinguaMenu();
      }
      openAuthModal('signin');
      return;
    }

    const remTrigger = e.target.closest('#reminderBellBtn');
    if (remTrigger && !document.getElementById('mainNav')?.dataset?.boundReminderByPage) {
      // Only intercept if page script doesn't have its own statically wired modal opener, or ensure fallback modal works
      if (typeof window.openReminderModal !== 'function' || !document.getElementById('reminderModal')) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.closeLinguaMenu === 'function') {
          window.closeLinguaMenu();
        }
        openUniversalReminderModal();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (reviewState.open) {
        closeLessonReviewModal();
        return;
      }
      if (modalMode !== 'closed') {
        if (modalMode === 'registering' && registrationState.phase === 'pending') {
          return;
        }
        closeModal();
      }
    }
  });

  // React to auth/catalog changes
  function onAuthChange(state) {
    updateHeaderAccountUI(state);
    syncMemberMenuTools(state);

    const newUid = state.user ? state.user.uid : null;
    const authUserChanged = newUid !== lastAuthUserUid;
    lastAuthUserUid = newUid;

    if (modalMode === 'registering') {
      return;
    }

    if (modalMode !== 'closed') {
      // Avoid blowing away typed input unless the user signed in/out or changed tabs explicitly
      if (authUserChanged || (modalMode === 'account' && accountTab === 'profile')) {
        // Only re-render automatically when auth status changes or profile isn't mid-edit
        const activeEl = document.activeElement;
        const isEditingInput = activeEl && activeEl.closest('#linguaAuthModal') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
        if (!isEditingInput || authUserChanged) {
          renderModal();
        }
      }
    }
  }

  window.addEventListener('lingua-auth-change', (e) => {
    onAuthChange(e.detail);
  });

  window.addEventListener('lingua-site-config-change', () => {
    if (modalMode === 'subscribe') {
      const activeEl = document.activeElement;
      const isEditingInput = activeEl && activeEl.closest('#linguaAuthModal') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
      if (!isEditingInput) {
        renderModal();
      }
    }
  });

  // Also re-sync header UI after header.js finishes injecting header.html
  window.addEventListener('lingua-header-ready', () => {
    updateHeaderAccountUI();
    syncMemberMenuTools();
  });

  document.addEventListener('DOMContentLoaded', () => {
    updateHeaderAccountUI();
    syncMemberMenuTools();
  });

  window.LinguaReview = {
    openLessonReviewModal,
    closeLessonReviewModal
  };

  window.LinguaAuthUI = {
    openAuthModal,
    openAccountModal,
    openSubscribeModal,
    openSubscribeCourseModal,
    closeModal,
    updateHeaderAccountUI,
    syncMemberMenuTools,
    openLessonReviewModal,
    showToast
  };
})();

