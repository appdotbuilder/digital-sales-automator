import { db } from '../db';
import { notificationLogsTable } from '../db/schema';
import { type NotificationLog } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getNotificationLogs = async (memberId: number): Promise<NotificationLog[]> => {
  try {
    // Query notification logs for the specific member, ordered by creation date (newest first)
    const results = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, memberId))
      .orderBy(desc(notificationLogsTable.created_at))
      .execute();

    // Return the results with proper date handling and structure
    return results.map(log => ({
      ...log,
      // Dates are already Date objects from the database, no conversion needed
      sent_at: log.sent_at,
      created_at: log.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch notification logs:', error);
    throw error;
  }
};