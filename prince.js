const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { qrRoute, pairRoute } = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;
const __path = process.cwd();

require('events').EventEmitter.defaultMaxListeners = 500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/qr', qrRoute);
app.use('/code', pairRoute);

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 200, success: true, service: 'Session Generator', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Session Generator running on port ${PORT}`);
});

module.exports = app;
