FROM node:18-slim

WORKDIR /app

COPY package*.json packages/database/package*.json apps/backend/package*.json ./
COPY package-lock.json* ./

RUN npm install

COPY packages/database/prisma ./packages/database/prisma
RUN cd packages/database && npx prisma generate

COPY . .

RUN cd apps/backend && npx tsc -p tsconfig.json

EXPOSE 4000

CMD ["node", "apps/backend/dist/src/index.js"]