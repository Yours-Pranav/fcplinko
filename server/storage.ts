import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users, vouchers, dropHistory, type User, type InsertUser, type Voucher, type DropHistory, type InsertVoucher, type InsertDropHistory } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByWallet(walletAddress: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Voucher methods
  createVoucher(voucher: InsertVoucher): Promise<Voucher>;
  getVouchersByUser(walletAddress: string): Promise<Voucher[]>;
  getVoucherByNonce(nonce: string): Promise<Voucher | undefined>;
  markVoucherRedeemed(nonce: string, txHash: string): Promise<void>;
  
  // Drop history methods
  createDropHistory(drop: InsertDropHistory): Promise<DropHistory>;
  getDropHistoryByUser(userId: number): Promise<DropHistory[]>;
}

export class PostgresStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByWallet(walletAddress: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.walletAddress, walletAddress.toLowerCase()));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...user,
      walletAddress: user.walletAddress.toLowerCase()
    }).returning();
    return result[0];
  }

  async createVoucher(voucher: InsertVoucher): Promise<Voucher> {
    const result = await db.insert(vouchers).values(voucher).returning();
    return result[0];
  }

  async getVouchersByUser(walletAddress: string): Promise<Voucher[]> {
    const result = await db.select().from(vouchers)
      .where(eq(vouchers.recipient, walletAddress.toLowerCase()))
      .orderBy(desc(vouchers.issuedAt));
    return result;
  }

  async getVoucherByNonce(nonce: string): Promise<Voucher | undefined> {
    const result = await db.select().from(vouchers).where(eq(vouchers.nonce, nonce));
    return result[0];
  }

  async markVoucherRedeemed(nonce: string, txHash: string): Promise<void> {
    await db.update(vouchers)
      .set({ redeemedAt: new Date(), txHash })
      .where(eq(vouchers.nonce, nonce));
  }

  async createDropHistory(drop: InsertDropHistory): Promise<DropHistory> {
    const result = await db.insert(dropHistory).values(drop).returning();
    return result[0];
  }

  async getDropHistoryByUser(userId: number): Promise<DropHistory[]> {
    const result = await db.select().from(dropHistory)
      .where(eq(dropHistory.userId, userId))
      .orderBy(desc(dropHistory.createdAt));
    return result;
  }
}

export const storage = new PostgresStorage();
