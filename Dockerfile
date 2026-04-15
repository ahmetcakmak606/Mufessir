FROM node:18-slim

RUN echo "=== CUSTOM DOCKERFILE IS BEING USED ==="

WORKDIR /app

COPY package*.json packages/database/package*.json apps/backend/package*.json ./
COPY package-lock.json* ./

RUN npm install

COPY packages/database/prisma ./packages/database/prisma
RUN cd packages/database && npx prisma generate

COPY . .

RUN cd apps/backend && npx tsc -p tsconfig.json

RUN ls -la apps/backend/dist/src/ || echo "dist folder missing"

EXPOSE 4000

CMD ["node", "apps/backend/dist/src/index.js"]