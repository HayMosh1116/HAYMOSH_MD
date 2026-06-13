const {
  princeId,
  removeFile
} = require('../ayobami');
const QRCode = require('qrcode');
const express = require('express');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const pino = require("pino");
const { sendButtons } = require('gifted-btns');
const {
  default: princeConnect,
  useMultiFileAuthState,
  Browsers,
  delay,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "session");

router.get('/', async (req, res) => {
  const id = princeId();
  let responseSent = false;
  let sessionCleanedUp = false;
  let intentionalClose = false;
  let reconnectCount = 0;
  const maxReconnects = 3;

  async function cleanUpSession() {
    if (!sessionCleanedUp) {
      try {
        await removeFile(path.join(sessionDir, id));
      } catch (e) {
        console.error("Cleanup error:", e);
      }
      sessionCleanedUp = true;
    }
  }

  async function HAYWHY_QR_CODE() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
    try {
      const Prince = princeConnect({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      Prince.ev.on('creds.update', saveCreds);
      Prince.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

        if (qr && !responseSent && !res.headersSent) {
          const qrImage = await QRCode.toDataURL(qr);
          res.send(`<!DOCTYPE html>
<html>
<head>
  <title>HAYWHY_MD | QR CODE</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
  <style>
    :root { --primary: #8b5cf6; --primary-glow: rgba(139,92,246,0.4); --accent: #ec4899; --bg: #0f0a1a; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { display:flex; justify-content:center; align-items:center; min-height:100vh; background:var(--bg);
      font-family:'Orbitron',sans-serif; color:#f3f0ff; text-align:center; padding:20px;
      background-image:linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px);
      background-size:50px 50px; }
    .container { width:100%; max-width:500px; background:rgba(25,15,40,0.7); backdrop-filter:blur(20px);
      border:1px solid rgba(139,92,246,0.2); border-radius:24px; padding:3rem 2rem; }
    h1 { font-size:1.6rem; font-weight:900; background:linear-gradient(135deg,var(--primary),var(--accent));
      -webkit-background-clip:text; background-clip:text; color:transparent; margin-bottom:0.5rem;
      text-transform:uppercase; letter-spacing:3px; }
    p { color:#a78bba; margin:1rem 0; font-family:sans-serif; font-size:0.95rem; }
    .qr-wrap { margin:1.5rem auto; width:260px; height:260px; padding:12px; background:#fff;
      border-radius:16px; box-shadow:0 0 40px var(--primary-glow); animation:pulse 2s infinite; }
    .qr-wrap img { width:100%; height:100%; }
    @keyframes pulse { 0%,100%{box-shadow:0 0 30px var(--primary-glow)} 50%{box-shadow:0 0 60px var(--primary-glow)} }
    .back-btn { display:inline-block; margin-top:1.5rem; padding:0.8rem 2rem;
      background:linear-gradient(135deg,var(--primary),#c084fc); color:#0f0a1a; border-radius:50px;
      font-family:'Orbitron',sans-serif; font-weight:700; font-size:0.85rem; text-decoration:none;
      text-transform:uppercase; letter-spacing:1px; transition:all 0.3s; }
    .back-btn:hover { transform:translateY(-3px); box-shadow:0 0 30px var(--primary-glow); }
  </style>
</head>
<body>
  <div class="container">
    <h1>HAYWHY_MD QR CODE</h1>
    <p>Scan with WhatsApp to connect</p>
    <div class="qr-wrap"><img src="${qrImage}" alt="QR Code"/></div>
    <p>Open WhatsApp → Linked Devices → Link a Device</p>
    <a href="./" class="back-btn">← Back Home</a>
  </div>
</body>
</html>`);
          responseSent = true;
        }

        if (connection === "open") {
          try {
            await Prince.groupAcceptInvite("GbExMqh1hXOFLIJlUyrF8f");
          } catch (_) {}

          await delay(10000);

          let sessionData = null;
          let attempts = 0;
          const maxAttempts = 10;

          while (attempts < maxAttempts && !sessionData) {
            try {
              const credsPath = path.join(sessionDir, id, "creds.json");
              if (fs.existsSync(credsPath)) {
                const data = fs.readFileSync(credsPath);
                if (data && data.length > 100) {
                  sessionData = data;
                  break;
                }
              }
              await delay(2000);
              attempts++;
            } catch (readError) {
              console.error("Read error:", readError);
              await delay(2000);
              attempts++;
            }
          }

          if (!sessionData) {
            await cleanUpSession();
            return;
          }

          try {
            const compressedData = zlib.gzipSync(sessionData);
            const b64data = compressedData.toString('base64');

            await sendButtons(Prince, Prince.user.id, {
              title: '',
              text: 'HAYWHY_MDX!' + b64data,
              footer: '> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ‎⁨👾𝒟𝐸𝒱-𝐻𝒜𝒴𝒲𝐻𝒴//𝒯𝐸𝒞𝐻🤖⁩*',
              buttons: [
                {
                  name: 'cta_copy',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'Copy Session',
                    copy_code: 'HAYWHY_MDX!' + b64data
                  })
                },
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'Visit Bot Repo',
                    url: 'https://github.com/HayMosh1116/HAYMOSH_MD'
                  })
                },
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'Join WaChannel',
                    url: 'https://whatsapp.com/channel/0029Vb7wmowCxoAtmEmCe11x'
                  })
                }
              ]
            });

            intentionalClose = true;
            await delay(2000);
            await Prince.ws.close();
          } catch (sendError) {
            console.error("Error sending session:", sendError);
          } finally {
            await cleanUpSession();
          }

        } else if (connection === "close") {
          if (intentionalClose) return;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          if (statusCode !== 401 && reconnectCount < maxReconnects) {
            reconnectCount++;
            await delay(10000);
            HAYWHY_QR_CODE();
          } else {
            await cleanUpSession();
          }
        }
      });

    } catch (err) {
      console.error("Main error:", err);
      if (!responseSent && !res.headersSent) {
        res.status(500).json({ code: "QR Service is Currently Unavailable" });
        responseSent = true;
      }
      await cleanUpSession();
    }
  }

  try {
    await HAYWHY_QR_CODE();
  } catch (finalError) {
    console.error("Final error:", finalError);
    await cleanUpSession();
    if (!responseSent && !res.headersSent) {
      res.status(500).json({ code: "Service Error" });
    }
  }
});

module.exports = router;
