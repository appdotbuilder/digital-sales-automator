import { db } from '../db';
import { referralsTable } from '../db/schema';
import { type Referral } from '../schema';
import { eq } from 'drizzle-orm';

export const getReferrals = async (referrerId: number): Promise<Referral[]> => {
  try {
    // Fetch all referrals made by a specific member
    const results = await db.select()
      .from(referralsTable)
      .where(eq(referralsTable.referrer_id, referrerId))
      .execute();

    return results;
  } catch (error) {
    console.error('Get referrals failed:', error);
    throw error;
  }
};