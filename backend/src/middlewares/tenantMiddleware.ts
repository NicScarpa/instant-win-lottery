import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Tenant } from '@prisma/client';

const prisma = new PrismaClient();

// Estende Request per includere il tenant
export interface TenantRequest extends Request {
  tenant?: Tenant;
  tenantId?: string;
}

/**
 * Middleware per risolvere il tenant dalla richiesta.
 *
 * Ordine di risoluzione:
 * 1. Header X-Tenant-ID (per API calls dirette)
 * 2. Subdomain (es. campari.instantwin.io)
 * 3. Custom domain (es. lotteria.campari.com)
 * 4. Localhost con header (per development)
 */
export const resolveTenant = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let tenant: Tenant | null = null;
    const host = req.hostname;
    const tenantHeader = req.headers['x-tenant-id'] as string | undefined;

    // 1. Check header X-Tenant-ID (priorità massima per API)
    if (tenantHeader) {
      tenant = await prisma.tenant.findUnique({
        where: { id: tenantHeader }
      });
    }

    // 2. Check subdomain (es. campari.instantwin.io)
    if (!tenant && host.includes('.')) {
      const parts = host.split('.');
      // Se è un subdomain del dominio principale (es. *.instantwin.io)
      if (parts.length >= 3 || (parts.length === 2 && !['localhost', 'railway'].includes(parts[1]))) {
        const subdomain = parts[0];
        // Esclude subdomain di sistema
        if (!['www', 'api', 'admin', 'superadmin'].includes(subdomain)) {
          tenant = await prisma.tenant.findUnique({
            where: { subdomain }
          });
        }
      }
    }

    // 3. Check custom domain (es. lotteria.campari.com)
    if (!tenant && host !== 'localhost') {
      tenant = await prisma.tenant.findFirst({
        where: { customDomain: host }
      });
    }

    // 4. Development: se localhost, usa il primo tenant disponibile o header
    if (!tenant && (host === 'localhost' || host === '127.0.0.1')) {
      // In development, permetti di specificare tenant via query param
      const tenantSlug = req.query.tenant as string;
      if (tenantSlug) {
        tenant = await prisma.tenant.findUnique({
          where: { slug: tenantSlug }
        });
      }
      // Fallback: usa il primo tenant (per backwards compatibility)
      if (!tenant) {
        tenant = await prisma.tenant.findFirst({
          orderBy: { createdAt: 'asc' }
        });
      }
    }

    // Se nessun tenant trovato
    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'Unable to resolve tenant from request'
      });
    }

    // Verifica stato licenza
    if (tenant.licenseStatus === 'expired') {
      return res.status(403).json({
        error: 'License expired',
        message: 'The license for this tenant has expired. Please contact support.'
      });
    }

    if (tenant.licenseStatus === 'suspended') {
      return res.status(403).json({
        error: 'Account suspended',
        message: 'This account has been suspended. Please contact support.'
      });
    }

    // Verifica scadenza licenza (se impostata)
    if (tenant.licenseEnd && new Date(tenant.licenseEnd) < new Date()) {
      // Aggiorna automaticamente lo stato a expired
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { licenseStatus: 'expired' }
      });
      return res.status(403).json({
        error: 'License expired',
        message: 'The license for this tenant has expired. Please renew your subscription.'
      });
    }

    // Attacca il tenant alla request
    req.tenant = tenant;
    req.tenantId = tenant.id;

    next();
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to resolve tenant'
    });
  }
};

/**
 * Middleware opzionale per route che NON richiedono tenant
 * (es. super admin routes, health checks)
 */
export const optionalTenant = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantHeader = req.headers['x-tenant-id'] as string | undefined;

    if (tenantHeader) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantHeader }
      });
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
      }
    }

    next();
  } catch (error) {
    // In caso di errore, continua senza tenant
    next();
  }
};

/**
 * Middleware per verificare i limiti del piano del tenant
 */
export const checkTenantLimits = (limitType: 'promotions' | 'tokens' | 'staff') => {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(400).json({ error: 'Tenant not resolved' });
    }

    try {
      const tenant = req.tenant;

      switch (limitType) {
        case 'promotions': {
          const promotionCount = await prisma.promotion.count({
            where: { tenantId: tenant.id }
          });
          if (promotionCount >= tenant.maxPromotions) {
            return res.status(403).json({
              error: 'Plan limit reached',
              message: `Your plan allows a maximum of ${tenant.maxPromotions} promotions. Please upgrade to create more.`,
              limit: tenant.maxPromotions,
              current: promotionCount
            });
          }
          break;
        }

        case 'tokens': {
          // Il limite è per promozione, controllato durante la generazione
          break;
        }

        case 'staff': {
          const staffCount = await prisma.staffUser.count({
            where: { tenantId: tenant.id }
          });
          if (staffCount >= tenant.maxStaffUsers) {
            return res.status(403).json({
              error: 'Plan limit reached',
              message: `Your plan allows a maximum of ${tenant.maxStaffUsers} staff users. Please upgrade to add more.`,
              limit: tenant.maxStaffUsers,
              current: staffCount
            });
          }
          break;
        }
      }

      next();
    } catch (error) {
      console.error('Error checking tenant limits:', error);
      return res.status(500).json({ error: 'Failed to check tenant limits' });
    }
  };
};

/**
 * Helper per ottenere query filter per tenant
 * Usa questo per tutte le query Prisma che devono essere filtrate per tenant
 */
export const getTenantFilter = (req: TenantRequest) => {
  if (!req.tenantId) {
    throw new Error('Tenant not resolved');
  }
  return { tenantId: req.tenantId };
};

/**
 * Helper per validare che una risorsa appartenga al tenant corrente
 */
export const validateTenantOwnership = async (
  req: TenantRequest,
  resourceType: 'promotion' | 'staffUser',
  resourceId: number
): Promise<boolean> => {
  if (!req.tenantId) return false;

  try {
    switch (resourceType) {
      case 'promotion': {
        const promotion = await prisma.promotion.findUnique({
          where: { id: resourceId },
          select: { tenantId: true }
        });
        return promotion?.tenantId === req.tenantId;
      }
      case 'staffUser': {
        const staff = await prisma.staffUser.findUnique({
          where: { id: resourceId },
          select: { tenantId: true }
        });
        return staff?.tenantId === req.tenantId;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
};
