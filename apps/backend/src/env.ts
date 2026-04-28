import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const candidateEnvPaths = [
  resolve(__dirname, "../../../.env"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../../.env"),
];

for (const envPath of candidateEnvPaths) {
  if (!existsSync(envPath)) {
    continue;
  }

  config({ path: envPath });
  break;
}
