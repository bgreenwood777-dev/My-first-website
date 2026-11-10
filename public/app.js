/* Summit Heating & Air — renders all business copy from /api/config. */
(function () {
  'use strict';

  var state = { config: null };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var SERVICE_ICONS = [
    /* AC Repair */ '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3.2"/><path d="M6.2 6.2l3.1 3.1M14.7 14.7l3.1 3.1M17.8 6.2l-3.1 3.1M9.3 14.7l-3.1 3.1"/></svg>',
    /* Heating */ '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.8 2.4 4.5 4.6 4.5 8.2a4.5 4.5 0 0 1-9 0C7.5 7.6 10.2 5.4 12 3z"/><path d="M8 20h8M9.5 17h5"/></svg>',
    /* Installation */ '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/></svg>',
    /* Maintenance */ '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5a4 4 0 0 0-5.6 5L4 16.4V20h3.6l4.9-4.9a4 4 0 0 0 5-5.6L14.6 12l-2.6-2.6 2.5-2.9z"/></svg>',
    /* Emergency */ '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>'
  ];

  function applyColors(colors) {
    if (!colors) return;
    var root = document.documentElement.style;
    if (colors.primary) root.setProperty('--primary', colors.primary);
    if (colors.accent) root.setProperty('--accent', colors.accent);
  }

  function renderChrome(cfg) {
    document.title = cfg.name;
    $('brand-name').textContent = cfg.name;
    $('hero-headline').textContent = cfg.hero.headline;
    $('hero-subhead').textContent = cfg.hero.subhead;

    var phoneLinks = ['header-phone', 'hero-phone', 'request-phone', 'footer-phone'];
    phoneLinks.forEach(function (id) {
      var el = $(id);
      el.href = cfg.phoneHref;
      if (id === 'request-phone') el.textContent = 'Call ' + cfg.phoneDisplay;
      else el.textContent = cfg.phoneDisplay;
    });

    $('footer-name').textContent = cfg.name;
    $('footer-tagline').textContent = cfg.tagline;
    $('footer-email').textContent = cfg.email;
    $('footer-email').href = 'mailto:' + cfg.email;
    $('footer-areas').textContent = cfg.serviceAreas.join(' · ');
    $('footer-copy').textContent = '© ' + new Date().getFullYear() + ' ' + cfg.name;
  }

  function renderServices(cfg) {
    var grid = $('services-grid');
    grid.className = 'cards services-grid-5';
    grid.innerHTML = cfg.services.map(function (svc, i) {
      return '<article class="card service-card">' +
        '<div class="service-icon">' + (SERVICE_ICONS[i % SERVICE_ICONS.length]) + '</div>' +
        '<h3>' + esc(svc.title) + '</h3>' +
        '<p>' + esc(svc.blurb) + '</p>' +
        '</article>';
    }).join('');
  }

  function renderTrust(cfg) {
    $('trust-items').innerHTML = cfg.trust.map(function (t) {
      return '<span class="trust-item">' + esc(t.label) + '</span>';
    }).join('');
  }

  function renderTestimonials(cfg) {
    $('testimonials-grid').innerHTML = cfg.testimonials.map(function (t) {
      return '<article class="card review-card">' +
        '<p class="review-quote">“' + esc(t.quote) + '”</p>' +
        '<div class="review-meta">' +
        '<span class="review-who">' + esc(t.name) + ' <span class="review-city">· ' + esc(t.city) + '</span></span>' +
        '<span class="chip">Sample</span>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function renderDemoMode(cfg) {
    if (cfg.demoMode) {
      $('demo-banner').hidden = false;
      $('footer-demo-note').hidden = false;
    }
  }

  function fillServiceSelect(cfg) {
    var select = $('fld-service');
    cfg.services.forEach(function (svc) {
      var opt = document.createElement('option');
      opt.value = svc.title;
      opt.textContent = svc.title;
      select.appendChild(opt);
    });
  }

  /* ---- Form validation + submit ---- */
  function setError(field, msg) {
    var input = document.querySelector('[name="' + field + '"]');
    var errEl = document.querySelector('[data-error-for="' + field + '"]');
    if (input) input.classList.toggle('invalid', !!msg);
    if (errEl) {
      errEl.textContent = msg || '';
      errEl.classList.toggle('show', !!msg);
    }
  }

  function validate(form) {
    var errors = 0;
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    var address = form.address.value.trim();
    var service = form.service.value;

    if (!name) { setError('name', 'Please enter your name.'); errors++; } else setError('name');
    if (!phone || phone.replace(/\D/g, '').length < 7) { setError('phone', 'Please enter a valid phone number.'); errors++; } else setError('phone');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('email', 'Please enter a valid email address.'); errors++; } else setError('email');
    if (!address) { setError('address', 'Please enter the service address.'); errors++; } else setError('address');
    if (!service) { setError('service', 'Please choose a service.'); errors++; } else setError('service');
    return errors === 0;
  }

  function bindForm() {
    var form = $('lead-form');
    var btn = $('submit-btn');
    var success = $('form-success');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      success.hidden = true;
      if (!validate(form)) return;

      var payload = {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        address: form.address.value.trim(),
        service: form.service.value,
        message: form.message.value.trim(),
        company: form.company.value /* honeypot */
      };

      btn.disabled = true;
      btn.textContent = 'Sending…';

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.status === 400) {
          return res.json().then(function (data) {
            Object.keys(data.errors || {}).forEach(function (k) { setError(k, data.errors[k]); });
            throw new Error('validation');
          });
        }
        if (!res.ok) throw new Error('network');
        return res.json();
      }).then(function () {
        form.reset();
        ['name', 'phone', 'email', 'address', 'service'].forEach(function (f) { setError(f); });
        success.hidden = false;
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function (err) {
        if (err.message !== 'validation') {
          alert('Sorry — we could not send your request. Please call us instead.');
        }
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = 'Request My Free Estimate';
      });
    });
  }

  fetch('/api/config')
    .then(function (res) { if (!res.ok) throw new Error('config'); return res.json(); })
    .then(function (cfg) {
      state.config = cfg;
      applyColors(cfg.colors);
      renderDemoMode(cfg);
      renderChrome(cfg);
      renderServices(cfg);
      renderTrust(cfg);
      renderTestimonials(cfg);
      fillServiceSelect(cfg);
      bindForm();
    })
    .catch(function () {
      document.body.insertAdjacentHTML('afterbegin',
        '<p style="background:#dc2626;color:#fff;padding:10px 16px;margin:0;text-align:center">Site configuration failed to load. Please refresh, or call us.</p>');
    });
})();
