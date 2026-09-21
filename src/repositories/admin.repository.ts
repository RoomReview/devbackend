import prisma from '@config/database';

export interface AdminOverview {
  users: { total: number; active: number; unverified: number };
  reports: { total: number; waiting: number; generating: number; ready: number; failed: number };
  orders: { total: number; pending: number; paid: number; failed: number; cancelled: number };
  recentFailures: Array<{
    kind: 'REPORT' | 'PAYMENT';
    id: string;
    status: string;
    reason: string | null;
    createdAt: Date;
  }>;
}

export interface AdminUser {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
  } | null;
}

type CountRow = { count: bigint };
type FailureRow = {
  kind: 'REPORT' | 'PAYMENT';
  id: string;
  status: string;
  reason: string | null;
  createdAt: Date;
};

const count = async (query: Promise<CountRow | CountRow[]>) => {
  const result = await query;
  const row = Array.isArray(result) ? result[0] : result;
  return Number(row?.count ?? 0n);
};

export const getAdminOverview = async (): Promise<AdminOverview> => {
  const [totalUsers, activeUsers, unverifiedUsers, totalReports, waitingReports, generatingReports, readyReports, failedReports, totalOrders, pendingOrders, paidOrders, failedOrders, cancelledOrders, recentFailures] = await Promise.all([
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM users`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM users WHERE is_active = true`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM users WHERE is_email_verified = false`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM score_reports`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'WAITING'`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'GENERATING'`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'READY'`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM score_reports WHERE status = 'FAILED'`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM report_orders`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'PENDING'`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'PAID'`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'FAILED'`),
    count(prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM report_orders WHERE status = 'CANCELLED'`),
    prisma.$queryRaw<FailureRow[]>`
      SELECT 'REPORT' AS kind, score_report_id AS id, status::text, NULL::text AS reason, created_at AS "createdAt"
      FROM score_reports
      WHERE status = 'FAILED'
      UNION ALL
      SELECT 'PAYMENT' AS kind, order_id::text AS id, status::text, NULL AS reason, created_at AS "createdAt"
      FROM report_orders
      WHERE status = 'FAILED'
      ORDER BY "createdAt" DESC
      LIMIT 10
    `,
  ]);

  return {
    users: { total: totalUsers, active: activeUsers, unverified: unverifiedUsers },
    reports: { total: totalReports, waiting: waitingReports, generating: generatingReports, ready: readyReports, failed: failedReports },
    orders: { total: totalOrders, pending: pendingOrders, paid: paidOrders, failed: failedOrders, cancelled: cancelledOrders },
    recentFailures,
  };
};

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  return prisma.$queryRaw<AdminUser[]>`
    SELECT u.user_id AS "userId", u.first_name AS "firstName", u.last_name AS "lastName",
      u.email, u.is_active AS "isActive",
      CASE WHEN bs.billing_subscription_id IS NULL THEN NULL ELSE json_build_object(
        'status', bs.status::text,
        'cancelAtPeriodEnd', bs.cancel_at_period_end
      ) END AS subscription
    FROM users u
    LEFT JOIN billing_subscriptions bs ON bs.user_id = u.user_id
    ORDER BY u.created_at DESC
  `;
};

export const setUserActive = async (userId: string, isActive: boolean) => {
  const rows = await prisma.$queryRaw<Array<{ userId: string; isActive: boolean }>>`
    UPDATE users
    SET is_active = ${isActive}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}::uuid
    RETURNING user_id AS "userId", is_active AS "isActive"
  `;
  return rows[0] ?? null;
};
