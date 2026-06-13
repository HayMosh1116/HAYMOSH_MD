const { princeId, removeFile, generateRandomCode } = require('../mayel');
const zlib = require('zlib');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { sendButtons } = require('gifted-btns');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const router = express.Router();
const sessionDir = path.join(__dirname, 'session');

router.get('/', async (req, res) => {
    const id = princeId();
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({ code: 'Phone number is required' });
    }

    num = num.replace(/[^0-9]/g, '');

    if (num.length < 7) {
        return res.status(400).json({ code: 'Invalid phone number' });
    }

    let responseSent = false;
    let sessionCleanedUp = false;
    let intentionalClose = false;
    let reconnectCount = 0;

    async function cleanUp() {
        if (!sessionCleanedUp) {
            sessionCleanedUp = true;
            try {
                await removeFile(path.join(sessionDir, id));
            } catch (e) {
                console.error('[pair] cleanup error:', e.message);
            }
        }
    }

    function sendError(msg) {
        if (!responseSent && !res.headersSent) {
            responseSent = true;
            res.status(500).json({ code: msg });
        }
    }

    async function connect() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({ level: 'fatal' }).child({ level: 'fatal' })
                )
            },
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
            browser: Browsers.macOS('Safari'),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            shouldIgnoreJid: jid => !!jid?.endsWith('@g.us'),
            getMessage: async () => undefined,
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);
            try {
                const code = await sock.requestPairingCode(num, generateRandomCode());
                if (!responseSent && !res.headersSent) {
                    responseSent = true;
                    res.json({ code });
                }
            } catch (e) {
                console.error('[pair] requestPairingCode error:', e.message);
                sendError('Failed to generate pair code');
                await cleanUp();
                return;
            }
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
            if (connection === 'open') {
                console.log('[pair] connected, waiting for creds...');
                await delay(8000);

                let sessionData = null;
                for (let i = 0; i < 15; i++) {
                    try {
                        const credsPath = path.join(sessionDir, id, 'creds.json');
                        if (fs.existsSync(credsPath)) {
                            const data = fs.readFileSync(credsPath);
                            if (data && data.length > 100) {
                                sessionData = data;
                                break;
                            }
                        }
                    } catch (e) {
                        console.error('[pair] read creds error:', e.message);
                    }
                    await delay(4000);
                }

                if (!sessionData) {
                    console.error('[pair] creds not found after retries');
                    await cleanUp();
                    return;
                }

                try {
                    const compressed = zlib.gzipSync(sessionData);
                    const b64 = compressed.toString('base64');
                    const sessionId = 'HAYWHY_MDX!' + b64;

                    for (let attempt = 0; attempt < 5; attempt++) {
                        try {
                            await sendButtons(sock, sock.user.id, {
                                title: '',
                                text: sessionId,
                                footer: '> *Powered by HAYMOSH SESSION GENERATOR*',
                                buttons: [
                                    {
                                        name: 'cta_copy',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: 'Copy Session ID',
                                            copy_code: sessionId
                                        })
                                    }
                                ]
                            });
                            console.log('[pair] session sent successfully');
                            break;
                        } catch (e) {
                            console.error('[pair] sendButtons attempt', attempt + 1, 'error:', e.message);
                            if (attempt < 4) await delay(3000);
                        }
                    }
                } catch (e) {
                    console.error('[pair] session processing error:', e.message);
                } finally {
                    await delay(2000);
                    intentionalClose = true;
                    try { sock.ws.close(); } catch (_) {}
                    await cleanUp();
                }

            } else if (connection === 'close') {
                if (intentionalClose) return;

                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log('[pair] connection closed, reason:', statusCode);

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    sendError('Session expired, please try again');
                    await cleanUp();
                    return;
                }

                if (reconnectCount < 3) {
                    reconnectCount++;
                    console.log(`[pair] reconnecting ${reconnectCount}/3...`);
                    await delay(5000);
                    connect().catch(async e => {
                        console.error('[pair] reconnect error:', e.message);
                        sendError('Service is Currently Unavailable');
                        await cleanUp();
                    });
                } else {
                    console.error('[pair] max reconnects reached');
                    sendError('Service is Currently Unavailable');
                    await cleanUp();
                }
            }
        });
    }

    try {
        await connect();
    } catch (e) {
        console.error('[pair] fatal error:', e.message);
        sendError('Service Error');
        await cleanUp();
    }
});

module.exports = router;
