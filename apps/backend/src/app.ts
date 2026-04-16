import express, { type Express } from "express";
import cors from "cors";
import "./env.js";
import { prisma } from "./prisma.js";
import { requestLogger } from "./middleware/request-logger.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import tafseerRouter from "./routes/tafseer.js";
import filtersRouter from "./routes/filters.js";
import versesRouter from "./routes/verses.js";

const app: Express = express();

// Store prisma on app locals for access in routers
app.locals.prisma = prisma;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/tafseer", tafseerRouter);
app.use("/filters", filtersRouter);
app.use("/verses", versesRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "unhandled_error",
        message: err.message,
        stack: err.stack,
        at: new Date().toISOString(),
      }),
    );
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
