#!/usr/bin/env tsx
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const CSV_PATH =
  process.env.USERS_CSV_PATH || resolve(__dirname, '../../../User.csv');

const prisma = new PrismaClient();

type CsvRow = Record<string, string>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (c === '\r') {
      if (next === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      }
      continue;
    }

    field += c;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/Z$|[+-]\\d{2}:?\\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  return new Date(trimmed.replace(' ', 'T') + 'Z');
}

function normalizeBoolean(value: string | null): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === 'true' || value.trim() === '1';
}

function normalizeString(value: string | null): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function main() {
  const raw = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(raw);
  if (!rows.length) {
    console.log('No CSV rows found.');
    return;
  }

  const header = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => r.length && r.some((c) => c.trim().length));

  const users: CsvRow[] = dataRows.map((r) => {
    const row: CsvRow = {};
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = r[i] ?? '';
    }
    return row;
  });

  if (!users.length) {
    console.log('No user data rows found.');
    return;
  }

  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      name: normalizeString(u.name),
      openaiApiKey: normalizeString(u.openaiApiKey),
      dailyQuota: Number(u.dailyQuota || 0),
      quotaResetAt: parseDate(u.quotaResetAt) || new Date(),
      emailVerified: normalizeBoolean(u.emailVerified),
      createdAt: parseDate(u.createdAt) || new Date(),
      updatedAt: parseDate(u.updatedAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log(`Imported users: ${users.length}`);
}

main()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
