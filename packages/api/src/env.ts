import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  UPLOAD_DIR: z.string().default("./uploads"),
  PORT: z.coerce.number().default(4000),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Only requests from the Supervisor carry trustworthy Home Assistant user headers.
  HA_SUPERVISOR_IP: z.string().default("172.30.32.2"),
  // Development only: act as this Home Assistant username when running outside Home Assistant.
  DEV_HA_USER: z.string().optional(),
  // When set, the API also serves the built web app from this directory.
  WEB_DIST: z.string().optional(),
});

export const env = schema.parse(process.env);
