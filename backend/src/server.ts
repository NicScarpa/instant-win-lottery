import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { PrismaClient, Prisma } from '@prisma/client';
import { probabilityEngine, PrizeConfig } from './services/ProbabilityEngine';
import { detectGender } from './utils/genderDetection';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import {
  authenticateToken,
  authorizeRole,
  authenticateCustomer,
  authenticateTokenForRefresh,
  authenticateSuperAdmin,
  generateStaffToken,
  generateCustomerToken,
  generateSuperAdminToken,
  AuthRequest
} from './middlewares/authMiddleware';
import {
  resolveTenant,
  optionalTenant,
  checkTenantLimits,
  TenantRequest
} from './middlewares/tenantMiddleware';
import {
  requireValidLicense,
  checkPlanLimit,
  requireFeature,
  validateLicenseWithWarning,
  allowExpiredLicense
} from './middlewares/licenseMiddleware';
import { LicenseService, PLAN_DEFINITIONS } from './services/LicenseService';
import { LicenseNotificationService } from './services/LicenseNotificationService';
import { AuditService } from './services/AuditService';
import { emailService } from './services/EmailService';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Tipo combinato per request con tenant e auth
type TenantAuthRequest = AuthRequest & TenantRequest;

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Validazione environment variables critiche
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set!');
  console.error('Please set JWT_SECRET in your .env file or environment variables.');
  console.error('Generate a strong secret with: openssl rand -base64 32');
  process.exit(1);
}

if (JWT_SECRET === 'super-secret-key-change-in-prod' || JWT_SECRET === 'chiave_segreta_super_sicura_campari_123') {
  console.error('FATAL ERROR: JWT_SECRET is using a weak default value!');
  console.error('Please generate a strong secret with: openssl rand -base64 32');
  process.exit(1);
}

// --- UTILITY FUNCTIONS: VALIDAZIONE INPUT ---

// Validazione numero di telefono italiano (accetta formati comuni)
const isValidPhoneNumber = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  // Rimuove spazi e caratteri non numerici tranne +
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Accetta numeri italiani: +39xxx, 39xxx, 3xxx (min 9, max 15 cifre)
  const phoneRegex = /^(\+?39)?[0-9]{9,12}$/;
  return phoneRegex.test(cleaned);
};

// Sanifica numero di telefono (mantiene solo cifre)
const sanitizePhoneNumber = (phone: string): string => {
  return phone.replace(/[^0-9]/g, '');
};

// Validazione data ISO
const isValidISODate = (dateStr: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

// Validazione array prizeTypes
const isValidPrizeTypesArray = (prizeTypes: unknown): boolean => {
  if (!Array.isArray(prizeTypes)) return false;
  return prizeTypes.every(p =>
    typeof p === 'object' &&
    p !== null &&
    typeof p.name === 'string' &&
    p.name.trim().length > 0 &&
    typeof p.initial_stock === 'number' &&
    p.initial_stock >= 0
  );
};

// Configurazione CORS - origins configurabili via env
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
    APP_URL,
    'http://localhost:3000',
    'https://www.camparinoweek.com',
    'https://camparinoweek.com'
  ];

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// --- FILE UPLOAD CONFIGURATION ---
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer storage configuration with tenant isolation
const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    // Create tenant-specific subdirectory
    const tenantId = req.tenantId || 'default';
    const tenantDir = path.join(UPLOADS_DIR, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    cb(null, tenantDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for images only
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// --- RATE LIMITING ---
// Strategia: limiti alti per IP (tutti i clienti del locale condividono WiFi),
// limiti stretti per singolo customer (prevenzione abusi individuali)

const isDev = process.env.NODE_ENV !== 'production';

// 1. Limiter generale (solo protezione DDoS) - molto permissivo
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5000, // 5000 richieste per IP - protegge solo da attacchi
  message: {
    error: 'Servizio temporaneamente non disponibile. Riprova tra qualche minuto.',
    code: 'RATE_LIMIT_GENERAL'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev && process.env.SKIP_RATE_LIMIT === 'true',
});

// 2. Limiter login admin (prevenzione brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 15, // 15 tentativi - ragionevole per admin
  message: {
    error: 'Troppi tentativi di accesso. Riprova tra 15 minuti.',
    code: 'RATE_LIMIT_AUTH'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Limiter registrazioni (per IP, ma alto per locali affollati)
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 200, // 200 registrazioni per IP (~13/min, sufficiente per locale affollato)
  message: {
    error: 'Troppe registrazioni dalla tua rete. Attendi qualche minuto.',
    code: 'RATE_LIMIT_REGISTRATION'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Limiter giocate PER CUSTOMER (basato su JWT, non IP!)
// Questo è il limite più importante: impedisce abusi individuali
const playLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 giocate al minuto per singolo customer
  message: {
    error: 'Hai giocato troppo velocemente! Attendi qualche secondo prima di riprovare.',
    code: 'RATE_LIMIT_PLAY'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Usa il customer ID dal JWT invece dell'IP
  keyGenerator: (req: any) => {
    // Prova a estrarre customer ID dal token JWT
    const customerToken = req.cookies?.customerToken || req.headers.authorization?.replace('Bearer ', '');
    if (customerToken) {
      try {
        const decoded = jwt.verify(customerToken, JWT_SECRET) as { customerId?: number };
        if (decoded.customerId) {
          return `customer_${decoded.customerId}`;
        }
      } catch {
        // Token non valido, fallback su IP
      }
    }
    // Fallback su IP se non c'è customer token
    return req.ip || 'unknown';
  },
});

// Applica rate limiting generale a tutte le API
app.use('/api/', generalLimiter);

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ==========================================
// 1. AUTHENTICATION (Login / Logout / Me)
// ==========================================

// Login per staff/admin (risolve tenant da request)
app.post('/api/auth/login', authLimiter, resolveTenant, async (req: TenantAuthRequest, res) => {
  const { username, password } = req.body;
  try {
    // Trova utente nel tenant corrente
    const user = await prisma.staffUser.findFirst({
      where: {
        username,
        tenantId: req.tenantId
      }
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Genera token con tenantId
    const token = generateStaffToken(user.id, user.username, user.role, user.tenantId);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 8 * 3600 * 1000
    });

    res.json({
      success: true,
      role: user.role,
      token: token,
      tenantId: user.tenantId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, (req: any, res: any) => {
  res.json({ user: req.user });
});

// Refresh Token - rinnova il JWT (permette refresh anche se scaduto da poco)
app.post('/api/auth/refresh', authenticateTokenForRefresh, (req: AuthRequest, res) => {
  try {
    // Se siamo qui, il token è ancora valido (verificato dal middleware)
    // Generiamo un nuovo token con scadenza estesa
    const user = req.user!;

    const newToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 8 * 3600 * 1000
    });

    res.json({ success: true, token: newToken });
  } catch (err) {
    console.error('Errore refresh token:', err);
    res.status(500).json({ error: 'Errore durante il refresh del token' });
  }
});

// ==========================================
// 1A. PASSWORD RESET
// ==========================================

// Request password reset (send email)
app.post('/api/auth/forgot-password', authLimiter, resolveTenant, async (req: TenantRequest, res) => {
  const { email, username } = req.body;

  if (!email && !username) {
    return res.status(400).json({ error: 'Email o username richiesto' });
  }

  try {
    // Find staff user by email (from tenant admin email) or username
    let staffUser = null;

    if (username) {
      staffUser = await prisma.staffUser.findFirst({
        where: {
          username,
          tenantId: req.tenantId
        },
        include: { tenant: true }
      });
    }

    // Always return success to prevent user enumeration
    if (!staffUser) {
      console.log('[PasswordReset] User not found, returning success anyway');
      return res.json({
        success: true,
        message: 'Se l\'utente esiste, riceverai un\'email con le istruzioni'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await prisma.staffUser.update({
      where: { id: staffUser.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    // Build reset URL
    const resetUrl = `${APP_URL}/admin/reset-password?token=${resetToken}`;

    // Send email
    const emailSent = await emailService.sendPasswordResetEmail(
      staffUser.tenant.adminEmail,
      resetUrl,
      staffUser.username,
      staffUser.tenant.name
    );

    if (!emailSent) {
      console.warn('[PasswordReset] Email not sent (SMTP not configured). Token:', resetToken);
    }

    res.json({
      success: true,
      message: 'Se l\'utente esiste, riceverai un\'email con le istruzioni',
      // In development, return token for testing
      ...(process.env.NODE_ENV === 'development' && { devToken: resetToken, devResetUrl: resetUrl })
    });
  } catch (err) {
    console.error('[PasswordReset] Error:', err);
    res.status(500).json({ error: 'Errore durante la richiesta di reset password' });
  }
});

// Verify reset token (check if valid)
app.post('/api/auth/verify-reset-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token mancante' });
  }

  try {
    const staffUser = await prisma.staffUser.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!staffUser) {
      return res.status(400).json({ error: 'Token non valido o scaduto' });
    }

    res.json({ success: true, username: staffUser.username });
  } catch (err) {
    console.error('[VerifyResetToken] Error:', err);
    res.status(500).json({ error: 'Errore durante la verifica del token' });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token e nuova password richiesti' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La password deve essere di almeno 8 caratteri' });
  }

  try {
    const staffUser = await prisma.staffUser.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      },
      include: { tenant: true }
    });

    if (!staffUser) {
      return res.status(400).json({ error: 'Token non valido o scaduto' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.staffUser.update({
      where: { id: staffUser.id },
      data: {
        password_hash: passwordHash,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    // Log audit
    await AuditService.log({
      tenantId: staffUser.tenantId,
      action: 'PASSWORD_RESET',
      entity: 'staff',
      entityId: staffUser.id.toString(),
      details: { username: staffUser.username },
      userId: staffUser.id,
      userType: 'staff',
      username: staffUser.username
    });

    res.json({ success: true, message: 'Password aggiornata con successo' });
  } catch (err) {
    console.error('[ResetPassword] Error:', err);
    res.status(500).json({ error: 'Errore durante il reset della password' });
  }
});

// Change password (authenticated user)
app.post('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Password attuale e nuova password richieste' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La password deve essere di almeno 8 caratteri' });
  }

  try {
    const staffUser = await prisma.staffUser.findUnique({
      where: { id: req.user!.id }
    });

    if (!staffUser) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, staffUser.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Password attuale non corretta' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.staffUser.update({
      where: { id: staffUser.id },
      data: { password_hash: passwordHash }
    });

    // Log audit
    await AuditService.log({
      tenantId: staffUser.tenantId,
      action: 'PASSWORD_CHANGED',
      entity: 'staff',
      entityId: staffUser.id.toString(),
      details: { username: staffUser.username },
      userId: staffUser.id,
      userType: 'staff',
      username: staffUser.username
    });

    res.json({ success: true, message: 'Password aggiornata con successo' });
  } catch (err) {
    console.error('[ChangePassword] Error:', err);
    res.status(500).json({ error: 'Errore durante il cambio password' });
  }
});

// ==========================================
// 1B. SUPER ADMIN AUTHENTICATION & ROUTES
// ==========================================

// Super Admin Login (no tenant required)
app.post('/api/superadmin/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const superAdmin = await prisma.superAdmin.findUnique({ where: { username } });
    if (!superAdmin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, superAdmin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateSuperAdminToken(superAdmin.id, superAdmin.username, superAdmin.email);

    res.cookie('superAdminToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 4 * 3600 * 1000 // 4 ore
    });

    res.json({ success: true, token, email: superAdmin.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Super Admin: Lista Tenants
app.get('/api/superadmin/tenants', authenticateSuperAdmin, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            promotions: true,
            staffUsers: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tenants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Super Admin: Crea Tenant
app.post('/api/superadmin/tenants', authenticateSuperAdmin, async (req, res) => {
  const { name, slug, subdomain, adminEmail, plan, companyName } = req.body;

  if (!name || !slug || !subdomain || !adminEmail) {
    return res.status(400).json({ error: 'Missing required fields: name, slug, subdomain, adminEmail' });
  }

  try {
    // Genera license key
    const licenseKey = Array.from({ length: 4 }, () =>
      crypto.randomBytes(2).toString('hex').toUpperCase()
    ).join('-');

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        subdomain,
        adminEmail,
        companyName,
        plan: plan || 'starter',
        licenseKey,
        licenseStatus: 'trial',
        licenseEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 giorni trial
      }
    });

    // Crea branding e content di default
    await prisma.tenantBranding.create({
      data: { tenantId: tenant.id }
    });

    await prisma.tenantContent.create({
      data: { tenantId: tenant.id, language: 'it' }
    });

    res.json({ success: true, tenant });
  } catch (err: any) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Slug or subdomain already exists' });
    }
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Super Admin: Aggiorna Tenant
app.put('/api/superadmin/tenants/:id', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, tenant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// Super Admin: Attiva Licenza
app.post('/api/superadmin/tenants/:id/activate', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { plan, durationDays } = req.body;

  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        licenseStatus: 'active',
        plan: plan || 'pro',
        licenseStart: new Date(),
        licenseEnd: new Date(Date.now() + (durationDays || 365) * 24 * 60 * 60 * 1000)
      }
    });
    res.json({ success: true, tenant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to activate license' });
  }
});

// Super Admin: Sospendi Tenant
app.post('/api/superadmin/tenants/:id/suspend', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { licenseStatus: 'suspended' }
    });
    res.json({ success: true, tenant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to suspend tenant' });
  }
});

