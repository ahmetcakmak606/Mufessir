#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL;
const NEW_DATABASE_URL = process.env.DATABASE_URL;

if (!OLD_DATABASE_URL) {
  throw new Error('OLD_DATABASE_URL is required.');
}

if (!NEW_DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const source = new PrismaClient({
  datasources: { db: { url: OLD_DATABASE_URL } },
});

const target = new PrismaClient({
  datasources: { db: { url: NEW_DATABASE_URL } },
});

const BATCH_SIZE = Number(process.env.BATCH_USERS || 500);

async function main() {
  let lastId: string | undefined;
  let total = 0;

  while (true) {
    const users = await source.user.findMany({
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
    });

    if (!users.length) break;

    await target.user.createMany({
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        openaiApiKey: u.openaiApiKey,
        dailyQuota: u.dailyQuota,
        quotaResetAt: u.quotaResetAt,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      skipDuplicates: true,
    });

    lastId = users[users.length - 1]?.id;
    total += users.length;
    console.log(`Copied users: ${total}`);
  }

  console.log('User copy complete.');
}

main()
  .catch((err) => {
    console.error('Copy failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
