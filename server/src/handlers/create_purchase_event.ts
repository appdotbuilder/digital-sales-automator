import { db } from '../db';
import { purchaseEventsTable, membersTable, notificationLogsTable, referralsTable } from '../db/schema';
import { type CreatePurchaseInput, type PurchaseEvent } from '../schema';
import { eq } from 'drizzle-orm';

export const createPurchaseEvent = async (input: CreatePurchaseInput): Promise<PurchaseEvent> => {
  try {
    // 1. Verify the member exists first
    const members = await db.select()
      .from(membersTable)
      .where(eq(membersTable.id, input.member_id))
      .execute();

    if (members.length === 0) {
      throw new Error(`Member with ID ${input.member_id} not found`);
    }

    const member = members[0];

    // 2. Create the purchase event record
    const result = await db.insert(purchaseEventsTable)
      .values({
        member_id: input.member_id,
        product_name: input.product_name,
        amount: input.amount.toString(), // Convert number to string for numeric column
        status: 'pending'
      })
      .returning()
      .execute();

    const purchaseEvent = result[0];

    // 3. Send purchase confirmation notifications (email and WhatsApp)
    const notificationMessage = `Purchase confirmed: ${input.product_name} for $${input.amount}`;
    
    // Insert email notification log
    await db.insert(notificationLogsTable)
      .values({
        member_id: input.member_id,
        type: 'email',
        event_type: 'purchase_confirmation',
        status: 'pending',
        message_content: notificationMessage
      })
      .execute();

    // Insert WhatsApp notification log
    await db.insert(notificationLogsTable)
      .values({
        member_id: input.member_id,
        type: 'whatsapp',
        event_type: 'purchase_confirmation',
        status: 'pending',
        message_content: notificationMessage
      })
      .execute();

    // 4. Process referral commissions if member has a referrer
    if (member.referrer_id) {
      // Create referral notification for the referrer
      const referralMessage = `Your referral ${member.full_name} made a purchase: ${input.product_name} for $${input.amount}`;
      
      await db.insert(notificationLogsTable)
        .values({
          member_id: member.referrer_id,
          type: 'email',
          event_type: 'referral_notification',
          status: 'pending',
          message_content: referralMessage
        })
        .execute();

      await db.insert(notificationLogsTable)
        .values({
          member_id: member.referrer_id,
          type: 'whatsapp',
          event_type: 'referral_notification',
          status: 'pending',
          message_content: referralMessage
        })
        .execute();
    }

    // 5. Return the created purchase event with proper type conversion
    return {
      ...purchaseEvent,
      amount: parseFloat(purchaseEvent.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Purchase event creation failed:', error);
    throw error;
  }
};