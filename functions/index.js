/**
 * HTTP Cloud Functions for RideSplits site APIs
 * - POST /api/contact    -> { name, email, message }
 * - POST /api/subscribe  -> { email }
 * - GET  /api/faq        -> simple JSON list
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

// ---- small CORS helper (allows your static site to call these endpoints) ----
function withCors(handler) {
  return async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    return handler(req, res);
  };
}

// ------------------- /api/contact -------------------
exports.contact = onRequest(
  withCors(async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { name = "", email = "", message = "" } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "name, email, and message are required" });
    }

    try {
      const docRef = await db.collection("contacts").add({
        name,
        email: email.toLowerCase().trim(),
        message,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("Contact saved", { id: docRef.id, email });
      return res.json({ ok: true, id: docRef.id });
    } catch (err) {
      logger.error("Failed to save contact", err);
      return res.status(500).json({ ok: false, error: "Internal error" });
    }
  })
);

// ------------------- /api/subscribe -------------------
exports.subscribe = onRequest(
  withCors(async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { email = "" } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    try {
      // Use email as doc id to avoid duplicates
      const id = email.toLowerCase().trim();
      await db.collection("subscribers").doc(id).set(
        {
          email: id,
          subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("Subscribed", { email: id });
      return res.json({ ok: true, email: id });
    } catch (err) {
      logger.error("Subscribe failed", err);
      return res.status(500).json({ ok: false, error: "Internal error" });
    }
  })
);

// ------------------- /api/faq -------------------
exports.faq = onRequest(
  withCors(async (req, res) => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Quick static example. Later you could read from Firestore (collection "faq").
    const items = [
      { q: "What is RideSplits?", a: "A peer-to-peer platform to share rides and reduce costs." },
      { q: "How do I request a ride?", a: "Use the app to set your pickup and drop-off, then confirm." },
      { q: "Is it eco-friendly?", a: "Yes—sharing rides reduces emissions and traffic." },
    ];

    return res.json({ ok: true, items });
  })
);
