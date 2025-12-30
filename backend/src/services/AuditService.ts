import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AuditAction =
  | 'CREATE_PROMOTION'
  | 'UPDATE_PROMOTION'
  | 'DELETE_PROMOTION'
  | 'ACTIVATE_PROMOTION'
  | 'DEACTIVATE_PROMOTION'
  | 'GENERATE_TOKENS'
  | 'CREATE_PRIZE'
  | 'UPDATE_PRIZE'
  | 'DELETE_PRIZE'
  | 'REDEEM_PRIZE'
  | 'CREATE_STAFF'
  | 'UPDATE_STAFF'
  | 'DELETE_STAFF'
  | 'RESET_PASSWORD'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'UPDATE_BRANDING'
  | 'UPDATE_CONTENT'
  | 'UPLOAD_ASSET'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ENGINE_CONFIG_UPDATE'
  | 'LEADERBOARD_SETTINGS_UPDATE';

export type AuditEntity = 'promotion' | 'token' | 'prize' | 'staff' | 'branding' | 'content' | 'engine' | 'leaderboard' | 'session';

export interface AuditLogInput {
  tenantId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | number;
  details?: Record<string, unknown>;
  userId?: number;
  userType?: 'staff' | 'admin' | 'system';
  username?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Registra un'azione nel log di audit
   */
  static async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId?.toString() || null,
          details: input.details ? JSON.stringify(input.details) : null,
          userId: input.userId,
          userType: input.userType || 'staff',
          username: input.username,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent
        }
      });
    } catch (err) {
      // Non bloccare l'operazione principale se il logging fallisce
      console.error('[AUDIT] Failed to log action:', err);
    }
  }

  /**
   * Ottiene i log per un tenant
   */
  static async getLogs(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      entity?: AuditEntity;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const { limit = 50, offset = 0, action, entity, startDate, endDate } = options;

    const where: Record<string, unknown> = { tenantId };

    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      })),
      total,
      limit,
      offset
    };
  }

  /**
   * Conta le azioni per tipo in un periodo
   */
  static async getActionStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const stats = await prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true
    });

    return stats.map(s => ({
      action: s.action,
      count: s._count
    }));
  }

  /**
   * Helper per estrarre info dalla request
   */
  static extractRequestInfo(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }) {
    return {
      ipAddress: req.ip || (req.headers?.['x-forwarded-for'] as string)?.split(',')[0] || 'unknown',
      userAgent: (req.headers?.['user-agent'] as string) || 'unknown'
    };
  }
}
