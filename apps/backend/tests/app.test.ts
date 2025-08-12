import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import healthRouter from '../src/routes/health.js';
import authRouter from '../src/routes/auth.js';
import filtersRouter from '../src/routes/filters.js';
import versesRouter from '../src/routes/verses.js';
import tafseerRouter from '../src/routes/tafseer.js';
import { PrismaClient } from '@prisma/client';

// Create an in-process express app using the same routers
const app = express();
app.use(express.json());
const prisma = new PrismaClient();
(app as any).locals.prisma = prisma;

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/filters', filtersRouter);
app.use('/verses', versesRouter);
app.use('/tafseer', tafseerRouter);

const server = createServer(app);

let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe('Health', () => {
  it('GET /health should return ok', async () => {
    const res = await request(base).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth', () => {
  let token = '';

  it('registers a user', async () => {
    const res = await request(base)
      .post('/auth/register')
      .send({ email: 'testuser@example.com', password: 'pass1234', name: 'Tester' });
    expect([200, 201, 409]).toContain(res.status); // 409 if user exists
  });

  it('logs in and returns a token', async () => {
    const res = await request(base)
      .post('/auth/login')
      .send({ email: 'testuser@example.com', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it('returns profile with /auth/me', async () => {
    const res = await request(base)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('testuser@example.com');
  });
});

describe('Filters & Verses', () => {
  it('GET /filters returns scholars and options', async () => {
    const res = await request(base).get('/filters');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scholars)).toBe(true);
  });

  it('GET /verses composite lookup works', async () => {
    const res = await request(base).get('/verses').query({ surahNumber: 1, verseNumber: 1 });
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^verse-/);
  });
});

describe('Tafseer', () => {
  let token = '';
  beforeAll(async () => {
    const login = await request(base)
      .post('/auth/login')
      .send({ email: 'testuser@example.com', password: 'pass1234' });
    token = login.body.token;
  });

  it('POST /tafseer returns AI or fallback (non-streaming)', async () => {
    const verseRes = await request(base).get('/verses').query({ surahNumber: 1, verseNumber: 1 });
    const verseId = verseRes.body.id;
    const res = await request(base)
      .post('/tafseer')
      .set('Authorization', `Bearer ${token}`)
      .send({ verseId, filters: { tone: 7, intellectLevel: 7, language: 'English' }, stream: false });
    expect(res.status).toBe(200);
    expect(typeof res.body.aiResponse).toBe('string');
    expect(res.body.verse.id).toBe(verseId);
  });
});


