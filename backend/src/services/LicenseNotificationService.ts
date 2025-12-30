import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LicenseNotification {
  tenantId: string;
  tenantName: string;
  adminEmail: string;
  licenseEnd: Date;
  daysRemaining: number;
  notificationType: 'expiring_7days' | 'expiring_3days' | 'expiring_1day' | 'expired';
}

export class LicenseNotificationService {
  /**
   * Trova tutti i tenant con licenze in scadenza
   */
  static async getExpiringLicenses(): Promise<LicenseNotification[]> {
    const now = new Date();
    const notifications: LicenseNotification[] = [];

    // Trova licenze che scadono entro 7 giorni
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const tenants = await prisma.tenant.findMany({
      where: {
        licenseEnd: {
          lte: sevenDaysFromNow,
          gte: now
        },
        licenseStatus: {
          in: ['active', 'trial']
        }
      },
      select: {
        id: true,
        name: true,
        adminEmail: true,
        licenseEnd: true
      }
    });

    for (const tenant of tenants) {
      if (!tenant.licenseEnd) continue;

      const daysRemaining = Math.ceil((tenant.licenseEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      let notificationType: LicenseNotification['notificationType'];
      if (daysRemaining <= 1) {
        notificationType = 'expiring_1day';
      } else if (daysRemaining <= 3) {
        notificationType = 'expiring_3days';
      } else {
        notificationType = 'expiring_7days';
      }

      notifications.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        adminEmail: tenant.adminEmail,
        licenseEnd: tenant.licenseEnd,
        daysRemaining,
        notificationType
      });
    }

    return notifications;
  }

  /**
   * Trova licenze già scadute ma non ancora sospese
   */
  static async getExpiredLicenses(): Promise<LicenseNotification[]> {
    const now = new Date();

    const tenants = await prisma.tenant.findMany({
      where: {
        licenseEnd: {
          lt: now
        },
        licenseStatus: {
          in: ['active', 'trial']
        }
      },
      select: {
        id: true,
        name: true,
        adminEmail: true,
        licenseEnd: true
      }
    });

    return tenants.map(tenant => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      adminEmail: tenant.adminEmail,
      licenseEnd: tenant.licenseEnd!,
      daysRemaining: 0,
      notificationType: 'expired' as const
    }));
  }

  /**
   * Sospende automaticamente le licenze scadute
   */
  static async suspendExpiredLicenses(): Promise<number> {
    const now = new Date();

    const result = await prisma.tenant.updateMany({
      where: {
        licenseEnd: {
          lt: now
        },
        licenseStatus: {
          in: ['active', 'trial']
        }
      },
      data: {
        licenseStatus: 'expired'
      }
    });

    return result.count;
  }

  /**
   * Processa tutte le notifiche e log (in produzione: invio email)
   */
  static async processNotifications(): Promise<{
    expiring: LicenseNotification[];
    expired: LicenseNotification[];
    suspended: number;
  }> {
    const expiring = await this.getExpiringLicenses();
    const expired = await this.getExpiredLicenses();

    // Log notifiche (in produzione qui invieremo email)
    for (const notification of expiring) {
      console.log(`[LICENSE] Tenant "${notification.tenantName}" (${notification.tenantId}): ` +
        `License expiring in ${notification.daysRemaining} day(s) - ${notification.notificationType}`);

      // TODO: In produzione, inviare email a notification.adminEmail
      // await sendEmail({
      //   to: notification.adminEmail,
      //   subject: `La tua licenza scade tra ${notification.daysRemaining} giorn${notification.daysRemaining === 1 ? 'o' : 'i'}`,
      //   template: 'license-expiring',
      //   data: notification
      // });
    }

    for (const notification of expired) {
      console.log(`[LICENSE] Tenant "${notification.tenantName}" (${notification.tenantId}): License EXPIRED`);
    }

    // Sospendi licenze scadute
    const suspended = await this.suspendExpiredLicenses();

    if (suspended > 0) {
      console.log(`[LICENSE] Suspended ${suspended} expired license(s)`);
    }

    return { expiring, expired, suspended };
  }

  /**
   * Ottieni statistiche sulle licenze
   */
  static async getLicenseStats(): Promise<{
    total: number;
    byStatus: { status: string; count: number }[];
    expiringThisWeek: number;
    expiringThisMonth: number;
  }> {
    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [total, byStatus, expiringThisWeek, expiringThisMonth] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.groupBy({
        by: ['licenseStatus'],
        _count: true
      }),
      prisma.tenant.count({
        where: {
          licenseEnd: {
            gte: now,
            lte: oneWeek
          },
          licenseStatus: { in: ['active', 'trial'] }
        }
      }),
      prisma.tenant.count({
        where: {
          licenseEnd: {
            gte: now,
            lte: oneMonth
          },
          licenseStatus: { in: ['active', 'trial'] }
        }
      })
    ]);

    return {
      total,
      byStatus: byStatus.map(s => ({
        status: s.licenseStatus,
        count: s._count
      })),
      expiringThisWeek,
      expiringThisMonth
    };
  }
}
