// Shared building blocks that make the HTML views behave like an installed app:
// PWA meta tags, launch splash, cross-document view transitions and scroll restoration.
// Kept free of imports so scripts/generate-pwa-assets.mjs can load it directly with Node.

export const THEME_COLOR = "#111827";
export const BACKGROUND_COLOR = "#0b0f19";

// iPhone portrait screen sizes in CSS pixels, used for apple-touch-startup-image
export const STARTUP_IMAGES = [
  { width: 440, height: 956, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 428, height: 926, ratio: 3 },
  { width: 414, height: 896, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 402, height: 874, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 375, height: 812, ratio: 3 },
  { width: 375, height: 667, ratio: 2 },
];

export const startupImagePath = (image: {
  width: number;
  height: number;
  ratio: number;
}): string =>
  `/splash/apple-splash-${image.width * image.ratio}x${image.height * image.ratio}.png`;

// Launch splash: the iOS startup images are rendered from exactly this markup,
// so the in-app splash picks up seamlessly where the native one ends.
export const SPLASH_CSS = `
        #app-splash {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            background: ${BACKGROUND_COLOR};
        }
        .show-splash #app-splash,
        .splash-out #app-splash {
            display: flex;
        }
        .splash-orb {
            position: relative;
            width: 96px;
            height: 96px;
        }
        .splash-orb::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.55) 0%, rgba(56, 189, 248, 0.18) 40%, rgba(56, 189, 248, 0) 70%);
        }
        .splash-orb::after {
            content: "";
            position: absolute;
            inset: 30px;
            border-radius: 50%;
            background: radial-gradient(circle at 42% 38%, #e0f7ff 0%, #7dd3fc 35%, #38bdf8 70%, #0ea5e9 100%);
            box-shadow: 0 0 18px rgba(56, 189, 248, 0.9), 0 0 42px rgba(56, 189, 248, 0.45);
        }
        .splash-ring {
            position: absolute;
            inset: 20px;
            border-radius: 50%;
            border: 1.5px solid rgba(125, 211, 252, 0.45);
        }`;

export const SPLASH_MARKUP = `<div id="app-splash" aria-hidden="true"><div class="splash-orb"><div class="splash-ring"></div></div></div>`;

