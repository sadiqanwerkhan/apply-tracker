/**
 * APPLY TRACKER — Phase 2: scan, classify, and show the application list.
 *
 * Phase 1 proved login + reading Gmail works.
 * Phase 2 adds the brain:
 *   - pick a date range on the home page
 *   - scan job-application emails in that range
 *   - extract company names (and roles for ATS senders)
 *   - classify each as Pending / Rejected / Advancing
 *   - show a results table
 *
 * Same logic we built and tested in the Apps Script, now using the Gmail API.
 * The UI is plain HTML for now — we make it a proper React dashboard in Phase 3.
 */

const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = 3000;

const MAX_MESSAGES = 200;   // safety cap on how many emails to scan
const CHUNK = 10;           // how many to fetch in parallel at once

app.use(session({
  secret: 'change-this-to-anything-random',
  resave: false,
  saveUninitialized: true,
}));

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
  );
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/* ============================================================
   KEYWORD LISTS (ported from the Apps Script — edit to tune)
   ============================================================ */
const REJECT_PHRASES = [
  // generic
  'unfortunately', 'we have decided to', 'not be moving forward', 'will not be proceeding',
  'decided to move forward with other', 'other candidates', 'not selected', 'regret to inform',
  'we will not be progressing', "won't be moving forward", 'decided not to proceed',
  'unable to offer', 'position has been filled', 'pursue other candidates',
  'not be progressing your application', 'no longer under consideration',
  'decided to proceed with other',
  // real phrasings pulled from actual rejection emails
  'decided not to move forward with your application',   // Agile Robots
  'not to move forward with your application',
  'decided to proceed with another candidate',           // IXOPay
  'proceed with another candidate',
  'moving forward with another candidate',               // Wandelbots
  'moved forward with another candidate',
  'ended up moving forward with another',
  // common close variants
  'move forward with another candidate', 'with other candidates', 'another applicant',
  'proceed with other candidates', 'decided to move forward with another',
  // German rejection phrases (add more as you get them)
  'leider müssen wir ihnen mitteilen', 'leider können wir', 'haben wir uns für andere',
  'andere kandidaten entschieden', 'nicht berücksichtigen', 'nicht erfolgreich',
  'anderweitig entschieden', 'leider eine absage', 'müssen wir ihnen leider'
];

const ADVANCE_PHRASES = [
  'we would like to invite', "we'd like to invite", 'invite you to', 'next round', 'next step',
  'schedule a call', 'schedule an interview', 'phone screen', 'technical interview',
  'coding challenge', 'technical assessment', 'take-home', 'take home', 'live coding',
  'system design', 'would like to speak', 'would like to meet', 'move forward with your application',
  'happy to inform', 'pleased to inform', 'interview with', 'book a time', 'set up a call',
  'available for a call', 'first interview', 'get to know you', 'hiring manager'
];

const CONFIRM_PHRASES = [
  'thank you for applying', 'thank you for your application', 'we have received your application',
  'application received', 'received your application', 'thanks for applying', 'successfully applied',
  'your application has been received', 'we appreciate your interest', 'application was sent'
];

const ATS_DOMAINS = [
  'greenhouse.io', 'lever.co', 'myworkday.com', 'workday.com', 'smartrecruiters.com',
  'personio.de', 'personio.com', 'ashbyhq.com', 'jobvite.com', 'icims.com', 'bamboohr.com',
  'recruitee.com', 'teamtailor.com', 'join.com', 'workable.com', 'breezy.hr',
  'gmail.com', 'googlemail.com', 'linkedin.com', 'indeed.com', 'indeedemail.com',
  'glassdoor.com', 'xing.com', 'stepstone.de', 'notifications.', 'noreply.', 'no-reply.'
];

/* ============================================================
   DATE HELPERS
   ============================================================ */
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function isoToGmail(iso, addDays = 0) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
function defaultStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return isoDate(d);
}
function defaultEndISO() {
  return isoDate(new Date());
}

/* ============================================================
   HOME PAGE
   ============================================================ */
