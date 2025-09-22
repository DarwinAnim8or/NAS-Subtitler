// Prisma singleton instance
const { PrismaClient } = require('@prisma/client');
// Ensure config side-effects (DATABASE_URL) applied before instantiation
require('./config');

const prisma = new PrismaClient();

module.exports = { prisma };