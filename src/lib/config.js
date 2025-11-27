// Centralized configuration and environment setup
require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Mounted directory on host (default to /data in container)
const MOUNT_DIR = process.env.MOUNT_DIR || '/data';

// Ensure DB directory exists and set SQLite file path (only based on MOUNT_DIR)
const DB_FILE = path.join(MOUNT_DIR, 'config', 'app.db');
try { fs.mkdirSync(path.dirname(DB_FILE), { recursive: true }); } catch {}

// Always set Prisma DATABASE_URL from MOUNT_DIR-derived DB_FILE
process.env.DATABASE_URL = `file:${DB_FILE}`;

const PORT = process.env.PORT || 3000;

module.exports = { MOUNT_DIR, DB_FILE, PORT };