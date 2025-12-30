import { PrismaClient, Tenant } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Tipi per il servizio licenze
export type LicenseStatus = 'trial' | 'active' | 'suspended' | 'expired';

export interface LicenseValidation {
  valid: boolean;
  status: LicenseStatus;
  daysRemaining: number | null;
  message: string;
  canOperate: boolean;
}

export interface PlanLimits {
  maxPromotions: number;
  maxTokensPerPromo: number;
  maxStaffUsers: number;
  features: string[];
}

// Definizione piani
export const PLAN_DEFINITIONS: Record<string, PlanLimits> = {
  starter: {
    maxPromotions: 1,
    maxTokensPerPromo: 500,
    maxStaffUsers: 2,
    features: ['basic_analytics', 'email_support']
  },
  pro: {
    maxPromotions: 3,
    maxTokensPerPromo: 2000,
    maxStaffUsers: 10,
    features: ['basic_analytics', 'advanced_analytics', 'leaderboard', 'csv_export', 'priority_support']
  },
  enterprise: {
    maxPromotions: 100,
    maxTokensPerPromo: 10000,
    maxStaffUsers: 50,
    features: ['basic_analytics', 'advanced_analytics', 'leaderboard', 'csv_export', 'custom_domain', 'api_access', 'white_label', 'dedicated_support']
  }
};

