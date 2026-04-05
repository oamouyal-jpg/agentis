const path = require("path");

// Load env from root .env (like Backend does from its own .env)
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const next = require("next");
const express = require("express");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const { app: backendApp } = require("./Backend/dist/server");
  const server = express();

  // All backend API routes live under /api
  server.use("/api", backendApp);

  // Everything else is handled by Next.js (pages, static assets, etc.)
  server.all("/{*path}", (req, res) => handle(req, res));

  server.listen(port, () => {
    console.log(`> Agentis ready on http://localhost:${port}`);
  });
});