app.get('/', (req, res) => {
  if (!req.session.tokens) {
    const url = makeOAuthClient().generateAuthUrl({
      access_type: 'offline', prompt: 'consent', scope: SCOPES,
    });
    return res.send(`
      <div style="font-family: sans-serif; max-width: 640px; margin: 60px auto;">
        <h1>Apply Tracker</h1>
        <p>Connect your Gmail to scan your job applications.</p>
        <p><a href="${url}" style="display:inline-block; padding:12px 20px; background:#1a73e8; color:#fff; text-decoration:none; border-radius:8px;">Connect Gmail</a></p>
      </div>
    `);
  }

  res.send(`
    <div style="font-family: sans-serif; max-width: 640px; margin: 60px auto;">
      <h1>Apply Tracker</h1>
      <p>Connected &#10003;  Pick a date range and scan.</p>
      <form action="/scan" method="get" style="margin:24px 0; display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap;">
        <label>From<br><input type="date" name="start" value="${defaultStartISO()}" style="padding:8px;"></label>
        <label>To<br><input type="date" name="end" value="${defaultEndISO()}" style="padding:8px;"></label>
        <button type="submit" style="padding:10px 20px; background:#1a73e8; color:#fff; border:none; border-radius:8px; cursor:pointer;">Scan my applications</button>
      </form>
      <p style="color:#666; font-size:13px;">Scanning may take a few seconds. Watch the terminal for progress.</p>
      <p><a href="/logout">Disconnect</a></p>
    </div>
  `);
});

/* ============================================================
   OAUTH CALLBACK
   ============================================================ */
app.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    const client = makeOAuthClient();
    const { tokens } = await client.getToken(code);
    req.session.tokens = tokens;
    res.redirect('/');
  } catch (err) {
    res.send('Login error: ' + err.message + '<br><a href="/">Try again</a>');
  }
});

/* ============================================================
   SCAN — the main feature
   ============================================================ */
