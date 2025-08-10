import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { purchaseEventsTable, membersTable, notificationLogsTable } from '../db/schema';
import { type CreatePurchaseInput } from '../schema';
import { createPurchaseEvent } from '../handlers/create_purchase_event';
import { eq } from 'drizzle-orm';

// Test input for purchase event
const testPurchaseInput: CreatePurchaseInput = {
  member_id: 1,
  product_name: 'Digital Marketing Course',
  amount: 99.99
};

describe('createPurchaseEvent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a purchase event for existing member', async () => {
    // Create test member first
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'John Doe',
        email: 'john@example.com',
        whatsapp_number: '+1234567890',
        address: '123 Main St',
        unique_link: 'john-unique-link'
      })
      .returning()
      .execute();

    const member = memberResult[0];
    const purchaseInput = { ...testPurchaseInput, member_id: member.id };

    const result = await createPurchaseEvent(purchaseInput);

    // Verify purchase event fields
    expect(result.member_id).toEqual(member.id);
    expect(result.product_name).toEqual('Digital Marketing Course');
    expect(result.amount).toEqual(99.99);
    expect(typeof result.amount).toBe('number'); // Verify numeric conversion
    expect(result.status).toEqual('pending');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save purchase event to database', async () => {
    // Create test member
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        whatsapp_number: '+1987654321',
        address: '456 Oak Ave',
        unique_link: 'jane-unique-link'
      })
      .returning()
      .execute();

    const member = memberResult[0];
    const purchaseInput = { ...testPurchaseInput, member_id: member.id };

    const result = await createPurchaseEvent(purchaseInput);

    // Query database to verify purchase event was saved
    const savedEvents = await db.select()
      .from(purchaseEventsTable)
      .where(eq(purchaseEventsTable.id, result.id))
      .execute();

    expect(savedEvents).toHaveLength(1);
    expect(savedEvents[0].member_id).toEqual(member.id);
    expect(savedEvents[0].product_name).toEqual('Digital Marketing Course');
    expect(parseFloat(savedEvents[0].amount)).toEqual(99.99);
    expect(savedEvents[0].status).toEqual('pending');
    expect(savedEvents[0].created_at).toBeInstanceOf(Date);
  });

  it('should create purchase confirmation notifications', async () => {
    // Create test member
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'Bob Johnson',
        email: 'bob@example.com',
        whatsapp_number: '+1122334455',
        address: '789 Pine St',
        unique_link: 'bob-unique-link'
      })
      .returning()
      .execute();

    const member = memberResult[0];
    const purchaseInput = { ...testPurchaseInput, member_id: member.id };

    await createPurchaseEvent(purchaseInput);

    // Verify email notification was created
    const emailNotifications = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, member.id))
      .execute();

    const emailNotif = emailNotifications.find(n => n.type === 'email' && n.event_type === 'purchase_confirmation');
    const whatsappNotif = emailNotifications.find(n => n.type === 'whatsapp' && n.event_type === 'purchase_confirmation');

    expect(emailNotif).toBeDefined();
    expect(emailNotif?.status).toEqual('pending');
    expect(emailNotif?.message_content).toContain('Purchase confirmed');
    expect(emailNotif?.message_content).toContain('Digital Marketing Course');
    expect(emailNotif?.message_content).toContain('99.99');

    expect(whatsappNotif).toBeDefined();
    expect(whatsappNotif?.status).toEqual('pending');
    expect(whatsappNotif?.message_content).toContain('Purchase confirmed');
  });

  it('should create referral notifications when member has referrer', async () => {
    // Create referrer member first
    const referrerResult = await db.insert(membersTable)
      .values({
        full_name: 'Alice Referrer',
        email: 'alice@example.com',
        whatsapp_number: '+1555666777',
        address: '101 Elm St',
        unique_link: 'alice-referrer-link'
      })
      .returning()
      .execute();

    const referrer = referrerResult[0];

    // Create referred member with referrer_id
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'Charlie Referred',
        email: 'charlie@example.com',
        whatsapp_number: '+1888999000',
        address: '202 Maple St',
        referrer_id: referrer.id,
        unique_link: 'charlie-referred-link'
      })
      .returning()
      .execute();

    const member = memberResult[0];
    const purchaseInput = { ...testPurchaseInput, member_id: member.id };

    await createPurchaseEvent(purchaseInput);

    // Verify referral notifications were created for the referrer
    const referralNotifications = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, referrer.id))
      .execute();

    const emailReferralNotif = referralNotifications.find(n => 
      n.type === 'email' && n.event_type === 'referral_notification'
    );
    const whatsappReferralNotif = referralNotifications.find(n => 
      n.type === 'whatsapp' && n.event_type === 'referral_notification'
    );

    expect(emailReferralNotif).toBeDefined();
    expect(emailReferralNotif?.message_content).toContain('Your referral Charlie Referred made a purchase');
    expect(emailReferralNotif?.message_content).toContain('Digital Marketing Course');
    expect(emailReferralNotif?.message_content).toContain('99.99');

    expect(whatsappReferralNotif).toBeDefined();
    expect(whatsappReferralNotif?.message_content).toContain('Your referral Charlie Referred made a purchase');
  });

  it('should not create referral notifications when member has no referrer', async () => {
    // Create member without referrer
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'David Solo',
        email: 'david@example.com',
        whatsapp_number: '+1333444555',
        address: '303 Birch St',
        unique_link: 'david-solo-link'
      })
      .returning()
      .execute();

    const member = memberResult[0];
    const purchaseInput = { ...testPurchaseInput, member_id: member.id };

    await createPurchaseEvent(purchaseInput);

    // Verify only purchase confirmation notifications were created (no referral notifications)
    const notifications = await db.select()
      .from(notificationLogsTable)
      .execute();

    const referralNotifications = notifications.filter(n => n.event_type === 'referral_notification');
    const purchaseNotifications = notifications.filter(n => n.event_type === 'purchase_confirmation');

    expect(referralNotifications).toHaveLength(0);
    expect(purchaseNotifications).toHaveLength(2); // email + whatsapp
  });

  it('should throw error when member does not exist', async () => {
    const invalidInput = { ...testPurchaseInput, member_id: 99999 };

    await expect(createPurchaseEvent(invalidInput)).rejects.toThrow(/Member with ID 99999 not found/i);
  });

  it('should handle different product names and amounts', async () => {
    // Create test member
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'Eve Tester',
        email: 'eve@example.com',
        whatsapp_number: '+1666777888',
        address: '404 Cedar St',
        unique_link: 'eve-tester-link'
      })
      .returning()
      .execute();

    const member = memberResult[0];

    const customInput: CreatePurchaseInput = {
      member_id: member.id,
      product_name: 'Advanced Web Development Bundle',
      amount: 249.95
    };

    const result = await createPurchaseEvent(customInput);

    expect(result.product_name).toEqual('Advanced Web Development Bundle');
    expect(result.amount).toEqual(249.95);
    expect(typeof result.amount).toBe('number');

    // Verify notification contains correct product details
    const notifications = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, member.id))
      .execute();

    const emailNotif = notifications.find(n => n.type === 'email' && n.event_type === 'purchase_confirmation');
    expect(emailNotif?.message_content).toContain('Advanced Web Development Bundle');
    expect(emailNotif?.message_content).toContain('249.95');
  });
});