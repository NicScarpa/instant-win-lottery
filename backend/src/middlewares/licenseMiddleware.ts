import { Response, NextFunction } from 'express';
import { LicenseService } from '../services/LicenseService';
import { TenantRequest } from './tenantMiddleware';

/**
 * Middleware che verifica che la licenza del tenant sia valida
 * Blocca le richieste se la licenza è scaduta o sospesa
 */
export const requireValidLicense = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenant) {
    return res.status(400).json({
      error: 'Tenant not resolved',
      message: 'Unable to verify license without tenant context'
    });
  }

  const validation = LicenseService.validateLicense(req.tenant);

  if (!validation.canOperate) {
    return res.status(403).json({
      error: 'License error',
      status: validation.status,
      message: validation.message,
      daysRemaining: validation.daysRemaining
    });
  }

  // Aggiungi info licenza alla request per uso successivo
  (req as any).licenseInfo = validation;

  next();
};

/**
 * Middleware che verifica i limiti del piano prima di un'operazione
 */
export const checkPlanLimit = (limitType: 'promotions' | 'tokens' | 'staff', amountField?: string) => {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.tenant || !req.tenantId) {
      return res.status(400).json({
        error: 'Tenant not resolved',
        message: 'Unable to check limits without tenant context'
      });
    }

    // Determina la quantità richiesta
    let requestedAmount = 1;
    if (amountField && req.body[amountField]) {
      requestedAmount = Number(req.body[amountField]) || 1;
    }

    const check = await LicenseService.checkLimit(req.tenantId, limitType, requestedAmount);

    if (!check.allowed) {
      return res.status(403).json({
        error: 'Plan limit reached',
        limitType,
        current: check.current,
        limit: check.limit,
        message: check.message
      });
    }

    // Aggiungi info limiti alla request
    (req as any).limitInfo = check;

    next();
  };
};

/**
 * Middleware che verifica se il tenant ha accesso a una feature specifica
 */
export const requireFeature = (feature: string) => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(400).json({
        error: 'Tenant not resolved',
        message: 'Unable to check features without tenant context'
      });
    }

    const hasFeature = LicenseService.hasFeature(req.tenant, feature);

    if (!hasFeature) {
      return res.status(403).json({
        error: 'Feature not available',
        feature,
        plan: req.tenant.plan,
        message: `La feature "${feature}" non è disponibile nel piano ${req.tenant.plan}. Effettua l'upgrade per accedere.`
      });
    }

    next();
  };
};

/**
 * Middleware che aggiunge un warning se la licenza sta per scadere
 * Non blocca la richiesta, ma aggiunge un header di warning
 */
export const licenseExpirationWarning = (warningDays: number = 7) => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return next();
    }

    const validation = LicenseService.validateLicense(req.tenant);

    if (validation.daysRemaining !== null && validation.daysRemaining <= warningDays && validation.daysRemaining > 0) {
      // Aggiungi header di warning
      res.setHeader('X-License-Warning', `License expires in ${validation.daysRemaining} days`);
      res.setHeader('X-License-Days-Remaining', validation.daysRemaining.toString());
    }

    next();
  };
};

/**
 * Combina validazione licenza + warning in un unico middleware
 */
export const validateLicenseWithWarning = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenant) {
    return res.status(400).json({
      error: 'Tenant not resolved',
      message: 'Unable to verify license without tenant context'
    });
  }

  const validation = LicenseService.validateLicense(req.tenant);

  // Se non può operare, blocca
  if (!validation.canOperate) {
    return res.status(403).json({
      error: 'License error',
      status: validation.status,
      message: validation.message,
      daysRemaining: validation.daysRemaining
    });
  }

  // Aggiungi warning se in scadenza
  if (validation.daysRemaining !== null && validation.daysRemaining <= 7 && validation.daysRemaining > 0) {
    res.setHeader('X-License-Warning', `License expires in ${validation.daysRemaining} days`);
    res.setHeader('X-License-Days-Remaining', validation.daysRemaining.toString());
  }

  // Trial warning
  if (validation.status === 'trial') {
    res.setHeader('X-License-Status', 'trial');
    if (validation.daysRemaining !== null) {
      res.setHeader('X-Trial-Days-Remaining', validation.daysRemaining.toString());
    }
  }

  (req as any).licenseInfo = validation;
  next();
};

/**
 * Middleware per route che sono accessibili anche con licenza scaduta
 * (es. visualizzazione dati, export, supporto)
 * Ma aggiunge comunque il warning
 */
export const allowExpiredLicense = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenant) {
    return next();
  }

  const validation = LicenseService.validateLicense(req.tenant);

  // Aggiungi sempre le info, ma non bloccare
  res.setHeader('X-License-Status', validation.status);
  if (validation.daysRemaining !== null) {
    res.setHeader('X-License-Days-Remaining', Math.max(0, validation.daysRemaining).toString());
  }

  if (!validation.canOperate) {
    res.setHeader('X-License-Warning', 'License inactive - limited functionality');
  }

  (req as any).licenseInfo = validation;
  next();
};
