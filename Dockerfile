FROM node:18-slim

WORKDIR /app

COPY package*.json ./
COPY packages/database/package*.json packages/database/
COPY apps/backend/package*.json apps/backend/

RUN npm install

COPY packages/database/prisma ./packages/database/prisma
RUN cd packages/database && npx prisma generate

COPY . .

RUN npm run build --workspace=@mufessir/backend

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=@mufessir/backend"]