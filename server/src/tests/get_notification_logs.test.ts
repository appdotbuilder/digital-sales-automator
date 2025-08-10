import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { membersTable, notificationLogsTable } from '../db/schema';
import { getNotificationLogs } from '../handlers/get_notification_logs';

describe('getNotificationLogs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return notification logs for a specific member', async () => {
    // Create test member
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'John Doe',
        email: 'john@example.com',
        whatsapp_number: '+1234567890',
        address: '123 Main St',
        unique_link: 'john-doe-unique-link'
      })
      .returning()
      .execute();

    const memberId = memberResult[0].id;

    // Create test notification logs with explicit timestamps for predictable ordering
    const earlierTime = new Date('2024-01-01T10:00:00Z');
    const laterTime = new Date('2024-01-01T12:00:00Z');

    // Insert the earlier log first (welcome)
    await db.insert(notificationLogsTable)
      .values({
        member_id: memberId,
        type: 'email',
        event_type: 'welcome',
        status: 'sent',
        message_content: 'Welcome to our platform!',
        sent_at: earlierTime,
        created_at: earlierTime
      })
      .execute();

    // Insert the later log second (purchase_confirmation) 
    await db.insert(notificationLogsTable)
      .values({
        member_id: memberId,
        type: 'whatsapp',
        event_type: 'purchase_confirmation',
        status: 'failed',
        message_content: 'Purchase confirmed!',
        sent_at: null,
        created_at: laterTime
      })
      .execute();

    const result = await getNotificationLogs(memberId);

    expect(result).toHaveLength(2);
    
    // Verify the logs are ordered by created_at desc (newest first)
    // The purchase_confirmation was inserted later, so should be first
    expect(result[0].created_at.getTime()).toBeGreaterThanOrEqual(result[1].created_at.getTime());
    
    // Find logs by their unique content to verify correct data regardless of order
    const welcomeLog = result.find(log => log.event_type === 'welcome');
    const purchaseLog = result.find(log => log.event_type === 'purchase_confirmation');
    
    // Check welcome notification log
    expect(welcomeLog).toBeDefined();
    expect(welcomeLog!.member_id).toBe(memberId);
    expect(welcomeLog!.type).toBe('email');
    expect(welcomeLog!.status).toBe('sent');
    expect(welcomeLog!.message_content).toBe('Welcome to our platform!');
    expect(welcomeLog!.sent_at).toBeInstanceOf(Date);
    expect(welcomeLog!.created_at).toBeInstanceOf(Date);
    
    // Check purchase confirmation notification log
    expect(purchaseLog).toBeDefined();
    expect(purchaseLog!.member_id).toBe(memberId);
    expect(purchaseLog!.type).toBe('whatsapp');
    expect(purchaseLog!.status).toBe('failed');
    expect(purchaseLog!.message_content).toBe('Purchase confirmed!');
    expect(purchaseLog!.sent_at).toBeNull();
    expect(purchaseLog!.created_at).toBeInstanceOf(Date);
  });

  it('should return empty array for member with no notification logs', async () => {
    // Create test member without any notification logs
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        whatsapp_number: '+1234567891',
        address: '456 Oak Ave',
        unique_link: 'jane-doe-unique-link'
      })
      .returning()
      .execute();

    const memberId = memberResult[0].id;

    const result = await getNotificationLogs(memberId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return logs for the specified member', async () => {
    // Create two test members
    const member1Result = await db.insert(membersTable)
      .values({
        full_name: 'Member One',
        email: 'member1@example.com',
        whatsapp_number: '+1111111111',
        address: '111 First St',
        unique_link: 'member-one-link'
      })
      .returning()
      .execute();

    const member2Result = await db.insert(membersTable)
      .values({
        full_name: 'Member Two',
        email: 'member2@example.com',
        whatsapp_number: '+2222222222',
        address: '222 Second St',
        unique_link: 'member-two-link'
      })
      .returning()
      .execute();

    const member1Id = member1Result[0].id;
    const member2Id = member2Result[0].id;

    // Create notification logs for both members
    await db.insert(notificationLogsTable)
      .values([
        {
          member_id: member1Id,
          type: 'email',
          event_type: 'welcome',
          status: 'sent',
          message_content: 'Welcome Member 1!'
        },
        {
          member_id: member1Id,
          type: 'whatsapp',
          event_type: 'referral_notification',
          status: 'pending',
          message_content: 'Referral bonus!'
        },
        {
          member_id: member2Id,
          type: 'email',
          event_type: 'welcome',
          status: 'sent',
          message_content: 'Welcome Member 2!'
        }
      ])
      .execute();

    const result = await getNotificationLogs(member1Id);

    expect(result).toHaveLength(2);
    result.forEach(log => {
      expect(log.member_id).toBe(member1Id);
    });

    // Verify member 2's logs are not included
    expect(result.find(log => log.message_content === 'Welcome Member 2!')).toBeUndefined();
  });

  it('should handle different notification types and statuses correctly', async () => {
    // Create test member
    const memberResult = await db.insert(membersTable)
      .values({
        full_name: 'Test User',
        email: 'test@example.com',
        whatsapp_number: '+9999999999',
        address: '999 Test St',
        unique_link: 'test-user-link'
      })
      .returning()
      .execute();

    const memberId = memberResult[0].id;

    // Create logs with different types, event types, and statuses
    await db.insert(notificationLogsTable)
      .values([
        {
          member_id: memberId,
          type: 'email',
          event_type: 'welcome',
          status: 'sent',
          message_content: 'Email welcome message',
          sent_at: new Date()
        },
        {
          member_id: memberId,
          type: 'whatsapp',
          event_type: 'purchase_confirmation',
          status: 'failed',
          message_content: 'WhatsApp purchase confirmation',
          sent_at: null
        },
        {
          member_id: memberId,
          type: 'email',
          event_type: 'referral_notification',
          status: 'pending',
          message_content: 'Email referral notification',
          sent_at: null
        }
      ])
      .execute();

    const result = await getNotificationLogs(memberId);

    expect(result).toHaveLength(3);

    // Check that all different types and statuses are included
    const types = result.map(log => log.type);
    const eventTypes = result.map(log => log.event_type);
    const statuses = result.map(log => log.status);

    expect(types).toContain('email');
    expect(types).toContain('whatsapp');
    expect(eventTypes).toContain('welcome');
    expect(eventTypes).toContain('purchase_confirmation');
    expect(eventTypes).toContain('referral_notification');
    expect(statuses).toContain('sent');
    expect(statuses).toContain('failed');
    expect(statuses).toContain('pending');
  });

  it('should return empty array for non-existent member', async () => {
    const nonExistentMemberId = 99999;

    const result = await getNotificationLogs(nonExistentMemberId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});