// Super Admin: Analytics cross-tenant
app.get('/api/superadmin/analytics', authenticateSuperAdmin, async (req, res) => {
  try {
    const [
      tenantCount,
      totalPromotions,
      totalTokens,
      totalPlays,
      totalWins,
      totalCustomers,
      activePromotions
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.promotion.count(),
      prisma.token.count(),
      prisma.play.count(),
      prisma.play.count({ where: { is_winner: true } }),
      prisma.customer.count(),
      prisma.promotion.count({ where: { status: 'active' } })
    ]);

    const tenantsByPlan = await prisma.tenant.groupBy({
      by: ['plan'],
      _count: { id: true }
    });

    const tenantsByStatus = await prisma.tenant.groupBy({
      by: ['licenseStatus'],
      _count: { id: true }
    });

    // Top 10 tenants by plays
    const topTenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        licenseStatus: true,
        _count: {
          select: {
            promotions: true
          }
        },
        promotions: {
          select: {
            _count: {
              select: {
                plays: true,
                tokens: true
              }
            }
          }
        }
      },
      take: 10
    });

    // Calculate plays per tenant
    const tenantsWithPlays = topTenants.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      licenseStatus: t.licenseStatus,
      promotionCount: t._count.promotions,
      totalPlays: t.promotions.reduce((sum, p) => sum + p._count.plays, 0),
      totalTokens: t.promotions.reduce((sum, p) => sum + p._count.tokens, 0)
    })).sort((a, b) => b.totalPlays - a.totalPlays);

    res.json({
      overview: {
        tenantCount,
        totalPromotions,
        activePromotions,
        totalTokens,
        totalPlays,
        totalWins,
        totalCustomers,
        winRate: totalPlays > 0 ? ((totalWins / totalPlays) * 100).toFixed(2) : 0
      },
      tenantsByPlan,
      tenantsByStatus,
      topTenants: tenantsWithPlays
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Super Admin: Detailed analytics trends
app.get('/api/superadmin/analytics/trends', authenticateSuperAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get plays grouped by day
    const plays = await prisma.play.findMany({
      where: { created_at: { gte: startDate } },
      select: {
        created_at: true,
        is_winner: true
      }
    });

    // Group by day
    const dailyStats: Record<string, { plays: number; wins: number }> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = { plays: 0, wins: 0 };
    }

    plays.forEach(play => {
      const dateKey = new Date(play.created_at).toISOString().split('T')[0];
      if (dailyStats[dateKey]) {
        dailyStats[dateKey].plays++;
        if (play.is_winner) dailyStats[dateKey].wins++;
      }
    });

    // Convert to array and sort by date
    const trends = Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get new tenants in period
    const newTenants = await prisma.tenant.count({
      where: { createdAt: { gte: startDate } }
    });

    // Get new customers in period
    const newCustomers = await prisma.customer.count({
      where: { created_at: { gte: startDate } }
    });

    res.json({
      period: { days, startDate, endDate: new Date() },
      trends,
      summary: {
        totalPlays: plays.length,
        totalWins: plays.filter(p => p.is_winner).length,
        newTenants,
        newCustomers
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics trends' });
  }
});

// Super Admin: Recent activity across all tenants
app.get('/api/superadmin/analytics/recent-activity', authenticateSuperAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    // Recent plays
    const recentPlays = await prisma.play.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        is_winner: true,
        created_at: true,
        customer: {
          select: {
            first_name: true,
            last_name: true
          }
        },
        promotion: {
          select: {
            name: true,
            tenant: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    // Recent tenant registrations
    const recentTenants = await prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true
      }
    });

    res.json({
      recentPlays: recentPlays.map(p => ({
        id: p.id,
        isWinner: p.is_winner,
        createdAt: p.created_at,
        customerName: `${p.customer.first_name} ${p.customer.last_name}`,
        promotionName: p.promotion.name,
        tenantName: p.promotion.tenant.name,
        tenantSlug: p.promotion.tenant.slug
      })),
      recentTenants
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// ==========================================
// LICENSE NOTIFICATIONS (Cron Job)
// ==========================================

// GET Statistiche licenze
app.get('/api/superadmin/licenses/stats', authenticateSuperAdmin, async (req, res) => {
  try {
    const stats = await LicenseNotificationService.getLicenseStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get license stats' });
  }
});

// GET Licenze in scadenza
app.get('/api/superadmin/licenses/expiring', authenticateSuperAdmin, async (req, res) => {
  try {
    const expiring = await LicenseNotificationService.getExpiringLicenses();
    res.json(expiring);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get expiring licenses' });
  }
});

// POST Processa notifiche (cron job manuale o schedulato)
app.post('/api/superadmin/licenses/process-notifications', authenticateSuperAdmin, async (req, res) => {
  try {
    const result = await LicenseNotificationService.processNotifications();
    res.json({
      success: true,
      summary: {
        expiringCount: result.expiring.length,
        expiredCount: result.expired.length,
        suspendedCount: result.suspended
      },
      details: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process notifications' });
  }
});

// POST Sospendi licenze scadute (cron job)
app.post('/api/superadmin/licenses/suspend-expired', authenticateSuperAdmin, async (req, res) => {
  try {
    const count = await LicenseNotificationService.suspendExpiredLicenses();
    res.json({
      success: true,
      suspendedCount: count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to suspend expired licenses' });
  }
});

// ==========================================
// Super Admin: Rinnova licenza
app.post('/api/superadmin/tenants/:id/renew', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { additionalDays } = req.body;

  if (!additionalDays || additionalDays < 1) {
    return res.status(400).json({ error: 'additionalDays must be a positive number' });
  }

  try {
    const tenant = await LicenseService.renewLicense(id, additionalDays);
    res.json({ success: true, tenant });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to renew license' });
  }
});

// Super Admin: Upgrade piano
app.post('/api/superadmin/tenants/:id/upgrade', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { plan, extendDays } = req.body;

  if (!plan || !PLAN_DEFINITIONS[plan]) {
    return res.status(400).json({
      error: 'Invalid plan',
      availablePlans: Object.keys(PLAN_DEFINITIONS)
    });
  }

  try {
    const tenant = await LicenseService.upgradePlan(id, plan, extendDays || 0);
    res.json({ success: true, tenant });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to upgrade plan' });
  }
});

// Super Admin: Riattiva licenza sospesa
app.post('/api/superadmin/tenants/:id/reactivate', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const tenant = await LicenseService.reactivateLicense(id);
    res.json({ success: true, tenant });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to reactivate license' });
  }
});

// Super Admin: Impersona Tenant Admin
app.post('/api/superadmin/tenants/:id/impersonate', authenticateSuperAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica che il tenant esista
    const tenant = await prisma.tenant.findUnique({
      where: { id }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Trova un admin user per questo tenant (o crea un token "virtuale")
    const adminUser = await prisma.staffUser.findFirst({
      where: { tenantId: id, role: 'admin' }
    });

    // Genera un token JWT con i dati necessari per impersonare
    const impersonationToken = jwt.sign(
      {
        id: adminUser?.id || 0,
        username: adminUser?.username || `superadmin_as_${tenant.slug}`,
        role: 'admin',
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        isImpersonation: true, // Flag per identificare sessioni impersonate
        impersonatedBy: 'superadmin'
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '2h' } // Token più breve per sicurezza
    );

    res.json({
      success: true,
      token: impersonationToken,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain
      },
      redirectUrl: `/admin/dashboard`
    });
  } catch (err: any) {
    console.error('Impersonation error:', err);
    res.status(500).json({ error: err.message || 'Failed to impersonate tenant' });
  }
});

// Super Admin: Lista licenze in scadenza
app.get('/api/superadmin/licenses/expiring', authenticateSuperAdmin, async (req, res) => {
  const daysAhead = Number(req.query.days) || 30;

  try {
    const tenants = await LicenseService.findExpiringLicenses(daysAhead);
    res.json({
      daysAhead,
      count: tenants.length,
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        licenseStatus: t.licenseStatus,
        licenseEnd: t.licenseEnd,
        adminEmail: t.adminEmail
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expiring licenses' });
  }
});

// Super Admin: Aggiorna licenze scadute (batch job manuale)
app.post('/api/superadmin/licenses/update-expired', authenticateSuperAdmin, async (req, res) => {
  try {
    const count = await LicenseService.updateExpiredLicenses();
    res.json({ success: true, updatedCount: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expired licenses' });
  }
});

// Super Admin: Dettagli piano disponibili
app.get('/api/superadmin/plans', authenticateSuperAdmin, (req, res) => {
  res.json(PLAN_DEFINITIONS);
});

// ==========================================
// 2. ADMIN: PROMOTIONS MANAGEMENT (CRUD)
// ==========================================

// Lista Promozioni (filtrate per tenant)
app.get('/api/promotions/list', resolveTenant, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const promotions = await prisma.promotion.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { created_at: 'desc' }
    });
    res.json(promotions);
  } catch (err) {
    res.status(500).json({ error: 'Errore recupero promozioni' });
  }
});

// Crea Promozione (con tenant e validazione licenza)
app.post('/api/promotions/create', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), checkPlanLimit('promotions'), async (req: TenantAuthRequest, res) => {
  const { name, plannedTokenCount, startDatetime, endDatetime } = req.body;

  // Validazione input
  if (!name || !plannedTokenCount || !startDatetime || !endDatetime) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }

  const startDate = new Date(startDatetime);
  const endDate = new Date(endDatetime);

  // Validazione date
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Formato date non valido' });
  }

  if (startDate >= endDate) {
    return res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' });
  }

  // Verifica limite token per promozione
  const tokenCount = Number(plannedTokenCount);
  if (req.tenant && tokenCount > req.tenant.maxTokensPerPromo) {
    return res.status(403).json({
      error: 'Plan limit reached',
      message: `Your plan allows a maximum of ${req.tenant.maxTokensPerPromo} tokens per promotion.`,
      limit: req.tenant.maxTokensPerPromo,
      requested: tokenCount
    });
  }

  try {
    // Crea la promozione con tenantId
    const promo = await prisma.promotion.create({
      data: {
        tenantId: req.tenantId!,
        name,
        planned_token_count: tokenCount,
        start_datetime: startDate,
        end_datetime: endDate,
        status: 'DRAFT'
      }
    });

    // Genera automaticamente i token
    if (tokenCount > 0) {
      const codesToCreate = [];
      for (let i = 0; i < tokenCount; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codesToCreate.push({
          promotion_id: promo.id,
          token_code: code,
          status: 'available'
        });
      }

      await prisma.token.createMany({
        data: codesToCreate as any
      });
    }

    // Log audit
    await AuditService.log({
      tenantId: req.tenantId!,
      action: 'CREATE_PROMOTION',
      entity: 'promotion',
      entityId: promo.id,
      details: { name, tokenCount },
      userId: req.user?.id,
      userType: req.user?.role as any,
      username: req.user?.username,
      ...AuditService.extractRequestInfo(req)
    });

    res.json({
      success: true,
      promotion: promo,
      tokensGenerated: tokenCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore creazione promozione' });
  }
});

// Aggiorna Promozione
app.put('/api/promotions/update/:id', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { id } = req.params;
  const { name, plannedTokenCount, status, start_datetime, end_datetime } = req.body;

  // Validazione date se fornite
  if (start_datetime && end_datetime) {
    const startDate = new Date(start_datetime);
    const endDate = new Date(end_datetime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Formato date non valido' });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' });
    }
  }

  try {
    const promo = await prisma.promotion.update({
      where: { id: Number(id) },
      data: {
        name,
        planned_token_count: Number(plannedTokenCount),
        status,
        start_datetime: start_datetime ? new Date(start_datetime) : undefined,
        end_datetime: end_datetime ? new Date(end_datetime) : undefined
      }
    });
    res.json({ success: true, promotion: promo });
  } catch (err) {
    res.status(500).json({ error: 'Errore aggiornamento' });
  }
});

