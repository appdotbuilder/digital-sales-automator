import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { membersTable } from '../db/schema';
import { getMemberByUniqueLink } from '../handlers/get_member_by_unique_link';
import { eq } from 'drizzle-orm';

describe('getMemberByUniqueLink', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return member when unique link exists', async () => {
    // Create test member
    const testMember = {
      full_name: 'John Doe',
      email: 'john@example.com',
      whatsapp_number: '1234567890',
      address: '123 Main St',
      unique_link: 'unique-affiliate-link-123',
      is_active: true
    };

    const insertResult = await db.insert(membersTable)
      .values(testMember)
      .returning()
      .execute();

    const createdMember = insertResult[0];

    // Test the handler
    const result = await getMemberByUniqueLink('unique-affiliate-link-123');

    // Verify member data
    expect(result).toBeDefined();
    expect(result?.id).toEqual(createdMember.id);
    expect(result?.full_name).toEqual('John Doe');
    expect(result?.email).toEqual('john@example.com');
    expect(result?.whatsapp_number).toEqual('1234567890');
    expect(result?.address).toEqual('123 Main St');
    expect(result?.unique_link).toEqual('unique-affiliate-link-123');
    expect(result?.is_active).toEqual(true);
    expect(result?.referrer_id).toBeNull();
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when unique link does not exist', async () => {
    // Test with non-existent unique link
    const result = await getMemberByUniqueLink('non-existent-link');

    expect(result).toBeNull();
  });

  it('should return null for empty unique link', async () => {
    // Test with empty string
    const result = await getMemberByUniqueLink('');

    expect(result).toBeNull();
  });

  it('should return correct member when multiple members exist', async () => {
    // Create multiple test members
    const member1 = {
      full_name: 'Alice Smith',
      email: 'alice@example.com',
      whatsapp_number: '1111111111',
      address: '111 First St',
      unique_link: 'alice-unique-link',
      is_active: true
    };

    const member2 = {
      full_name: 'Bob Johnson',
      email: 'bob@example.com',
      whatsapp_number: '2222222222',
      address: '222 Second St',
      unique_link: 'bob-unique-link',
      is_active: false
    };

    await db.insert(membersTable)
      .values([member1, member2])
      .execute();

    // Test finding first member
    const result1 = await getMemberByUniqueLink('alice-unique-link');
    expect(result1?.full_name).toEqual('Alice Smith');
    expect(result1?.email).toEqual('alice@example.com');
    expect(result1?.is_active).toEqual(true);

    // Test finding second member
    const result2 = await getMemberByUniqueLink('bob-unique-link');
    expect(result2?.full_name).toEqual('Bob Johnson');
    expect(result2?.email).toEqual('bob@example.com');
    expect(result2?.is_active).toEqual(false);
  });

  it('should handle member with referrer correctly', async () => {
    // Create referrer member first
    const referrerResult = await db.insert(membersTable)
      .values({
        full_name: 'Referrer User',
        email: 'referrer@example.com',
        whatsapp_number: '9999999999',
        address: '999 Referrer St',
        unique_link: 'referrer-link',
        is_active: true
      })
      .returning()
      .execute();

    const referrerId = referrerResult[0].id;

    // Create referred member
    const referredMember = {
      full_name: 'Referred User',
      email: 'referred@example.com',
      whatsapp_number: '8888888888',
      address: '888 Referred St',
      referrer_id: referrerId,
      unique_link: 'referred-unique-link',
      is_active: true
    };

    await db.insert(membersTable)
      .values(referredMember)
      .execute();

    // Test finding referred member
    const result = await getMemberByUniqueLink('referred-unique-link');

    expect(result).toBeDefined();
    expect(result?.full_name).toEqual('Referred User');
    expect(result?.referrer_id).toEqual(referrerId);
    expect(result?.unique_link).toEqual('referred-unique-link');
  });

  it('should verify database state after retrieval', async () => {
    // Create test member
    const testMember = {
      full_name: 'Database Test User',
      email: 'dbtest@example.com',
      whatsapp_number: '5555555555',
      address: '555 Test St',
      unique_link: 'database-test-link',
      is_active: true
    };

    await db.insert(membersTable)
      .values(testMember)
      .execute();

    // Use handler to get member
    const handlerResult = await getMemberByUniqueLink('database-test-link');

    // Verify by direct database query
    const dbResult = await db.select()
      .from(membersTable)
      .where(eq(membersTable.unique_link, 'database-test-link'))
      .execute();

    expect(dbResult).toHaveLength(1);
    expect(handlerResult?.id).toEqual(dbResult[0].id);
    expect(handlerResult?.full_name).toEqual(dbResult[0].full_name);
    expect(handlerResult?.email).toEqual(dbResult[0].email);
    expect(handlerResult?.unique_link).toEqual(dbResult[0].unique_link);
  });

  it('should handle special characters in unique link', async () => {
    // Create member with special characters in unique link
    const testMember = {
      full_name: 'Special User',
      email: 'special@example.com',
      whatsapp_number: '7777777777',
      address: '777 Special St',
      unique_link: 'special-link_with-chars.123',
      is_active: true
    };

    await db.insert(membersTable)
      .values(testMember)
      .execute();

    // Test retrieval
    const result = await getMemberByUniqueLink('special-link_with-chars.123');

    expect(result).toBeDefined();
    expect(result?.full_name).toEqual('Special User');
    expect(result?.unique_link).toEqual('special-link_with-chars.123');
  });
});