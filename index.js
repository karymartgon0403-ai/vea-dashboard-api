// index.js
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json()); // en Express 5 no necesitas body-parser

app.get('/health', (_req, res) => {
  res.json({ ok: true, node: process.version });
});

const PORT = process.env.PORT || 3000;
const HTTPS = (process.env.HTTPS || 'false').toLowerCase() === 'true';
const CERT = process.env.SSL_CERT_PATH || 'C:\\vea\\certs\\cert.pem';
const KEY  = process.env.SSL_KEY_PATH  || 'C:\\vea\\certs\\key.pem';

if (HTTPS && fs.existsSync(CERT) && fs.existsSync(KEY)) {
  const opts = { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) };
  https.createServer(opts, app).listen(PORT, () => {
    console.log(`HTTPS listo en https://localhost:${PORT}`);
  });
} else {
  http.createServer(app).listen(PORT, () => {
    console.log(`HTTP listo en http://localhost:${PORT}`);
  });
}
