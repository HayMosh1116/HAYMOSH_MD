const {
  princeId,
  removeFile,
  generateRandomCode
} = require('../ayobami');
const zlib = require('zlib');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require("pino");
const { sendButtons } = require('gifted-btns');
const {
  default: princeConnect,
  useMultiFileAuthState,
  delay,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "session");

router.get('/', async (req, res) => {
  const id = princeId();
  let num = req.query.number;
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

  async function HAYWHY_PAIR_CODE() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
    try {
      const Prince = princeConnect({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        shouldIgnoreJid: jid => !!jid?.endsWith('@g.us'),
        getMessage: async () => undefined,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      if (!Prince.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const randomCode = generateRandomCode();
        const code = await Prince.requestPairingCode(num, randomCode);
        if (!responseSent && !res.headersSent) {
          res.json({ code });
          responseSent = true;
        }
      }

      Prince.ev.on('creds.update', saveCreds);
      Prince.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
          try {
            await Prince.groupAcceptInvite("GbExMqh1hXOFLIJlUyrF8f");
          } catch (_) {}

          await delay(50000);

          let sessionData = null;
          let attempts = 0;
          const maxAttempts = 15;

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
              await delay(8000);
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
            await delay(5000);

            let sessionSent = false;
            let sendAttempts = 0;
            const maxSendAttempts = 5;

            while (sendAttempts < maxSendAttempts && !sessionSent) {
              try {
                await sendButtons(Prince, Prince.user.id, {
                  title: '',
                  text: 'HAYWHY_MDX!' + b64data,
                  footer: '> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ DEV_HAYWHY *',
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
                sessionSent = true;
              } catch (sendError) {
                console.error("Send error:", sendError);
                sendAttempts++;
                if (sendAttempts < maxSendAttempts) await delay(3000);
              }
            }

            intentionalClose = true;
            await delay(3000);
            await Prince.ws.close();
          } catch (sessionError) {
            console.error("Session processing error:", sessionError);
          } finally {
            await cleanUpSession();
          }

        } else if (connection === "close") {
          if (intentionalClose) return;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          if (statusCode !== 401 && reconnectCount < maxReconnects) {
            reconnectCount++;
            console.log(`Reconnecting... attempt ${reconnectCount}`);
            await delay(5000);
            HAYWHY_PAIR_CODE();
          } else {
            await cleanUpSession();
          }
        }
      });

    } catch (err) {
      console.error("Main error:", err);
      if (!responseSent && !res.headersSent) {
        res.status(500).json({ code: "Service is Currently Unavailable" });
        responseSent = true;
      }
      await cleanUpSession();
    }
  }

  if (!num || !/^\d{10,15}$/.test(num.replace(/[^0-9]/g, ''))) {
    return res.status(400).json({ code: "Invalid phone number" });
  }

  try {
    await HAYWHY_PAIR_CODE();
  } catch (finalError) {
    console.error("Final error:", finalError);
    await cleanUpSession();
    if (!responseSent && !res.headersSent) {
      res.status(500).json({ code: "Service Error" });
    }
  }
});

module.exports = router;
