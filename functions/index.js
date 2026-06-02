require('dotenv').config();
// Connects to local emulator or production depending on environment variables

const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

admin.initializeApp();

const app = express();

app.use((req, res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});

app.use(cors({
 origin: true,
 credentials: true
}));

app.options("*", cors());

app.use(express.json());

/**
 * Route: Health Check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

console.log("--- REGISTERED EXPRESS ROUTES ---");
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(', ');
    console.log(`Route: [${methods}] ${r.route.path}`);
  }
});
console.log("---------------------------------");

exports.api = functions.https.onRequest(app);
