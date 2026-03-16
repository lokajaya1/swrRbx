require("dotenv").config();
const express = require("express");
const crypto  = require("crypto");
const app     = express();
const PORT    = process.env.PORT || 3000;

const STREAM_KEY    = process.env.SAWERIA_STREAM_KEY || "";
const ROBLOX_SECRET = process.env.ROBLOX_SECRET      || "ganti_ini";

let donationQueue = [];
const processedIds = new Set();

app.use(express.json());

app.get("/", (req, res) => res.json({
    status: "online", service: "NekoSaweria", queue: donationQueue.length
}));

app.post("/saweria/webhook", (req, res) => {
    const signature = req.headers["saweria-callback-signature"];
    const timestamp = req.headers["saweria-callback-timestamp"] || "";
    if (!signature) return res.status(403).json({ error: "No signature" });

    const expected = crypto
        .createHmac("sha256", STREAM_KEY)
        .update(timestamp + JSON.stringify(req.body))
        .digest("hex");
    if (signature !== expected) return res.status(401).json({ error: "Invalid signature" });

    const { id, donator_name, amount_raw, message, created_at } = req.body;
    if (processedIds.has(id)) return res.json({ status: "duplicate" });
    processedIds.add(id);
    if (processedIds.size > 500) processedIds.delete(processedIds.values().next().value);

    donationQueue.push({
        id,
        donator_name : donator_name || "Anonim",
        amount       : amount_raw   || 0,
        message      : message      || "",
        timestamp    : created_at   || new Date().toISOString()
    });
    console.log(`[DONASI] ${donator_name} → Rp${(amount_raw||0).toLocaleString("id-ID")}`);
    res.json({ status: "ok" });
});

app.get("/roblox/poll", (req, res) => {
    const secret = req.query.secret || req.headers["x-secret"];
    if (secret !== ROBLOX_SECRET) return res.status(403).json({ error: "Forbidden" });
    const data = [...donationQueue];
    donationQueue = [];
    res.json({ donations: data, count: data.length });
});

// Test endpoint — untuk coba tanpa donasi nyata
app.post("/test", (req, res) => {
    const d = {
        id           : "test-" + Date.now(),
        donator_name : req.body.name    || "TestUser",
        amount       : req.body.amount  || 10000,
        message      : req.body.message || "Semangat!",
        timestamp    : new Date().toISOString()
    };
    donationQueue.push(d);
    res.json({ status: "queued", donation: d });
});

app.listen(PORT, () => {
    console.log(`NekoSaweria Middleware — port ${PORT}`);
    console.log(`Webhook : POST /saweria/webhook`);
    console.log(`Poll    : GET  /roblox/poll?secret=...`);
    console.log(`Test    : POST /test`);
});
