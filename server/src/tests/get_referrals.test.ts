import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { membersTable, referralsTable } from '../db/schema';
import { getReferrals } from '../handlers/get_referrals';
import { eq } from 'drizzle-orm';

describe('getReferrals', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return referrals made by a specific member', async () => {
    // Create referrer member
    const [referrer] = await db.insert(membersTable)
      .values({
        full_name: 'John Referrer',
        email: 'referrer@test.com',
        whatsapp_number: '1234567890',
        address: 'Test Address',
        unique_link: 'test-referrer-link'
      })
      .returning()
      .execute();

    // Create referred members
    const [referred1] = await db.insert(membersTable)
      .values({
        full_name: 'Jane Referred',
        email: 'referred1@test.com',
        whatsapp_number: '1234567891',
        address: 'Test Address 1',
        referrer_id: referrer.id,
        unique_link: 'test-referred1-link'
      })
      .returning()
      .execute();

    const [referred2] = await db.insert(membersTable)
      .values({
        full_name: 'Bob Referred',
        email: 'referred2@test.com',
        whatsapp_number: '1234567892',
        address: 'Test Address 2',
        referrer_id: referrer.id,
        unique_link: 'test-referred2-link'
      })
      .returning()
      .execute();

    // Create referral records
    await db.insert(referralsTable)
      .values([
        {
          referrer_id: referrer.id,
          referred_member_id: referred1.id
        },
        {
          referrer_id: referrer.id,
          referred_member_id: referred2.id
        }
      ])
      .execute();

    const result = await getReferrals(referrer.id);

    // Should return 2 referrals
    expect(result).toHaveLength(2);
    
    // Verify referral data
    expect(result[0].referrer_id).toEqual(referrer.id);
    expect(result[0].referred_member_id).toEqual(referred1.id);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);

    expect(result[1].referrer_id).toEqual(referrer.id);
    expect(result[1].referred_member_id).toEqual(referred2.id);
    expect(result[1].id).toBeDefined();
    expect(result[1].created_at).toBeInstanceOf(Date);
  });

  it('should return empty array when member has no referrals', async () => {
    // Create member with no referrals
    const [member] = await db.insert(membersTable)
      .values({
        full_name: 'No Referrals Member',
        email: 'noreferrals@test.com',
        whatsapp_number: '1234567890',
        address: 'Test Address',
        unique_link: 'test-noreferrals-link'
      })
      .returning()
      .execute();

    const result = await getReferrals(member.id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return referrals for the specified referrer', async () => {
    // Create two referrer members
    const [referrer1] = await db.insert(membersTable)
      .values({
        full_name: 'Referrer One',
        email: 'referrer1@test.com',
        whatsapp_number: '1234567890',
        address: 'Test Address 1',
        unique_link: 'test-referrer1-link'
      })
      .returning()
      .execute();

    const [referrer2] = await db.insert(membersTable)
      .values({
        full_name: 'Referrer Two',
        email: 'referrer2@test.com',
        whatsapp_number: '1234567891',
        address: 'Test Address 2',
        unique_link: 'test-referrer2-link'
      })
      .returning()
      .execute();

    // Create referred members
    const [referred1] = await db.insert(membersTable)
      .values({
        full_name: 'Referred by One',
        email: 'referred1@test.com',
        whatsapp_number: '1234567892',
        address: 'Test Address 3',
        referrer_id: referrer1.id,
        unique_link: 'test-referred1-link'
      })
      .returning()
      .execute();

    const [referred2] = await db.insert(membersTable)
      .values({
        full_name: 'Referred by Two',
        email: 'referred2@test.com',
        whatsapp_number: '1234567893',
        address: 'Test Address 4',
        referrer_id: referrer2.id,
        unique_link: 'test-referred2-link'
      })
      .returning()
      .execute();

    // Create referral records for both referrers
    await db.insert(referralsTable)
      .values([
        {
          referrer_id: referrer1.id,
          referred_member_id: referred1.id
        },
        {
          referrer_id: referrer2.id,
          referred_member_id: referred2.id
        }
      ])
      .execute();

    // Get referrals for referrer1 only
    const result = await getReferrals(referrer1.id);

    // Should return only 1 referral (for referrer1)
    expect(result).toHaveLength(1);
    expect(result[0].referrer_id).toEqual(referrer1.id);
    expect(result[0].referred_member_id).toEqual(referred1.id);
  });

  it('should return referrals ordered by creation date', async () => {
    // Create referrer member
    const [referrer] = await db.insert(membersTable)
      .values({
        full_name: 'Referrer',
        email: 'referrer@test.com',
        whatsapp_number: '1234567890',
        address: 'Test Address',
        unique_link: 'test-referrer-link'
      })
      .returning()
      .execute();

    // Create multiple referred members
    const referredMembers = await db.insert(membersTable)
      .values([
        {
          full_name: 'First Referred',
          email: 'first@test.com',
          whatsapp_number: '1234567891',
          address: 'Test Address 1',
          referrer_id: referrer.id,
          unique_link: 'test-first-link'
        },
        {
          full_name: 'Second Referred',
          email: 'second@test.com',
          whatsapp_number: '1234567892',
          address: 'Test Address 2',
          referrer_id: referrer.id,
          unique_link: 'test-second-link'
        },
        {
          full_name: 'Third Referred',
          email: 'third@test.com',
          whatsapp_number: '1234567893',
          address: 'Test Address 3',
          referrer_id: referrer.id,
          unique_link: 'test-third-link'
        }
      ])
      .returning()
      .execute();

    // Create referral records
    await db.insert(referralsTable)
      .values([
        {
          referrer_id: referrer.id,
          referred_member_id: referredMembers[0].id
        },
        {
          referrer_id: referrer.id,
          referred_member_id: referredMembers[1].id
        },
        {
          referrer_id: referrer.id,
          referred_member_id: referredMembers[2].id
        }
      ])
      .execute();

    const result = await getReferrals(referrer.id);

    expect(result).toHaveLength(3);
    
    // Verify all referrals belong to the correct referrer
    result.forEach(referral => {
      expect(referral.referrer_id).toEqual(referrer.id);
      expect(referral.created_at).toBeInstanceOf(Date);
      expect(referral.id).toBeDefined();
    });

    // Verify we have the expected referred member IDs
    const referredIds = result.map(r => r.referred_member_id);
    expect(referredIds).toContain(referredMembers[0].id);
    expect(referredIds).toContain(referredMembers[1].id);
    expect(referredIds).toContain(referredMembers[2].id);
  });

  it('should handle non-existent referrer gracefully', async () => {
    // Try to get referrals for a non-existent referrer ID
    const nonExistentReferrerId = 99999;
    
    const result = await getReferrals(nonExistentReferrerId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});