import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  PUBLIC_ORIGIN: z.string().url().default("http://localhost:5173"),
  UPLOAD_DIR: z.string().default("./uploads"),
  PORT: z.coerce.number().default(4000),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = schema.parse(process.env);
