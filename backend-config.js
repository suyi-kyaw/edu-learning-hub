/**
 * =========================================================
 * LINGUAPATH - RUNTIME BACKEND & MEDIA ASSET URL RESOLVER
 * Allows the static GitHub Pages frontend (suyi-kyaw.github.io)
 * to connect seamlessly to a separately hosted HTTPS Node server
 * while keeping same-origin /api/* working locally and in preview.
 * =========================================================
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'linguapath_backend_url';

  // Optional: Paste your deployed HTTPS Node backend URL here so all public visitors
  // on suyi-kyaw.github.io connect automatically without manual Admin Portal setup.
  // Example: 'https://linguapath-server.onrender.com'
  var DEFAULT_PRODUCTION_BACKEND_URL = '';

  function normalizeBaseUrl(raw) {
    var trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '');
  }

  function isValidHttpUrl(url) {
    return /^https?:\/\/[^/\s]+/i.test(String(url || '').trim());
  }

  function isMixedContentUrl(url) {
    var clean = normalizeBaseUrl(url);
    if (!clean) return false;
    var isHttpsPage = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
    if (!isHttpsPage) return false;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(clean)) return false;
    return /^http:\/\//i.test(clean);
  }

  function isStaticGithubHost() {
    if (typeof window === 'undefined' || !window.location) return false;
    var host = String(window.location.hostname || '').toLowerCase();
    var proto = String(window.location.protocol || '').toLowerCase();
    return host.endsWith('.github.io') || host === 'github.io' || proto === 'file:';
  }

  // Allow sharing a pre-connected Admin link via ?apiBase=https://...
  (function applyQueryOverride() {
    try {
      if (typeof window === 'undefined' || !window.location) return;
      var params = new URLSearchParams(window.location.search);
      var qBase = params.get('apiBase');
      if (qBase === null) return;
      var cleaned = normalizeBaseUrl(qBase);
      if (cleaned === 'reset' || cleaned === 'clear' || cleaned === 'local' || cleaned === '') {
        localStorage.removeItem(STORAGE_KEY);
      } else if (isValidHttpUrl(cleaned) && !isMixedContentUrl(cleaned)) {
        localStorage.setItem(STORAGE_KEY, cleaned);
      }
    } catch (_) {}
  })();

  function getStoredOverride() {
    try {
      return normalizeBaseUrl(localStorage.getItem(STORAGE_KEY) || '');
    } catch (_) {
      return '';
    }
  }

  function getMetaOverride() {
    try {
      if (typeof document === 'undefined') return '';
      var meta = document.querySelector('meta[name="linguapath-api-base"]');
      return meta ? normalizeBaseUrl(meta.getAttribute('content') || '') : '';
    } catch (_) {
      return '';
    }
  }

  function getApiBase() {
    return '';
  }

  function hasBackend() {
    return false;
  }

  function dispatchConfigChange() {
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('linguapath-backend-change', {
            detail: {
              apiBase: getApiBase(),
              hasBackend: hasBackend(),
              isStaticHost: isStaticGithubHost()
            }
          })
        );
      }
    } catch (_) {}
  }

  function setApiBase(rawUrl) {
    var clean = normalizeBaseUrl(rawUrl);
    if (!clean) {
      return clearApiBase();
    }
    if (!isValidHttpUrl(clean)) {
      throw new Error('Backend URL must start with https:// (or http://localhost for local dev).');
    }
    if (isMixedContentUrl(clean)) {
      throw new Error('Because this page loads over HTTPS, your Node server URL must use https://.');
    }
    try {
      localStorage.setItem(STORAGE_KEY, clean);
    } catch (_) {}
    dispatchConfigChange();
    return clean;
  }

  function clearApiBase() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    dispatchConfigChange();
    return '';
  }

  function apiUrl(path) {
    var raw = String(path || '').trim();
    if (!raw) return getApiBase();
    if (/^https?:\/\//i.test(raw)) return raw;
    var cleanPath = raw.charAt(0) === '/' ? raw : '/' + raw;
    var base = getApiBase();
    return base ? base + cleanPath : cleanPath;
  }

  function assetUrl(path) {
    var trimmed = String(path || '').trim();
    if (!trimmed || /^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    var cleanNoLeading = trimmed.replace(/^\/+/, '');
    var base = getApiBase();
    if (base && cleanNoLeading.indexOf('assets/uploads/') === 0) {
      return base + '/' + cleanNoLeading;
    }
    return trimmed;
  }

  async function testConnection(candidateUrl) {
    var clean = normalizeBaseUrl(candidateUrl !== undefined ? candidateUrl : getApiBase());
    if (!clean) {
      if (isStaticGithubHost()) {
        return {
          ok: false,
          error: 'Enter your hosted Node backend HTTPS URL first (GitHub Pages cannot run Node APIs).'
        };
      }
    } else {
      if (!isValidHttpUrl(clean)) {
        return {
          ok: false,
          error: 'URL must start with https:// (e.g. https://linguapath-server.onrender.com).'
        };
      }
      if (isMixedContentUrl(clean)) {
        return {
          ok: false,
          mixedContent: true,
          error: 'HTTPS GitHub Pages blocks plain http:// servers. Use your hosted Node server https:// URL.'
        };
      }
    }

    var probeUrl = (clean ? clean : '') + '/api/site-config?t=' + Date.now();
    var started = Date.now();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 9500) : null;

    try {
      var res = await fetch(probeUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });
      var latencyMs = Date.now() - started;
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          latencyMs: latencyMs,
          error: 'Server responded with HTTP ' + res.status + '. Check that your Node backend is running.'
        };
      }
      var data = await res.json();
      if (!data || (!data.success && !data.config)) {
        return {
          ok: false,
          latencyMs: latencyMs,
          error: 'Server responded, but /api/site-config did not return LinguaPath JSON.'
        };
      }
      return {
        ok: true,
        url: clean,
        latencyMs: latencyMs,
        config: data.config || null
      };
    } catch (err) {
      var isAbort = err && err.name === 'AbortError';
      return {
        ok: false,
        corsOrNetwork: true,
        error: isAbort
          ? 'Connection timed out after 9.5s. If using a free-tier Node host, wake it up and test again.'
          : 'Could not reach server over HTTPS/CORS. Verify the URL is live and uses updated LinguaPath server CORS headers.'
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  global.LinguaBackend = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_PRODUCTION_BACKEND_URL: DEFAULT_PRODUCTION_BACKEND_URL,
    isStaticGithubHost: isStaticGithubHost,
    isValidHttpUrl: isValidHttpUrl,
    isMixedContentUrl: isMixedContentUrl,
    getApiBase: getApiBase,
    getStoredOverride: getStoredOverride,
    hasBackend: hasBackend,
    setApiBase: setApiBase,
    clearApiBase: clearApiBase,
    apiUrl: apiUrl,
    assetUrl: assetUrl,
    testConnection: testConnection
  };
})(typeof window !== 'undefined' ? window : globalThis);
