"use strict";

// Minimal Express wrapper so Hostinger detects a buildable Node.js layout and
// can serve this static Insurance Website.
//
// The frontend (index.html / index3.html / register.html / dashboard.html and
// the associated .js/.css assets) is plain static content; this file only adds
// the Node.js entry point Hostinger requires.

const express = require("express");
const path = require("path");

const app = express();
// Hostinger injects the target port via the PORT environment variable.
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

// Serve the static site from the project root.
app.use(express.static(ROOT));

// Any unmatched route falls back to the entry page.
// index.html itself redirects to index3.html (the actual login page).
app.get("*", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Insurance Website is running on port ${PORT}`);
});