app.get('/scan', async (req, res) => {
  if (!req.session.tokens) return res.redirect('/');

  const startISO = req.query.start || defaultStartISO();
  const endISO = req.query.end || defaultEndISO();
  const startG = isoToGmail(startISO);
  const endG = isoToGmail(endISO, 1); // +1 day so the end date is included

  try {
    const client = makeOAuthClient();
    client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const query = buildQuery(startG, endG);
    console.log('\nScanning:', query);

    // 1) collect message IDs (paginated, up to the cap)
    let ids = [];
    let pageToken = null;
    do {
      const resp = await gmail.users.messages.list({
        userId: 'me', q: query, maxResults: 100, pageToken,
      });
      (resp.data.messages || []).forEach(m => ids.push(m.id));
      pageToken = resp.data.nextPageToken;
    } while (pageToken && ids.length < MAX_MESSAGES);
    ids = ids.slice(0, MAX_MESSAGES);
    console.log('Found', ids.length, 'emails to read.');

    // 2) fetch them in parallel chunks (fast)
    const messages = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const got = await Promise.all(chunk.map(id =>
        gmail.users.messages.get({ userId: 'me', id, format: 'full' })
          .then(r => r.data).catch(() => null)
      ));
      got.forEach(m => { if (m) messages.push(m); });
      console.log('  read', Math.min(i + CHUNK, ids.length), 'of', ids.length);
    }

    // 3) classify + aggregate per company
    const byCompany = {};
    for (const msg of messages) {
      const headers = (msg.payload && msg.payload.headers) || [];
      const from = (headers.find(h => h.name === 'From') || {}).value || '';
      const subject = (headers.find(h => h.name === 'Subject') || {}).value || '';
      const date = new Date(parseInt(msg.internalDate, 10));

      const info = extractCompany(from);     // {name, isAts, sender}
      const role = extractRole(subject);

      let label, key;
      if (info.name) { label = info.name; key = info.name.toLowerCase(); }
      else if (role) { label = '(' + role + ')'; key = 'role:' + role.toLowerCase(); }
      else continue;

      const body = getBodyText(msg.payload);
      const hay = (subject + ' ' + body).toLowerCase();
      const result = classify(hay);

      if (!byCompany[key]) {
        byCompany[key] = {
          company: label, role, sender: info.sender, viaAts: info.isAts,
          hasReject: false, lastRejectDate: null,
          hasAdvance: false, lastAdvanceDate: null,
          hasConfirm: false, firstSeen: date, lastSeen: date,
          rejectSubject: '', advanceSubject: '',
          confidence: info.isAts ? 'Low' : 'High',
        };
      }
      const rec = byCompany[key];
      if (!rec.role && role) rec.role = role;
      if (date < rec.firstSeen) rec.firstSeen = date;
      if (date > rec.lastSeen) rec.lastSeen = date;

      if (result === 'Rejected') {
        rec.hasReject = true;
        if (!rec.lastRejectDate || date > rec.lastRejectDate) { rec.lastRejectDate = date; rec.rejectSubject = subject; }
      } else if (result === 'Advancing') {
        rec.hasAdvance = true;
        if (!rec.lastAdvanceDate || date > rec.lastAdvanceDate) { rec.lastAdvanceDate = date; rec.advanceSubject = subject; }
      } else if (result === 'Confirmed') {
        rec.hasConfirm = true;
      }
    }

    res.send(renderTable(byCompany, startISO, endISO));
  } catch (err) {
    console.error(err);
    res.send('Scan error: ' + err.message + '<br><a href="/">Back</a>');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* ============================================================
   LOGIC (ported from the Apps Script)
   ============================================================ */
function buildQuery(startG, endG) {
  const keywords = [
    '"thank you for applying"', '"your application"', 'application', 'applying',
    'interview', 'unfortunately', '"next step"', 'candidacy', '"move forward"',
    'recruiting', 'recruiter', 'position', 'role',
  ].join(' OR ');
  return `after:${startG} before:${endG} (${keywords})`;
}

function classify(text) {
  if (matchesAny(text, REJECT_PHRASES)) return 'Rejected';
  if (matchesAny(text, ADVANCE_PHRASES)) return 'Advancing';
  if (matchesAny(text, CONFIRM_PHRASES)) return 'Confirmed';
  return 'None';
}

function extractCompany(from) {
  if (!from) return { name: '', isAts: false, sender: '' };
  let displayName = '', email = '';
  const m = from.match(/^(.*?)<(.+?)>$/);
  if (m) { displayName = m[1].trim().replace(/["']/g, ''); email = m[2].trim().toLowerCase(); }
  else { email = from.trim().toLowerCase(); }

  const domain = (email.split('@')[1] || '');
  let isAts = false;
  for (const d of ATS_DOMAINS) { if (domain.indexOf(d) !== -1) { isAts = true; break; } }

  if (domain && !isAts) return { name: cleanDomain(domain), isAts: false, sender: email };
  if (displayName) {
    const cleaned = cleanDisplayName(displayName);
    if (cleaned) return { name: cleaned, isAts: true, sender: email };
  }
  return { name: '', isAts: true, sender: email };
}

function extractRole(subject) {
  if (!subject) return '';
  const s = subject.replace(/\s+/g, ' ').trim();
  const patterns = [
    /applying (?:to|for)(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
    /application for(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
    /your application[:\-]\s*(.+?)(?: at | \(| -|$)/i,
    /application received[:\-]\s*(.+?)(?: at | \(| -|$)/i,
    /interview for(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
    /regarding(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
  ];
  for (const p of patterns) {
    const mm = s.match(p);
    if (mm && mm[1]) {
      const role = mm[1].trim().replace(/[",.]+$/, '');
      if (role.length >= 3 && role.length <= 60) return capWords(role);
    }
  }
  return '';
}

function cleanDomain(domain) {
  const parts = domain.split('.');
  const noise = ['careers', 'jobs', 'mail', 'email', 'no-reply', 'noreply', 'notifications', 'apply', 'recruiting', 'www', 'eu', 'us'];
  while (parts.length > 2 && noise.indexOf(parts[0]) !== -1) parts.shift();
  const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return cap(label);
}
function cleanDisplayName(name) {
  const noise = /\b(careers?|recruiting|recruitment|recruiter|talent|hiring|team|hr|people|jobs?|no[- ]?reply|notifications?|via greenhouse|via lever|via workday|the)\b/gi;
  return name.replace(noise, '').replace(/\s+/g, ' ').replace(/[|,\-]/g, ' ').trim();
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function capWords(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }
function matchesAny(text, list) { for (const w of list) if (text.indexOf(w) !== -1) return true; return false; }

function getBodyText(payload) {
  let out = '';
  function walk(p) {
    if (!p) return;
    if (p.mimeType === 'text/plain' && p.body && p.body.data) out += decodeB64(p.body.data) + ' ';
    else if (p.mimeType === 'text/html' && p.body && p.body.data) out += decodeB64(p.body.data).replace(/<[^>]+>/g, ' ') + ' ';
    if (p.parts) p.parts.forEach(walk);
  }
  walk(payload);
  return out;
}
function decodeB64(data) {
  try { return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
  catch (e) { return ''; }
}

/* ============================================================
   RENDER the results table
   ============================================================ */
function renderTable(byCompany, startISO, endISO) {
  const rows = [];
  for (const key in byCompany) {
    const r = byCompany[key];
    let status;
    if (r.hasReject && (!r.lastAdvanceDate || r.lastRejectDate >= r.lastAdvanceDate)) status = 'Rejected';
    else if (r.hasAdvance) status = 'Advancing';
    else status = 'Pending';

    const note = status === 'Advancing' ? r.advanceSubject : status === 'Rejected' ? r.rejectSubject : '';
    rows.push({ company: r.company, role: r.role || '', status, confidence: r.confidence,
      sender: r.viaAts ? r.sender : '', first: isoDate(r.firstSeen), last: isoDate(r.lastSeen), note });
  }

  const order = { Advancing: 0, Pending: 1, Rejected: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.company.localeCompare(b.company));

  const counts = { Advancing: 0, Pending: 0, Rejected: 0 };
  rows.forEach(r => counts[r.status]++);

  const color = s => s === 'Advancing' ? '#d4edda' : s === 'Rejected' ? '#f8d7da' : '#fff3cd';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const body = rows.map(r => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(r.company)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(r.role)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; background:${color(r.status)};">${r.status}</td>
      <td style="padding:8px; border-bottom:1px solid #eee;">${r.confidence}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; font-size:12px; color:#666;">${esc(r.sender)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee;">${r.first}</td>
      <td style="padding:8px; border-bottom:1px solid #eee;">${r.last}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; font-size:12px; color:#666;">${esc(r.note)}</td>
    </tr>`).join('');

  return `
    <div style="font-family: sans-serif; max-width: 1100px; margin: 40px auto;">
      <p><a href="/">&larr; New scan</a></p>
      <h1>Your applications</h1>
      <p style="color:#666;">${startISO} to ${endISO} &middot; ${rows.length} companies found</p>
      <p>
        <span style="background:#d4edda; padding:4px 10px; border-radius:6px;">Advancing: ${counts.Advancing}</span>
        <span style="background:#fff3cd; padding:4px 10px; border-radius:6px;">Pending: ${counts.Pending}</span>
        <span style="background:#f8d7da; padding:4px 10px; border-radius:6px;">Rejected: ${counts.Rejected}</span>
      </p>
      <table style="border-collapse:collapse; width:100%; margin-top:16px; font-size:14px;">
        <thead>
          <tr style="background:#1a1a1a; color:#fff; text-align:left;">
            <th style="padding:10px;">Company</th>
            <th style="padding:10px;">Role</th>
            <th style="padding:10px;">Status</th>
            <th style="padding:10px;">Confidence</th>
            <th style="padding:10px;">Sender (ATS)</th>
            <th style="padding:10px;">First</th>
            <th style="padding:10px;">Last</th>
            <th style="padding:10px;">Latest subject</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

app.listen(PORT, () => {
  console.log(`\n  Apply Tracker running -> http://localhost:${PORT}\n`);
});