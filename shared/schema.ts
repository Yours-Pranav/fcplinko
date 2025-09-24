import { pgTable, text, serial, integer, boolean, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  farcasterHandle: text("farcaster_handle"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  amountCents: integer("amount_cents").notNull(),
  nonce: text("nonce").notNull().unique(),
  expiry: bigint("expiry", { mode: "number" }).notNull(),
  signature: text("signature").notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  redeemedAt: timestamp("redeemed_at"),
  txHash: text("tx_hash"),
});

export const dropHistory = pgTable("drop_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  amountCents: integer("amount_cents").notNull(),
  pathData: text("path_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  voucherId: integer("voucher_id").references(() => vouchers.id),
});

export const insertUserSchema = createInsertSchema(users).pick({
  walletAddress: true,
  farcasterHandle: true,
});

export const insertVoucherSchema = createInsertSchema(vouchers);
export const insertDropHistorySchema = createInsertSchema(dropHistory);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Voucher = typeof vouchers.$inferSelect;
export type DropHistory = typeof dropHistory.$inferSelect;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type InsertDropHistory = z.infer<typeof insertDropHistorySchema>;
