import { z } from 'zod';

// Member schema for database records
export const memberSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  email: z.string().email(),
  whatsapp_number: z.string(),
  address: z.string(),
  referrer_id: z.number().nullable(), // ID of the member who referred this user
  unique_link: z.string(), // Unique affiliate/reseller link for this member
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Member = z.infer<typeof memberSchema>;

// Input schema for member registration
export const registerMemberInputSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format"),
  whatsapp_number: z.string().min(10, "WhatsApp number must be at least 10 digits"),
  address: z.string().min(1, "Address is required"),
  referrer_link: z.string().optional() // Optional referrer link from URL
});

export type RegisterMemberInput = z.infer<typeof registerMemberInputSchema>;

// Purchase event schema
export const purchaseEventSchema = z.object({
  id: z.number(),
  member_id: z.number(),
  product_name: z.string(),
  amount: z.number(),
  status: z.enum(['pending', 'completed', 'failed']),
  created_at: z.coerce.date()
});

export type PurchaseEvent = z.infer<typeof purchaseEventSchema>;

// Input schema for creating purchase events
export const createPurchaseInputSchema = z.object({
  member_id: z.number(),
  product_name: z.string(),
  amount: z.number().positive()
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseInputSchema>;

// Digital product schema
export const digitalProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  download_url: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date()
});

export type DigitalProduct = z.infer<typeof digitalProductSchema>;

// Input schema for creating products
export const createProductInputSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().nullable().optional(),
  price: z.number().positive("Price must be positive"),
  download_url: z.string().url().nullable().optional()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

// Notification log schema for tracking sent messages
export const notificationLogSchema = z.object({
  id: z.number(),
  member_id: z.number(),
  type: z.enum(['email', 'whatsapp']),
  event_type: z.enum(['welcome', 'purchase_confirmation', 'referral_notification']),
  status: z.enum(['sent', 'failed', 'pending']),
  message_content: z.string().nullable(),
  sent_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type NotificationLog = z.infer<typeof notificationLogSchema>;

// Input schema for sending notifications
export const sendNotificationInputSchema = z.object({
  member_id: z.number(),
  type: z.enum(['email', 'whatsapp']),
  event_type: z.enum(['welcome', 'purchase_confirmation', 'referral_notification']),
  message_content: z.string()
});

export type SendNotificationInput = z.infer<typeof sendNotificationInputSchema>;

// Referral tracking schema
export const referralSchema = z.object({
  id: z.number(),
  referrer_id: z.number(),
  referred_member_id: z.number(),
  created_at: z.coerce.date()
});

export type Referral = z.infer<typeof referralSchema>;

// Member stats schema for dashboard
export const memberStatsSchema = z.object({
  total_referrals: z.number(),
  active_referrals: z.number(),
  total_earnings: z.number()
});

export type MemberStats = z.infer<typeof memberStatsSchema>;