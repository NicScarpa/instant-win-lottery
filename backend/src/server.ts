import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { ProbabilityEngine } from './services/ProbabilityEngine';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { authenticateToken, authorizeRole } from './middlewares/authMiddleware';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Configurazione CORS
app.use(cors({
  origin: [APP_URL, 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ==========================================
// 1. AUTHENTICATION (Login / Logout / Me)
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.staffUser.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 8 * 3600 * 1000
    });

    res.json({ success: true, role: user.role });
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

// ==========================================
// 2. ADMIN: PROMOTIONS MANAGEMENT (CRUD)
// ==========================================

// Lista Promozioni
app.get('/api/promotions/list', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const promotions = await prisma.promotion.findMany({
            orderBy: { created_at: 'desc' }
        });
        res.json(promotions);
    } catch (err) {
        res.status(500).json({ error: 'Errore recupero promozioni' });
    }
});

// Crea Promozione
app.post('/api/promotions/create', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { name, plannedTokenCount, startDatetime, endDatetime } = req.body;
    try {
        const promo = await prisma.promotion.create({
            data: {
                name,
                planned_token_count: Number(plannedTokenCount),
                start_datetime: new Date(startDatetime),
                end_datetime: new Date(endDatetime),
                status: 'DRAFT'
            }
        });
        res.json({ success: true, promotion: promo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore creazione promozione' });
    }
});

// Aggiorna Promozione
app.put('/api/promotions/update/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { name, plannedTokenCount, status, start_datetime, end_datetime } = req.body;
    try {
        const promo = await prisma.promotion.update({
            where: { id: Number(id) },
            data: {
                name,
                planned_token_count: Number(plannedTokenCount),
                status,
                start_datetime: new Date(start_datetime),
                end_datetime: new Date(end_datetime)
            }
        });
        res.json({ success: true, promotion: promo });
    } catch (err) {
        res.status(500).json({ error: 'Errore aggiornamento' });
    }
});

// Elimina Promozione
app.delete('/api/promotions/delete/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.token.deleteMany({ where: { promotion_id: Number(id) } });
        await prisma.prizeType.deleteMany({ where: { promotion_id: Number(id) } });
        await prisma.promotion.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore eliminazione' });
    }
});

// ==========================================
// 3. ADMIN: PRIZES MANAGEMENT
// ==========================================

app.get('/api/admin/prizes/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

app.post('/api/admin/prizes/update', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

// ==========================================
// 4. ADMIN: STATS & LOGS (CORRETTO QUI)
// ==========================================

app.get('/api/admin/stats/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { promotionId } = req.params;
    const pid = Number(promotionId);
    try {
        const totalTokens = await prisma.token.count({ where: { promotion_id: pid } });
        const usedTokens = await prisma.token.count({ where: { promotion_id: pid, status: 'used' } });
        const totalPlays = await prisma.play.count({ where: { promotion_id: pid } });
        const uniquePlayers = await prisma.customer.count({ where: { promotion_id: pid } });
        const wins = await prisma.play.count({ where: { promotion_id: pid, is_winner: true } });
        
        const prizes = await prisma.prizeType.findMany({ where: { promotion_id: pid } });
        const totalStock = prizes.reduce((acc, p) => acc + p.initial_stock, 0);
        const remainingStock = prizes.reduce((acc, p) => acc + p.remaining_stock, 0);

        res.json({
            tokens: { total: totalTokens, used: usedTokens },
            plays: { total: totalPlays, unique_players: uniquePlayers },
            prizes: { total: totalStock, awarded: wins, remaining: remainingStock }
        });
    } catch (err) {
        res.status(500).json({ error: 'Errore statistiche' });
    }
});

app.get('/api/admin/play-logs/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
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
        
        // Formattazione per frontend
        const formatted = logs.map(l => ({
            id: l.id,
            timestamp: l.created_at, // CORRETTO
            customerName: `${l.customer.first_name} ${l.customer.last_name}`,
            phone: l.customer.phone_number,
            result: l.is_winner ? (l.prize_assignment?.prize_type.name || 'Vincita (Errore ref)') : 'Non vincente',
            token: l.token.token_code
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err); // Aggiunto log errore
        res.status(500).json({ error: 'Errore logs' });
    }
});

app.get('/api/admin/tokens/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { promotionId } = req.params;
    const { page = 1, limit = 50, search = '' } = req.query; 
    
    try {
        const tokens = await prisma.token.findMany({
            where: { 
                promotion_id: Number(promotionId),
                token_code: { contains: String(search) }
            },
            orderBy: { created_at: 'desc' },
            take: Number(limit),
            skip: (Number(page) - 1) * Number(limit)
        });
        res.json({ tokens, total: 0 }); 
    } catch (err) {
        res.status(500).json({ error: 'Errore tokens' });
    }
});

