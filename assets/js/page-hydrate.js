/**
 * page-hydrate.js
 * Reads /_content/*.json (specified via data-content-src on <body>)
 * and updates the page's text content to match, so CMS edits appear live.
 */
(function () {
  var src = document.body.getAttribute('data-content-src');
  if (!src) return;

  fetch(src)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;

      // ── Meta tags ──
      if (d.meta_title) document.title = d.meta_title;
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && d.meta_description) metaDesc.setAttribute('content', d.meta_description);

      // ── data-field attributes (used on contact / pricing / about pages) ──
      document.querySelectorAll('[data-field]').forEach(function (el) {
        var key = el.getAttribute('data-field');
        if (d[key] != null) el.textContent = d[key];
      });

      // ── Hero section (all page types) ──
      set('.page-hero .gold-tag', d.hero_tag);
      set('#page-heading', d.hero_h1);
      set('.hero-sub', d.hero_sub);

      // ── Service page intro (who-section) ──
      set('.who-section h2', d.intro_heading);

      var whoCard = document.querySelector('.who-card');
      if (whoCard && d.intro_quote) {
        var qps = whoCard.querySelectorAll('p');
        if (qps[1]) qps[1].textContent = d.intro_quote;
      }

      var introDiv = document.querySelector('.who-section .fade-up:not(.who-card)');
      if (introDiv) {
        var ips = introDiv.querySelectorAll('p');
        if (ips[0] && d.intro_para_1) ips[0].textContent = d.intro_para_1;
        if (ips[1] && d.intro_para_2) ips[1].textContent = d.intro_para_2;
      }

      // ── FAQs (service pages) ──
      if (Array.isArray(d.faqs)) {
        var grid = document.querySelector('.faq-grid');
        if (grid) {
          grid.innerHTML = d.faqs.map(function (faq) {
            return '<div class="faq-item fade-up visible">'
              + '<dt class="faq-q">' + esc(faq.question) + '</dt>'
              + '<dd class="faq-a">' + esc(faq.answer) + '</dd>'
              + '</div>';
          }).join('');
        }
      }

      // ── Contact page: hours table ──
      if (Array.isArray(d.hours)) {
        var tbody = document.querySelector('.hours-table tbody');
        if (tbody) {
          tbody.innerHTML = d.hours.map(function (row) {
            return '<tr><td>' + esc(row.days) + '</td><td>' + esc(row.hours) + '</td></tr>';
          }).join('');
        }
      }
      set('.hours-note', d.hours_note);

      // ── Our Story: numbered sections ──
      if (Array.isArray(d.sections)) {
        d.sections.forEach(function (sec, i) {
          var el = document.getElementById('section-' + i);
          if (!el) return;
          ['tag', 'heading', 'para_1', 'para_2', 'para_3'].forEach(function (f) {
            var child = el.querySelector('[data-field="' + f + '"]');
            if (child && sec[f] != null) child.textContent = sec[f];
          });
        });
      }

      // ── Our Story: values cards ──
      if (Array.isArray(d.values)) {
        document.querySelectorAll('[data-value-index]').forEach(function (el) {
          var i = parseInt(el.getAttribute('data-value-index'), 10);
          if (!d.values[i]) return;
          var titleEl = el.querySelector('[data-field="title"]');
          var textEl  = el.querySelector('[data-field="text"]');
          if (titleEl) titleEl.textContent = d.values[i].title;
          if (textEl)  textEl.textContent  = d.values[i].text;
        });
      }
    })
    .catch(function () {});

  function set(sel, val) {
    if (val == null) return;
    var el = document.querySelector(sel);
    if (el) el.textContent = val;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
