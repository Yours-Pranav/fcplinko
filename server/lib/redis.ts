import Redis from "ioredis";

// Create Redis client with connection error handling
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

// In-memory fallback storage for when Redis is not available
const memoryStore = new Map<string, { tickets: number; expiry: number }>();

let redisAvailable = false;

// Test Redis connection
redis.ping()
  .then(() => {
    redisAvailable = true;
    console.log("Redis connected successfully");
  })
  .catch(() => {
    redisAvailable = false;
    console.log("Redis not available, using in-memory fallback for tickets");
  });

// Handle Redis connection errors gracefully
redis.on('error', () => {
  redisAvailable = false;
});

export interface TicketManager {
  getRemainingTickets(walletAddress: string): Promise<number>;
  consumeTicket(walletAddress: string): Promise<boolean>;
  resetTickets(walletAddress: string): Promise<void>;
}

export class RedisTicketManager implements TicketManager {
  private getTicketKey(walletAddress: string): string {
    return `tickets:${walletAddress.toLowerCase()}`;
  }

  async getRemainingTickets(walletAddress: string): Promise<number> {
    if (!redisAvailable) {
      return this.getTicketsFromMemory(walletAddress);
    }

    try {
      const key = this.getTicketKey(walletAddress);
      const tickets = await redis.get(key);
      
      if (tickets === null) {
        // First time user, give them 3 tickets for 24 hours
        await redis.setex(key, 24 * 60 * 60, "3");
        return 3;
      }
      
      return parseInt(tickets, 10);
    } catch (error) {
      console.warn("Redis error, falling back to memory:", error);
      redisAvailable = false;
      return this.getTicketsFromMemory(walletAddress);
    }
  }

  async consumeTicket(walletAddress: string): Promise<boolean> {
    if (!redisAvailable) {
      return this.consumeTicketFromMemory(walletAddress);
    }

    try {
      const key = this.getTicketKey(walletAddress);
      const result = await redis.eval(
        `
        local current = redis.call('GET', KEYS[1])
        if current == false then
          redis.call('SETEX', KEYS[1], 86400, '2')
          return 1
        end
        current = tonumber(current)
        if current > 0 then
          redis.call('DECR', KEYS[1])
          return 1
        else
          return 0
        end
        `,
        1,
        key
      ) as number;
      
      return result === 1;
    } catch (error) {
      console.warn("Redis error, falling back to memory:", error);
      redisAvailable = false;
      return this.consumeTicketFromMemory(walletAddress);
    }
  }

  async resetTickets(walletAddress: string): Promise<void> {
    if (!redisAvailable) {
      this.resetTicketsInMemory(walletAddress);
      return;
    }

    try {
      const key = this.getTicketKey(walletAddress);
      await redis.setex(key, 24 * 60 * 60, "3");
    } catch (error) {
      console.warn("Redis error, falling back to memory:", error);
      redisAvailable = false;
      this.resetTicketsInMemory(walletAddress);
    }
  }

  // Memory fallback methods
  private getTicketsFromMemory(walletAddress: string): number {
    const key = this.getTicketKey(walletAddress);
    const data = memoryStore.get(key);
    
    if (!data || Date.now() > data.expiry) {
      // First time or expired, give 3 tickets for 24 hours
      const expiry = Date.now() + (24 * 60 * 60 * 1000);
      memoryStore.set(key, { tickets: 3, expiry });
      return 3;
    }
    
    return data.tickets;
  }

  private consumeTicketFromMemory(walletAddress: string): boolean {
    const key = this.getTicketKey(walletAddress);
    const data = memoryStore.get(key);
    
    if (!data || Date.now() > data.expiry) {
      // First time or expired, give 3 tickets and consume 1
      const expiry = Date.now() + (24 * 60 * 60 * 1000);
      memoryStore.set(key, { tickets: 2, expiry });
      return true;
    }
    
    if (data.tickets > 0) {
      data.tickets--;
      memoryStore.set(key, data);
      return true;
    }
    
    return false;
  }

  private resetTicketsInMemory(walletAddress: string): void {
    const key = this.getTicketKey(walletAddress);
    const expiry = Date.now() + (24 * 60 * 60 * 1000);
    memoryStore.set(key, { tickets: 3, expiry });
  }
}

export const ticketManager = new RedisTicketManager();