// Generazione PDF Token
app.post('/api/admin/generate-tokens', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { promotionId, count, prefix } = req.body;

  try {
    const codesToCreate = [];
    for (let i = 0; i < count; i++) {
        const code = (prefix || '') + Math.random().toString(36).substring(2, 8).toUpperCase();
        codesToCreate.push({
            promotion_id: Number(promotionId),
            token_code: code,
            status: 'available'
        });
    }

    await prisma.token.createMany({
        data: codesToCreate,
        skipDuplicates: true
    });

    const tokens = await prisma.token.findMany({
        where: { promotion_id: Number(promotionId) },
        orderBy: { created_at: 'desc' },
        take: Number(count)
    });

    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=tokens.pdf');
    doc.pipe(res);

    let x = 50, y = 50;
    for (const t of tokens) {
        const playUrl = `${APP_URL}/play?token=${t.token_code}`;
        const qrData = await QRCode.toDataURL(playUrl);
        
        doc.image(qrData, x, y, { width: 100 });
        doc.text(t.token_code, x, y + 105, { width: 100, align: 'center' });
        
        x += 150;
        if (x > 500) {
            x = 50;
            y += 150;
        }
        if (y > 700) {
            doc.addPage();
            y = 50;
        }
    }

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed' });
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
      privacyUrl: token.promotion.privacy_url
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Register
app.post('/api/customer/register', async (req, res) => {
  const { promotionId, firstName, lastName, phoneNumber, consentMarketing, consentTerms } = req.body;
  
  if (!promotionId || !firstName || !lastName || !phoneNumber) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const customer = await prisma.customer.upsert({
      where: {
        promotion_id_phone_number: {
          promotion_id: Number(promotionId),
          phone_number: phoneNumber
        }
      },
      update: {
        first_name: firstName,
        last_name: lastName,
        consent_marketing: consentMarketing,
        marketing_consent_at: consentMarketing ? new Date() : undefined,
        consent_terms: consentTerms,
        terms_consent_at: consentTerms ? new Date() : undefined
      },
      create: {
        promotion_id: Number(promotionId),
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        consent_marketing: consentMarketing || false,
        consent_terms: consentTerms || false,
        marketing_consent_at: consentMarketing ? new Date() : null,
        terms_consent_at: consentTerms ? new Date() : null
      }
    });

    res.json({ customerId: customer.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Play
app.post('/api/customer/play', async (req: any, res: any) => {
  const { promotion_id, token_code, customer_id } = req.body;

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

      const engine = new ProbabilityEngine();
      const wonPrizeType = engine.determineOutcome({
        totalTokens,
        usedTokens,
        prizeTypes: prizeTypes.map(p => ({
          id: p.id,
          initialStock: p.initial_stock,
          remainingStock: p.remaining_stock,
          targetProbability: p.target_overall_probability || 0
        }))
      });

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

      await tx.customer.update({
        where: { id: customer_id },
        data: { total_plays: { increment: 1 } }
      });

      return { isWinner, prizeAssignment };
    }); 

    res.json(result);

  } catch (err: any) {
    console.error("Play Error:", err);
    if (err.message === 'TOKEN_NOT_FOUND') return res.status(404).json({ error: 'Token not found' });
    if (err.message === 'TOKEN_USED') return res.status(400).json({ error: 'Token already used' });
    if (err.message === 'TOKEN_MISMATCH') return res.status(400).json({ error: 'Token does not belong to this promotion' });
    res.status(500).json({ error: 'Transaction failed' });
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

app.post('/api/staff/redeem', authenticateToken, async (req, res) => {
    const { prizeCode } = req.body;
    
    if (!prizeCode) return res.status(400).json({ error: 'Codice mancante' });

    try {
        const assignment = await prisma.prizeAssignment.findUnique({
            where: { prize_code: prizeCode },
            include: { prize_type: true, customer: true }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Codice premio non trovato o non valido' });
        }

        if (assignment.redeemed_at) {
            return res.status(400).json({ 
                error: 'Premio già ritirato', 
                redeemedAt: assignment.redeemed_at,
                redeemedBy: assignment.redeemed_by_staff_id 
            });
        }

        const updated = await prisma.prizeAssignment.update({
            where: { id: assignment.id },
            data: {
                redeemed_at: new Date(),
            }
        });

        res.json({ 
            success: true, 
            prize: assignment.prize_type.name,
            customer: `${assignment.customer.first_name} ${assignment.customer.last_name}`,
            redeemedAt: updated.redeemed_at
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore durante il riscatto' });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});