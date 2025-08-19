/**
 * Backend for RideSplits forms
 * - POST /api/contact      -> saves a contact message
 * - POST /api/subscribe    -> upserts a newsletter subscriber
 * - GET  /api/faq          -> returns a simple FAQ payload (placeholder)
 */

const { setGlobalOptions } = require('firebase-functions');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Configure function runtime
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

// Initialize Admin SDK once
try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();

// very small CORS helper (allows any origin; tighten later if you want)
function withCORS(handler) {
  return async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return handler(req, res);
  };
}

// ---------- CONTACT ----------
exports.contact = functions.https.onRequest(
  withCORS(async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const { name = '', email = '', topic = 'General', message = '' } = (req.body || {});
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields (name, email, message).' });
    }

    const doc = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      topic: String(topic || 'General').trim(),
      message: String(message).trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.get('user-agent') || '',
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
    };

    await db.collection('contactMessages').add(doc);
    return res.json({ ok: true });
  })
);

// ---------- SUBSCRIBE ----------
exports.subscribe = functions.https.onRequest(
  withCORS(async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const { email = '' } = (req.body || {});
    const clean = String(email).trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return res.status(400).json({ error: 'Valid email required.' });
    }

    // use the email (sanitized) as the doc id to dedupe
    const id = clean.replace(/[^\w.-]+/g, '_');
    await db.collection('newsletterSubscribers').doc(id).set(
      {
        email: clean,
        source: 'site',
        subscribed: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({ ok: true });
  })
);

// ---------- FAQ (placeholder) ----------
exports.faq = functions.https.onRequest(
  withCORS(async (_req, res) => {
    return res.json({
      ok: true,
      items: [
        { q: 'What is RideSplits?', a: 'A community-driven ride platform focused on reliability.' },
        { q: 'Where is it available?', a: 'We’re expanding; check the app for current cities.' },
      ],
    });
  })
);
