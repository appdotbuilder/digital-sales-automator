import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum definitions
export const notificationTypeEnum = pgEnum('notification_type', ['email', 'whatsapp']);
export const notificationEventTypeEnum = pgEnum('notification_event_type', ['welcome', 'purchase_confirmation', 'referral_notification']);
export const notificationStatusEnum = pgEnum('notification_status', ['sent', 'failed', 'pending']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['pending', 'completed', 'failed']);

// Members table - core user data
export const membersTable = pgTable('members', {
  id: serial('id').primaryKey(),
  full_name: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  whatsapp_number: text('whatsapp_number').notNull(),
  address: text('address').notNull(),
  referrer_id: integer('referrer_id'), // Self-referencing foreign key
  unique_link: text('unique_link').notNull().unique(), // Generated unique affiliate link
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Digital products table
export const digitalProductsTable = pgTable('digital_products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  download_url: text('download_url'), // Nullable
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Purchase events table
export const purchaseEventsTable = pgTable('purchase_events', {
  id: serial('id').primaryKey(),
  member_id: integer('member_id').notNull(),
  product_name: text('product_name').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: purchaseStatusEnum('status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Notification logs table for tracking sent messages
export const notificationLogsTable = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  member_id: integer('member_id').notNull(),
  type: notificationTypeEnum('type').notNull(),
  event_type: notificationEventTypeEnum('event_type').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  message_content: text('message_content'), // Nullable
  sent_at: timestamp('sent_at'), // Nullable - set when actually sent
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Referrals table for tracking referrer-referred relationships
export const referralsTable = pgTable('referrals', {
  id: serial('id').primaryKey(),
  referrer_id: integer('referrer_id').notNull(),
  referred_member_id: integer('referred_member_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations for proper query building
export const membersRelations = relations(membersTable, ({ one, many }) => ({
  referrer: one(membersTable, {
    fields: [membersTable.referrer_id],
    references: [membersTable.id],
    relationName: 'referrer'
  }),
  referrals: many(referralsTable, {
    relationName: 'referrer_referrals'
  }),
  purchaseEvents: many(purchaseEventsTable),
  notificationLogs: many(notificationLogsTable)
}));

export const purchaseEventsRelations = relations(purchaseEventsTable, ({ one }) => ({
  member: one(membersTable, {
    fields: [purchaseEventsTable.member_id],
    references: [membersTable.id]
  })
}));

export const notificationLogsRelations = relations(notificationLogsTable, ({ one }) => ({
  member: one(membersTable, {
    fields: [notificationLogsTable.member_id],
    references: [membersTable.id]
  })
}));

export const referralsRelations = relations(referralsTable, ({ one }) => ({
  referrer: one(membersTable, {
    fields: [referralsTable.referrer_id],
    references: [membersTable.id],
    relationName: 'referrer_referrals'
  }),
  referredMember: one(membersTable, {
    fields: [referralsTable.referred_member_id],
    references: [membersTable.id]
  })
}));

// TypeScript types for the table schemas
export type Member = typeof membersTable.$inferSelect;
export type NewMember = typeof membersTable.$inferInsert;

export type DigitalProduct = typeof digitalProductsTable.$inferSelect;
export type NewDigitalProduct = typeof digitalProductsTable.$inferInsert;

export type PurchaseEvent = typeof purchaseEventsTable.$inferSelect;
export type NewPurchaseEvent = typeof purchaseEventsTable.$inferInsert;

export type NotificationLog = typeof notificationLogsTable.$inferSelect;
export type NewNotificationLog = typeof notificationLogsTable.$inferInsert;

export type Referral = typeof referralsTable.$inferSelect;
export type NewReferral = typeof referralsTable.$inferInsert;

// Export all tables for proper relation queries
export const tables = {
  members: membersTable,
  digitalProducts: digitalProductsTable,
  purchaseEvents: purchaseEventsTable,
  notificationLogs: notificationLogsTable,
  referrals: referralsTable
};