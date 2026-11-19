/**
 * =========================================================
 * LINGUAPATH - AUTHENTICATION, PROFILE & SUBSCRIPTION UI
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
      title: 'By-Lesson Pass',
      defaultAmount: '$9',
      subtitle: 'Unlock one paid lesson permanently'
    },
    monthly: {
      id: 'monthly',
      title: 'Monthly All-Access',
      defaultAmount: '$19 / mo',
      subtitle: 'All Adult & Kids paid lessons for 30 days'
    },
    annual: {
      id: 'annual',
      title: 'Annual All-Access',
      defaultAmount: '$149 / yr',
      subtitle: 'All Adult & Kids paid lessons for 12 months (Save 35%)'
    }
  };

  let modalMode = 'closed'; // 'closed' | 'auth' | 'account' | 'subscribe'
  let authTab = 'signin'; // 'signin' | 'register'
  let accountTab = 'profile'; // 'profile' | 'plans' | 'admin'
  let subscribeContext = {
    planType: 'monthly',
    lessonId: '',
    lessonTitle: '',
    amountLabel: '$19 / mo',
    contactChannel: 'viber'
  };
  let pendingPostAuthSubscribe = null;
  let feedbackBanner = null; // { type: 'success' | 'error' | 'info', text: string, showGoogleHint?: boolean }
  let lastAuthUserUid = null;

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

  function formatMembershipBadge(state) {
    const profile = state?.profile;
    if (!state?.user) return '';
    if (state.isAdmin) return 'Admin';
    if (!profile) return 'Free';
    if (profile.membershipStatus === 'active') {
      if (profile.membershipPlan === 'annual') return 'Annual Active';
      if (profile.membershipPlan === 'monthly') return 'Monthly Active';
      if (profile.membershipPlan === 'per_lesson') return 'Lesson Pass';
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
          closeModal();
        }
      });
    }
    return backdrop;
  }

  function closeModal() {
    modalMode = 'closed';
    feedbackBanner = null;
    const backdrop = document.getElementById('linguaAuthModal');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('lp-modal-open');
  }

  function openAuthModal(initialTab = 'signin') {
    const api = getAuthApi();
    const state = api ? api.getState() : null;
    feedbackBanner = null;
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
    if (!state || !state.user) {
      openAuthModal('signin');
      return;
    }
    modalMode = 'account';
    accountTab = tab;
    renderModal();
  }

  function openSubscribeModal(lesson) {
    const api = getAuthApi();
    const state = api ? api.getState() : null;
    feedbackBanner = null;

    if (lesson && (lesson.id || lesson.lessonId)) {
      const pricing = api ? api.getLessonPricing(lesson) : { accessType: 'paid', price: 9 };
      const lessonId = String(lesson.id || lesson.lessonId);
      const lessonTitle = String(lesson.title || lessonId);
      subscribeContext = {
        planType: 'per_lesson',
        lessonId,
        lessonTitle,
        amountLabel: `$${pricing.price || 9}`,
        contactChannel: subscribeContext.contactChannel || 'viber'
      };
    } else {
      subscribeContext = {
        planType: 'monthly',
        lessonId: '',
        lessonTitle: '',
        amountLabel: '$19 / mo',
        contactChannel: subscribeContext.contactChannel || 'viber'
      };
    }

    if (state && state.user) {
      modalMode = 'subscribe';
    } else {
      // Prompt sign in / registration first, then proceed right into the selected plan
      pendingPostAuthSubscribe = { ...subscribeContext };
      modalMode = 'subscribe';
    }
    renderModal();
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
          <span class="lp-modal-eyebrow">LinguaPath Account</span>
          <h2 id="lpAuthModalTitle">${authTab === 'register' ? 'Create Your Learner Profile' : 'Welcome Back'}</h2>
        </div>
        <button type="button" class="lp-modal-close" id="lpCloseAuthModalBtn" aria-label="Close modal">✕</button>
      </div>

      ${pendingHint}
      ${adminSetupHint}

      <div class="lp-tabs-bar" role="tablist">
        <button type="button" class="lp-tab-btn ${authTab === 'signin' ? 'active' : ''}" data-auth-tab="signin" role="tab" aria-selected="${authTab === 'signin'}">Sign In</button>
        <button type="button" class="lp-tab-btn ${authTab === 'register' ? 'active' : ''}" data-auth-tab="register" role="tab" aria-selected="${authTab === 'register'}">Register</button>
      </div>

      ${renderFeedbackHTML()}

      ${
        authTab === 'signin'
          ? `
        <form id="lpSignInForm" class="lp-form" novalidate>
          <div class="lp-field">
            <label for="lpLoginEmail">Email Address</label>
            <input type="email" id="lpLoginEmail" autocomplete="email" placeholder="you@example.com" required />
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
              <input type="text" id="lpRegUsername" maxlength="60" autocomplete="username" placeholder="e.g. Mei Lin" required />
            </div>
            <div class="lp-field">
              <label for="lpRegEmail">Email Address *</label>
              <input type="email" id="lpRegEmail" maxlength="160" autocomplete="email" placeholder="you@example.com" required />
            </div>
          </div>

          <div class="lp-form-grid-2">
            <div class="lp-field">
              <label for="lpRegPhone">Phone / Viber Number *</label>
              <input type="tel" id="lpRegPhone" maxlength="32" autocomplete="tel" placeholder="+95 9 xxx xxx xxx" required />
            </div>
            <div class="lp-field">
              <div class="lp-field-label-row">
                <label for="lpRegDob">Date of Birth *</label>
                <span class="lp-age-readout" id="lpRegAgePreview">Age: --</span>
              </div>
              <input type="date" id="lpRegDob" max="${todayIso}" required />
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

  function renderPlanSelectionAndQrStep(state) {
    const api = getAuthApi();
    const isSignedIn = Boolean(state && state.user);
    const profile = state?.profile;
    const isLessonContext = Boolean(subscribeContext.lessonId);

    const perLessonTitle = subscribeContext.lessonTitle || 'Selected Paid Lesson';
    const perLessonPrice = subscribeContext.lessonId ? subscribeContext.amountLabel || '$9' : '$9 / lesson';

    const selectedPlan = subscribeContext.planType || 'monthly';
    const selectedLabel =
      selectedPlan === 'per_lesson'
        ? `${perLessonTitle} (${perLessonPrice})`
        : PLAN_CATALOG[selectedPlan]?.title + ' · ' + PLAN_CATALOG[selectedPlan]?.defaultAmount;

    const { contactEmail, contactViber, viberHref } = getSiteContact();
    const channel = subscribeContext.contactChannel === 'email' ? 'email' : 'viber';
    const prefilledHandle =
      channel === 'viber'
        ? profile?.phoneNumber || ''
        : profile?.email || state?.user?.email || '';

    const subject = encodeURIComponent(`LinguaPath QR Subscription Request: ${selectedLabel}`);
    const body = encodeURIComponent(
      `Hello LinguaPath Team,\n\nI would like to subscribe to: ${selectedLabel}\nUsername: ${
        profile?.username || ''
      }\nEmail: ${profile?.email || state?.user?.email || ''}\nPhone/Viber: ${
        profile?.phoneNumber || ''
      }\n\nPlease share the QR code for payment so my membership can be activated.\n\nThank you!`
    );
    const mailtoHref = `mailto:${encodeURIComponent(contactEmail)}?subject=${subject}&body=${body}`;

    const pendingReq = (state?.myRequests || []).find((r) => r.status === 'pending');

    return `
      ${
        isLessonContext
          ? `<div class="lp-context-callout">
               <strong>Locked Lesson:</strong> ${escapeHTML(subscribeContext.lessonTitle)}
               <span>· Choose single-lesson unlock or unlimited All-Access below.</span>
             </div>`
          : ''
      }

      <div class="lp-plan-grid">
        ${
          isLessonContext
            ? `
          <button type="button" class="lp-plan-card ${selectedPlan === 'per_lesson' ? 'is-selected' : ''}" data-select-plan="per_lesson">
            <div class="lp-plan-top">
              <strong>This Lesson Only</strong>
              <span class="lp-plan-price">${escapeHTML(perLessonPrice)}</span>
            </div>
            <p>${escapeHTML(perLessonTitle)} · Permanent access to this lesson.</p>
          </button>
        `
            : ''
        }

        <button type="button" class="lp-plan-card ${selectedPlan === 'monthly' ? 'is-selected' : ''}" data-select-plan="monthly">
          <div class="lp-plan-top">
            <strong>Monthly All-Access</strong>
            <span class="lp-plan-price">$19 / mo</span>
          </div>
          <p>Unlock every paid Adult &amp; Kids lesson for 30 days.</p>
        </button>

        <button type="button" class="lp-plan-card ${selectedPlan === 'annual' ? 'is-selected' : ''}" data-select-plan="annual">
          <div class="lp-plan-top">
            <strong>Annual All-Access</strong>
            <span class="lp-plan-price">$149 / yr</span>
          </div>
          <p>Full 12-month membership across all lessons (Save 35%).</p>
        </button>
      </div>

      ${
        !isSignedIn
          ? `
        <div class="lp-qr-box">
          <h3>Step 2: Sign In to Request QR Payment</h3>
          <p class="lp-muted">Please sign in or register first so we can link the QR payment and activate membership on your profile.</p>
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
            Selected: <strong>${escapeHTML(selectedLabel)}</strong> · Contact us via Email or Viber to receive our payment QR code. After payment is confirmed, your membership status will be activated on your profile.
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

    let membershipHeadline = 'Free Learner Plan';
    let membershipSub = 'Access all free foundational lessons. Upgrade anytime for paid lessons.';
    let membershipTone = 'free';

    if (state.isAdmin) {
      membershipHeadline = 'Administrator · Full Access';
      membershipSub = 'You have full access to all lessons, upload pricing, and member approvals.';
      membershipTone = 'active';
    } else if (profile?.membershipStatus === 'active' && api && api.hasActiveMembership()) {
      membershipTone = 'active';
      const planNames = { monthly: 'Monthly All-Access', annual: 'Annual All-Access', per_lesson: 'By-Lesson Pass', none: 'Active' };
      membershipHeadline = `Active Membership · ${planNames[profile.membershipPlan] || 'Subscribed'}`;
      membershipSub = profile.membershipExpiresAt
        ? `Valid through ${profile.membershipExpiresAt} · All paid lessons unlocked.`
        : 'All paid lessons are unlocked on your account.';
    } else if ((profile?.subscribedLessonIds || []).length > 0) {
      membershipTone = 'active';
      membershipHeadline = `Active · ${profile.subscribedLessonIds.length} Lesson${
        profile.subscribedLessonIds.length > 1 ? 's' : ''
      } Unlocked`;
      membershipSub = `Unlocked IDs: ${profile.subscribedLessonIds.join(', ')}`;
    } else if (pendingReq) {
      membershipTone = 'pending';
      membershipHeadline = `Pending QR Verification · ${pendingReq.lessonTitle}`;
      membershipSub = `Requested ${pendingReq.amountLabel} via ${pendingReq.contactChannel.toUpperCase()}. Waiting for admin confirmation.`;
    } else if (profile?.membershipStatus === 'expired') {
      membershipTone = 'expired';
      membershipHeadline = 'Membership Expired';
      membershipSub = 'Renew Monthly, Annual, or By-Lesson access to unlock paid lessons.';
    }

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
                : membershipTone !== 'active' || profile?.membershipPlan === 'per_lesson'
                ? `<button type="button" class="lp-btn lp-btn-primary lp-btn-sm" id="lpOpenPlansFromProfileBtn">Upgrade / Subscribe</button>`
                : ''
            }
          </div>
        </div>
        ${
          (profile?.subscribedLessonIds || []).length > 0 && profile?.membershipPlan !== 'per_lesson'
            ? `<div class="lp-membership-extra">Individual Unlocked Lessons: ${escapeHTML(
                profile.subscribedLessonIds.join(', ')
              )}</div>`
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
                          <option value="monthly" ${u.membershipPlan === 'monthly' ? 'selected' : ''}>monthly</option>
                          <option value="annual" ${u.membershipPlan === 'annual' ? 'selected' : ''}>annual</option>
                          <option value="per_lesson" ${u.membershipPlan === 'per_lesson' ? 'selected' : ''}>per_lesson</option>
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
          <span class="lp-modal-eyebrow">My LinguaPath Account</span>
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
    if (modalMode === 'subscribe') {
      inner = renderSubscribeView(state);
    } else if (modalMode === 'account' && state.user) {
      inner = renderAccountView(state);
    } else {
      modalMode = 'auth';
      inner = renderAuthView(state);
    }

    backdrop.innerHTML = `<div class="lp-auth-card">${inner}</div>`;
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
          feedbackBanner = {
            type: 'error',
            text: err instanceof Error ? err.message : 'Unable to sign in.'
          };
          renderModal();
        }
      };
    }

    // Forgot password (server generates temporary password & emails user)
    const forgotBtn = document.getElementById('lpForgotPasswordBtn');
    if (forgotBtn) {
      forgotBtn.onclick = async () => {
        if (!api) return;
        const emailInput = document.getElementById('lpLoginEmail');
        const email = emailInput?.value?.trim() || '';
        if (!email) {
          feedbackBanner = { type: 'info', text: 'Enter your email address above first, then click Forgot password?.' };
          renderModal();
          setTimeout(() => document.getElementById('lpLoginEmail')?.focus(), 20);
          return;
        }
        forgotBtn.disabled = true;
        forgotBtn.textContent = 'Sending…';
        try {
          const msg = await api.sendPasswordReset(email);
          feedbackBanner = { type: 'success', text: msg };
          showToast('Temporary password email sent.');
          renderModal();
        } catch (err) {
          feedbackBanner = { type: 'error', text: err instanceof Error ? err.message : 'Unable to send reset email.' };
          renderModal();
        }
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

        const submitBtn = document.getElementById('lpRegisterSubmitBtn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating Account…';
        }
        try {
          await api.registerWithEmail({ username, email, phoneNumber, dob, password });
          const nextState = api.getState();
          if (nextState?.isAdmin && !pendingPostAuthSubscribe) {
            closeModal();
            if (window.location.pathname.includes('admin.html')) {
              showToast('Admin account created — CMS Portal unlocked.');
            } else {
              showToast('Admin account created — opening Admin Portal…');
              setTimeout(() => {
                window.location.href = 'admin.html';
              }, 300);
            }
            return;
          }
          feedbackBanner = { type: 'success', text: 'Account created and signed in!' };
          showToast('Welcome to LinguaPath!');
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
          feedbackBanner = {
            type: 'error',
            text: err instanceof Error ? err.message : 'Registration failed.'
          };
          renderModal();
        }
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
      card.onclick = () => {
        const planId = card.dataset.selectPlan;
        subscribeContext.planType = planId;
        if (planId === 'monthly') {
          subscribeContext.amountLabel = '$19 / mo';
        } else if (planId === 'annual') {
          subscribeContext.amountLabel = '$149 / yr';
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
          await api.submitSubscriptionRequest({
            planType: subscribeContext.planType,
            lessonId: subscribeContext.lessonId,
            lessonTitle: subscribeContext.lessonTitle,
            amountLabel: subscribeContext.amountLabel,
            contactChannel,
            contactHandle,
            note
          });
          feedbackBanner = {
            type: 'success',
            text: 'Subscription request submitted! Send a message via Email or Viber above to receive your QR code. Your membership will unlock once payment is confirmed.'
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
          window.location.href = 'lessons-adult.html?managePricing=1';
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
        const subjectText = `LinguaPath Lesson Review: ${reviewState.title} (${reviewState.rating}/5)`;
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
    closeModal,
    updateHeaderAccountUI,
    syncMemberMenuTools,
    openLessonReviewModal,
    showToast
  };
})();

