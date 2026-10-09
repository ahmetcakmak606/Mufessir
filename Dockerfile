FROM node:22-slim

WORKDIR /app

# better-sqlite3 icin on-kurulu ikili yok (node:22-slim/Node 22) — kaynaktan
# derleme python3 + make + g++ ister (openssl: Prisma sorgu motoru).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl python3 make g++

COPY package*.json packages/database/package*.json apps/backend/package*.json ./
COPY package-lock.json* ./

RUN npm install

COPY packages/database/prisma ./packages/database/prisma
RUN cd packages/database && npx prisma generate

COPY . .

RUN npm run build --workspace=@mufessir/backend

EXPOSE 4000

CMD ["node", "/app/apps/backend/dist/src/index.js"]