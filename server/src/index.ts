import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schema types
import { 
  registerMemberInputSchema, 
  createPurchaseInputSchema, 
  createProductInputSchema,
  sendNotificationInputSchema 
} from './schema';

// Import handlers
import { registerMember } from './handlers/register_member';
import { getMember } from './handlers/get_member';
import { getMemberByUniqueLink } from './handlers/get_member_by_unique_link';
import { getMemberStats } from './handlers/get_member_stats';
import { createPurchaseEvent } from './handlers/create_purchase_event';
import { getDigitalProducts } from './handlers/get_digital_products';
import { createProduct } from './handlers/create_product';
import { sendNotification } from './handlers/send_notification';
import { getReferrals } from './handlers/get_referrals';
import { getNotificationLogs } from './handlers/get_notification_logs';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Member management endpoints
  registerMember: publicProcedure
    .input(registerMemberInputSchema)
    .mutation(({ input }) => registerMember(input)),

  getMember: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getMember(input.id)),

  getMemberByUniqueLink: publicProcedure
    .input(z.object({ uniqueLink: z.string() }))
    .query(({ input }) => getMemberByUniqueLink(input.uniqueLink)),

  getMemberStats: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(({ input }) => getMemberStats(input.memberId)),

  // Purchase and product endpoints
  createPurchaseEvent: publicProcedure
    .input(createPurchaseInputSchema)
    .mutation(({ input }) => createPurchaseEvent(input)),

  getDigitalProducts: publicProcedure
    .query(() => getDigitalProducts()),

  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),

  // Notification endpoints
  sendNotification: publicProcedure
    .input(sendNotificationInputSchema)
    .mutation(({ input }) => sendNotification(input)),

  getNotificationLogs: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(({ input }) => getNotificationLogs(input.memberId)),

  // Referral system endpoints
  getReferrals: publicProcedure
    .input(z.object({ referrerId: z.number() }))
    .query(({ input }) => getReferrals(input.referrerId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();