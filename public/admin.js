/* Admin dashboard — lead list with inline status updates. Requires basic auth (handled by /admin route). */
(function () {
  'use strict';

  var STATUSES = ['New', 'Contacted', 'Scheduled', 'Completed'];
  var leads = [];
  var authB64 = sessionStorage.getItem('adminAuth') || null;

  /* Browsers usually attach the basic-auth credentials from the /admin prompt
     automatically. If they don't (some browsers/flows), fall back to an
     explicit Authorization header after prompting once. */
  function authFetch(url, opts) {
    if (url.charAt(0) === '/') url = location.origin + url; // avoid resolving against a credentialed document base
    opts = opts || {};
    opts.headers = Object.assign({}, authB64 ? { 'Authorization': 'Basic ' + authB64 } : {}, opts.headers || {});
    return fetch(url, opts).then(function (res) {
      if (res.status !== 401 || authB64) return res;
      var user = prompt('Admin sign-in\nUsername:');
      if (user === null) return res;
      var pass = prompt('Admin sign-in\nPassword:');
      if (pass === null) return res;
      authB64 = btoa(user + ':' + pass);
      sessionStorage.setItem('adminAuth', authB64);
      opts.headers['Authorization'] = 'Basic ' + authB64;
      return fetch(url, opts);
    });
  }

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function renderChips() {
    $('status-chips').innerHTML = STATUSES.map(function (s) {
      var count = leads.filter(function (l) { return l.status === s; }).length;
      return '<span class="status-chip">' + s + ' <span class="count">' + count + '</span></span>';
    }).join('');
    $('lead-count').textContent = leads.length + (leads.length === 1 ? ' lead' : ' leads') + ' · newest first';
  }

  function renderLeads() {
    var list = $('leads-list');
    if (leads.length === 0) {
      list.innerHTML = '<div class="empty-state"><strong>No leads yet.</strong><p style="margin:6px 0 0">Submissions from the Request Service form will appear here.</p></div>';
      return;
    }
    list.innerHTML = leads.map(function (lead) {
      return '<article class="lead-card status-' + esc(lead.status) + '">' +
        '<div class="lead-top">' +
        '<h2 class="lead-name">' + esc(lead.name) + '</h2>' +
        '<p class="lead-time">Received ' + esc(formatTime(lead.receivedAt)) + '</p>' +
        '</div>' +
        '<div class="lead-grid">' +
        '<div><span class="lead-label">Phone</span><br /><a href="tel:' + esc(lead.phone.replace(/[^\d+]/g, '')) + '">' + esc(lead.phone) + '</a></div>' +
        '<div><span class="lead-label">Email</span><br /><a href="mailto:' + esc(lead.email) + '">' + esc(lead.email) + '</a></div>' +
        '<div><span class="lead-label">Address</span><br />' + esc(lead.address) + '</div>' +
        '</div>' +
        '<div><span class="lead-label">Service</span><br /><span class="lead-service">' + esc(lead.service) + '</span></div>' +
        (lead.message ? '<div class="lead-message">' + esc(lead.message) + '</div>' : '') +
        '<div class="lead-status" style="margin-top:14px">' +
        '<label for="status-' + esc(lead.id) + '" class="lead-label" style="margin:0">Status</label>' +
        '<select id="status-' + esc(lead.id) + '" data-lead-id="' + esc(lead.id) + '">' +
        STATUSES.map(function (s) {
          return '<option value="' + s + '"' + (s === lead.status ? ' selected' : '') + '>' + s + '</option>';
        }).join('') +
        '</select>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function load() {
    authFetch('/api/leads')
      .then(function (res) {
        if (res.status === 401) {
          $('leads-list').innerHTML = '<div class="empty-state"><strong>Not authorized.</strong><p style="margin:6px 0 0">Reload the page and sign in with the admin credentials.</p></div>';
          throw new Error('unauthorized');
        }
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then(function (data) {
        leads = data.leads || [];
        renderChips();
        renderLeads();
      })
      .catch(function (err) {
        if (err.message !== 'unauthorized') {
          $('leads-list').innerHTML = '<div class="empty-state">Could not load leads. <button class="btn-refresh" onclick="location.reload()" type="button" style="margin-left:8px">Retry</button></div>';
        }
      });
  }

  $('leads-list').addEventListener('change', function (e) {
    var select = e.target;
    if (!select.matches('select[data-lead-id]')) return;
    var id = select.getAttribute('data-lead-id');
    var status = select.value;

    authFetch('/api/leads/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    }).then(function (res) {
      if (!res.ok) throw new Error('update failed');
      return res.json();
    }).then(function (data) {
      var lead = leads.find(function (l) { return l.id === id; });
      if (lead) lead.status = data.lead.status;
      var card = select.closest('.lead-card');
      card.className = 'lead-card status-' + lead.status;
      renderChips();
    }).catch(function () {
      alert('Could not update status. Please try again.');
      load();
    });
  });

  $('refresh-btn').addEventListener('click', load);

  document.getElementById('admin-title').textContent =
    'Lead Dashboard — ' + (document.querySelector('.admin-header h1') ? 'Admin' : '');

  fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
    document.querySelector('.admin-header h1').textContent = 'Lead Dashboard — ' + cfg.name;
    document.title = 'Lead Dashboard — ' + cfg.name;
  }).catch(function () {});

  load();
})();
