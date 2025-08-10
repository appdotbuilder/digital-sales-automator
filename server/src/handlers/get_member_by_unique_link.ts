import { db } from '../db';
import { membersTable } from '../db/schema';
import { type Member } from '../schema';
import { eq } from 'drizzle-orm';

export const getMemberByUniqueLink = async (uniqueLink: string): Promise<Member | null> => {
  try {
    // Query member by unique link
    const result = await db.select()
      .from(membersTable)
      .where(eq(membersTable.unique_link, uniqueLink))
      .execute();

    // Return null if no member found
    if (result.length === 0) {
      return null;
    }

    // Return the member (no numeric conversions needed for this table)
    return result[0];
  } catch (error) {
    console.error('Failed to get member by unique link:', error);
    throw error;
  }
};