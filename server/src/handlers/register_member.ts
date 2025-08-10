import { db } from '../db';
import { membersTable, referralsTable, notificationLogsTable } from '../db/schema';
import { type RegisterMemberInput, type Member } from '../schema';
import { eq } from 'drizzle-orm';

export const registerMember = async (input: RegisterMemberInput): Promise<Member> => {
  try {
    // Generate unique affiliate link
    const uniqueLink = `member_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Find referrer if referrer_link is provided
    let referrerId: number | null = null;
    if (input.referrer_link) {
      const referrerResults = await db.select()
        .from(membersTable)
        .where(eq(membersTable.unique_link, input.referrer_link))
        .execute();
      
      if (referrerResults.length > 0) {
        referrerId = referrerResults[0].id;
      }
    }

    // Create new member record
    const memberResults = await db.insert(membersTable)
      .values({
        full_name: input.full_name,
        email: input.email,
        whatsapp_number: input.whatsapp_number,
        address: input.address,
        referrer_id: referrerId,
        unique_link: uniqueLink,
        is_active: true
      })
      .returning()
      .execute();

    const newMember = memberResults[0];

    // If there's a referrer, create a referral record
    if (referrerId) {
      await db.insert(referralsTable)
        .values({
          referrer_id: referrerId,
          referred_member_id: newMember.id
        })
        .execute();
    }

    // Send welcome email notification
    await db.insert(notificationLogsTable)
      .values({
        member_id: newMember.id,
        type: 'email',
        event_type: 'welcome',
        status: 'sent',
        message_content: `Welcome to our platform, ${input.full_name}! Your unique affiliate link is: ${uniqueLink}`,
        sent_at: new Date()
      })
      .execute();

    // Send welcome WhatsApp notification
    await db.insert(notificationLogsTable)
      .values({
        member_id: newMember.id,
        type: 'whatsapp',
        event_type: 'welcome',
        status: 'sent',
        message_content: `Welcome ${input.full_name}! Start earning with your link: ${uniqueLink}`,
        sent_at: new Date()
      })
      .execute();

    // If there's a referrer, notify them about the new referral
    if (referrerId) {
      await db.insert(notificationLogsTable)
        .values({
          member_id: referrerId,
          type: 'email',
          event_type: 'referral_notification',
          status: 'sent',
          message_content: `Great news! ${input.full_name} has joined using your referral link.`,
          sent_at: new Date()
        })
        .execute();

      await db.insert(notificationLogsTable)
        .values({
          member_id: referrerId,
          type: 'whatsapp',
          event_type: 'referral_notification',
          status: 'sent',
          message_content: `New referral: ${input.full_name} joined your network!`,
          sent_at: new Date()
        })
        .execute();
    }

    // Return the created member
    return {
      id: newMember.id,
      full_name: newMember.full_name,
      email: newMember.email,
      whatsapp_number: newMember.whatsapp_number,
      address: newMember.address,
      referrer_id: newMember.referrer_id,
      unique_link: newMember.unique_link,
      is_active: newMember.is_active,
      created_at: newMember.created_at,
      updated_at: newMember.updated_at
    };
  } catch (error) {
    console.error('Member registration failed:', error);
    throw error;
  }
};