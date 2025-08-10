import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { notificationLogsTable, membersTable } from '../db/schema';
import { type SendNotificationInput } from '../schema';
import { sendNotification } from '../handlers/send_notification';
import { eq } from 'drizzle-orm';

// Test member data
const testMember = {
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  whatsapp_number: '+1234567890',
  address: '123 Test Street',
  unique_link: 'unique-link-123'
};

// Test notification input
const emailNotificationInput: SendNotificationInput = {
  member_id: 1, // Will be set after member creation
  type: 'email',
  event_type: 'welcome',
  message_content: 'Welcome to our platform!'
};

const whatsappNotificationInput: SendNotificationInput = {
  member_id: 1, // Will be set after member creation
  type: 'whatsapp',
  event_type: 'purchase_confirmation',
  message_content: 'Your purchase has been confirmed!'
};

describe('sendNotification', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let createdMemberId: number;

  beforeEach(async () => {
    // Create a test member for notifications
    const memberResult = await db.insert(membersTable)
      .values(testMember)
      .returning()
      .execute();
    
    createdMemberId = memberResult[0].id;
    
    // Update test inputs with actual member ID
    emailNotificationInput.member_id = createdMemberId;
    whatsappNotificationInput.member_id = createdMemberId;
  });

  it('should send email notification successfully', async () => {
    const result = await sendNotification(emailNotificationInput);

    // Validate returned notification log
    expect(result.id).toBeDefined();
    expect(result.member_id).toEqual(createdMemberId);
    expect(result.type).toEqual('email');
    expect(result.event_type).toEqual('welcome');
    expect(result.status).toEqual('sent');
    expect(result.message_content).toEqual('Welcome to our platform!');
    expect(result.sent_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should send whatsapp notification successfully', async () => {
    const result = await sendNotification(whatsappNotificationInput);

    // Validate returned notification log
    expect(result.id).toBeDefined();
    expect(result.member_id).toEqual(createdMemberId);
    expect(result.type).toEqual('whatsapp');
    expect(result.event_type).toEqual('purchase_confirmation');
    expect(result.status).toEqual('sent');
    expect(result.message_content).toEqual('Your purchase has been confirmed!');
    expect(result.sent_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save notification log to database', async () => {
    const result = await sendNotification(emailNotificationInput);

    // Query the database to verify the log was saved
    const savedLogs = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.id, result.id))
      .execute();

    expect(savedLogs).toHaveLength(1);
    expect(savedLogs[0].member_id).toEqual(createdMemberId);
    expect(savedLogs[0].type).toEqual('email');
    expect(savedLogs[0].event_type).toEqual('welcome');
    expect(savedLogs[0].status).toEqual('sent');
    expect(savedLogs[0].message_content).toEqual('Welcome to our platform!');
    expect(savedLogs[0].sent_at).toBeInstanceOf(Date);
    expect(savedLogs[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle different event types correctly', async () => {
    const referralNotification: SendNotificationInput = {
      member_id: createdMemberId,
      type: 'email',
      event_type: 'referral_notification',
      message_content: 'You have earned a referral bonus!'
    };

    const result = await sendNotification(referralNotification);

    expect(result.event_type).toEqual('referral_notification');
    expect(result.message_content).toEqual('You have earned a referral bonus!');
  });

  it('should handle different notification types', async () => {
    // Test all notification types
    const notifications: SendNotificationInput[] = [
      {
        member_id: createdMemberId,
        type: 'email',
        event_type: 'welcome',
        message_content: 'Email welcome message'
      },
      {
        member_id: createdMemberId,
        type: 'whatsapp',
        event_type: 'welcome',
        message_content: 'WhatsApp welcome message'
      }
    ];

    for (const notification of notifications) {
      const result = await sendNotification(notification);
      expect(result.type).toEqual(notification.type);
      expect(result.message_content).toEqual(notification.message_content);
      expect(result.status).toEqual('sent');
    }
  });

  it('should handle all event types', async () => {
    const eventTypes: Array<'welcome' | 'purchase_confirmation' | 'referral_notification'> = [
      'welcome',
      'purchase_confirmation', 
      'referral_notification'
    ];

    for (const eventType of eventTypes) {
      const notification: SendNotificationInput = {
        member_id: createdMemberId,
        type: 'email',
        event_type: eventType,
        message_content: `Test message for ${eventType}`
      };

      const result = await sendNotification(notification);
      expect(result.event_type).toEqual(eventType);
      expect(result.message_content).toEqual(`Test message for ${eventType}`);
      expect(result.status).toEqual('sent');
    }
  });

  it('should throw error for non-existent member', async () => {
    const invalidNotification: SendNotificationInput = {
      member_id: 99999, // Non-existent member ID
      type: 'email',
      event_type: 'welcome',
      message_content: 'This should fail'
    };

    await expect(sendNotification(invalidNotification)).rejects.toThrow(/Member with id 99999 not found/i);
  });

  it('should create multiple notification logs for same member', async () => {
    // Send multiple notifications to same member
    await sendNotification(emailNotificationInput);
    await sendNotification(whatsappNotificationInput);

    const allLogs = await db.select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, createdMemberId))
      .execute();

    expect(allLogs).toHaveLength(2);
    
    // Verify both types are present
    const emailLog = allLogs.find(log => log.type === 'email');
    const whatsappLog = allLogs.find(log => log.type === 'whatsapp');
    
    expect(emailLog).toBeDefined();
    expect(whatsappLog).toBeDefined();
    expect(emailLog?.event_type).toEqual('welcome');
    expect(whatsappLog?.event_type).toEqual('purchase_confirmation');
  });

  it('should handle empty message content', async () => {
    const emptyMessageNotification: SendNotificationInput = {
      member_id: createdMemberId,
      type: 'email',
      event_type: 'welcome',
      message_content: ''
    };

    const result = await sendNotification(emptyMessageNotification);
    expect(result.message_content).toEqual('');
    expect(result.status).toEqual('sent');
  });

  it('should verify notification log timestamps are reasonable', async () => {
    const beforeSend = new Date();
    const result = await sendNotification(emailNotificationInput);
    const afterSend = new Date();

    expect(result.sent_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    
    // Verify timestamps are within reasonable range
    expect(result.sent_at!.getTime()).toBeGreaterThanOrEqual(beforeSend.getTime() - 1000); // Allow 1s buffer
    expect(result.sent_at!.getTime()).toBeLessThanOrEqual(afterSend.getTime() + 1000);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeSend.getTime() - 1000);
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterSend.getTime() + 1000);
  });
});