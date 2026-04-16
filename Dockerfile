FROM node:18-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json packages/database/package*.json apps/backend/package*.json ./
COPY package-lock.json* ./

RUN npm install

COPY packages/database/prisma ./packages/database/prisma
RUN cd packages/database && npx prisma generate

COPY . .

RUN npm run build --workspace=@mufessir/backend

EXPOSE 4000

CMD ["node", "/app/apps/backend/dist/src/index.js"]