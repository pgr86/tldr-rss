import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const CACHE_DIR = "./.cache";
const READ_STATUS_FILE = path.join(CACHE_DIR, "read_status.json");

let readUrls: Set<string> = new Set();
let loaded = false;

// Load read status from disk
const loadReadStatus = (): void => {
  try {
    if (existsSync(READ_STATUS_FILE)) {
      const data = readFileSync(READ_STATUS_FILE, "utf-8");
      const urls = JSON.parse(data);
      if (Array.isArray(urls)) {
        readUrls = new Set(urls);
      }
    }
  } catch (error) {
    console.error("Failed to load read status:", error);
  }
};

const ensureLoaded = (): void => {
  if (!loaded) {
    loadReadStatus();
    loaded = true;
  }
};

// Save read status to file
const saveReadStatus = (): void => {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    const arr = Array.from(readUrls);
    // Keep list size reasonable (max 1000 items, more than enough for last 10 days of news)
    if (arr.length > 1000) {
      const pruned = arr.slice(arr.length - 1000);
      readUrls = new Set(pruned);
      writeFileSync(READ_STATUS_FILE, JSON.stringify(pruned), "utf-8");
    } else {
      writeFileSync(READ_STATUS_FILE, JSON.stringify(arr), "utf-8");
    }
  } catch (error) {
    console.error("Failed to save read status:", error);
  }
};

// Mark a URL as read
export const markAsRead = (url: string): void => {
  ensureLoaded();
  if (!readUrls.has(url)) {
    readUrls.add(url);
    saveReadStatus();
  }
};

// Check if a URL is read
export const isRead = (url: string): boolean => {
  ensureLoaded();
  return readUrls.has(url);
};
