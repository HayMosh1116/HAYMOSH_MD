const fs = require('fs');

function princeId(num = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < num; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    await fs.promises.rm(filePath, { recursive: true, force: true });
    return true;
}

module.exports = { princeId, removeFile, generateRandomCode };
