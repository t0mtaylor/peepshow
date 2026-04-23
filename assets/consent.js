/* peepshow — cookie + analytics consent
 *
 * Two trackers are wired: self-hosted Matomo + Google Analytics 4.
 * Neither loads until the visitor clicks Accept on the banner.
 * Choice stored in localStorage under `peepshow-consent`:
 *   "accepted" — load both trackers, hide banner
 *   "rejected" — load nothing, hide banner
 *   (null)     — show banner
 *
 * Links to /privacy/, /terms/, /cookies/ from the banner so a
 * visitor can read the full policy before deciding.
 */
(function () {
  "use strict";

  var KEY = "peepshow-consent";
  var ROOT = computeRoot();

  function computeRoot() {
    // Walk up the path segments until we hit site root.
    // `/sinks/sqlite/` -> `../../`, `/sinks/` -> `../`, `/` -> `./`
    var path = location.pathname.replace(/\/+$/, "/");
    var depth = (path.match(/\//g) || []).length - 1;
    if (depth < 1) return "./";
    return new Array(depth).fill("..").join("/") + "/";
  }

  function loadMatomo() {
    var _paq = (window._paq = window._paq || []);
    _paq.push(["setDocumentTitle", document.domain + "/" + document.title]);
    _paq.push(["setCookieDomain", "*.www.peepshow.dev"]);
    _paq.push(["trackPageView"]);
    _paq.push(["enableLinkTracking"]);
    var u = "https://st.rs.thetomtaylor.co.uk/";
    _paq.push(["setTrackerUrl", u + "matomo.php"]);
    _paq.push(["setSiteId", "31"]);
    var d = document,
      g = d.createElement("script"),
      s = d.getElementsByTagName("script")[0];
    g.async = true;
    g.src = u + "matomo.js";
    s.parentNode.insertBefore(g, s);
  }

  function loadGtag() {
    var id = "G-VRND18LG0L";
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", id, { anonymize_ip: true });
  }

  function loadAll() {
    try { loadMatomo(); } catch (e) { /* noop */ }
    try { loadGtag(); } catch (e) { /* noop */ }
  }

  function setChoice(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* noop */ }
  }
  function getChoice() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function injectBanner() {
    if (document.getElementById("cookie-banner")) return;
    var aside = document.createElement("aside");
    aside.className = "cookie-banner";
    aside.id = "cookie-banner";
    aside.setAttribute("role", "dialog");
    aside.setAttribute("aria-label", "Cookie and analytics preferences");
    aside.innerHTML =
      '<div class="cookie-banner__inner">' +
      '<p class="cookie-banner__copy">' +
      "<strong>Cookies.</strong> peepshow.dev uses privacy-friendly analytics " +
      "(self-hosted Matomo + anonymized Google Analytics) to count visits. " +
      "Nothing loads until you choose. " +
      '<a href="' + ROOT + 'cookies/">Cookies</a> · ' +
      '<a href="' + ROOT + 'privacy/">Privacy</a> · ' +
      '<a href="' + ROOT + 'terms/">Terms</a>' +
      "</p>" +
      '<div class="cookie-banner__actions">' +
      '<button type="button" class="cookie-btn cookie-btn--reject" data-consent="reject">Reject</button>' +
      '<button type="button" class="cookie-btn cookie-btn--accept" data-consent="accept">Accept</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(aside);
    requestAnimationFrame(function () {
      aside.classList.add("is-on");
    });
    aside.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!(t instanceof Element)) return;
      var btn = t.closest("[data-consent]");
      if (!btn) return;
      var choice = btn.getAttribute("data-consent");
      if (choice === "accept") {
        setChoice("accepted");
        loadAll();
      } else if (choice === "reject") {
        setChoice("rejected");
      }
      aside.classList.remove("is-on");
      setTimeout(function () { aside.remove(); }, 320);
    });
  }

  // Public API — lets a footer link revoke or re-open consent.
  window.peepshowConsent = {
    get: getChoice,
    accept: function () {
      setChoice("accepted");
      loadAll();
      var b = document.getElementById("cookie-banner");
      if (b) b.remove();
    },
    reject: function () {
      setChoice("rejected");
      var b = document.getElementById("cookie-banner");
      if (b) b.remove();
    },
    reopen: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
      injectBanner();
    },
  };

  function boot() {
    var choice = getChoice();
    if (choice === "accepted") {
      loadAll();
    } else if (choice !== "rejected") {
      injectBanner();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
