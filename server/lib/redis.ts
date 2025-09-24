import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

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
    const key = this.getTicketKey(walletAddress);
    const tickets = await redis.get(key);
    
    if (tickets === null) {
      // First time user, give them 3 tickets for 24 hours
      await redis.setex(key, 24 * 60 * 60, "3");
      return 3;
    }
    
    return parseInt(tickets, 10);
  }

  async consumeTicket(walletAddress: string): Promise<boolean> {
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
  }

  async resetTickets(walletAddress: string): Promise<void> {
    const key = this.getTicketKey(walletAddress);
    await redis.setex(key, 24 * 60 * 60, "3");
  }
}

export const ticketManager = new RedisTicketManager();
