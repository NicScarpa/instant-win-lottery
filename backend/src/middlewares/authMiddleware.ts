import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Tenant } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set!');
}

// Payload per staff/admin (include tenantId per multi-tenant)
export interface UserPayload extends JwtPayload {
  id: number;
  username: string;
  role: string;
  tenantId: string; // Nuovo campo per multi-tenant
}

// Payload per customer (include tenantId per multi-tenant)
export interface CustomerPayload extends JwtPayload {
  customerId: number;
  promotionId: number;
  phoneNumber: string;
  tenantId: string; // Nuovo campo per multi-tenant
}

// Payload per super admin (senza tenant, accesso globale)
export interface SuperAdminPayload extends JwtPayload {
  id: number;
  username: string;
  email: string;
  isSuperAdmin: true;
}

// Estendiamo l'interfaccia Request di Express
export interface AuthRequest extends Request {
  user?: UserPayload;
  customer?: CustomerPayload;
  superAdmin?: SuperAdminPayload;
  tenant?: Tenant;
  tenantId?: string;
}

// ------------------------------------------------------------------
// Middleware per l'autenticazione staff/admin
// ------------------------------------------------------------------
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Token not found' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as UserPayload;

    // Verifica che il token contenga tenantId (per nuovi token multi-tenant)
    // Per backwards compatibility, accetta anche token senza tenantId
    req.user = verified;

    // Se il token ha tenantId, lo usa; altrimenti usa quello dalla request (tenant middleware)
    if (verified.tenantId) {
      req.tenantId = verified.tenantId;
    }

    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ------------------------------------------------------------------
// Middleware per l'autenticazione dei customer
// ------------------------------------------------------------------
export const authenticateCustomer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.customerToken || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Customer token not found' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as CustomerPayload;
    req.customer = verified;

    // Se il token ha tenantId, lo usa
    if (verified.tenantId) {
      req.tenantId = verified.tenantId;
    }

    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired customer token' });
  }
};

// ------------------------------------------------------------------
// Middleware per l'autenticazione super admin
// ------------------------------------------------------------------
export const authenticateSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.superAdminToken || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Super admin token not found' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as SuperAdminPayload;

    // Verifica che sia effettivamente un super admin
    if (!verified.isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied: Not a super admin' });
    }

    req.superAdmin = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired super admin token' });
  }
};

// ------------------------------------------------------------------
// Middleware per l'autorizzazione basata sui ruoli
// ------------------------------------------------------------------
export const authorizeRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || (req.user.role !== role && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ------------------------------------------------------------------
// Middleware per verificare che l'utente appartenga al tenant corrente
// ------------------------------------------------------------------
export const validateTenantAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Se c'è un super admin, bypassa il check
  if (req.superAdmin) {
    return next();
  }

  // Se c'è un user (staff/admin)
  if (req.user) {
    // Se il token ha tenantId, verifica che corrisponda
    if (req.user.tenantId && req.tenantId && req.user.tenantId !== req.tenantId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this tenant'
      });
    }
    return next();
  }

  // Se c'è un customer
  if (req.customer) {
    if (req.customer.tenantId && req.tenantId && req.customer.tenantId !== req.tenantId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this tenant'
      });
    }
    return next();
  }

  // Nessuna autenticazione trovata
  return res.status(401).json({ error: 'Authentication required' });
};

// ------------------------------------------------------------------
// Middleware per il refresh del token (permette token scaduti entro grace period)
// ------------------------------------------------------------------
const REFRESH_GRACE_PERIOD = 7 * 24 * 60 * 60; // 7 giorni in secondi

export const authenticateTokenForRefresh = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Token not found' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = verified;
    if (verified.tenantId) {
      req.tenantId = verified.tenantId;
    }
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      try {
        const decoded = jwt.decode(token) as UserPayload & { exp?: number };

        if (decoded && decoded.exp) {
          const now = Math.floor(Date.now() / 1000);
          const expiredAt = decoded.exp;
          const secondsSinceExpiry = now - expiredAt;

          if (secondsSinceExpiry <= REFRESH_GRACE_PERIOD) {
            req.user = decoded;
            if (decoded.tenantId) {
              req.tenantId = decoded.tenantId;
            }
            return next();
          }
        }

        return res.status(403).json({ error: 'Token expired beyond grace period' });
      } catch {
        return res.status(403).json({ error: 'Invalid token' });
      }
    }

    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ------------------------------------------------------------------
// Helper per generare token JWT
// ------------------------------------------------------------------
export const generateStaffToken = (
  id: number,
  username: string,
  role: string,
  tenantId: string
): string => {
  return jwt.sign(
    { id, username, role, tenantId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

export const generateCustomerToken = (
  customerId: number,
  promotionId: number,
  phoneNumber: string,
  tenantId: string
): string => {
  return jwt.sign(
    { customerId, promotionId, phoneNumber, tenantId },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

export const generateSuperAdminToken = (
  id: number,
  username: string,
  email: string
): string => {
  return jwt.sign(
    { id, username, email, isSuperAdmin: true },
    JWT_SECRET,
    { expiresIn: '4h' } // Super admin ha sessione più breve per sicurezza
  );
};
