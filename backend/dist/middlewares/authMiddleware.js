"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSuperAdminToken = exports.generateCustomerToken = exports.generateStaffToken = exports.authenticateTokenForRefresh = exports.validateTenantAccess = exports.authorizeRole = exports.authenticateSuperAdmin = exports.authenticateCustomer = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set!');
}
// ------------------------------------------------------------------
// Middleware per l'autenticazione staff/admin
// ------------------------------------------------------------------
const authenticateToken = (req, res, next) => {
    const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied: Token not found' });
    }
    try {
        const verified = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Verifica che il token contenga tenantId (per nuovi token multi-tenant)
        // Per backwards compatibility, accetta anche token senza tenantId
        req.user = verified;
        // Se il token ha tenantId, lo usa; altrimenti usa quello dalla request (tenant middleware)
        if (verified.tenantId) {
            req.tenantId = verified.tenantId;
        }
        next();
    }
    catch (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
// ------------------------------------------------------------------
// Middleware per l'autenticazione dei customer
// ------------------------------------------------------------------
const authenticateCustomer = (req, res, next) => {
    const token = req.cookies?.customerToken || req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied: Customer token not found' });
    }
    try {
        const verified = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.customer = verified;
        // Se il token ha tenantId, lo usa
        if (verified.tenantId) {
            req.tenantId = verified.tenantId;
        }
        next();
    }
    catch (err) {
        res.status(403).json({ error: 'Invalid or expired customer token' });
    }
};
exports.authenticateCustomer = authenticateCustomer;
// ------------------------------------------------------------------
// Middleware per l'autenticazione super admin
// ------------------------------------------------------------------
const authenticateSuperAdmin = (req, res, next) => {
    const token = req.cookies?.superAdminToken || req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied: Super admin token not found' });
    }
    try {
        const verified = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Verifica che sia effettivamente un super admin
        if (!verified.isSuperAdmin) {
            return res.status(403).json({ error: 'Access denied: Not a super admin' });
        }
        req.superAdmin = verified;
        next();
    }
    catch (err) {
        res.status(403).json({ error: 'Invalid or expired super admin token' });
    }
};
exports.authenticateSuperAdmin = authenticateSuperAdmin;
// ------------------------------------------------------------------
// Middleware per l'autorizzazione basata sui ruoli
// ------------------------------------------------------------------
const authorizeRole = (role) => {
    return (req, res, next) => {
        if (!req.user || (req.user.role !== role && req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
exports.authorizeRole = authorizeRole;
// ------------------------------------------------------------------
// Middleware per verificare che l'utente appartenga al tenant corrente
// ------------------------------------------------------------------
const validateTenantAccess = (req, res, next) => {
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
exports.validateTenantAccess = validateTenantAccess;
// ------------------------------------------------------------------
// Middleware per il refresh del token (permette token scaduti entro grace period)
// ------------------------------------------------------------------
const REFRESH_GRACE_PERIOD = 7 * 24 * 60 * 60; // 7 giorni in secondi
const authenticateTokenForRefresh = (req, res, next) => {
    const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied: Token not found' });
    }
    try {
        const verified = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = verified;
        if (verified.tenantId) {
            req.tenantId = verified.tenantId;
        }
        next();
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            try {
                const decoded = jsonwebtoken_1.default.decode(token);
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
            }
            catch {
                return res.status(403).json({ error: 'Invalid token' });
            }
        }
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateTokenForRefresh = authenticateTokenForRefresh;
// ------------------------------------------------------------------
// Helper per generare token JWT
// ------------------------------------------------------------------
const generateStaffToken = (id, username, role, tenantId) => {
    return jsonwebtoken_1.default.sign({ id, username, role, tenantId }, JWT_SECRET, { expiresIn: '8h' });
};
exports.generateStaffToken = generateStaffToken;
const generateCustomerToken = (customerId, promotionId, phoneNumber, tenantId) => {
    return jsonwebtoken_1.default.sign({ customerId, promotionId, phoneNumber, tenantId }, JWT_SECRET, { expiresIn: '30d' });
};
exports.generateCustomerToken = generateCustomerToken;
const generateSuperAdminToken = (id, username, email) => {
    return jsonwebtoken_1.default.sign({ id, username, email, isSuperAdmin: true }, JWT_SECRET, { expiresIn: '4h' } // Super admin ha sessione più breve per sicurezza
    );
};
exports.generateSuperAdminToken = generateSuperAdminToken;