export class LicenseService {
  /**
   * Genera una chiave licenza univoca
   * Formato: XXXX-XXXX-XXXX-XXXX (16 caratteri hex)
   */
  static generateLicenseKey(): string {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
    }
    return segments.join('-');
  }

  /**
   * Valida lo stato della licenza di un tenant
   */
  static validateLicense(tenant: Tenant): LicenseValidation {
    const now = new Date();

    // Calcola giorni rimanenti
    let daysRemaining: number | null = null;
    if (tenant.licenseEnd) {
      const msRemaining = tenant.licenseEnd.getTime() - now.getTime();
      daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    }

    // Controlla stati
    switch (tenant.licenseStatus as LicenseStatus) {
      case 'suspended':
        return {
          valid: false,
          status: 'suspended',
          daysRemaining,
          message: 'Account sospeso. Contatta il supporto per riattivare.',
          canOperate: false
        };

      case 'expired':
        return {
          valid: false,
          status: 'expired',
          daysRemaining: 0,
          message: 'Licenza scaduta. Rinnova per continuare ad usare il servizio.',
          canOperate: false
        };

      case 'trial':
        // Verifica se il trial è scaduto
        if (tenant.licenseEnd && now > tenant.licenseEnd) {
          return {
            valid: false,
            status: 'expired',
            daysRemaining: 0,
            message: 'Periodo di prova terminato. Attiva un piano per continuare.',
            canOperate: false
          };
        }
        return {
          valid: true,
          status: 'trial',
          daysRemaining,
          message: daysRemaining !== null
            ? `Trial attivo. ${daysRemaining} giorni rimanenti.`
            : 'Trial attivo.',
          canOperate: true
        };

      case 'active':
        // Verifica se la licenza è scaduta
        if (tenant.licenseEnd && now > tenant.licenseEnd) {
          return {
            valid: false,
            status: 'expired',
            daysRemaining: 0,
            message: 'Licenza scaduta. Rinnova per continuare.',
            canOperate: false
          };
        }
        return {
          valid: true,
          status: 'active',
          daysRemaining,
          message: 'Licenza attiva.',
          canOperate: true
        };

      default:
        return {
          valid: false,
          status: 'expired',
          daysRemaining: null,
          message: 'Stato licenza non riconosciuto.',
          canOperate: false
        };
    }
  }

  /**
   * Ottiene i limiti del piano per un tenant
   */
  static getPlanLimits(tenant: Tenant): PlanLimits {
    const planDef = PLAN_DEFINITIONS[tenant.plan] || PLAN_DEFINITIONS.starter;

    // I limiti custom del tenant sovrascrivono i defaults del piano
    return {
      maxPromotions: tenant.maxPromotions || planDef.maxPromotions,
      maxTokensPerPromo: tenant.maxTokensPerPromo || planDef.maxTokensPerPromo,
      maxStaffUsers: tenant.maxStaffUsers || planDef.maxStaffUsers,
      features: planDef.features
    };
  }

  /**
   * Verifica se un tenant può eseguire un'azione specifica
   */
  static async checkLimit(
    tenantId: string,
    limitType: 'promotions' | 'tokens' | 'staff',
    requestedAmount: number = 1
  ): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { allowed: false, current: 0, limit: 0, message: 'Tenant not found' };
    }

    const limits = this.getPlanLimits(tenant);

    switch (limitType) {
      case 'promotions': {
        const currentCount = await prisma.promotion.count({ where: { tenantId } });
        const allowed = currentCount + requestedAmount <= limits.maxPromotions;
        return {
          allowed,
          current: currentCount,
          limit: limits.maxPromotions,
          message: allowed ? undefined : `Limite promozioni raggiunto (${currentCount}/${limits.maxPromotions})`
        };
      }

      case 'tokens': {
        // Per i token, il limite è per singola promozione
        return {
          allowed: requestedAmount <= limits.maxTokensPerPromo,
          current: 0,
          limit: limits.maxTokensPerPromo,
          message: requestedAmount > limits.maxTokensPerPromo
            ? `Il piano permette max ${limits.maxTokensPerPromo} token per promozione`
            : undefined
        };
      }

      case 'staff': {
        const currentCount = await prisma.staffUser.count({ where: { tenantId } });
        const allowed = currentCount + requestedAmount <= limits.maxStaffUsers;
        return {
          allowed,
          current: currentCount,
          limit: limits.maxStaffUsers,
          message: allowed ? undefined : `Limite staff raggiunto (${currentCount}/${limits.maxStaffUsers})`
        };
      }

      default:
        return { allowed: false, current: 0, limit: 0, message: 'Unknown limit type' };
    }
  }

  /**
   * Verifica se un tenant ha accesso a una feature specifica
   */
  static hasFeature(tenant: Tenant, feature: string): boolean {
    const limits = this.getPlanLimits(tenant);
    return limits.features.includes(feature);
  }

  /**
   * Aggiorna automaticamente lo stato delle licenze scadute
   * Da eseguire periodicamente (cron job)
   */
  static async updateExpiredLicenses(): Promise<number> {
    const now = new Date();

    const result = await prisma.tenant.updateMany({
      where: {
        licenseEnd: { lt: now },
        licenseStatus: { in: ['trial', 'active'] }
      },
      data: {
        licenseStatus: 'expired'
      }
    });

    return result.count;
  }

  /**
   * Trova tenant con licenza in scadenza
   * Utile per inviare notifiche
   */
  static async findExpiringLicenses(daysAhead: number): Promise<Tenant[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return prisma.tenant.findMany({
      where: {
        licenseStatus: { in: ['trial', 'active'] },
        licenseEnd: {
          gte: now,
          lte: futureDate
        }
      },
      orderBy: { licenseEnd: 'asc' }
    });
  }

  /**
   * Attiva una licenza per un tenant
   */
  static async activateLicense(
    tenantId: string,
    plan: string,
    durationDays: number
  ): Promise<Tenant> {
    const planLimits = PLAN_DEFINITIONS[plan] || PLAN_DEFINITIONS.starter;

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        licenseStatus: 'active',
        licenseStart: new Date(),
        licenseEnd: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
        maxPromotions: planLimits.maxPromotions,
        maxTokensPerPromo: planLimits.maxTokensPerPromo,
        maxStaffUsers: planLimits.maxStaffUsers
      }
    });
  }

  /**
   * Rinnova una licenza esistente
   */
  static async renewLicense(tenantId: string, additionalDays: number): Promise<Tenant> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    // Se la licenza è già scaduta, parti da oggi
    const baseDate = tenant.licenseEnd && tenant.licenseEnd > new Date()
      ? tenant.licenseEnd
      : new Date();

    const newEndDate = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        licenseStatus: 'active',
        licenseEnd: newEndDate
      }
    });
  }

  /**
   * Sospende una licenza
   */
  static async suspendLicense(tenantId: string, reason?: string): Promise<Tenant> {
    // Potremmo salvare il motivo in un campo audit log
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        licenseStatus: 'suspended'
      }
    });
  }

  /**
   * Riattiva una licenza sospesa
   */
  static async reactivateLicense(tenantId: string): Promise<Tenant> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    // Determina lo stato corretto basandosi sulla data di scadenza
    const now = new Date();
    let newStatus: LicenseStatus = 'active';

    if (tenant.licenseEnd && tenant.licenseEnd < now) {
      newStatus = 'expired';
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        licenseStatus: newStatus
      }
    });
  }

  /**
   * Upgrade di piano
   */
  static async upgradePlan(
    tenantId: string,
    newPlan: string,
    extendDays: number = 0
  ): Promise<Tenant> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    const planLimits = PLAN_DEFINITIONS[newPlan] || PLAN_DEFINITIONS.starter;

    // Calcola nuova data di scadenza
    let newEndDate = tenant.licenseEnd;
    if (extendDays > 0 && newEndDate) {
      newEndDate = new Date(newEndDate.getTime() + extendDays * 24 * 60 * 60 * 1000);
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: newPlan,
        licenseEnd: newEndDate,
        maxPromotions: planLimits.maxPromotions,
        maxTokensPerPromo: planLimits.maxTokensPerPromo,
        maxStaffUsers: planLimits.maxStaffUsers
      }
    });
  }
}

export default LicenseService;
