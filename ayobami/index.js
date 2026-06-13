const fs = require('fs');

function princeId(num = 4) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const len = characters.length;
  for (let i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * len));
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

async function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  await fs.promises.rm(FilePath, { recursive: true, force: true });
  return true;
}

module.exports = { princeId, removeFile, generateRandomCode };
