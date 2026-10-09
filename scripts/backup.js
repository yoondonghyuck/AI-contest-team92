import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const backupDir = path.join(rootDir, 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const snapshotDir = path.join(backupDir, `snapshot_${timestamp}`);
fs.mkdirSync(snapshotDir, { recursive: true });

const excludeDirs = new Set(['node_modules', 'dist', 'backups', '.git']);

function copyDirRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeDirs.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirRecursive(rootDir, snapshotDir);
console.log(`[BACKUP SUCCESS] Project snapshot created at: ${snapshotDir}`);

// Also synchronize to backups/latest
const latestDir = path.join(backupDir, 'latest');
if (fs.existsSync(latestDir)) {
  fs.rmSync(latestDir, { recursive: true, force: true });
}
fs.mkdirSync(latestDir, { recursive: true });
copyDirRecursive(snapshotDir, latestDir);

console.log(`[BACKUP SUCCESS] 'latest' backup synchronized at: ${latestDir}`);
