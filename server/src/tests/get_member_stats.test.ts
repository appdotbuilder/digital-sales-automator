import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { membersTable, referralsTable, purchaseEventsTable } from '../db/schema';
import { getMemberStats } from '../handlers/get_member_stats';

describe('getMemberStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return zero stats for member with no referrals', async () => {
    // Create a member with no referrals
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'John Doe',
        email: 'john@example.com',
        whatsapp_number: '1234567890',
        address: '123 Main St',
        unique_link: 'john-unique-link',
        is_active: true
      })
      .returning()
      .execute();

    const memberId = memberResult[0].id;
    const stats = await getMemberStats(memberId);

    expect(stats.total_referrals).toBe(0);
    expect(stats.active_referrals).toBe(0);
    expect(stats.total_earnings).toBe(0);
  });

  it('should calculate total referrals correctly', async () => {
    // Create referrer
    const referrerResult = await db.insert(membersTable)
      .values({
        full_name: 'Referrer User',
        email: 'referrer@example.com',
        whatsapp_number: '1111111111',
        address: '456 Oak Ave',
        unique_link: 'referrer-link',
        is_active: true
      })
      .returning()
      .execute();

    const referrerId = referrerResult[0].id;

    // Create 3 referred members
    const referred1 = await db.insert(membersTable)
      .values({
        full_name: 'Referred One',
        email: 'ref1@example.com',
        whatsapp_number: '2222222222',
        address: '789 Pine St',
        referrer_id: referrerId,
        unique_link: 'ref1-link',
        is_active: true
      })
      .returning()
      .execute();

    const referred2 = await db.insert(membersTable)
      .values({
        full_name: 'Referred Two',
        email: 'ref2@example.com',
        whatsapp_number: '3333333333',
        address: '321 Elm St',
        referrer_id: referrerId,
        unique_link: 'ref2-link',
        is_active: false // Inactive member
      })
      .returning()
      .execute();

    const referred3 = await db.insert(membersTable)
      .values({
        full_name: 'Referred Three',
        email: 'ref3@example.com',
        whatsapp_number: '4444444444',
        address: '654 Maple Dr',
        referrer_id: referrerId,
        unique_link: 'ref3-link',
        is_active: true
      })
      .returning()
      .execute();

    // Create referral records
    await db.insert(referralsTable)
      .values([
        {
          referrer_id: referrerId,
          referred_member_id: referred1[0].id
        },
        {
          referrer_id: referrerId,
          referred_member_id: referred2[0].id
        },
        {
          referrer_id: referrerId,
          referred_member_id: referred3[0].id
        }
      ])
      .execute();

    const stats = await getMemberStats(referrerId);

    expect(stats.total_referrals).toBe(3);
    expect(stats.active_referrals).toBe(2); // Only 2 are active
    expect(stats.total_earnings).toBe(0); // No purchases yet
  });

  it('should calculate earnings from referral commissions correctly', async () => {
    // Create referrer
    const referrerResult = await db.insert(membersTable)
      .values({
        full_name: 'Commission Earner',
        email: 'earner@example.com',
        whatsapp_number: '5555555555',
        address: '999 Revenue St',
        unique_link: 'earner-link',
        is_active: true
      })
      .returning()
      .execute();

    const referrerId = referrerResult[0].id;

    // Create referred member
    const referredResult = await db.insert(membersTable)
      .values({
        full_name: 'Big Spender',
        email: 'spender@example.com',
        whatsapp_number: '6666666666',
        address: '777 Purchase Blvd',
        referrer_id: referrerId,
        unique_link: 'spender-link',
        is_active: true
      })
      .returning()
      .execute();

    const referredId = referredResult[0].id;

    // Create referral record
    await db.insert(referralsTable)
      .values({
        referrer_id: referrerId,
        referred_member_id: referredId
      })
      .execute();

    // Create purchase events for the referred member
    await db.insert(purchaseEventsTable)
      .values([
        {
          member_id: referredId,
          product_name: 'Product A',
          amount: '100.00', // $100 purchase
          status: 'completed'
        },
        {
          member_id: referredId,
          product_name: 'Product B',
          amount: '50.00', // $50 purchase
          status: 'completed'
        },
        {
          member_id: referredId,
          product_name: 'Product C',
          amount: '25.00', // $25 purchase - but pending, should not count
          status: 'pending'
        }
      ])
      .execute();

    const stats = await getMemberStats(referrerId);

    expect(stats.total_referrals).toBe(1);
    expect(stats.active_referrals).toBe(1);
    // 10% commission on $150 completed purchases = $15
    expect(stats.total_earnings).toBe(15.0);
  });

  it('should handle multiple referrals with various purchase amounts', async () => {
    // Create referrer
    const referrerResult = await db.insert(membersTable)
      .values({
        full_name: 'Multi Referrer',
        email: 'multi@example.com',
        whatsapp_number: '7777777777',
        address: '111 Multi St',
        unique_link: 'multi-link',
        is_active: true
      })
      .returning()
      .execute();

    const referrerId = referrerResult[0].id;

    // Create multiple referred members
    const ref1Result = await db.insert(membersTable)
      .values({
        full_name: 'Buyer One',
        email: 'buyer1@example.com',
        whatsapp_number: '8888888888',
        address: '222 Buyer Ave',
        referrer_id: referrerId,
        unique_link: 'buyer1-link',
        is_active: true
      })
      .returning()
      .execute();

    const ref2Result = await db.insert(membersTable)
      .values({
        full_name: 'Buyer Two',
        email: 'buyer2@example.com',
        whatsapp_number: '9999999999',
        address: '333 Purchaser Dr',
        referrer_id: referrerId,
        unique_link: 'buyer2-link',
        is_active: true
      })
      .returning()
      .execute();

    // Create referral records
    await db.insert(referralsTable)
      .values([
        {
          referrer_id: referrerId,
          referred_member_id: ref1Result[0].id
        },
        {
          referrer_id: referrerId,
          referred_member_id: ref2Result[0].id
        }
      ])
      .execute();

    // Create purchases for both referred members
    await db.insert(purchaseEventsTable)
      .values([
        // Purchases by first referred member
        {
          member_id: ref1Result[0].id,
          product_name: 'Premium Course',
          amount: '299.99',
          status: 'completed'
        },
        {
          member_id: ref1Result[0].id,
          product_name: 'Bonus Material',
          amount: '49.99',
          status: 'completed'
        },
        // Purchases by second referred member
        {
          member_id: ref2Result[0].id,
          product_name: 'Basic Package',
          amount: '99.95',
          status: 'completed'
        },
        {
          member_id: ref2Result[0].id,
          product_name: 'Failed Purchase',
          amount: '1000.00',
          status: 'failed' // Should not count towards earnings
        }
      ])
      .execute();

    const stats = await getMemberStats(referrerId);

    expect(stats.total_referrals).toBe(2);
    expect(stats.active_referrals).toBe(2);
    
    // Commission calculation: 10% of (299.99 + 49.99 + 99.95) = 10% of 449.93 = 44.993
    const expectedEarnings = (299.99 + 49.99 + 99.95) * 0.1;
    expect(stats.total_earnings).toBeCloseTo(expectedEarnings, 2);
  });

  it('should only count active members for active_referrals', async () => {
    // Create referrer
    const referrerResult = await db.insert(membersTable)
      .values({
        full_name: 'Activity Tracker',
        email: 'tracker@example.com',
        whatsapp_number: '1010101010',
        address: '444 Active St',
        unique_link: 'tracker-link',
        is_active: true
      })
      .returning()
      .execute();

    const referrerId = referrerResult[0].id;

    // Create active referred member
    const activeRef = await db.insert(membersTable)
      .values({
        full_name: 'Active Member',
        email: 'active@example.com',
        whatsapp_number: '1212121212',
        address: '555 Active Ave',
        referrer_id: referrerId,
        unique_link: 'active-link',
        is_active: true
      })
      .returning()
      .execute();

    // Create inactive referred member
    const inactiveRef = await db.insert(membersTable)
      .values({
        full_name: 'Inactive Member',
        email: 'inactive@example.com',
        whatsapp_number: '1313131313',
        address: '666 Inactive Blvd',
        referrer_id: referrerId,
        unique_link: 'inactive-link',
        is_active: false
      })
      .returning()
      .execute();

    // Create referral records
    await db.insert(referralsTable)
      .values([
        {
          referrer_id: referrerId,
          referred_member_id: activeRef[0].id
        },
        {
          referrer_id: referrerId,
          referred_member_id: inactiveRef[0].id
        }
      ])
      .execute();

    const stats = await getMemberStats(referrerId);

    expect(stats.total_referrals).toBe(2);
    expect(stats.active_referrals).toBe(1); // Only active member counts
    expect(stats.total_earnings).toBe(0);
  });

  it('should return zero earnings when no completed purchases exist', async () => {
    // Create referrer
    const referrerResult = await db.insert(membersTable)
      .values({
        full_name: 'No Earnings',
        email: 'noearnings@example.com',
        whatsapp_number: '1414141414',
        address: '888 Zero St',
        unique_link: 'noearnings-link',
        is_active: true
      })
      .returning()
      .execute();

    const referrerId = referrerResult[0].id;

    // Create referred member
    const referredResult = await db.insert(membersTable)
      .values({
        full_name: 'No Purchaser',
        email: 'nopurchases@example.com',
        whatsapp_number: '1515151515',
        address: '999 Empty Wallet St',
        referrer_id: referrerId,
        unique_link: 'nopurchases-link',
        is_active: true
      })
      .returning()
      .execute();

    // Create referral record
    await db.insert(referralsTable)
      .values({
        referrer_id: referrerId,
        referred_member_id: referredResult[0].id
      })
      .execute();

    // Create only pending/failed purchases
    await db.insert(purchaseEventsTable)
      .values([
        {
          member_id: referredResult[0].id,
          product_name: 'Pending Product',
          amount: '100.00',
          status: 'pending'
        },
        {
          member_id: referredResult[0].id,
          product_name: 'Failed Product',
          amount: '200.00',
          status: 'failed'
        }
      ])
      .execute();

    const stats = await getMemberStats(referrerId);

    expect(stats.total_referrals).toBe(1);
    expect(stats.active_referrals).toBe(1);
    expect(stats.total_earnings).toBe(0); // No completed purchases
  });
});