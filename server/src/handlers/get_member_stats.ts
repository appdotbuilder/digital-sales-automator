import { db } from '../db';
import { membersTable, referralsTable, purchaseEventsTable } from '../db/schema';
import { type MemberStats } from '../schema';
import { eq, and, count, sum } from 'drizzle-orm';

export const getMemberStats = async (memberId: number): Promise<MemberStats> => {
  try {
    // 1. Calculate total number of referrals for the member
    const totalReferralsResult = await db.select({ count: count() })
      .from(referralsTable)
      .where(eq(referralsTable.referrer_id, memberId))
      .execute();

    const total_referrals = totalReferralsResult[0]?.count || 0;

    // 2. Count active referrals (members who are still active)
    const activeReferralsResult = await db.select({ count: count() })
      .from(referralsTable)
      .innerJoin(membersTable, eq(referralsTable.referred_member_id, membersTable.id))
      .where(
        and(
          eq(referralsTable.referrer_id, memberId),
          eq(membersTable.is_active, true)
        )
      )
      .execute();

    const active_referrals = activeReferralsResult[0]?.count || 0;

    // 3. Calculate total earnings from referral commissions
    // This calculates 10% commission from purchases made by referred members
    const earningsResult = await db.select({ 
      total: sum(purchaseEventsTable.amount) 
    })
      .from(purchaseEventsTable)
      .innerJoin(referralsTable, eq(purchaseEventsTable.member_id, referralsTable.referred_member_id))
      .where(
        and(
          eq(referralsTable.referrer_id, memberId),
          eq(purchaseEventsTable.status, 'completed')
        )
      )
      .execute();

    // Calculate 10% commission and convert to number
    const totalPurchaseAmount = earningsResult[0]?.total ? parseFloat(earningsResult[0].total) : 0;
    const total_earnings = totalPurchaseAmount * 0.1; // 10% commission

    return {
      total_referrals,
      active_referrals,
      total_earnings
    };
  } catch (error) {
    console.error('Get member stats failed:', error);
    throw error;
  }
};