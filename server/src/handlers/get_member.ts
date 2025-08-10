import { db } from '../db';
import { membersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Member } from '../schema';

export const getMember = async (memberId: number): Promise<Member | null> => {
  try {
    // Fetch member data by ID
    const results = await db.select()
      .from(membersTable)
      .where(eq(membersTable.id, memberId))
      .execute();

    // Return null if member not found
    if (results.length === 0) {
      return null;
    }

    const member = results[0];

    // Return member with proper type conversions (no numeric fields in members table)
    return {
      ...member,
      // All fields are already properly typed from the database
    };
  } catch (error) {
    console.error('Member fetch failed:', error);
    throw error;
  }
};