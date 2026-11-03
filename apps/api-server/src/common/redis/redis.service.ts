import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { envConfig } from "../config/env.config";
import { createLogger } from "@asn/logger";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | null = null;
  private inMemoryStore = new Map<
    string,
    { value: string; expiresAt?: number }
  >();
  private readonly logger = createLogger("RedisService");
  private isConnected = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    try {
      this.client = new Redis(envConfig.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Do not spam reconnects in offline test mode
        lazyConnect: true,
      });

      // Suppress unhandled EventEmitter errors when Redis is not running in test mode
      this.client.on("error", () => {
        this.isConnected = false;
      });

      this.client
        .connect()
        .then(() => {
          this.isConnected = true;
          this.logger.info("Connected to Redis service successfully");
        })
        .catch(() => {
          this.isConnected = false;
          this.logger.warn(
            "Redis unavailable. Running with in-memory cache fallback",
          );
        });
    } catch {
      this.isConnected = false;
      this.logger.warn(
        "Failed to initialize Redis client. Using in-memory fallback",
      );
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch {
        // Fallback to in-memory on unexpected Redis error
      }
    }

    const item = this.inMemoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.inMemoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, "EX", ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch {
        // Fallback to in-memory
      }
    }

    this.inMemoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch {
        // Ignore
      }
    }
    this.inMemoryStore.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (this.isConnected && this.client) {
      try {
        const val = await this.client.incr(key);
        if (ttlSeconds && val === 1) {
          await this.client.expire(key, ttlSeconds);
        }
        return val;
      } catch {
        // Fallback
      }
    }

    const currentStr = await this.get(key);
    const count = (currentStr ? parseInt(currentStr, 10) : 0) + 1;
    await this.set(key, count.toString(), ttlSeconds);
    return count;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }
}
