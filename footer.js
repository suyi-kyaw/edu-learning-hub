/**
 * =========================================================
 * JIEDEEDU - SHARED FOOTER LOADER (footer.js)
 * Automatically loads and injects footer.html into all pages
 * Dynamically hydrates Contact Us fields from SiteConfig.
 * =========================================================
 */

(function () {
  'use strict';

  const FALLBACK_FOOTER_HTML = `
  <footer class="site-footer">
    <div class="container footer-content">
      <div class="footer-brand">
        <div class="footer-logo has-custom-logo">
          <img src="public/assets/aistudio/Logo-01_264a2645.jpg" alt="JiedeEdu" class="footer-brand-logo-img" />
        </div>
        <p>A practical path to learning Chinese.</p>
      </div>

      <div class="footer-links">
        <h4 class="footer-title">Navigation</h4>
        <a href="index.html#home">Home</a>
        <a href="story.html">Stories</a>
        <a href="reels.html">Reels</a>
        <a href="games.html">Games</a>
        <a href="lessons.html">Lessons</a>
      </div>

      <div class="footer-contact">
        <h4 class="footer-title">Contact Us</h4>
        <ul class="contact-list" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
          <li>
            <a href="mailto:syndkyaw@gmail.com" data-footer-contact="email-link" class="contact-item" style="display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none;">
              <span class="contact-icon" aria-hidden="true">✉️</span>
              <div class="contact-details">
                <span class="contact-label" style="display: block; font-size: 0.75rem; color: #64748b;">Email</span>
                <span class="contact-value" data-footer-contact="email-value" style="font-weight: 600; font-size: 0.9rem;">syndkyaw@gmail.com</span>
              </div>
            </a>
          </li>
          <li>
            <a href="tel:+959798123456" data-footer-contact="phone-link" class="contact-item" style="display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none;">
              <span class="contact-icon" aria-hidden="true">📞</span>
              <div class="contact-details">
                <span class="contact-label" style="display: block; font-size: 0.75rem; color: #64748b;">Phone (Myanmar)</span>
                <span class="contact-value" data-footer-contact="phone-value" style="font-weight: 600; font-size: 0.9rem;">+95 9 798 123 456</span>
              </div>
            </a>
          </li>
          <li>
            <a href="viber://chat?number=%2B959798123456" data-footer-contact="viber-link" class="contact-item" title="Chat on Viber" style="display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none;">
              <span class="contact-icon" aria-hidden="true">💬</span>
              <div class="contact-details">
                <span class="contact-label" style="display: block; font-size: 0.75rem; color: #64748b;">Viber (Myanmar)</span>
                <span class="contact-value" data-footer-contact="viber-value" style="font-weight: 600; font-size: 0.9rem;">+95 9 798 123 456</span>
              </div>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="container">
        <p>© 2026 JiedeEdu. All rights reserved. Practical Chinese Learning.</p>
      </div>
    </div>
  </footer>
  `;

  function cleanTel(phone) {
    return String(phone || '').replace(/[^+\d]/g, '');
  }

  function resolveFooterLogoUrl(url) {
    const clean = String(url || '').trim();
    if (!clean) return '';
    if (window.LinguaBackend && typeof window.LinguaBackend.assetUrl === 'function') {
      return window.LinguaBackend.assetUrl(clean);
    }
    return clean;
  }

  const DEFAULT_FOOTER_LOGO_HTML = '<img src="public/assets/aistudio/Logo-01_264a2645.jpg" alt="JiedeEdu" class="footer-brand-logo-img" />';

  function hydrateFooterContact(cfg) {
    if (!cfg) return;
    const footer = document.querySelector('footer.site-footer');
    if (!footer) return;

    const footerLogoEl = footer.querySelector('.footer-logo');
    if (footerLogoEl) {
      const rawLogo = typeof cfg.siteLogoUrl === 'string' ? cfg.siteLogoUrl.trim() : '';
      if (!rawLogo) {
        footerLogoEl.classList.remove('has-custom-logo');
        footerLogoEl.innerHTML = DEFAULT_FOOTER_LOGO_HTML;
      } else {
        footerLogoEl.classList.add('has-custom-logo');
        footerLogoEl.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'footer-brand-logo-img';
        img.src = resolveFooterLogoUrl(rawLogo);
        img.alt = 'JiedeEdu';
        img.decoding = 'async';
        img.onerror = function () {
          footerLogoEl.classList.remove('has-custom-logo');
          footerLogoEl.innerHTML = DEFAULT_FOOTER_LOGO_HTML;
        };
        footerLogoEl.appendChild(img);
      }
    }

    const email = String(cfg.contactEmail || 'syndkyaw@gmail.com').trim();
    const phone = String(cfg.contactPhone || '+95 9 798 123 456').trim();
    const viber = String(cfg.contactViber || phone || '+95 9 798 123 456').trim();

    const items = footer.querySelectorAll('.contact-list a.contact-item');
    const emailLink = footer.querySelector('[data-footer-contact="email-link"]') || items[0];
    const phoneLink = footer.querySelector('[data-footer-contact="phone-link"]') || items[1];
    const viberLink = footer.querySelector('[data-footer-contact="viber-link"]') || items[2];

    if (emailLink) {
      emailLink.setAttribute('href', `mailto:${email}`);
      const valEl = emailLink.querySelector('.contact-value');
      if (valEl) valEl.textContent = email;
    }
    if (phoneLink) {
      const tel = cleanTel(phone) || '+959798123456';
      phoneLink.setAttribute('href', `tel:${tel}`);
      const valEl = phoneLink.querySelector('.contact-value');
      if (valEl) valEl.textContent = phone;
    }
    if (viberLink) {
      const vib = cleanTel(viber) || '+959798123456';
      viberLink.setAttribute('href', `viber://chat?number=${encodeURIComponent(vib)}`);
      const valEl = viberLink.querySelector('.contact-value');
      if (valEl) valEl.textContent = viber;
    }
  }

  async function resolveAndHydrateFooter() {
    if (window.LinguaAuth && typeof window.LinguaAuth.getSiteConfig === 'function') {
      hydrateFooterContact(window.LinguaAuth.getSiteConfig());
      return;
    }
    try {
      const apiPath = '/api/site-config?t=' + Date.now();
      const url = window.LinguaBackend ? window.LinguaBackend.apiUrl(apiPath) : apiPath;
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && j.config) hydrateFooterContact(j.config);
      }
    } catch (e) {}
  }

  async function injectFooter() {
    let htmlContent = FALLBACK_FOOTER_HTML;
    try {
      const res = await fetch('footer.html?t=' + Date.now());
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith('<footer')) {
          htmlContent = text;
        }
      }
    } catch (e) {
      console.warn('Footer fetch note (using fallback):', e);
    }

    const container = document.getElementById('sharedFooter');
    if (container) {
      container.innerHTML = htmlContent;
    } else {
      const existing = document.querySelector('footer.site-footer');
      if (existing) {
        existing.outerHTML = htmlContent;
      } else {
        document.body.insertAdjacentHTML('beforeend', htmlContent);
      }
    }

    resolveAndHydrateFooter();
  }

  window.addEventListener('lingua-site-config-change', function (e) {
    hydrateFooterContact(e.detail);
  });

  window.addEventListener('lingua-auth-change', function (e) {
    if (e.detail && e.detail.siteConfig) {
      hydrateFooterContact(e.detail.siteConfig);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
