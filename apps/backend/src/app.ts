import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import tafseerRouter from "./routes/tafseer.js";
import filtersRouter from "./routes/filters.js";
import versesRouter from "./routes/verses.js";

// Load .env from the project root when running locally
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

const app = express();
const prisma = new PrismaClient();

// Store prisma on app locals for access in routers
app.locals.prisma = prisma;

app.use(cors());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/tafseer", tafseerRouter);
app.use("/filters", filtersRouter);
app.use("/verses", versesRouter);

export default app;