// Elimina Promozione (con cascade completo)
app.delete('/api/promotions/delete/:id', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { id } = req.params;
  const pid = Number(id);

  try {
    // Usa una transazione per garantire atomicità
    await prisma.$transaction(async (tx) => {
      // 1. Elimina FinalLeaderboard (dipende da Customer e Promotion)
      await tx.finalLeaderboard.deleteMany({ where: { promotion_id: pid } });

      // 2. Elimina PrizeAssignment (dipende da PrizeType, Customer, Token, Play)
      await tx.prizeAssignment.deleteMany({ where: { promotion_id: pid } });

      // 3. Elimina Play (dipende da Token, Customer)
      await tx.play.deleteMany({ where: { promotion_id: pid } });

      // 4. Elimina Customer (dipende da Promotion)
      await tx.customer.deleteMany({ where: { promotion_id: pid } });

      // 5. Elimina Token (dipende da Promotion)
      await tx.token.deleteMany({ where: { promotion_id: pid } });

      // 6. Elimina PrizeType (dipende da Promotion)
      await tx.prizeType.deleteMany({ where: { promotion_id: pid } });

      // 7. Elimina Promotion
      await tx.promotion.delete({ where: { id: pid } });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Errore eliminazione promozione:', err);
    res.status(500).json({ error: 'Errore eliminazione promozione' });
  }
});

// GET singola promozione (per settings)
app.get('/api/promotions/:id', resolveTenant, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { id } = req.params;
  try {
    const promotion = await prisma.promotion.findFirst({
      where: { id: Number(id), tenantId: req.tenantId }
    });
    if (!promotion) {
      return res.status(404).json({ error: 'Promozione non trovata' });
    }
    res.json(promotion);
  } catch (err) {
    console.error('Errore recupero promozione:', err);
    res.status(500).json({ error: 'Errore recupero promozione' });
  }
});

// PUT Leaderboard settings
app.put('/api/promotions/:id/leaderboard', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { id } = req.params;
  const { leaderboard_enabled, leaderboard_show_names, leaderboard_show_prizes, leaderboard_style, leaderboard_size } = req.body;

  try {
    const promotion = await prisma.promotion.updateMany({
      where: { id: Number(id), tenantId: req.tenantId },
      data: {
        leaderboard_enabled: leaderboard_enabled ?? false,
        leaderboard_show_names: leaderboard_show_names ?? true,
        leaderboard_show_prizes: leaderboard_show_prizes ?? false,
        leaderboard_style: leaderboard_style || 'minimal',
        leaderboard_size: leaderboard_size || 10
      }
    });

    if (promotion.count === 0) {
      return res.status(404).json({ error: 'Promozione non trovata' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Errore aggiornamento leaderboard:', err);
    res.status(500).json({ error: 'Errore aggiornamento leaderboard' });
  }
});

// GET Engine config
app.get('/api/promotions/:id/engine-config', resolveTenant, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { id } = req.params;
  try {
    // Verifica che la promozione appartenga al tenant
    const promotion = await prisma.promotion.findFirst({
      where: { id: Number(id), tenantId: req.tenantId }
    });
    if (!promotion) {
      return res.status(404).json({ error: 'Promozione non trovata' });
    }

    const config = await prisma.promotionEngineConfig.findUnique({
      where: { promotionId: Number(id) }
    });

    // Se non esiste, ritorna i valori di default
    if (!config) {
      return res.json({
        promotionId: Number(id),
        // Fatigue defaults
        fatigueEnabled: true,
        fatiguePlayThreshold: 6,
        fatiguePlayBasePenalty: 0.10,
        fatiguePlayIncrement: 0.02,
        fatiguePlayMax: 0.50,
        fatigueWinPenalty: 0.20,
        fatigueWinMax: 0.60,
        fatigueMinProbability: 0.10,
        // Pacing defaults
        pacingEnabled: true,
        pacingTooFastThreshold: 1.30,
        pacingTooFastMultiplier: 0.60,
        pacingFastThreshold: 1.15,
        pacingFastMultiplier: 0.80,
        pacingSlowThreshold: 0.85,
        pacingSlowMultiplier: 1.20,
        pacingTooSlowThreshold: 0.70,
        pacingTooSlowMultiplier: 1.40,
        // Time Pressure defaults
        timePressureEnabled: true,
        timeConservationStartMin: 60,
        timeDistributionStartMin: 5,
        timeFinalStartMin: 1,
        timeConservationMin: 0.30,
        timeConservationMax: 0.80,
        timeConservationBoost: 1.30,
        timeDistributionMin: 1.50,
        timeDistributionMax: 5.00,
        timeFinalBoost: 10.00,
        // Force Win
        forceWinEnabled: false,
        forceWinThresholdMin: 1,
        // Desperation
        desperationModeEnabled: false,
        desperationStartMin: 5,
        // Global
        maxProbability: 1.00,
        minProbability: 0.001,
        loggingEnabled: false
      });
    }

    res.json(config);
  } catch (err) {
    console.error('Errore recupero engine config:', err);
    res.status(500).json({ error: 'Errore recupero config' });
  }
});

// PUT Engine config
app.put('/api/promotions/:id/engine-config', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { id } = req.params;
  const configData = req.body;

  try {
    // Verifica che la promozione appartenga al tenant
    const promotion = await prisma.promotion.findFirst({
      where: { id: Number(id), tenantId: req.tenantId }
    });
    if (!promotion) {
      return res.status(404).json({ error: 'Promozione non trovata' });
    }

    // Upsert: crea o aggiorna la configurazione
    const config = await prisma.promotionEngineConfig.upsert({
      where: { promotionId: Number(id) },
      update: configData,
      create: {
        promotionId: Number(id),
        ...configData
      }
    });

    res.json({ success: true, config });
  } catch (err) {
    console.error('Errore aggiornamento engine config:', err);
    res.status(500).json({ error: 'Errore aggiornamento config' });
  }
});

// ==========================================
// 3. ADMIN: PRIZES MANAGEMENT
// ==========================================

app.get('/api/admin/prizes/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  try {
    const prizes = await prisma.prizeType.findMany({
      where: { promotion_id: Number(promotionId) },
      orderBy: { name: 'asc' }
    });
    res.json(prizes);
  } catch (err) {
    res.status(500).json({ error: 'Errore recupero premi' });
  }
});

// Aggiungi singolo premio
app.post('/api/admin/prizes/add', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId, name, initialStock, genderRestriction } = req.body;

  if (!promotionId || !name || !initialStock) {
    return res.status(400).json({ error: 'Campi mancanti: promotionId, name, initialStock sono obbligatori' });
  }

  // Valida genderRestriction se fornito
  const validGenderValues = ['F', 'M', null, '', undefined];
  if (genderRestriction && !['F', 'M'].includes(genderRestriction)) {
    return res.status(400).json({ error: 'genderRestriction deve essere "F", "M" o vuoto' });
  }

  try {
    const prize = await prisma.prizeType.create({
      data: {
        promotion_id: Number(promotionId),
        name: name.trim(),
        initial_stock: Number(initialStock),
        remaining_stock: Number(initialStock),
        target_overall_probability: 0,
        gender_restriction: genderRestriction || null
      }
    });

    res.json({ success: true, prize });
  } catch (err) {
    console.error('Errore creazione premio:', err);
    res.status(500).json({ error: 'Errore creazione premio' });
  }
});

