/**
 * APPLY TRACKER — Phase 1: prove the clean Google login works.
 *
 * What this does (only this, for now):
 *   1. Shows a "Connect Gmail" button
 *   2. Sends you to Google's real login + consent screen (clean, no warning,
 *      because your account is a Test User in Google Cloud)
 *   3. Receives a read-only token
 *   4. Lists your 5 most recent email subjects, proving the token works
 *
 * The classification, the React UI, and export come in later phases.
 *
 * RUN:
 *   1. npm install
 *   2. create a .env file with your Client ID + Secret (see .env.example)
 *   3. npm start
 *   4. open http://localhost:3000
 */

const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(session({
  secret: 'change-this-to-anything-random',
  resave: false,
  saveUninitialized: true,
}));

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'   // MUST match the redirect URI in Google Cloud
  );
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// ---- HOME PAGE ----
app.get('/', (req, res) => {
  if (req.session.tokens) {
    res.send(`
      <div style="font-family: sans-serif; max-width: 600px; margin: 60px auto;">
        <h1>Connected &#10003;</h1>
        <p>Your Gmail is connected. Let's prove the token works:</p>
        <p><a href="/emails" style="font-size:18px;">&rarr; Show my 5 most recent email subjects</a></p>
        <p><a href="/logout">Disconnect</a></p>
      </div>
    `);
  } else {
    const url = makeOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });
    res.send(`
      <div style="font-family: sans-serif; max-width: 600px; margin: 60px auto;">
        <h1>Apply Tracker</h1>
        <p>Phase 1: prove the clean login works.</p>
        <p><a href="${url}" style="display:inline-block; padding:12px 20px; background:#1a73e8; color:#fff; text-decoration:none; border-radius:8px;">Connect Gmail</a></p>
      </div>
    `);
  }
});

// ---- OAUTH CALLBACK ----
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

// ---- TEST ENDPOINT: list 5 recent subjects ----
app.get('/emails', async (req, res) => {
  if (!req.session.tokens) return res.redirect('/');

  try {
    const client = makeOAuthClient();
    client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 5 });
    const messages = list.data.messages || [];

    const rows = [];
    for (const m of messages) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From'],
      });
      const headers = full.data.payload.headers || [];
      const subj = (headers.find(h => h.name === 'Subject') || {}).value || '(no subject)';
      const from = (headers.find(h => h.name === 'From') || {}).value || '';
      rows.push({ subj, from });
    }

    res.send(`
      <div style="font-family: sans-serif; max-width: 700px; margin: 60px auto;">
        <h1>It works &#10003;</h1>
        <p>Read ${rows.length} emails from your inbox:</p>
        <ul>
          ${rows.map(r => `<li><strong>${escapeHtml(r.subj)}</strong><br><small>${escapeHtml(r.from)}</small></li>`).join('')}
        </ul>
        <p><a href="/">&larr; Back</a></p>
      </div>
    `);
  } catch (err) {
    res.send('Error reading mail: ' + err.message + '<br><a href="/">Back</a>');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

app.listen(PORT, () => {
  console.log(`\n  Apply Tracker running -> http://localhost:${PORT}\n`);
});