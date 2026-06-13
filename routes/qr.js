const { princeId, removeFile } = require('../mayel');
const zlib = require('zlib');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const { sendButtons } = require('gifted-btns');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const router = express.Router();
const sessionDir = path.join(__dirname, 'session');

router.get('/', async (req, res) => {
    const id = princeId();
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
                console.error('[qr] cleanup error:', e.message);
            }
        }
    }

    async function connect() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
            browser: Browsers.macOS('Desktop'),
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            if (qr && !responseSent && !res.headersSent) {
                responseSent = true;
                try {
                    const qrImage = await QRCode.toDataURL(qr);
                    res.json({ qr: qrImage });
                } catch (e) {
                    console.error('[qr] QRCode error:', e.message);
                    res.status(500).json({ code: 'Failed to generate QR code' });
                }
            }

            if (connection === 'open') {
                console.log('[qr] connected, waiting for creds...');
                await delay(8000);

                let sessionData = null;
                for (let i = 0; i < 10; i++) {
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
                        console.error('[qr] read creds error:', e.message);
                    }
                    await delay(3000);
                }

                if (!sessionData) {
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
                            console.log('[qr] session sent successfully');
                            break;
                        } catch (e) {
                            console.error('[qr] sendButtons attempt', attempt + 1, 'error:', e.message);
                            if (attempt < 4) await delay(3000);
                        }
                    }
                } catch (e) {
                    console.error('[qr] session processing error:', e.message);
                } finally {
                    await delay(2000);
                    intentionalClose = true;
                    try { sock.ws.close(); } catch (_) {}
                    await cleanUp();
                }

            } else if (connection === 'close') {
                if (intentionalClose) return;

                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log('[qr] connection closed, reason:', statusCode);

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    await cleanUp();
                    return;
                }

                if (reconnectCount < 3) {
                    reconnectCount++;
                    console.log(`[qr] reconnecting ${reconnectCount}/3...`);
                    await delay(8000);
                    connect().catch(async e => {
                        console.error('[qr] reconnect error:', e.message);
                        await cleanUp();
                    });
                } else {
                    console.error('[qr] max reconnects reached');
                    await cleanUp();
                }
            }
        });
    }

    try {
        await connect();
    } catch (e) {
        console.error('[qr] fatal error:', e.message);
        if (!res.headersSent) {
            res.status(500).json({ code: 'Service Error' });
        }
        await cleanUp();
    }
});

module.exports = router;
