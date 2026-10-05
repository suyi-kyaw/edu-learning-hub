/**
 * =========================================================
 * LINGUAPATH - SHARED HEADER LOADER & THEME CONTROLLER (header.js)
 * Automatically loads and injects header.html into all pages
 * Provides unified, bulletproof Dark/Light Mode toggle & navigation
 * =========================================================
 */

(function () {
  'use strict';

  // --- Theme Management ---
  function getStoredTheme() {
    try {
      const saved = localStorage.getItem('linguapath_theme') || localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem('linguapath_theme', theme);
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }

  function updateThemeButtonUI(theme) {
    const isDark = theme === 'dark';
    const buttons = document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn');
    buttons.forEach(btn => {
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode for late-night learning sessions');
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    });
  }

  function applyTheme(theme, save = true) {
    const validTheme = (theme === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', validTheme);
    if (save) {
      setStoredTheme(validTheme);
    }
    updateThemeButtonUI(validTheme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: validTheme } }));
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getStoredTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
  }

  // Expose global theme functions
  window.toggleLinguaTheme = toggleTheme;
  window.setLinguaTheme = applyTheme;
  window.getLinguaTheme = getStoredTheme;

  // Apply initial theme immediately to prevent white flashes
  applyTheme(getStoredTheme(), false);

  // --- Mobile Menu Drawer ---
  function toggleMobileMenu() {
    const mainNav = document.getElementById('mainNav');
    const menuBtn = document.getElementById('menuToggle');
    if (!mainNav) return;
    const isOpen = mainNav.classList.toggle('is-open');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menuBtn.classList.toggle('active', isOpen);
    }
    document.body.classList.toggle('menu-open', isOpen);
  }

  function closeMobileMenu() {
    const mainNav = document.getElementById('mainNav');
    const menuBtn = document.getElementById('menuToggle');
    if (mainNav) mainNav.classList.remove('is-open');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.classList.remove('active');
    }
    document.body.classList.remove('menu-open');
  }

  // --- Global Event Delegation (Works even before/after dynamic header injection) ---
  document.addEventListener('click', function (e) {
    const themeBtn = e.target.closest('#themeToggleBtn, .theme-toggle-btn');
    if (themeBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
      return;
    }

    const menuBtn = e.target.closest('#menuToggle, .menu-toggle');
    if (menuBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleMobileMenu();
      return;
    }

    const closeBtn = e.target.closest('#hideMenuCloseBtn, .hide-menu-close-btn');
    if (closeBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeMobileMenu();
      return;
    }

    // Close menu when clicking outside
    const mainNav = document.getElementById('mainNav');
    if (mainNav && mainNav.classList.contains('is-open')) {
      if (!mainNav.contains(e.target) && !e.target.closest('#menuToggle, .menu-toggle')) {
        closeMobileMenu();
      }
    }
  });

  // Close menu on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeMobileMenu();
    }
  });

  // Listen to OS system color scheme changes if user hasn't explicitly set one
  try {
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        const hasManualSetting = localStorage.getItem('linguapath_theme') || localStorage.getItem('theme');
        if (!hasManualSetting) {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  } catch (err) {}

  // Fallback Header Template
  const FALLBACK_HEADER_HTML = `
  <header class="site-header">
    <div class="container nav-container">
      <a href="index.html" class="logo">
        <span class="logo-chinese">语</span>
        <span class="logo-text">LinguaPath</span>
      </a>

      <nav class="desktop-nav" aria-label="Main Navigation">
        <a href="index.html" class="nav-link">Home</a>
        <a href="story.html" class="nav-link">Stories &amp; Reels</a>
        <a href="games.html" class="nav-link">Games</a>
        <a href="lessons.html" class="nav-link">Lessons</a>
      </nav>

      <div class="nav-actions">
        <button
          type="button"
          class="theme-toggle-btn"
          id="themeToggleBtn"
          aria-label="Toggle dark mode"
          title="Toggle light / dark mode for late-night learning sessions"
        >
          <span class="theme-icon theme-icon-moon" aria-hidden="true">🌙</span>
          <span class="theme-icon theme-icon-sun" aria-hidden="true">☀️</span>
        </button>

        <button
          class="menu-toggle"
          id="menuToggle"
          type="button"
          aria-label="Toggle menu and learning tools"
          aria-expanded="false"
          title="Menu & Learning Tools"
        >
          <span class="menu-toggle-icon" aria-hidden="true">☰</span>
          <span class="menu-toggle-label">Menu</span>
        </button>
      </div>
    </div>

    <nav class="main-nav" id="mainNav" aria-label="Menu and learning tools">
      <div class="hide-menu-header">
        <div class="hide-menu-header-top">
          <span class="hide-menu-title">Menu & Learning Hub</span>
          <button type="button" class="hide-menu-close-btn" id="hideMenuCloseBtn" aria-label="Close menu" title="Close menu">✕</button>
        </div>
        <span class="hide-menu-subtitle">Your progress & study tools</span>
      </div>

      <div class="hide-menu-nav-links">
        <a href="index.html" class="hide-menu-link">
          <span class="menu-link-icon" aria-hidden="true">🏠</span>
          <span class="hide-menu-link-text">Home</span>
        </a>
        <a href="story.html" class="hide-menu-link">
          <span class="menu-link-icon" aria-hidden="true">🎬</span>
          <span class="hide-menu-link-text">Stories &amp; Reels</span>
          <span class="hide-menu-tag">Watch</span>
        </a>
        <a href="games.html" class="hide-menu-link">
          <span class="menu-link-icon" aria-hidden="true">🎮</span>
          <span class="hide-menu-link-text">Interactive Games</span>
          <span class="hide-menu-tag">Play</span>
        </a>
        <a href="lessons.html" class="hide-menu-link">
          <span class="menu-link-icon" aria-hidden="true">📚</span>
          <span class="hide-menu-link-text">Lessons &amp; Pathways</span>
        </a>
        <a href="story.html" id="navReviewModeBtn" class="hide-menu-link hide-menu-review-link">
          <span class="menu-link-icon" aria-hidden="true">🎴</span>
          <span class="hide-menu-link-text">Review Mode</span>
          <span class="hide-menu-tag hide-menu-tag-review">Flashcards</span>
        </a>
      </div>

      <div class="hide-menu-divider" aria-hidden="true"></div>

      <div class="hide-menu-tools">
        <div class="hide-menu-section-label">Your Daily Streak</div>
        <div
          class="streak-badge hide-menu-streak-card"
          id="dailyStreakBadge"
          role="status"
          aria-label="Daily Streak Counter"
          tabindex="0"
          title="Daily Learning Streak: Click for info"
        >
          <span class="streak-flame" aria-hidden="true">🔥</span>
          <div class="hide-menu-card-body">
            <div class="streak-text-wrap">
              <span class="streak-count" id="dailyStreakCount">0</span>
              <span class="streak-label">Daily Streak</span>
            </div>
            <span class="hide-menu-card-sub" id="streakTooltipDesc">Complete a lesson today to start your streak!</span>
          </div>
          <div class="streak-tooltip" id="streakTooltip">
            <strong id="streakTooltipTitle">Daily Streak: 0 days</strong>
            <p>Complete any lesson each day to build your streak!</p>
          </div>
        </div>

        <div class="hide-menu-section-label">Your Learning Rank</div>
        <div
          class="level-badge rank-novice hide-menu-level-card"
          id="userLevelBadge"
          role="status"
          aria-label="User Level: Novice (Level 1)"
          tabindex="0"
          title="User Learning Level: Novice"
        >
          <span class="level-icon" id="userLevelIcon" aria-hidden="true">🌱</span>
          <div class="hide-menu-card-body">
            <div class="level-text-wrap">
              <span class="level-rank" id="userLevelRank">Novice</span>
              <span class="level-label" id="userLevelSubtitle">Lvl 1</span>
            </div>
            <span class="hide-menu-card-sub" id="levelProgressText">0 / 1 completed</span>
          </div>
          <div class="level-tooltip" id="levelTooltip">
            <div class="level-tooltip-header">
              <strong id="levelTooltipTitle">🌱 Novice (Level 1)</strong>
              <span class="level-tooltip-chinese" id="levelTooltipChinese">初学者</span>
            </div>
            <p id="levelTooltipDesc">Complete 1 lesson to achieve Scholar rank!</p>
            <div class="level-progress-bar-wrap">
              <div class="level-progress-bar" id="levelProgressBar" style="width: 0%;"></div>
            </div>
            <div class="level-progress-footer">
              <span id="levelNextRank">Next: Scholar</span>
            </div>
          </div>
        </div>

        <div class="hide-menu-section-label">Daily Reminder</div>
        <div class="hide-menu-reminder-wrap">
          <button
            type="button"
            class="reminder-bell-btn"
            id="reminderBellBtn"
            aria-label="Daily Lesson Reminder"
            title="Daily Lesson Reminder: Get prompted to complete a lesson"
          >
            <span class="bell-icon" aria-hidden="true">🔔</span>
            <span class="reminder-status-dot" id="reminderStatusDot" aria-hidden="true"></span>
          </button>
          <div class="hide-menu-reminder-text">
            <strong class="hide-menu-reminder-title">Daily Practice Alarm</strong>
            <span class="hide-menu-reminder-sub">Click bell to configure time</span>
          </div>
        </div>
      </div>
    </nav>
  </header>
  `;

  async function injectHeader() {
    let htmlContent = FALLBACK_HEADER_HTML;
    try {
      const res = await fetch('header.html?t=' + Date.now());
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().includes('<header')) {
          htmlContent = text;
        }
      }
    } catch (e) {
      // Use fallback
    }

    const container = document.getElementById('sharedHeader');
    if (container) {
      container.innerHTML = htmlContent;
    } else {
      const existing = document.querySelector('header.site-header');
      if (existing) {
        existing.outerHTML = htmlContent;
      } else {
        document.body.insertAdjacentHTML('afterbegin', htmlContent);
      }
    }

    // Mark current active link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.desktop-nav .nav-link, .hide-menu-nav-links .hide-menu-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
          link.classList.add('active');
        } else if (currentPath.includes('lessons') && href.includes('lessons')) {
          link.classList.add('active');
        }
      }
    });

    // Sync theme UI on injected button
    updateThemeButtonUI(document.documentElement.getAttribute('data-theme') || getStoredTheme());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHeader);
  } else {
    injectHeader();
  }
})();
