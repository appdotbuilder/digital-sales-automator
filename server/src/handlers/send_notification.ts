import { db } from '../db';
import { notificationLogsTable, membersTable } from '../db/schema';
import { type SendNotificationInput, type NotificationLog } from '../schema';
import { eq } from 'drizzle-orm';

export const sendNotification = async (input: SendNotificationInput): Promise<NotificationLog> => {
  try {
    // First verify the member exists
    const member = await db.select()
      .from(membersTable)
      .where(eq(membersTable.id, input.member_id))
      .execute();

    if (member.length === 0) {
      throw new Error(`Member with id ${input.member_id} not found`);
    }

    // Simulate sending notification (placeholder for actual notification service)
    let notificationStatus: 'sent' | 'failed' = 'sent';
    let sentAt: Date | null = new Date();

    try {
      // Here would be the actual notification sending logic
      // For email: use email service (SendGrid, AWS SES, etc.)
      // For WhatsApp: use WhatsApp Business API
      
      if (input.type === 'email') {
        // Simulate email sending
        console.log(`Sending email to member ${input.member_id}: ${input.message_content}`);
      } else if (input.type === 'whatsapp') {
        // Simulate WhatsApp sending
        console.log(`Sending WhatsApp to member ${input.member_id}: ${input.message_content}`);
      }
      
      // In real implementation, catch specific errors from notification services
      // and set status accordingly
    } catch (sendError) {
      console.error('Failed to send notification:', sendError);
      notificationStatus = 'failed';
      sentAt = null;
    }

    // Log the notification attempt in the database
    const result = await db.insert(notificationLogsTable)
      .values({
        member_id: input.member_id,
        type: input.type,
        event_type: input.event_type,
        status: notificationStatus,
        message_content: input.message_content,
        sent_at: sentAt
      })
      .returning()
      .execute();

    const notificationLog = result[0];
    
    return {
      ...notificationLog,
      sent_at: notificationLog.sent_at // Keep as Date | null from database
    };
  } catch (error) {
    console.error('Notification sending failed:', error);
    throw error;
  }
};