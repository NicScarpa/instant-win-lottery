import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set!');
}

// Definiamo il tipo dell'utente staff che sarà attaccato alla Request
export interface UserPayload extends JwtPayload {
  id: number;
  username: string;
  role: string;
}

// Definiamo il tipo del customer che sarà attaccato alla Request
export interface CustomerPayload extends JwtPayload {
  customerId: number;
  promotionId: number;
  phoneNumber: string;
}

// Estendiamo l'interfaccia Request di Express per includere l'utente o il customer
export interface AuthRequest extends Request {
  user?: UserPayload;
  customer?: CustomerPayload;
}

// ------------------------------------------------------------------
// Middleware per l'autenticazione
// ------------------------------------------------------------------
export const authenticateToken = (
  req: AuthRequest, // Usiamo AuthRequest qui per TypeScript
  res: Response,
  next: NextFunction
) => {
  // 1. Cerca il token nei cookie O nell'header Authorization (Bearer token)
  // Questo è utile se decidi di testare le API con Postman o se il frontend cambia strategia
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Token not found' });
  }

  try {
    // 2. Verifica il token
    const verified = jwt.verify(token, JWT_SECRET) as UserPayload;
    
    // 3. Attacca l'utente alla richiesta
    req.user = verified;
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
  // Cerca il token nei cookie o nell'header Authorization
  const token = req.cookies?.customerToken || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Customer token not found' });
  }

  try {
    // Verifica il token
    const verified = jwt.verify(token, JWT_SECRET) as CustomerPayload;

    // Attacca il customer alla richiesta
    req.customer = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired customer token' });
  }
};

// ------------------------------------------------------------------
// Middleware per l'autorizzazione basata sui ruoli (NUOVO)
// ------------------------------------------------------------------
export const authorizeRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Se l'utente è admin, passa sempre. Altrimenti controlla il ruolo specifico.
    if (!req.user || (req.user.role !== role && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
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
    // Prima prova a verificare normalmente
    const verified = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = verified;
    next();
  } catch (err: any) {
    // Se il token è scaduto, verifica se è dentro il grace period
    if (err.name === 'TokenExpiredError') {
      try {
        // Decodifica il token senza verificare la scadenza
        const decoded = jwt.decode(token) as UserPayload & { exp?: number };

        if (decoded && decoded.exp) {
          const now = Math.floor(Date.now() / 1000);
          const expiredAt = decoded.exp;
          const secondsSinceExpiry = now - expiredAt;

          // Se scaduto da meno del grace period, permetti il refresh
          if (secondsSinceExpiry <= REFRESH_GRACE_PERIOD) {
            req.user = decoded;
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