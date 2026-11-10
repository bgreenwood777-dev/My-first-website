'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, 'config', 'business.json');
const LEADS_FILE = path.join(__dirname, 'data', 'leads.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Config -------------------------------------------------------------
function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).business;
}

app.get('/api/config', (req, res) => {
  try {
    res.json(readConfig());
  } catch (err) {
    res.status(500).json({ error: 'Unable to load business configuration.' });
  }
});

// ---- Leads storage ------------------------------------------------------
function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLeads(leads) {
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

const VALID_STATUSES = new Set(['New', 'Contacted', 'Scheduled', 'Completed']);

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return typeof value === 'string' && value.replace(/\D/g, '').length >= 7;
}

// ---- API: create a lead (public form endpoint) ---------------------------
app.post('/api/leads', (req, res) => {
  const body = req.body || {};

  // Honeypot: bots that fill this get a fake success, nothing is stored.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return res.status(201).json({ ok: true });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const service = typeof body.service === 'string' ? body.service.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  const errors = {};
  if (!name) errors.name = 'Please enter your name.';
  if (!isValidPhone(phone)) errors.phone = 'Please enter a valid phone number.';
  if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.';
  if (!address) errors.address = 'Please enter the service address.';
  if (!service) errors.service = 'Please choose a service.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  const config = readConfig();
  if (!config.services.some((s) => s.title === service)) {
    return res.status(400).json({ ok: false, errors: { service: 'Please choose a service from the list.' } });
  }

  const lead = {
    id: 'lead_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    receivedAt: new Date().toISOString(),
    name,
    phone,
    email,
    address,
    service,
    message,
    status: 'New'
  };

  const leads = readLeads();
  leads.push(lead);
  writeLeads(leads);

  res.status(201).json({ ok: true, id: lead.id });
});

// ---- API: list leads (admin) --------------------------------------------
app.get('/api/leads', requireAdmin, (req, res) => {
  const leads = readLeads();
  leads.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1)); // newest first
  res.json({ ok: true, leads });
});

// ---- API: update lead status (admin) ------------------------------------
app.patch('/api/leads/:id/status', requireAdmin, (req, res) => {
  const status = typeof (req.body || {}).status === 'string' ? req.body.status.trim() : '';
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: 'Invalid status.' });
  }

  const leads = readLeads();
  const lead = leads.find((l) => l.id === req.params.id);
  if (!lead) {
    return res.status(404).json({ ok: false, error: 'Lead not found.' });
  }

  lead.status = status;
  writeLeads(leads);
  res.json({ ok: true, lead });
});

// ---- Admin auth: simple basic-auth guard --------------------------------
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Basic (.+)$/i.exec(header);
  if (match) {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx !== -1) {
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      if (user === (process.env.ADMIN_USER || 'admin') && pass === (process.env.ADMIN_PASSWORD || 'changeme')) {
        return next();
      }
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
  res.status(401).json({ ok: false, error: 'Unauthorized' });
}

// ---- Admin page (behind the same basic-auth guard) ----------------------
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.js', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.js'));
});

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`Summit Heating & Air website running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin (basic auth: ${process.env.ADMIN_USER || 'admin'} / set ADMIN_PASSWORD)`);
});