app.post('/api/admin/prizes/update', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId, prizeTypes } = req.body;
  try {
    for (const p of prizeTypes) {
      if (p.id) {
        await prisma.prizeType.update({
          where: { id: p.id },
          data: {
            name: p.name,
            initial_stock: Number(p.initial_stock),
            remaining_stock: Number(p.remaining_stock),
            target_overall_probability: Number(p.target_overall_probability)
          }
        });
      } else {
        await prisma.prizeType.create({
          data: {
            promotion_id: Number(promotionId),
            name: p.name,
            initial_stock: Number(p.initial_stock),
            remaining_stock: Number(p.initial_stock),
            target_overall_probability: Number(p.target_overall_probability)
          }
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore salvataggio premi' });
  }
});

// Modifica stock di un singolo premio
app.put('/api/admin/prizes/:prizeId', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { prizeId } = req.params;
  const { initial_stock, remaining_stock, gender_restriction } = req.body;

  try {
    const prize = await prisma.prizeType.findUnique({
      where: { id: Number(prizeId) }
    });

    if (!prize) {
      return res.status(404).json({ error: 'Premio non trovato' });
    }

    // Valida gender_restriction se fornito
    if (gender_restriction !== undefined && gender_restriction !== null && gender_restriction !== '' && !['F', 'M'].includes(gender_restriction)) {
      return res.status(400).json({ error: 'gender_restriction deve essere "F", "M" o vuoto' });
    }

    const updateData: { initial_stock?: number; remaining_stock?: number; gender_restriction?: string | null } = {};

    if (initial_stock !== undefined) {
      updateData.initial_stock = Number(initial_stock);
    }
    if (remaining_stock !== undefined) {
      updateData.remaining_stock = Number(remaining_stock);
    }
    if (gender_restriction !== undefined) {
      // Se e' stringa vuota o null, imposta null
      updateData.gender_restriction = gender_restriction === '' ? null : gender_restriction;
    }

    const updated = await prisma.prizeType.update({
      where: { id: Number(prizeId) },
      data: updateData
    });

    res.json({ success: true, prize: updated });
  } catch (err) {
    console.error('Errore modifica premio:', err);
    res.status(500).json({ error: 'Errore durante la modifica del premio' });
  }
});

// Reset stock di un premio (remaining = initial)
app.put('/api/admin/prizes/:prizeId/reset', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { prizeId } = req.params;

  try {
    const prize = await prisma.prizeType.findUnique({
      where: { id: Number(prizeId) }
    });

    if (!prize) {
      return res.status(404).json({ error: 'Premio non trovato' });
    }

    const updated = await prisma.prizeType.update({
      where: { id: Number(prizeId) },
      data: { remaining_stock: prize.initial_stock }
    });

    res.json({
      success: true,
      prize: updated,
      message: `Stock resettato: ${updated.remaining_stock}/${updated.initial_stock}`
    });
  } catch (err) {
    console.error('Errore reset premio:', err);
    res.status(500).json({ error: 'Errore durante il reset del premio' });
  }
});

// Elimina un premio
app.delete('/api/admin/prizes/:prizeId', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { prizeId } = req.params;

  try {
    // Verifica se il premio ha assegnazioni
    const assignmentsCount = await prisma.prizeAssignment.count({
      where: { prize_type_id: Number(prizeId) }
    });

    if (assignmentsCount > 0) {
      return res.status(400).json({
        error: `Impossibile eliminare: questo premio ha ${assignmentsCount} assegnazioni esistenti. Elimina prima le assegnazioni o crea una nuova promozione.`
      });
    }

    await prisma.prizeType.delete({
      where: { id: Number(prizeId) }
    });

    res.json({ success: true, message: 'Premio eliminato con successo' });
  } catch (err) {
    console.error('Errore eliminazione premio:', err);
    res.status(500).json({ error: 'Errore durante l\'eliminazione del premio' });
  }
});

// ==========================================
// 4. ADMIN: STATS & LOGS (CORRETTO QUI)
// ==========================================

app.get('/api/admin/stats/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  const pid = Number(promotionId);
  try {
    const totalTokens = await prisma.token.count({ where: { promotion_id: pid } });
    const usedTokens = await prisma.token.count({ where: { promotion_id: pid, status: 'used' } });
    const availableTokens = await prisma.token.count({ where: { promotion_id: pid, status: 'available' } });
    const totalPlays = await prisma.play.count({ where: { promotion_id: pid } });
    const uniquePlayers = await prisma.customer.count({ where: { promotion_id: pid } });
    const wins = await prisma.play.count({ where: { promotion_id: pid, is_winner: true } });

    const prizes = await prisma.prizeType.findMany({ where: { promotion_id: pid } });
    const totalStock = prizes.reduce((acc, p) => acc + p.initial_stock, 0);
    const remainingStock = prizes.reduce((acc, p) => acc + p.remaining_stock, 0);

    // Dettagli premi per il frontend
    const prizeDetails = prizes.map(p => ({
      name: p.name,
      initial_stock: p.initial_stock,
      remaining_stock: p.remaining_stock
    }));

    // Risposta nel formato atteso dal frontend StatsCard
    res.json({
      tokenStats: {
        total: totalTokens,
        used: usedTokens,
        available: availableTokens
      },
      prizeStats: {
        total: totalStock,
        remaining: remainingStock,
        details: prizeDetails
      },
      // Manteniamo anche il vecchio formato per retrocompatibilità
      tokens: { total: totalTokens, used: usedTokens },
      plays: { total: totalPlays, unique_players: uniquePlayers },
      prizes: { total: totalStock, awarded: wins, remaining: remainingStock }
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore statistiche' });
  }
});

// Revenue Stats endpoint
const SALE_PRICE = 3.00;  // Prezzo vendita Campari Soda
const UNIT_COST = 0.84;   // Costo acquisto

// Helper functions per fuso orario italiano (Europe/Rome)
function getItalianDateString(date: Date): string {
  // Ritorna data in formato YYYY-MM-DD nel fuso orario italiano
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); // sv-SE usa formato ISO
}

function getItalianHour(date: Date): number {
  // Ritorna l'ora (0-23) nel fuso orario italiano
  const hourStr = date.toLocaleString('en-US', {
    timeZone: 'Europe/Rome',
    hour: 'numeric',
    hour12: false
  });
  return parseInt(hourStr, 10);
}

app.get('/api/admin/revenue/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  const { date } = req.query; // Opzionale: filtra per giorno specifico
  const pid = Number(promotionId);

  try {
    // 1. Recupera info promozione per date inizio/fine
    const promotion = await prisma.promotion.findUnique({
      where: { id: pid },
      select: { start_datetime: true, end_datetime: true }
    });

    if (!promotion) {
      return res.status(404).json({ error: 'Promozione non trovata' });
    }

    // 2. Costruisci filtro date
    const dateFilter: { used_at?: { gte?: Date; lte?: Date } } = {};
    if (date) {
      // Filtra per giorno specifico
      const dayStart = new Date(date as string);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date as string);
      dayEnd.setHours(23, 59, 59, 999);
      dateFilter.used_at = { gte: dayStart, lte: dayEnd };
    }

    // 3. Conteggio totale token utilizzati
    const unitsSold = await prisma.token.count({
      where: {
        promotion_id: pid,
        status: 'used',
        ...dateFilter
      }
    });

    // 4. Calcoli finanziari
    const totalRevenue = unitsSold * SALE_PRICE;
    const totalCost = unitsSold * UNIT_COST;
    const grossMargin = totalRevenue - totalCost;
    const marginPercentage = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    // 5. Aggregazione giornaliera - usando Prisma invece di raw SQL per compatibilità SQLite/PostgreSQL
    const usedTokens = await prisma.token.findMany({
      where: {
        promotion_id: pid,
        status: 'used',
        used_at: { not: null }
      },
      select: { used_at: true }
    });

    // Raggruppa per data manualmente (usando fuso orario italiano)
    const dailyMap = new Map<string, number>();
    usedTokens.forEach(token => {
      if (token.used_at) {
        const dateKey = getItalianDateString(token.used_at);
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }
    });

    // Converti in array ordinato
    const dailySalesRaw = Array.from(dailyMap.entries())
      .map(([date, units]) => ({ date, units }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calcola variazione rispetto al giorno precedente
    const dailySales = dailySalesRaw.map((day, index) => {
      const units = day.units;
      const revenue = units * SALE_PRICE;
      let vsYesterday: number | null = null;

      if (index > 0) {
        const yesterdayUnits = dailySalesRaw[index - 1].units;
        if (yesterdayUnits > 0) {
          vsYesterday = ((units - yesterdayUnits) / yesterdayUnits) * 100;
        }
      }

      return {
        date: day.date,
        units,
        revenue,
        vsYesterday
      };
    });

    // 6. Media giornaliera (solo giorni con vendite)
    const daysWithSales = dailySales.length;
    const dailyAverage = daysWithSales > 0 ? unitsSold / daysWithSales : 0;
    const dailyAverageRevenue = daysWithSales > 0 ? totalRevenue / daysWithSales : 0;

    // 7. Distribuzione oraria - raggruppa per ora manualmente (fuso orario italiano)
    const hourlyMap = new Map<number, number>();

    // Filtra per data se specificata (usando fuso orario italiano)
    const tokensForHourly = date
      ? usedTokens.filter(t => t.used_at && getItalianDateString(t.used_at) === date)
      : usedTokens;

    tokensForHourly.forEach(token => {
      if (token.used_at) {
        const hour = getItalianHour(token.used_at);
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      }
    });

    // Crea array completo 0-23 ore
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyMap.get(i) || 0
    }));

    res.json({
      summary: {
        unitsSold,
        totalRevenue,
        totalCost,
        grossMargin,
        marginPercentage,
        dailyAverage,
        dailyAverageRevenue
      },
      dailySales,
      hourlyDistribution,
      promotion: {
        startDate: promotion.start_datetime.toISOString(),
        endDate: promotion.end_datetime.toISOString()
      }
    });
  } catch (err) {
    console.error('Errore revenue stats:', err);
    res.status(500).json({ error: 'Errore nel calcolo revenue' });
  }
});

app.get('/api/admin/play-logs/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  try {
    const logs = await prisma.play.findMany({
      where: { promotion_id: Number(promotionId) },
      include: {
        customer: true,
        token: true,
        prize_assignment: { include: { prize_type: true } } // CORRETTO: Singolare
      },
      orderBy: { created_at: 'desc' }, // CORRETTO: created_at, non played_at
      take: 50
    });

    // Formattazione per frontend (allineato con PlayLogViewer interface)
    const formatted = logs.map(l => ({
      playId: String(l.id),
      date: l.created_at.toISOString(),
      firstName: l.customer.first_name,
      lastName: l.customer.last_name,
      phoneNumber: l.customer.phone_number,
      isWinner: l.is_winner,
      tokenCode: l.token.token_code,
      // Campi extra per compatibilità
      prizeName: l.is_winner ? (l.prize_assignment?.prize_type.name || null) : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err); // Aggiunto log errore
    res.status(500).json({ error: 'Errore logs' });
  }
});

app.get('/api/admin/tokens/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  const { page = 1, limit = 50, search = '' } = req.query;
  const pid = Number(promotionId);
  const searchStr = String(search);

  try {
    // Definisci il filtro where - SOLO token disponibili (non usati)
    const whereClause = {
      promotion_id: pid,
      status: 'available', // Fix: mostra solo token disponibili
      ...(searchStr && { token_code: { contains: searchStr } })
    };

    // Esegui query e count in parallelo per efficienza
    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit)
      }),
      prisma.token.count({
        where: whereClause
      })
    ]);

    res.json({
      tokens,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    console.error('Errore fetch tokens:', err);
    res.status(500).json({ error: 'Errore tokens' });
  }
});

