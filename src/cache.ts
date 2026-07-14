import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "./util";

const CACHE_DIR = path.join(process.cwd(), ".cache");

const getCacheFilePath = (key: string): string => {
  const hash = crypto.createHash("md5").update(key).digest("hex");
  return path.join(CACHE_DIR, `${hash}.json`);
};

export const getCache = <T>(key: string): T | null => {
  try {
    const filePath = getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      logger.debug(`Cache hit for key: ${key}`);
      return JSON.parse(content) as T;
    }
  } catch (err) {
    logger.warn(`Failed to read cache for key ${key}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
};

export const getCacheWithTtl = <T>(key: string, maxAgeMs: number): T | null => {
  try {
    const filePath = getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs <= maxAgeMs) {
        const content = fs.readFileSync(filePath, "utf-8");
        logger.debug(`Cache hit for key: ${key} (age: ${Math.round(ageMs / 1000)}s)`);
        return JSON.parse(content) as T;
      } else {
        logger.debug(`Cache expired for key: ${key} (age: ${Math.round(ageMs / 1000)}s, max: ${Math.round(maxAgeMs / 1000)}s)`);
      }
    }
  } catch (err) {
    logger.warn(`Failed to read cache for key ${key}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
};

export const setCache = <T>(key: string, value: T): void => {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const filePath = getCacheFilePath(key);
    fs.writeFileSync(filePath, JSON.stringify(value), "utf-8");
    logger.debug(`Cache save for key: ${key}`);
  } catch (err) {
    logger.warn(`Failed to write cache for key ${key}: ${err instanceof Error ? err.message : String(err)}`);
  }
};
