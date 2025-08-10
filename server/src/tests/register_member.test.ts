import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { membersTable, referralsTable, notificationLogsTable } from '../db/schema';
import { type RegisterMemberInput } from '../schema';
import { registerMember } from '../handlers/register_member';
import { eq } from 'drizzle-orm';

// Test input for member registration
const testInput: RegisterMemberInput = {
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  whatsapp_number: '1234567890',
  address: '123 Main Street, City, Country'
};

describe('registerMember', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new member without referrer', async () => {
    const result = await registerMember(testInput);

    // Verify returned member data
    expect(result.full_name).toEqual('John Doe');
    expect(result.email).toEqual('john.doe@example.com');
    expect(result.whatsapp_number).toEqual('1234567890');
    expect(result.address).toEqual('123 Main Street, City, Country');
    expect(result.referrer_id).toBeNull();
    expect(result.unique_link).toBeDefined();
    expect(result.unique_link.startsWith('member_')).toBe(true);
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save member to database', async () => {
    const result = await registerMember(testInput);

    // Query database to verify member was saved
    const members = await db.select()
      .from(membersTable)
      .where(eq(membersTable.id, result.id))
      .execute();

    expect(members).toHaveLength(1);
    expect(members[0].full_name).toEqual('John Doe');
    expect(members[0].email).toEqual('john.doe@example.com');
    expect(members[0].is_active).toBe(true);
    expect(members[0].unique_link).toEqual(result.unique_link);
  });

  it('should create welcome notifications for new member', async () => {
    const result = await registerMember(testInput);

    // Check email notification was created
    const emailNotifications = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, result.id))
      .execute();

    // Should have both email and WhatsApp welcome notifications
    expect(emailNotifications).toHaveLength(2);
    
    const emailNotif = emailNotifications.find(n => n.type === 'email');
    const whatsappNotif = emailNotifications.find(n => n.type === 'whatsapp');

    expect(emailNotif).toBeDefined();
    expect(emailNotif!.event_type).toEqual('welcome');
    expect(emailNotif!.status).toEqual('sent');
    expect(emailNotif!.message_content).toContain('Welcome to our platform, John Doe');
    expect(emailNotif!.sent_at).toBeInstanceOf(Date);

    expect(whatsappNotif).toBeDefined();
    expect(whatsappNotif!.event_type).toEqual('welcome');
    expect(whatsappNotif!.status).toEqual('sent');
    expect(whatsappNotif!.message_content).toContain('Welcome John Doe');
    expect(whatsappNotif!.sent_at).toBeInstanceOf(Date);
  });

  it('should register member with valid referrer', async () => {
    // First create a referrer member
    const referrerInput: RegisterMemberInput = {
      full_name: 'Jane Referrer',
      email: 'jane@example.com',
      whatsapp_number: '0987654321',
      address: '456 Referrer Ave'
    };
    const referrer = await registerMember(referrerInput);

    // Register new member with referrer link
    const inputWithReferrer: RegisterMemberInput = {
      ...testInput,
      email: 'john.referred@example.com',
      referrer_link: referrer.unique_link
    };

    const result = await registerMember(inputWithReferrer);

    // Verify referrer_id is set
    expect(result.referrer_id).toEqual(referrer.id);
  });

  it('should create referral record when member is referred', async () => {
    // Create referrer
    const referrerInput: RegisterMemberInput = {
      full_name: 'Jane Referrer',
      email: 'jane@example.com',
      whatsapp_number: '0987654321',
      address: '456 Referrer Ave'
    };
    const referrer = await registerMember(referrerInput);

    // Register referred member
    const inputWithReferrer: RegisterMemberInput = {
      ...testInput,
      email: 'john.referred@example.com',
      referrer_link: referrer.unique_link
    };
    const referred = await registerMember(inputWithReferrer);

    // Check referral record was created
    const referrals = await db.select()
      .from(referralsTable)
      .where(eq(referralsTable.referred_member_id, referred.id))
      .execute();

    expect(referrals).toHaveLength(1);
    expect(referrals[0].referrer_id).toEqual(referrer.id);
    expect(referrals[0].referred_member_id).toEqual(referred.id);
    expect(referrals[0].created_at).toBeInstanceOf(Date);
  });

  it('should send referral notifications to referrer', async () => {
    // Create referrer
    const referrerInput: RegisterMemberInput = {
      full_name: 'Jane Referrer',
      email: 'jane@example.com',
      whatsapp_number: '0987654321',
      address: '456 Referrer Ave'
    };
    const referrer = await registerMember(referrerInput);

    // Register referred member
    const inputWithReferrer: RegisterMemberInput = {
      ...testInput,
      email: 'john.referred@example.com',
      referrer_link: referrer.unique_link
    };
    await registerMember(inputWithReferrer);

    // Check referrer received notifications
    const referrerNotifications = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, referrer.id))
      .execute();

    // Should have welcome notifications (2) + referral notifications (2) = 4 total
    expect(referrerNotifications).toHaveLength(4);

    const referralNotifs = referrerNotifications.filter(n => n.event_type === 'referral_notification');
    expect(referralNotifs).toHaveLength(2);

    const emailReferralNotif = referralNotifs.find(n => n.type === 'email');
    const whatsappReferralNotif = referralNotifs.find(n => n.type === 'whatsapp');

    expect(emailReferralNotif).toBeDefined();
    expect(emailReferralNotif!.message_content).toContain('John Doe has joined using your referral link');
    expect(emailReferralNotif!.status).toEqual('sent');

    expect(whatsappReferralNotif).toBeDefined();
    expect(whatsappReferralNotif!.message_content).toContain('New referral: John Doe joined your network');
    expect(whatsappReferralNotif!.status).toEqual('sent');
  });

  it('should handle invalid referrer link gracefully', async () => {
    const inputWithInvalidReferrer: RegisterMemberInput = {
      ...testInput,
      email: 'john.noreferrer@example.com',
      referrer_link: 'invalid_link_12345'
    };

    const result = await registerMember(inputWithInvalidReferrer);

    // Should register successfully but with no referrer
    expect(result.referrer_id).toBeNull();
    expect(result.full_name).toEqual('John Doe');
    
    // Check no referral record was created
    const referrals = await db.select()
      .from(referralsTable)
      .where(eq(referralsTable.referred_member_id, result.id))
      .execute();

    expect(referrals).toHaveLength(0);
  });

  it('should generate unique affiliate links', async () => {
    // Register multiple members
    const member1 = await registerMember({
      ...testInput,
      email: 'member1@example.com'
    });

    const member2 = await registerMember({
      ...testInput,
      email: 'member2@example.com'
    });

    // Verify unique links are different
    expect(member1.unique_link).not.toEqual(member2.unique_link);
    expect(member1.unique_link.startsWith('member_')).toBe(true);
    expect(member2.unique_link.startsWith('member_')).toBe(true);
  });

  it('should handle duplicate email constraint', async () => {
    // Register first member
    await registerMember(testInput);

    // Try to register with same email
    await expect(registerMember(testInput)).rejects.toThrow(/duplicate key value/i);
  });
});