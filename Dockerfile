FROM node:18-slim

RUN echo "=== CUSTOM DOCKERFILE BUILD START ==="

WORKDIR /app

COPY package*.json packages/database/package*.json apps/backend/package*.json ./
COPY package-lock.json* ./

RUN npm install

RUN echo "=== RUNNING PRISMA GENERATE ===" && \
    ls -la packages/database/ && \
    ls -la packages/database/prisma/ && \
    cd packages/database && npx prisma --version && \
    npx prisma generate --verbose && \
    ls -la node_modules/.prisma/client/ || echo "PRISMA CLIENT NOT FOUND" && \
    echo "=== PRISMA GENERATE COMPLETE ==="

COPY . .

RUN cd apps/backend && npx tsc -p tsconfig.json

RUN ls -la apps/backend/dist/src/

EXPOSE 4000

CMD ["node", "apps/backend/dist/src/index.js"]