const APP_CSS = `
        html {
            background-color: ${BACKGROUND_COLOR};
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
        }
        body {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }
        ${SPLASH_CSS}
        .splash-out #app-splash {
            pointer-events: none;
            animation: splash-fade 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .splash-out .splash-orb {
            animation: splash-orb-out 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .show-splash .splash-ring {
            animation: splash-ring-pulse 1.4s ease-out infinite;
        }
        @keyframes splash-fade {
            to { opacity: 0; }
        }
        @keyframes splash-orb-out {
            to { transform: scale(1.6); opacity: 0; }
        }
        @keyframes splash-ring-pulse {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1.9); opacity: 0; }
        }

        /* Top loading bar for navigations that wait on the server */
        #nav-progress {
            position: fixed;
            top: env(safe-area-inset-top, 0px);
            left: 0;
            height: 2px;
            width: 0;
            z-index: 1000;
            background: linear-gradient(90deg, #38bdf8, #7dd3fc);
            box-shadow: 0 0 8px rgba(56, 189, 248, 0.8);
            opacity: 0;
            pointer-events: none;
        }
        html.is-navigating #nav-progress {
            opacity: 1;
            width: 88%;
            transition: width 6s cubic-bezier(0.1, 0.7, 0.2, 1), opacity 0.2s;
        }

        /* Toast notifications */
        #app-toast {
            position: fixed;
            left: 50%;
            bottom: calc(24px + env(safe-area-inset-bottom, 0px));
            transform: translate(-50%, 16px);
            z-index: 1000;
            max-width: calc(100% - 32px);
            padding: 9px 16px;
            border-radius: 999px;
            background: rgba(31, 41, 55, 0.92);
            -webkit-backdrop-filter: blur(16px);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
            color: #f3f4f6;
            font-size: 0.82rem;
            font-weight: 500;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        #app-toast.is-visible {
            opacity: 1;
            transform: translate(-50%, 0);
        }

        /* Cross-document view transitions (Chrome 126+, Safari 18.2+) */
        @view-transition {
            navigation: auto;
        }
        ::view-transition-group(*) {
            animation-duration: 0.38s;
            animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        ::view-transition-group(app-header) {
            overflow: clip;
        }
        ::view-transition-old(root),
        ::view-transition-new(root) {
            animation-duration: 0.22s;
        }

        /* Push: the next page slides in from the right over the current one */
        html.vt-push::view-transition-old(root),
        html.vt-push::view-transition-new(root),
        html.vt-pop::view-transition-old(root),
        html.vt-pop::view-transition-new(root) {
            mix-blend-mode: normal;
            animation-duration: 0.42s;
            animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        html.vt-push::view-transition-old(root) {
            animation-name: vt-shift-out-left;
        }
        html.vt-push::view-transition-new(root) {
            animation-name: vt-slide-in-right;
            box-shadow: -12px 0 32px rgba(0, 0, 0, 0.45);
        }
        /* Pop: the current page slides away to the right, revealing the previous one */
        html.vt-pop::view-transition-old(root) {
            z-index: 1;
            animation-name: vt-slide-out-right;
            box-shadow: -12px 0 32px rgba(0, 0, 0, 0.45);
        }
        html.vt-pop::view-transition-new(root) {
            animation-name: vt-shift-in-left;
        }

        /* Switching feeds: header stays, list glides sideways */
        html.vt-tab-next::view-transition-old(root),
        html.vt-tab-next::view-transition-new(root),
        html.vt-tab-prev::view-transition-old(root),
        html.vt-tab-prev::view-transition-new(root) {
            animation: none;
        }
        html.vt-tab-next::view-transition-old(feed-list) {
            animation: 0.3s cubic-bezier(0.4, 0, 1, 1) both vt-list-out-left;
        }
        html.vt-tab-next::view-transition-new(feed-list) {
            animation: 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) 0.06s both vt-list-in-right;
        }
        html.vt-tab-prev::view-transition-old(feed-list) {
            animation: 0.3s cubic-bezier(0.4, 0, 1, 1) both vt-list-out-right;
        }
        html.vt-tab-prev::view-transition-new(feed-list) {
            animation: 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) 0.06s both vt-list-in-left;
        }

        /* After an edge swipe the page is already gone, just settle the previous one */
        html.vt-swipe-back::view-transition-old(root) {
            animation: none;
            opacity: 0;
        }
        html.vt-swipe-back::view-transition-new(root) {
            animation: 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both vt-shift-in-left;
        }

        @keyframes vt-slide-in-right {
            from { transform: translateX(100%); }
        }
        @keyframes vt-slide-out-right {
            to { transform: translateX(100%); }
        }
        @keyframes vt-shift-out-left {
            to { transform: translateX(-28%); filter: brightness(0.6); }
        }
        @keyframes vt-shift-in-left {
            from { transform: translateX(-28%); filter: brightness(0.6); }
        }
        @keyframes vt-list-out-left {
            to { transform: translateX(-18%); opacity: 0; }
        }
        @keyframes vt-list-in-right {
            from { transform: translateX(18%); opacity: 0; }
        }
        @keyframes vt-list-out-right {
            to { transform: translateX(18%); opacity: 0; }
        }
        @keyframes vt-list-in-left {
            from { transform: translateX(-18%); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
            @view-transition {
                navigation: none;
            }
            .splash-out #app-splash,
            .splash-out .splash-orb,
            .show-splash .splash-ring {
                animation-duration: 0.01s;
            }
        }`;

