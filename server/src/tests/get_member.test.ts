import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { membersTable } from '../db/schema';
import { getMember } from '../handlers/get_member';

// Test member data
const testMemberData = {
  full_name: 'John Doe',
  email: 'john@example.com',
  whatsapp_number: '+1234567890',
  address: '123 Main St, City, Country',
  unique_link: 'member_unique_abc123',
  is_active: true
};

const testReferrerData = {
  full_name: 'Jane Smith',
  email: 'jane@example.com',
  whatsapp_number: '+0987654321',
  address: '456 Oak Ave, Town, Country',
  unique_link: 'referrer_unique_xyz789',
  is_active: true
};

describe('getMember', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return member data when member exists', async () => {
    // Create test member
    const insertResult = await db.insert(membersTable)
      .values(testMemberData)
      .returning()
      .execute();

    const createdMember = insertResult[0];
    
    // Fetch member using handler
    const result = await getMember(createdMember.id);

    // Verify member data
    expect(result).toBeDefined();
    expect(result?.id).toEqual(createdMember.id);
    expect(result?.full_name).toEqual('John Doe');
    expect(result?.email).toEqual('john@example.com');
    expect(result?.whatsapp_number).toEqual('+1234567890');
    expect(result?.address).toEqual('123 Main St, City, Country');
    expect(result?.unique_link).toEqual('member_unique_abc123');
    expect(result?.is_active).toEqual(true);
    expect(result?.referrer_id).toBeNull();
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });

  it('should return member with referrer_id when member has referrer', async () => {
    // Create referrer first
    const referrerResult = await db.insert(membersTable)
      .values(testReferrerData)
      .returning()
      .execute();

    const referrer = referrerResult[0];

    // Create member with referrer
    const memberWithReferrerData = {
      ...testMemberData,
      email: 'referred@example.com', // Different email to avoid unique constraint
      referrer_id: referrer.id
    };

    const memberResult = await db.insert(membersTable)
      .values(memberWithReferrerData)
      .returning()
      .execute();

    const createdMember = memberResult[0];

    // Fetch member using handler
    const result = await getMember(createdMember.id);

    // Verify member data includes referrer_id
    expect(result).toBeDefined();
    expect(result?.id).toEqual(createdMember.id);
    expect(result?.full_name).toEqual('John Doe');
    expect(result?.referrer_id).toEqual(referrer.id);
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when member does not exist', async () => {
    // Try to fetch non-existent member
    const result = await getMember(999999);

    expect(result).toBeNull();
  });

  it('should handle database query correctly for existing member', async () => {
    // Create multiple members
    const member1Result = await db.insert(membersTable)
      .values(testMemberData)
      .returning()
      .execute();

    const member2Data = {
      ...testMemberData,
      email: 'member2@example.com',
      unique_link: 'member2_unique_def456'
    };

    const member2Result = await db.insert(membersTable)
      .values(member2Data)
      .returning()
      .execute();

    const member1 = member1Result[0];
    const member2 = member2Result[0];

    // Fetch specific member - should return correct one
    const result = await getMember(member2.id);

    expect(result).toBeDefined();
    expect(result?.id).toEqual(member2.id);
    expect(result?.email).toEqual('member2@example.com');
    expect(result?.unique_link).toEqual('member2_unique_def456');
    
    // Verify it's not member1
    expect(result?.id).not.toEqual(member1.id);
    expect(result?.email).not.toEqual('john@example.com');
  });

  it('should preserve all boolean and date fields correctly', async () => {
    // Create inactive member
    const inactiveMemberData = {
      ...testMemberData,
      email: 'inactive@example.com',
      is_active: false
    };

    const insertResult = await db.insert(membersTable)
      .values(inactiveMemberData)
      .returning()
      .execute();

    const createdMember = insertResult[0];

    // Fetch member using handler
    const result = await getMember(createdMember.id);

    // Verify boolean field preservation
    expect(result).toBeDefined();
    expect(result?.is_active).toEqual(false);
    expect(typeof result?.is_active).toEqual('boolean');
    
    // Verify date fields are proper Date objects
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
    expect(result?.created_at?.getTime()).toBeGreaterThan(0);
    expect(result?.updated_at?.getTime()).toBeGreaterThan(0);
  });
});