// Token Utilizzati con dettagli giocata (per sezione "Ultimi Token Utilizzati")
app.get('/api/admin/used-tokens/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const pid = Number(promotionId);
  const pageNum = Number(page);
  const limitNum = Number(limit);

  try {
    // Query per il conteggio totale e i dati in parallelo
    const whereClause = {
      promotion_id: pid,
      status: 'used'
    };

    const [usedTokens, total] = await Promise.all([
      prisma.token.findMany({
        where: whereClause,
        include: {
          play: {
            include: {
              customer: {
                select: {
                  first_name: true,
                  last_name: true,
                  phone_number: true
                }
              },
              prize_assignment: {
                include: {
                  prize_type: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { used_at: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum
      }),
      prisma.token.count({ where: whereClause })
    ]);

    // Formatta la risposta per il frontend
    const formatted = usedTokens.map(token => ({
      id: token.id,
      token_code: token.token_code,
      used_at: token.used_at,
      is_winner: token.play?.is_winner || false,
      customer: token.play?.customer ? {
        first_name: token.play.customer.first_name,
        last_name: token.play.customer.last_name,
        phone_number: token.play.customer.phone_number
      } : null,
      prize_name: token.play?.prize_assignment?.prize_type?.name || null,
      prize_code: token.play?.prize_assignment?.prize_code || null,
      redeemed_at: token.play?.prize_assignment?.redeemed_at || null
    }));

    res.json({
      tokens: formatted,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    console.error('Errore fetch used tokens:', err);
    res.status(500).json({ error: 'Errore recupero token utilizzati' });
  }
});

// Lista Clienti registrati per una promozione (Archivio Giocatori)
app.get('/api/admin/customers/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  const { page = 1, limit = 20, search = '' } = req.query;
  const pid = Number(promotionId);
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const searchStr = String(search).trim();

  try {
    // Costruisci il filtro where
    const whereClause: {
      promotion_id: number;
      OR?: Array<{
        first_name?: { contains: string; mode: 'insensitive' };
        last_name?: { contains: string; mode: 'insensitive' };
        phone_number?: { contains: string };
      }>;
    } = {
      promotion_id: pid
    };

    // Aggiungi filtro di ricerca se presente
    if (searchStr) {
      whereClause.OR = [
        { first_name: { contains: searchStr, mode: 'insensitive' } },
        { last_name: { contains: searchStr, mode: 'insensitive' } },
        { phone_number: { contains: searchStr } }
      ];
    }

    // Query per dati e conteggio in parallelo
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          total_plays: true,
          consent_marketing: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum
      }),
      prisma.customer.count({ where: whereClause })
    ]);

    // Formatta la risposta
    const formatted = customers.map(c => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      phoneNumber: c.phone_number,
      totalPlays: c.total_plays,
      consentMarketing: c.consent_marketing,
      registeredAt: c.created_at
    }));

    res.json({
      customers: formatted,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    console.error('Errore fetch customers:', err);
    res.status(500).json({ error: 'Errore recupero clienti' });
  }
});

// Export CSV di tutti i clienti di una promozione
app.get('/api/admin/customers/:promotionId/export', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  const pid = Number(promotionId);

  try {
    const customers = await prisma.customer.findMany({
      where: { promotion_id: pid },
      select: {
        first_name: true,
        last_name: true,
        phone_number: true,
        total_plays: true,
        consent_marketing: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' }
    });

    // Genera CSV
    const headers = ['Nome', 'Cognome', 'Telefono', 'Giocate Totali', 'Consenso Marketing', 'Data Registrazione'];
    const rows = customers.map(c => [
      c.first_name,
      c.last_name,
      c.phone_number,
      c.total_plays.toString(),
      c.consent_marketing ? 'Sì' : 'No',
      new Date(c.created_at).toLocaleString('it-IT')
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    // BOM per Excel compatibility con caratteri italiani
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=archivio_giocatori_promo_${pid}.csv`);
    res.send(bom + csvContent);
  } catch (err) {
    console.error('Errore export customers:', err);
    res.status(500).json({ error: 'Errore esportazione clienti' });
  }
});

// Reset Token - Elimina tutti i token e le giocate di una promozione
app.delete('/api/admin/tokens/reset/:promotionId', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  const pid = Number(promotionId);

  if (!pid || isNaN(pid)) {
    return res.status(400).json({ error: 'ID promozione non valido' });
  }

  try {
    // Esegui tutto in una transazione per garantire consistenza
    const result = await prisma.$transaction(async (tx) => {
      // 1. Elimina prima i PrizeAssignment (dipende da Token e Play)
      const deletedAssignments = await tx.prizeAssignment.deleteMany({
        where: { promotion_id: pid }
      });

      // 2. Elimina le Play (dipende da Token)
      const deletedPlays = await tx.play.deleteMany({
        where: { promotion_id: pid }
      });

      // 3. Elimina i Token
      const deletedTokens = await tx.token.deleteMany({
        where: { promotion_id: pid }
      });

      // 4. Reset dello stock dei premi (riporta remaining_stock a initial_stock)
      const prizeTypes = await tx.prizeType.findMany({
        where: { promotion_id: pid }
      });
      for (const prize of prizeTypes) {
        await tx.prizeType.update({
          where: { id: prize.id },
          data: { remaining_stock: prize.initial_stock }
        });
      }

      // 5. Reset total_plays dei customer di questa promozione
      await tx.customer.updateMany({
        where: { promotion_id: pid },
        data: { total_plays: 0 }
      });

      return {
        deletedTokens: deletedTokens.count,
        deletedPlays: deletedPlays.count,
        deletedAssignments: deletedAssignments.count
      };
    });

    res.json({
      message: `Reset completato: ${result.deletedTokens} token, ${result.deletedPlays} giocate e ${result.deletedAssignments} premi assegnati eliminati.`,
      ...result
    });
  } catch (err) {
    console.error('Errore reset tokens:', err);
    res.status(500).json({ error: 'Errore durante il reset dei token' });
  }
});

// Helper: Fetch tenant branding for PDF generation
async function getTenantBrandingForPdf(tenantId: string) {
  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId }
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  return {
    primaryColor: branding?.colorPrimary || tenant?.primaryColor || '#b42a28',
    secondaryColor: branding?.colorSecondary || tenant?.secondaryColor || '#f3efe6',
    logoUrl: branding?.logoMainUrl || null
  };
}

// Helper: Download image from URL for PDF embedding
async function downloadImageForPdf(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error('Failed to download image for PDF:', e);
    return null;
  }
}

// Generazione PDF Token (Layout Verticale 50x80mm con Pattern)
app.post('/api/admin/generate-tokens', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId, count, prefix } = req.body;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');

  try {
    // Fetch tenant branding
    const brandingConfig = await getTenantBrandingForPdf(req.tenantId!);
    let logoBuffer: Buffer | null = null;
    if (brandingConfig.logoUrl) {
      logoBuffer = await downloadImageForPdf(brandingConfig.logoUrl);
    }

    const codesToCreate = [];
    for (let i = 0; i < count; i++) {
      const code = (prefix || '') + crypto.randomBytes(4).toString('hex').toUpperCase();
      codesToCreate.push({
        promotion_id: Number(promotionId),
        token_code: code,
        status: 'available'
      });
    }

    await prisma.token.createMany({
      data: codesToCreate as any
    });

    const tokens = await prisma.token.findMany({
      where: { promotion_id: Number(promotionId) },
      orderBy: { created_at: 'desc' },
      take: Number(count)
    });

    const doc = new PDFDocument({ size: 'A4', autoFirstPage: false, margin: 0 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=tokens_print_50x80.pdf');
    doc.pipe(res);

    // --- CONFIGURAZIONE GRIGLIA VERTICALE (50mm x 80mm) ---
    const MM_TO_PT = 2.83465;
    const CARD_W = 50 * MM_TO_PT;  // ~141.73pt
    const CARD_H = 80 * MM_TO_PT;  // ~226.77pt

    // A4 = 595.28 x 841.89pt (210mm x 297mm)
    // 4 Colonne (200mm), 3 Righe (240mm) = 12 card per pagina
    const COLUMNS = 4;
    const ROWS = 3;
    const CARDS_PER_PAGE = COLUMNS * ROWS;

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const CONTENT_W = CARD_W * COLUMNS;
    const CONTENT_H = CARD_H * ROWS;
    const START_X = (PAGE_W - CONTENT_W) / 2;
    const START_Y = (PAGE_H - CONTENT_H) / 2;

    // Paths risorse - Template predesegnati (in backend/assets per deploy)
    const FRONT_TEMPLATE = path.join(__dirname, '../assets/fronte-token-v2.png');
    const BACK_TEMPLATE = path.join(__dirname, '../assets/retro-token-v2.png');
    const FONT_CODE = path.join(__dirname, '../fonts/Roboto-Medium.ttf');

    // Funzione: Disegna pagina Retro (colonne specchiate per stampa fronte/retro)
    const drawBackPage = (cardCount: number) => {
      doc.addPage({ size: 'A4', margin: 0 });

      for (let j = 0; j < cardCount; j++) {
        const row = Math.floor(j / COLUMNS);
        const col = j % COLUMNS;
        // Specchia la colonna per allineamento corretto in stampa fronte/retro
        const mirroredCol = (COLUMNS - 1) - col;
        const x = START_X + (mirroredCol * CARD_W);
        const y = START_Y + (row * CARD_H);

        // Immagine retro scalata a 50x80mm (usa colore tenant come fallback)
        try {
          doc.image(BACK_TEMPLATE, x, y, { width: CARD_W, height: CARD_H });
        } catch (e) {
          doc.rect(x, y, CARD_W, CARD_H).fill(brandingConfig.primaryColor);
        }

        // Linea di taglio tratteggiata
        doc.save();
        doc.dash(5, { space: 3 });
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).stroke('#999999');
        doc.restore();
      }
    };

    // Main Loop - Genera pagine
    for (let i = 0; i < tokens.length; i += CARDS_PER_PAGE) {
      const chunk = tokens.slice(i, i + CARDS_PER_PAGE);

      // --- PAGINA FRONTE ---
      doc.addPage({ size: 'A4', margin: 0 });

      for (let j = 0; j < chunk.length; j++) {
        const token = chunk[j];
        const row = Math.floor(j / COLUMNS);
        const col = j % COLUMNS;
        const x = START_X + (col * CARD_W);
        const y = START_Y + (row * CARD_H);

        // 1. Immagine fronte come sfondo (scalata a 50x80mm)
        try {
          doc.image(FRONT_TEMPLATE, x, y, { width: CARD_W, height: CARD_H });
        } catch (e) {
          // Fallback: Card dinamica con colori tenant
          doc.rect(x, y, CARD_W, CARD_H).fill(brandingConfig.secondaryColor);
          // Header con colore primario
          doc.rect(x, y, CARD_W, CARD_H * 0.25).fill(brandingConfig.primaryColor);
          // Logo tenant se disponibile
          if (logoBuffer) {
            try {
              const logoSize = CARD_W * 0.6;
              const logoX = x + (CARD_W - logoSize) / 2;
              const logoY = y + (CARD_H * 0.25 - logoSize / 2) / 2 + 5;
              doc.image(logoBuffer, logoX, logoY, { width: logoSize, fit: [logoSize, CARD_H * 0.2] });
            } catch (logoErr) {
              // Ignore logo errors
            }
          }
        }

        // 2. QR Code centrato verticalmente (nella zona centrale del template)
        const playUrl = `${APP_URL}/play?token=${token.token_code}`;
        const qrData = await QRCode.toDataURL(playUrl, { margin: 1, width: 200 });
        const qrSize = 75 * MM_TO_PT / 2.83465; // ~75pt per QR leggibile
        const qrX = x + (CARD_W - qrSize) / 2;
        const qrY = y + (CARD_H * 0.35); // Posizionato al 35% dall'alto

        // Background bianco semi-trasparente per QR + codice
        const boxPadding = 8;
        const boxHeight = qrSize + 30; // Spazio per QR + codice
        doc.save();
        doc.opacity(0.9);
        doc.roundedRect(qrX - boxPadding, qrY - boxPadding, qrSize + boxPadding * 2, boxHeight + boxPadding, 5).fill('white');
        doc.restore();

        // QR Code
        doc.image(qrData, qrX, qrY, { width: qrSize });

        // 3. Token Code sotto il QR
        doc.fillColor('black');
        try {
          doc.font(FONT_CODE).fontSize(10);
        } catch (e) {
          doc.font('Courier').fontSize(10);
        }
        const codeY = qrY + qrSize + 8;
        doc.text(token.token_code, x, codeY, { width: CARD_W, align: 'center', characterSpacing: 1 });

        // 4. Linea di taglio tratteggiata
        doc.save();
        doc.dash(5, { space: 3 });
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).stroke('#999999');
        doc.restore();
      }

      // --- PAGINA RETRO ---
      drawBackPage(chunk.length);
    }

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed' });
  }
});

// Download PDF dei Token Esistenti (Layout Verticale 50x80mm con Pattern)
app.get('/api/admin/tokens/pdf/:promotionId', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { promotionId } = req.params;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');

  try {
    // Fetch tenant branding
    const brandingConfig = await getTenantBrandingForPdf(req.tenantId!);
    let logoBuffer: Buffer | null = null;
    if (brandingConfig.logoUrl) {
      logoBuffer = await downloadImageForPdf(brandingConfig.logoUrl);
    }

    // Recupera tutti i token disponibili per questa promozione
    const tokens = await prisma.token.findMany({
      where: {
        promotion_id: Number(promotionId),
        status: 'available'
      },
      orderBy: { created_at: 'asc' }
    });

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Nessun token disponibile per questa promozione' });
    }

    const doc = new PDFDocument({ size: 'A4', autoFirstPage: false, margin: 0 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=tokens_promo_${promotionId}.pdf`);
    doc.pipe(res);

    // --- CONFIGURAZIONE GRIGLIA VERTICALE (50mm x 80mm) ---
    const MM_TO_PT = 2.83465;
    const CARD_W = 50 * MM_TO_PT;  // ~141.73pt
    const CARD_H = 80 * MM_TO_PT;  // ~226.77pt

    // A4 = 595.28 x 841.89pt (210mm x 297mm)
    // 4 Colonne (200mm), 3 Righe (240mm) = 12 card per pagina
    const COLUMNS = 4;
    const ROWS = 3;
    const CARDS_PER_PAGE = COLUMNS * ROWS;

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const CONTENT_W = CARD_W * COLUMNS;
    const CONTENT_H = CARD_H * ROWS;
    const START_X = (PAGE_W - CONTENT_W) / 2;
    const START_Y = (PAGE_H - CONTENT_H) / 2;

    // Paths risorse - Template predesegnati (in backend/assets per deploy)
    const FRONT_TEMPLATE = path.join(__dirname, '../assets/fronte-token-v2.png');
    const BACK_TEMPLATE = path.join(__dirname, '../assets/retro-token-v2.png');
    const FONT_CODE = path.join(__dirname, '../fonts/Roboto-Medium.ttf');

    // Funzione: Disegna pagina Retro (colonne specchiate per stampa fronte/retro)
    const drawBackPage = (cardCount: number) => {
      doc.addPage({ size: 'A4', margin: 0 });

      for (let j = 0; j < cardCount; j++) {
        const row = Math.floor(j / COLUMNS);
        const col = j % COLUMNS;
        // Specchia la colonna per allineamento corretto in stampa fronte/retro
        const mirroredCol = (COLUMNS - 1) - col;
        const x = START_X + (mirroredCol * CARD_W);
        const y = START_Y + (row * CARD_H);

        // Immagine retro scalata a 50x80mm (usa colore tenant come fallback)
        try {
          doc.image(BACK_TEMPLATE, x, y, { width: CARD_W, height: CARD_H });
        } catch (e) {
          doc.rect(x, y, CARD_W, CARD_H).fill(brandingConfig.primaryColor);
        }

        // Linea di taglio tratteggiata
        doc.save();
        doc.dash(5, { space: 3 });
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).stroke('#999999');
        doc.restore();
      }
    };

    // Main Loop - Genera pagine
    for (let i = 0; i < tokens.length; i += CARDS_PER_PAGE) {
      const chunk = tokens.slice(i, i + CARDS_PER_PAGE);

      // --- PAGINA FRONTE ---
      doc.addPage({ size: 'A4', margin: 0 });

      for (let j = 0; j < chunk.length; j++) {
        const token = chunk[j];
        const row = Math.floor(j / COLUMNS);
        const col = j % COLUMNS;
        const x = START_X + (col * CARD_W);
        const y = START_Y + (row * CARD_H);

        // 1. Immagine fronte come sfondo (scalata a 50x80mm)
        try {
          doc.image(FRONT_TEMPLATE, x, y, { width: CARD_W, height: CARD_H });
        } catch (e) {
          // Fallback: Card dinamica con colori tenant
          doc.rect(x, y, CARD_W, CARD_H).fill(brandingConfig.secondaryColor);
          // Header con colore primario
          doc.rect(x, y, CARD_W, CARD_H * 0.25).fill(brandingConfig.primaryColor);
          // Logo tenant se disponibile
          if (logoBuffer) {
            try {
              const logoSize = CARD_W * 0.6;
              const logoX = x + (CARD_W - logoSize) / 2;
              const logoY = y + (CARD_H * 0.25 - logoSize / 2) / 2 + 5;
              doc.image(logoBuffer, logoX, logoY, { width: logoSize, fit: [logoSize, CARD_H * 0.2] });
            } catch (logoErr) {
              // Ignore logo errors
            }
          }
        }

        // 2. QR Code centrato verticalmente (nella zona centrale del template)
        const playUrl = `${APP_URL}/play?token=${token.token_code}`;
        const qrData = await QRCode.toDataURL(playUrl, { margin: 1, width: 200 });
        const qrSize = 75 * MM_TO_PT / 2.83465; // ~75pt per QR leggibile
        const qrX = x + (CARD_W - qrSize) / 2;
        const qrY = y + (CARD_H * 0.35); // Posizionato al 35% dall'alto

        // Background bianco semi-trasparente per QR + codice
        const boxPadding = 8;
        const boxHeight = qrSize + 30; // Spazio per QR + codice
        doc.save();
        doc.opacity(0.9);
        doc.roundedRect(qrX - boxPadding, qrY - boxPadding, qrSize + boxPadding * 2, boxHeight + boxPadding, 5).fill('white');
        doc.restore();

        // QR Code
        doc.image(qrData, qrX, qrY, { width: qrSize });

        // 3. Token Code sotto il QR
        doc.fillColor('black');
        try {
          doc.font(FONT_CODE).fontSize(10);
        } catch (e) {
          doc.font('Courier').fontSize(10);
        }
        const codeY = qrY + qrSize + 8;
        doc.text(token.token_code, x, codeY, { width: CARD_W, align: 'center', characterSpacing: 1 });

        // 4. Linea di taglio tratteggiata
        doc.save();
        doc.dash(5, { space: 3 });
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).stroke('#999999');
        doc.restore();
      }

      // --- PAGINA RETRO ---
      drawBackPage(chunk.length);
    }

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore generazione PDF' });
  }
});


// ==========================================
// 5. CUSTOMER FLOW (Game)
// ==========================================

// Validate Token
app.get('/api/customer/validate-token/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const token = await prisma.token.findUnique({
      where: { token_code: code },
      include: { promotion: true }
    });

    if (!token) return res.status(404).json({ valid: false, message: 'Codice non trovato.' });

    if (token.status !== 'available') {
      return res.status(400).json({ valid: false, message: 'Codice già utilizzato o non valido.' });
    }

    const now = new Date();
    if (now < token.promotion.start_datetime || now > token.promotion.end_datetime) {
      return res.status(400).json({ valid: false, message: 'Promozione non attiva in questo momento.' });
    }

    res.json({
      valid: true,
      promotionId: token.promotion_id,
      promotionName: token.promotion.name,
      termsUrl: token.promotion.terms_url,
      privacyUrl: token.promotion.privacy_url,
      leaderboardEnabled: token.promotion.leaderboard_enabled ?? true
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Debug Token Info (per verificare date promozione)
app.get('/api/debug/token/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const token = await prisma.token.findUnique({
      where: { token_code: code },
      include: { promotion: true }
    });

    if (!token) return res.status(404).json({ error: 'Token non trovato' });

    const now = new Date();
    res.json({
      token_code: token.token_code,
      status: token.status,
      promotion_id: token.promotion_id,
      promotion_name: token.promotion.name,
      promotion_status: token.promotion.status,
      start_datetime: token.promotion.start_datetime,
      end_datetime: token.promotion.end_datetime,
      current_time: now,
      is_before_start: now < token.promotion.start_datetime,
      is_after_end: now > token.promotion.end_datetime,
      is_active: now >= token.promotion.start_datetime && now <= token.promotion.end_datetime
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Check Phone - Verifica se un numero di telefono è già registrato
app.post('/api/customer/check-phone', async (req, res) => {
  const { promotionId, phoneNumber } = req.body;

  if (!promotionId || !phoneNumber) {
    return res.status(400).json({ error: 'Missing promotionId or phoneNumber' });
  }

  // Validazione formato telefono
  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Formato numero di telefono non valido' });
  }

  const sanitizedPhone = sanitizePhoneNumber(phoneNumber);

  try {
    const customer = await prisma.customer.findUnique({
      where: {
        promotion_id_phone_number: {
          promotion_id: Number(promotionId),
          phone_number: sanitizedPhone
        }
      },
      select: {
        first_name: true,
        last_name: true
      }
    });

    if (customer) {
      res.json({
        exists: true,
        firstName: customer.first_name,
        lastName: customer.last_name
      });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register
app.post('/api/customer/register', registrationLimiter, async (req, res) => {
  const { promotionId, firstName, lastName, phoneNumber, consentMarketing, consentTerms } = req.body;

  if (!promotionId || !firstName || !lastName || !phoneNumber) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Validazione formato telefono
  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Formato numero di telefono non valido' });
  }

  const sanitizedPhone = sanitizePhoneNumber(phoneNumber);

  // Rileva genere dal nome
  const genderResult = detectGender(firstName);

  try {
    const customer = await prisma.customer.upsert({
      where: {
        promotion_id_phone_number: {
          promotion_id: Number(promotionId),
          phone_number: sanitizedPhone
        }
      },
      update: {
        first_name: firstName,
        last_name: lastName,
        detected_gender: genderResult.gender,
        consent_marketing: consentMarketing,
        marketing_consent_at: consentMarketing ? new Date() : undefined,
        consent_terms: consentTerms,
        terms_consent_at: consentTerms ? new Date() : undefined
      },
      create: {
        promotion_id: Number(promotionId),
        first_name: firstName,
        last_name: lastName,
        phone_number: sanitizedPhone,
        detected_gender: genderResult.gender,
        consent_marketing: consentMarketing || false,
        consent_terms: consentTerms || false,
        marketing_consent_at: consentMarketing ? new Date() : null,
        terms_consent_at: consentTerms ? new Date() : null
      }
    });

    // Genera un JWT token per il customer
    const customerToken = jwt.sign(
      {
        customerId: customer.id,
        promotionId: customer.promotion_id,
        phoneNumber: customer.phone_number
      },
      JWT_SECRET,
      { expiresIn: '30d' } // Token valido per 30 giorni
    );

    // Imposta il token come cookie
    res.cookie('customerToken', customerToken, {
      httpOnly: true,
      secure: true, // HTTPS only
      sameSite: 'none',
      maxAge: 30 * 24 * 3600 * 1000 // 30 giorni
    });

    res.json({
      customerId: customer.id,
      token: customerToken // Restituiamo anche il token nel body per flessibilità
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Play - PROTETTO DA AUTENTICAZIONE
app.post('/api/customer/play', playLimiter, authenticateCustomer, async (req: AuthRequest, res: any) => {
  const { promotion_id, token_code } = req.body;

  // SICUREZZA: Usa il customer_id dal token JWT, NON dal body della richiesta!
  const customer_id = req.customer!.customerId;

  // Verifica che il customer appartenga alla promozione
  if (req.customer!.promotionId !== Number(promotion_id)) {
    return res.status(403).json({ error: 'Customer not authorized for this promotion' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const token = await tx.token.findUnique({
        where: { token_code },
        include: { promotion: true }
      });

      if (!token) throw new Error('TOKEN_NOT_FOUND');
      if (token.status !== 'available') throw new Error('TOKEN_USED');
      if (token.promotion_id !== Number(promotion_id)) throw new Error('TOKEN_MISMATCH');

      const promotionId = token.promotion_id;

      const totalTokens = await tx.token.count({ where: { promotion_id: promotionId } });
      const usedTokens = await tx.token.count({ where: { promotion_id: promotionId, status: 'used' } });

      const prizeTypes = await tx.prizeType.findMany({
        where: { promotion_id: promotionId }
      });

      // Recupera statistiche customer per fatigue factor
      const customerStats = await tx.customer.findUnique({
        where: { id: customer_id },
        select: {
          first_name: true,
          total_plays: true,
          total_wins: true,
          detected_gender: true
        }
      });

      if (!customerStats) throw new Error('CUSTOMER_NOT_FOUND');

      // Conta premi gia' assegnati in questa promozione (per pacing)
      const prizesAssignedTotal = await tx.prizeAssignment.count({
        where: { promotion_id: promotionId }
      });

      // Prepara input per il nuovo engine v2.1 (con time pressure)
      const engineInput = {
        totalTokens,
        usedTokens,
        prizeTypes: prizeTypes.map(p => ({
          id: p.id,
          name: p.name,
          initialStock: p.initial_stock,
          remainingStock: p.remaining_stock,
          genderRestriction: p.gender_restriction
        })),
        customer: {
          firstName: customerStats.first_name,
          totalPlays: customerStats.total_plays,
          totalWins: customerStats.total_wins,
          detectedGender: customerStats.detected_gender
        },
        prizesAssignedTotal,
        // Time pressure: passa le date della promozione
        promotionStartTime: token.promotion.start_datetime,
        promotionEndTime: token.promotion.end_datetime
      };

      // Esegui estrazione con engine v2.1
      const outcome = probabilityEngine.determineOutcome(engineInput);
      const wonPrizeType = outcome.winner ? outcome.prize : null;

      let prizeAssignment = null;
      let isWinner = false;

      if (wonPrizeType) {
        const updateResult = await tx.prizeType.updateMany({
          where: {
            id: wonPrizeType.id,
            remaining_stock: { gt: 0 }
          },
          data: {
            remaining_stock: { decrement: 1 }
          }
        });

        if (updateResult.count > 0) {
          isWinner = true;
          const uniqueCode = `WIN-${token_code}-${Date.now().toString().slice(-4)}`;

          const playRecord = await tx.play.create({
            data: {
              promotion_id: promotionId,
              token_id: token.id,
              customer_id: customer_id,
              is_winner: true
            }
          });

          prizeAssignment = await tx.prizeAssignment.create({
            data: {
              promotion_id: promotionId,
              prize_type_id: wonPrizeType.id,
              customer_id: customer_id,
              token_id: token.id,
              prize_code: uniqueCode,
              play_id: playRecord.id
            },
            include: {
              prize_type: true
            }
          });
        } else {
          isWinner = false;
          await tx.play.create({
            data: {
              promotion_id: promotionId,
              token_id: token.id,
              customer_id: customer_id,
              is_winner: false
            }
          });
        }
      } else {
        await tx.play.create({
          data: {
            promotion_id: promotionId,
            token_id: token.id,
            customer_id: customer_id,
            is_winner: false
          }
        });
      }

      await tx.token.update({
        where: { id: token.id },
        data: {
          status: 'used',
          used_at: new Date()
        }
      });

      // Aggiorna statistiche customer
      await tx.customer.update({
        where: { id: customer_id },
        data: {
          total_plays: { increment: 1 },
          // Se ha vinto, incrementa anche total_wins e last_win_at
          ...(isWinner && {
            total_wins: { increment: 1 },
            last_win_at: new Date()
          })
        }
      });

      return { isWinner, prizeAssignment };
    });

    res.json(result);

  } catch (err: any) {
    console.error("Play Error:", err);
    if (err.message === 'TOKEN_NOT_FOUND') return res.status(404).json({ error: 'Token not found' });
    if (err.message === 'TOKEN_USED') return res.status(400).json({ error: 'Token already used' });
    if (err.message === 'TOKEN_MISMATCH') return res.status(400).json({ error: 'Token does not belong to this promotion' });
    if (err.message === 'CUSTOMER_NOT_FOUND') return res.status(404).json({ error: 'Customer not found' });
    res.status(500).json({ error: 'Transaction failed' });
  }
});

// Public Promotion Info (per pagina classifica pubblica)
app.get('/api/promotions/public/:promotionId', async (req, res) => {
  const { promotionId } = req.params;

  try {
    const promotion = await prisma.promotion.findUnique({
      where: { id: Number(promotionId) },
      select: {
        name: true,
        status: true,
        start_datetime: true,
        end_datetime: true
      }
    });

    if (!promotion) {
      return res.status(404).json({ error: 'Promozione non trovata' });
    }

    res.json(promotion);
  } catch (err) {
    console.error('Errore fetch promotion public:', err);
    res.status(500).json({ error: 'Errore server' });
  }
});

// Leaderboard
app.get('/api/leaderboard/:promotionId', async (req, res) => {
  const { promotionId } = req.params;
  const { customerId } = req.query;

  try {
    const topN = 10;

    const leaderboard = await prisma.customer.findMany({
      where: { promotion_id: Number(promotionId) },
      orderBy: [
        { total_plays: 'desc' },
        { updated_at: 'asc' }
      ],
      take: topN,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        total_plays: true
      }
    });

    const formatted = leaderboard.map((c, index) => ({
      rank: index + 1,
      name: `${c.first_name} ${c.last_name.charAt(0)}.`,
      phone: `*** *** ${c.phone_number.slice(-4)}`,
      plays: c.total_plays,
      isMe: customerId ? c.id === Number(customerId) : false
    }));

    let myStats = null;
    if (customerId) {
      const me = await prisma.customer.findUnique({ where: { id: Number(customerId) } });
      if (me) {
        const betterPlayers = await prisma.customer.count({
          where: {
            promotion_id: Number(promotionId),
            OR: [
              { total_plays: { gt: me.total_plays } },
              { total_plays: me.total_plays, updated_at: { lt: me.updated_at } }
            ]
          }
        });
        myStats = {
          rank: betterPlayers + 1,
          plays: me.total_plays
        };
      }
    }

    res.json({ leaderboard: formatted, myStats });

  } catch (err) {
    res.status(500).json({ error: 'Error fetching leaderboard' });
  }
});

// ==========================================
// 6. STAFF API
// ==========================================

app.post('/api/staff/redeem', resolveTenant, validateLicenseWithWarning, authenticateToken, async (req: TenantAuthRequest, res) => {
  const { prizeCode } = req.body;
  const staffId = req.user?.id; // Recupera l'ID dello staff dal JWT

  if (!prizeCode) return res.status(400).json({ error: 'Codice mancante' });

  try {
    // Usa una transazione per prevenire race condition
    const result = await prisma.$transaction(async (tx) => {
      // 1. Trova e blocca il record (la transazione garantisce atomicità)
      const assignment = await tx.prizeAssignment.findUnique({
        where: { prize_code: prizeCode },
        include: { prize_type: true, customer: true, redeemed_by_staff: true }
      });

      if (!assignment) {
        throw { code: 'NOT_FOUND', message: 'Codice premio non trovato o non valido' };
      }

      if (assignment.redeemed_at) {
        throw {
          code: 'ALREADY_REDEEMED',
          message: 'Premio già ritirato',
          redeemedAt: assignment.redeemed_at,
          redeemedBy: assignment.redeemed_by_staff?.username || `Staff #${assignment.redeemed_by_staff_id}`,
          prizeType: assignment.prize_type.name
        };
      }

      // 2. Aggiorna atomicamente con staff_id
      const updated = await tx.prizeAssignment.update({
        where: { id: assignment.id },
        data: {
          redeemed_at: new Date(),
          redeemed_by_staff_id: staffId // FIX: Ora salviamo chi ha riscattato
        },
        include: { prize_type: true, customer: true }
      });

      return {
        success: true,
        prizeType: updated.prize_type.name,
        customer: `${updated.customer.first_name} ${updated.customer.last_name}`,
        redeemedAt: updated.redeemed_at
      };
    });

    res.json(result);

  } catch (err: any) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ALREADY_REDEEMED') {
      return res.status(400).json({
        error: err.message,
        redeemedAt: err.redeemedAt,
        redeemedBy: err.redeemedBy,
        prizeType: err.prizeType
      });
    }
    console.error('Errore redeem:', err);
    res.status(500).json({ error: 'Errore durante il riscatto' });
  }
});

// Admin: Segna premio come riscosso
app.post('/api/admin/mark-redeemed', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { prizeCode } = req.body;
  const adminId = req.user?.id;

  if (!prizeCode) return res.status(400).json({ error: 'Codice premio mancante' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.prizeAssignment.findUnique({
        where: { prize_code: prizeCode },
        include: { prize_type: true, customer: true }
      });

      if (!assignment) {
        throw { code: 'NOT_FOUND', message: 'Codice premio non trovato' };
      }

      if (assignment.redeemed_at) {
        throw { code: 'ALREADY_REDEEMED', message: 'Premio già riscosso' };
      }

      const updated = await tx.prizeAssignment.update({
        where: { id: assignment.id },
        data: {
          redeemed_at: new Date(),
          redeemed_by_staff_id: adminId
        },
        include: { prize_type: true, customer: true }
      });

      return {
        success: true,
        prizeType: updated.prize_type.name,
        customer: `${updated.customer.first_name} ${updated.customer.last_name}`,
        redeemedAt: updated.redeemed_at
      };
    });

    res.json(result);
  } catch (err: any) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'ALREADY_REDEEMED') return res.status(400).json({ error: err.message });
    console.error('Errore mark-redeemed:', err);
    res.status(500).json({ error: 'Errore durante il riscatto' });
  }
});

// ==========================================
// 7. TENANT BRANDING & CONTENT API
// ==========================================

// GET Branding pubblico per tenant
app.get('/api/tenant/branding', resolveTenant, async (req: TenantAuthRequest, res) => {
  try {
    const branding = await prisma.tenantBranding.findUnique({
      where: { tenantId: req.tenantId }
    });

    // Se non esiste, ritorna defaults dal tenant
    if (!branding && req.tenant) {
      return res.json({
        colorPrimary: req.tenant.primaryColor,
        colorSecondary: req.tenant.secondaryColor,
        colorAccent: req.tenant.accentColor,
        logoMainUrl: req.tenant.logoUrl,
        fontHeading: 'Inter',
        fontBody: 'Inter'
      });
    }

    res.json(branding);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});

// PUT Aggiorna branding (solo admin tenant)
app.put('/api/admin/branding', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const branding = await prisma.tenantBranding.upsert({
      where: { tenantId: req.tenantId! },
      update: req.body,
      create: {
        tenantId: req.tenantId!,
        ...req.body
      }
    });
    res.json({ success: true, branding });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// GET Content pubblico per tenant (per lingua)
app.get('/api/tenant/content/:language?', resolveTenant, async (req: TenantAuthRequest, res) => {
  const language = req.params.language || 'it';

  try {
    const content = await prisma.tenantContent.findUnique({
      where: {
        tenantId_language: {
          tenantId: req.tenantId!,
          language
        }
      }
    });

    if (!content) {
      // Ritorna defaults
      return res.json({
        language,
        landingTitle: 'Tenta la fortuna!',
        landingCtaText: 'Gioca Ora',
        formTitle: 'Completa la registrazione',
        winTitle: 'Congratulazioni!',
        loseTitle: 'Peccato!'
      });
    }

    res.json(content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// PUT Aggiorna content (solo admin tenant)
app.put('/api/admin/content/:language?', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const language = req.params.language || 'it';

  try {
    const content = await prisma.tenantContent.upsert({
      where: {
        tenantId_language: {
          tenantId: req.tenantId!,
          language
        }
      },
      update: req.body,
      create: {
        tenantId: req.tenantId!,
        language,
        ...req.body
      }
    });
    res.json({ success: true, content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// POST Upload asset (logo, background, etc.)
app.post('/api/admin/upload', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), upload.single('file'), async (req: TenantAuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { type } = req.body; // 'logo', 'favicon', 'background', 'ogImage'

    // Build public URL
    const publicUrl = `/uploads/${req.tenantId}/${req.file.filename}`;

    // Optionally update branding based on type
    if (type && ['logoMainUrl', 'logoIconUrl', 'faviconUrl', 'backgroundUrl', 'ogImageUrl'].includes(type)) {
      await prisma.tenantBranding.upsert({
        where: { tenantId: req.tenantId! },
        update: { [type]: publicUrl },
        create: {
          tenantId: req.tenantId!,
          [type]: publicUrl
        }
      });
    }

    res.json({
      success: true,
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET List uploaded assets for tenant
app.get('/api/admin/uploads', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const tenantDir = path.join(UPLOADS_DIR, req.tenantId!);

    if (!fs.existsSync(tenantDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(tenantDir).map(filename => {
      const filePath = path.join(tenantDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        url: `/uploads/${req.tenantId}/${filename}`,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    });

    // Sort by creation date, newest first
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// DELETE Remove uploaded asset
app.delete('/api/admin/upload/:filename', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, req.tenantId!, filename);

    // Security check: ensure file is within tenant directory
    if (!filePath.startsWith(path.join(UPLOADS_DIR, req.tenantId!))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET Info tenant pubbliche (per frontend)
app.get('/api/tenant/info', resolveTenant, async (req: TenantAuthRequest, res) => {
  if (!req.tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Ritorna solo info pubbliche
  res.json({
    name: req.tenant.name,
    slug: req.tenant.slug,
    logoUrl: req.tenant.logoUrl,
    primaryColor: req.tenant.primaryColor,
    secondaryColor: req.tenant.secondaryColor,
    accentColor: req.tenant.accentColor
  });
});

// ==========================================
// STAFF USER MANAGEMENT
// ==========================================

// GET Lista staff users del tenant
app.get('/api/admin/staff', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const staffUsers = await prisma.staffUser.findMany({
      where: { tenantId: req.tenantId! },
      select: {
        id: true,
        username: true,
        role: true,
        created_at: true,
        _count: {
          select: { redeemed_prizes: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(staffUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff users' });
  }
});

// POST Crea nuovo staff user
app.post('/api/admin/staff', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Verifica limiti piano
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId! },
    include: { _count: { select: { staffUsers: true } } }
  });

  if (tenant && tenant._count.staffUsers >= tenant.maxStaffUsers) {
    return res.status(403).json({
      error: `Staff limit reached (${tenant.maxStaffUsers}). Upgrade your plan for more staff users.`
    });
  }

  try {
    // Verifica username unico
    const existing = await prisma.staffUser.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const staffUser = await prisma.staffUser.create({
      data: {
        tenantId: req.tenantId!,
        username,
        password_hash: passwordHash,
        role: role || 'staff'
      },
      select: {
        id: true,
        username: true,
        role: true,
        created_at: true
      }
    });

    res.status(201).json(staffUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create staff user' });
  }
});

// PUT Aggiorna staff user
app.put('/api/admin/staff/:id', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const staffId = parseInt(req.params.id);
  const { username, password, role } = req.body;

  try {
    // Verifica che lo staff user appartenga al tenant
    const existing = await prisma.staffUser.findFirst({
      where: { id: staffId, tenantId: req.tenantId! }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Staff user not found' });
    }

    // Prepara dati da aggiornare
    const updateData: any = {};
    if (username) updateData.username = username;
    if (role) updateData.role = role;
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);

    const staffUser = await prisma.staffUser.update({
      where: { id: staffId },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        created_at: true
      }
    });

    res.json(staffUser);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update staff user' });
  }
});

// DELETE Elimina staff user
app.delete('/api/admin/staff/:id', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const staffId = parseInt(req.params.id);

  try {
    // Verifica che lo staff user appartenga al tenant
    const existing = await prisma.staffUser.findFirst({
      where: { id: staffId, tenantId: req.tenantId! }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Staff user not found' });
    }

    // Non permettere di eliminare se stesso
    if (existing.id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.staffUser.delete({ where: { id: staffId } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete staff user' });
  }
});

// POST Genera token reset password per staff user
app.post('/api/admin/staff/:id/reset-password', resolveTenant, validateLicenseWithWarning, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  const staffId = parseInt(req.params.id);

  try {
    // Verifica che lo staff user appartenga al tenant
    const staff = await prisma.staffUser.findFirst({
      where: { id: staffId, tenantId: req.tenantId! }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff user not found' });
    }

    // Genera token reset (valido 24 ore)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.staffUser.update({
      where: { id: staffId },
      data: { resetToken, resetTokenExpiry }
    });

    // In produzione, qui invieremmo un'email. Per ora restituiamo il link
    res.json({
      success: true,
      resetToken,
      resetLink: `/reset-password?token=${resetToken}`,
      expiresAt: resetTokenExpiry
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate reset token' });
  }
});

// POST Staff usa token per resettare password (no auth required)
app.post('/api/staff/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Trova staff user con token valido
    const staff = await prisma.staffUser.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!staff) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash nuova password e invalida token
    const password_hash = await bcrypt.hash(newPassword, 10);
    await prisma.staffUser.update({
      where: { id: staff.id },
      data: {
        password_hash,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET Verifica validità token reset
app.get('/api/staff/reset-password/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const staff = await prisma.staffUser.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      },
      select: { username: true }
    });

    if (!staff) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired token' });
    }

    res.json({ valid: true, username: staff.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// GET Tenant limits info (per mostrare quanti staff rimangono)
app.get('/api/admin/tenant-limits', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId! },
      include: {
        _count: {
          select: {
            staffUsers: true,
            promotions: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      plan: tenant.plan,
      staffUsers: {
        used: tenant._count.staffUsers,
        max: tenant.maxStaffUsers
      },
      promotions: {
        used: tenant._count.promotions,
        max: tenant.maxPromotions
      },
      tokensPerPromo: tenant.maxTokensPerPromo,
      licenseStatus: tenant.licenseStatus,
      licenseEnd: tenant.licenseEnd
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tenant limits' });
  }
});

// ==========================================
// AUDIT LOGS
// ==========================================

// GET Lista audit logs (solo admin)
app.get('/api/admin/audit-logs', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const action = req.query.action as string;
    const entity = req.query.entity as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const result = await AuditService.getLogs(req.tenantId!, {
      limit,
      offset,
      action: action as any,
      entity: entity as any,
      startDate,
      endDate
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET Statistiche azioni (solo admin)
app.get('/api/admin/audit-logs/stats', resolveTenant, allowExpiredLicense, authenticateToken, authorizeRole('admin'), async (req: TenantAuthRequest, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const stats = await AuditService.getActionStats(req.tenantId!, startDate, endDate);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // ==========================================
  // LICENSE NOTIFICATION SCHEDULER
  // ==========================================
  // Esegue controllo licenze ogni 24 ore
  const LICENSE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  const runLicenseCheck = async () => {
    console.log('[SCHEDULER] Running daily license check...');
    try {
      const result = await LicenseNotificationService.processNotifications();
      console.log(`[SCHEDULER] License check complete: ${result.expiring.length} expiring, ${result.suspended} suspended`);
    } catch (err) {
      console.error('[SCHEDULER] License check failed:', err);
    }
  };

  // Esegui al primo avvio (dopo 10 secondi per permettere al DB di inizializzarsi)
  setTimeout(runLicenseCheck, 10000);

  // Poi ogni 24 ore
  setInterval(runLicenseCheck, LICENSE_CHECK_INTERVAL);
});