// Runs in <head> before first paint: marks standalone mode, decides whether to show the
// launch splash and wires up the cross-document view transition bookkeeping.
const EARLY_SCRIPT = `
        (function () {
            var root = document.documentElement;
            var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            var TRANSITION_KEY = 'tldr-vt';
            var readTransition = function () {
                try { return JSON.parse(sessionStorage.getItem(TRANSITION_KEY) || 'null'); } catch (e) { return null; }
            };
            var navEntry = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
            var pending = readTransition();

            if (standalone) root.classList.add('is-standalone');
            try {
                if (standalone && !sessionStorage.getItem('tldr-launched')) {
                    root.classList.add('show-splash');
                    sessionStorage.setItem('tldr-launched', '1');
                }
            } catch (e) {}
            if ((pending && (pending.type === 'pop' || pending.type === 'swipe-back')) || (navEntry && navEntry.type === 'back_forward')) {
                root.classList.add('is-back-nav');
            }

            window.tldrApp = {
                standalone: standalone,
                setTransition: function (transition) {
                    try { sessionStorage.setItem(TRANSITION_KEY, JSON.stringify(transition)); } catch (e) {}
                },
                clearSharedNames: function () {
                    document.querySelectorAll('[data-vt-shared]').forEach(function (el) {
                        el.style.viewTransitionName = '';
                        el.removeAttribute('data-vt-shared');
                    });
                },
                nameShared: function (el, name) {
                    if (!el) return;
                    el.style.viewTransitionName = name;
                    el.setAttribute('data-vt-shared', '');
                },
                startNavigation: function () {
                    root.classList.add('is-navigating');
                },
                toast: function (message, duration) {
                    var toast = document.getElementById('app-toast');
                    if (!toast) return;
                    toast.textContent = message;
                    toast.classList.add('is-visible');
                    clearTimeout(toast._timer);
                    toast._timer = setTimeout(function () { toast.classList.remove('is-visible'); }, duration || 2200);
                },
                haptic: function () {
                    if (navigator.vibrate) navigator.vibrate(8);
                },
                // Runs fn(transition, hasViewTransition) once the page is revealed (and again on bfcache restores)
                whenRevealed: function (fn) {
                    revealCallbacks.push(fn);
                    if (lastReveal) fn(lastReveal.transition, lastReveal.hasViewTransition);
                }
            };
            var revealCallbacks = [];
            var lastReveal = null;
            var reveal = function (transition, hasViewTransition) {
                lastReveal = { transition: transition, hasViewTransition: hasViewTransition };
                revealCallbacks.forEach(function (fn) { fn(transition, hasViewTransition); });
            };
            var consumeTransition = function () {
                var transition = readTransition();
                try { sessionStorage.removeItem(TRANSITION_KEY); } catch (err) {}
                return transition;
            };

            window.addEventListener('pageswap', function (e) {
                // System back gestures don't pass through our click handlers
                if (e.viewTransition && !readTransition() && e.activation && e.activation.navigationType === 'traverse') {
                    var articleUrl = new URLSearchParams(location.search).get('url');
                    window.tldrApp.setTransition({ type: 'pop', link: articleUrl });
                }
            });

            if ('onpagereveal' in window) {
                window.addEventListener('pagereveal', function (e) {
                    var transition = consumeTransition();
                    if (e.viewTransition) {
                        startTransition(e.viewTransition, transition);
                    }
                    reveal(transition, !!e.viewTransition);
                });
            } else {
                document.addEventListener('DOMContentLoaded', function () {
                    reveal(consumeTransition(), false);
                });
            }

            function startTransition(viewTransition, transition) {
                root.classList.add('no-stagger');
                var type = transition ? transition.type : 'fade';
                root.classList.add('vt-' + type);
                viewTransition.finished.finally(function () {
                    root.classList.remove('vt-' + type);
                    window.tldrApp.clearSharedNames();
                });
            }

            // Restored from the back/forward cache: drop the loading state of the old navigation
            window.addEventListener('pageshow', function (e) {
                root.classList.remove('is-navigating');
                if (e.persisted) root.classList.add('no-stagger');
            });

            if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                    navigator.serviceWorker.register('/sw.js').catch(function (err) {
                        console.error('Service worker registration failed:', err);
                    });
                });
            }
        })();`;

// Fades out the launch splash once the page is ready
const SPLASH_SCRIPT = `
        (function () {
            var root = document.documentElement;
            if (!root.classList.contains('show-splash')) return;
            var shownAt = performance.now();
            var hide = function () {
                var wait = Math.max(0, 550 - (performance.now() - shownAt));
                setTimeout(function () {
                    root.classList.add('splash-out');
                    root.classList.remove('show-splash');
                    setTimeout(function () { root.classList.remove('splash-out'); }, 500);
                }, wait);
            };
            if (document.readyState === 'complete') hide();
            else window.addEventListener('load', hide);
            // Never keep the user waiting on slow images
            setTimeout(hide, 1800);
        })();`;

export const renderPwaHead = (): string => {
  const startupImages = STARTUP_IMAGES.map(
    (image) =>
      `<link rel="apple-touch-startup-image" media="(device-width: ${image.width}px) and (device-height: ${image.height}px) and (-webkit-device-pixel-ratio: ${image.ratio}) and (orientation: portrait)" href="${startupImagePath(image)}">`,
  ).join("\n    ");

  return `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="${THEME_COLOR}">
    <meta name="color-scheme" content="dark">
    <meta name="format-detection" content="telephone=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="TLDR">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    ${startupImages}
    <link rel="expect" href="#app-ready" blocking="render">
    <style>${APP_CSS}
    </style>
    <script>${EARLY_SCRIPT}
    </script>`;
};

// Placed first in <body>
export const renderPwaBodyStart = (): string => `${SPLASH_MARKUP}
    <div id="nav-progress"></div>
    <div id="app-toast" role="status" aria-live="polite"></div>
    <script>${SPLASH_SCRIPT}
    </script>`;

// Placed last in <body>: first paint (and the view transition snapshot) waits until
// everything before it, including the page scripts, has been parsed
export const PWA_BODY_END = `<span id="app-ready" hidden></span>`;
