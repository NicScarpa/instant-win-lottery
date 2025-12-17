import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { ProbabilityEngine } from './services/ProbabilityEngine';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { authenticateToken, authorizeRole, authenticateCustomer, AuthRequest } from './middlewares/authMiddleware';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

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

// Configurazione CORS
app.use(cors({
  origin: [
    APP_URL,
    'http://localhost:3000',
    'https://new-frontend-camparino-week.up.railway.app',  // Railway frontend domain
    'https://campari-lottery-git-main-nicola-scarpas-projects.vercel.app',  // Vercel branch domain
    'https://campari-lottery.vercel.app'  // Vercel production domain
  ],
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

    res.json({ success: true, role: user.role, token: token });
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

// Elimina Promozione (con cascade completo)
app.delete('/api/promotions/delete/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

// Aggiungi singolo premio
app.post('/api/admin/prizes/add', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { promotionId, name, initialStock } = req.body;

  if (!promotionId || !name || !initialStock) {
    return res.status(400).json({ error: 'Campi mancanti: promotionId, name, initialStock sono obbligatori' });
  }

  try {
    const prize = await prisma.prizeType.create({
      data: {
        promotion_id: Number(promotionId),
        name: name.trim(),
        initial_stock: Number(initialStock),
        remaining_stock: Number(initialStock),
        target_overall_probability: 0
      }
    });

    res.json({ success: true, prize });
  } catch (err) {
    console.error('Errore creazione premio:', err);
    res.status(500).json({ error: 'Errore creazione premio' });
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

// Modifica stock di un singolo premio
app.put('/api/admin/prizes/:prizeId', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { prizeId } = req.params;
  const { initial_stock, remaining_stock } = req.body;

  try {
    const prize = await prisma.prizeType.findUnique({
      where: { id: Number(prizeId) }
    });

    if (!prize) {
      return res.status(404).json({ error: 'Premio non trovato' });
    }

    const updateData: { initial_stock?: number; remaining_stock?: number } = {};

    if (initial_stock !== undefined) {
      updateData.initial_stock = Number(initial_stock);
    }
    if (remaining_stock !== undefined) {
      updateData.remaining_stock = Number(remaining_stock);
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
app.put('/api/admin/prizes/:prizeId/reset', authenticateToken, authorizeRole('admin'), async (req, res) => {
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
app.delete('/api/admin/prizes/:prizeId', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

app.get('/api/admin/stats/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

app.get('/api/admin/tokens/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { promotionId } = req.params;
  const { page = 1, limit = 50, search = '' } = req.query;
  const pid = Number(promotionId);
  const searchStr = String(search);

  try {
    // Definisci il filtro where una volta sola
    const whereClause = {
      promotion_id: pid,
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

// Reset Token - Elimina tutti i token e le giocate di una promozione
app.delete('/api/admin/tokens/reset/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

// Generazione PDF Token (Layout Verticale 50x80mm con Pattern)
app.post('/api/admin/generate-tokens', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { promotionId, count, prefix } = req.body;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');

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

    // Paths risorse
    const LOGO_PATH = path.join(__dirname, '../../frontend/public/logocamparisoda_bianco.png');
    const TEXTURE_PATH = path.join(__dirname, '../../frontend/public/bottiglia.png');
    const TEXTURE_PATH_FRONT = path.join(__dirname, '../../frontend/public/bottiglia_bianca.png');
    const FONT_TITLE = path.join(__dirname, '../fonts/JosefinSans-Bold.ttf');
    const FONT_CODE = path.join(__dirname, '../fonts/Roboto-Medium.ttf');

    // Colore Campari
    const CAMPARI_RED = '#D31418';

    // Helper: Disegna Pattern Bottiglie (stile CSS background-repeat)
    const drawPattern = (x: number, y: number, w: number, h: number, opacity: number, texturePath: string) => {
      doc.save();
      doc.rect(x, y, w, h).clip();
      doc.opacity(opacity);

      // Pattern size: 12mm come da template HTML
      const BOTTLE_W = 12 * MM_TO_PT; // ~34pt
      const BOTTLE_H = BOTTLE_W * 2.5; // Proporzione bottiglia (altezza > larghezza)

      // Calcola quante colonne e righe servono per coprire l'area
      const cols = Math.ceil(w / BOTTLE_W) + 1;
      const rows = Math.ceil(h / BOTTLE_H) + 1;

      // Disegna pattern a griglia uniforme (come CSS background-repeat)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          try {
            const bX = x + (col * BOTTLE_W);
            const bY = y + (row * BOTTLE_H);
            doc.image(texturePath, bX, bY, { width: BOTTLE_W });
          } catch (e) { /* Ignora errori immagine */ }
        }
      }
      doc.restore();
    };

    // Funzione: Disegna pagina Retro (12 card)
    const drawBackPage = (cardCount: number) => {
      doc.addPage({ size: 'A4', margin: 0 });

      for (let j = 0; j < cardCount; j++) {
        const row = Math.floor(j / COLUMNS);
        const col = j % COLUMNS;
        const x = START_X + (col * CARD_W);
        const y = START_Y + (row * CARD_H);

        // 1. Sfondo Rosso Campari
        doc.rect(x, y, CARD_W, CARD_H).fill(CAMPARI_RED);

        // 2. Pattern tono su tono (opacity 0.3) - usa bottiglia rossa per retro
        drawPattern(x, y, CARD_W, CARD_H, 0.3, TEXTURE_PATH);

        // 3. Logo Bianco Centrato
        const logoW = 100;
        try {
          doc.image(LOGO_PATH, x + (CARD_W - logoW) / 2, y + (CARD_H - logoW) / 2, { width: logoW });
        } catch (e) {
          doc.fillColor('white').font('Helvetica-Bold').fontSize(16);
          doc.text('CAMPARI SODA', x, y + CARD_H / 2 - 10, { width: CARD_W, align: 'center' });
        }

        // 4. Bordo guida taglio
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).stroke('white');
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

        // 1. Sfondo Bianco
        doc.rect(x, y, CARD_W, CARD_H).fill('white');

        // 2. Pattern filigrana leggera (opacity 0.06) - usa bottiglia bianca per effetto grayscale
        drawPattern(x, y, CARD_W, CARD_H, 0.06, TEXTURE_PATH_FRONT);

        // 3. Bordo guida taglio
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.2).stroke('#ddd');

        // 4. Header: SCANSIONA E VINCI
        doc.fillColor(CAMPARI_RED);
        try {
          doc.font(FONT_TITLE).fontSize(20);
        } catch (e) {
          doc.font('Helvetica-Bold').fontSize(20);
        }
        const textY = y + 18;
        doc.text('SCANSIONA', x, textY, { width: CARD_W, align: 'center', lineGap: -4 });
        doc.text('E VINCI', x, textY + 20, { width: CARD_W, align: 'center' });

        // 5. QR Code con padding bianco
        const playUrl = `${APP_URL}/play?token=${token.token_code}`;
        const qrData = await QRCode.toDataURL(playUrl, { margin: 1, width: 200 });
        const qrSize = 85;
        const qrX = x + (CARD_W - qrSize) / 2;
        const qrY = textY + 50;

        // Background bianco per QR
        doc.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8).fill('white');
        doc.image(qrData, qrX, qrY, { width: qrSize });

        // 6. Token Code
        doc.fillColor('black');
        try {
          doc.font(FONT_CODE).fontSize(11);
        } catch (e) {
          doc.font('Courier').fontSize(11);
        }
        // Background bianco per codice
        const codeY = qrY + qrSize + 8;
        doc.rect(x + 20, codeY - 2, CARD_W - 40, 16).fill('white');
        doc.fillColor('black');
        doc.text(token.token_code, x, codeY, { width: CARD_W, align: 'center', characterSpacing: 1 });

        // 7. Triangolo decorativo angolo in basso a destra
        doc.save();
        doc.moveTo(x + CARD_W - 25, y + CARD_H)
          .lineTo(x + CARD_W, y + CARD_H)
          .lineTo(x + CARD_W, y + CARD_H - 25)
          .fill(CAMPARI_RED);
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
app.get('/api/admin/tokens/pdf/:promotionId', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { promotionId } = req.params;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');

  try {
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

    // Paths risorse
    const LOGO_PATH = path.join(__dirname, '../../frontend/public/logocamparisoda_bianco.png');
    const TEXTURE_PATH = path.join(__dirname, '../../frontend/public/bottiglia.png');
    const TEXTURE_PATH_FRONT = path.join(__dirname, '../../frontend/public/bottiglia_bianca.png');
    const FONT_TITLE = path.join(__dirname, '../fonts/JosefinSans-Bold.ttf');
    const FONT_CODE = path.join(__dirname, '../fonts/Roboto-Medium.ttf');

    // Colore Campari
    const CAMPARI_RED = '#D31418';

    // Helper: Disegna Pattern Bottiglie (stile CSS background-repeat)
    const drawPattern = (x: number, y: number, w: number, h: number, opacity: number, texturePath: string) => {
      doc.save();
      doc.rect(x, y, w, h).clip();
      doc.opacity(opacity);

      // Pattern size: 12mm come da template HTML
      const BOTTLE_W = 12 * MM_TO_PT; // ~34pt
      const BOTTLE_H = BOTTLE_W * 2.5; // Proporzione bottiglia (altezza > larghezza)

      // Calcola quante colonne e righe servono per coprire l'area
      const cols = Math.ceil(w / BOTTLE_W) + 1;
      const rows = Math.ceil(h / BOTTLE_H) + 1;

      // Disegna pattern a griglia uniforme (come CSS background-repeat)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          try {
            const bX = x + (col * BOTTLE_W);
            const bY = y + (row * BOTTLE_H);
            doc.image(texturePath, bX, bY, { width: BOTTLE_W });
          } catch (e) { /* Ignora errori immagine */ }
        }
      }
      doc.restore();
    };

    // Funzione: Disegna pagina Retro
    const drawBackPage = (cardCount: number) => {
      doc.addPage({ size: 'A4', margin: 0 });

      for (let j = 0; j < cardCount; j++) {
        const row = Math.floor(j / COLUMNS);
        const col = j % COLUMNS;
        const x = START_X + (col * CARD_W);
        const y = START_Y + (row * CARD_H);

        // 1. Sfondo Rosso Campari
        doc.rect(x, y, CARD_W, CARD_H).fill(CAMPARI_RED);

        // 2. Pattern tono su tono (opacity 0.3) - usa bottiglia rossa per retro
        drawPattern(x, y, CARD_W, CARD_H, 0.3, TEXTURE_PATH);

        // 3. Logo Bianco Centrato
        const logoW = 100;
        try {
          doc.image(LOGO_PATH, x + (CARD_W - logoW) / 2, y + (CARD_H - logoW) / 2, { width: logoW });
        } catch (e) {
          doc.fillColor('white').font('Helvetica-Bold').fontSize(16);
          doc.text('CAMPARI SODA', x, y + CARD_H / 2 - 10, { width: CARD_W, align: 'center' });
        }

        // 4. Bordo guida taglio
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).stroke('white');
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

        // 1. Sfondo Bianco
        doc.rect(x, y, CARD_W, CARD_H).fill('white');

        // 2. Pattern filigrana leggera (opacity 0.06) - usa bottiglia bianca per effetto grayscale
        drawPattern(x, y, CARD_W, CARD_H, 0.06, TEXTURE_PATH_FRONT);

        // 3. Bordo guida taglio
        doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.2).stroke('#ddd');

        // 4. Header: SCANSIONA E VINCI
        doc.fillColor(CAMPARI_RED);
        try {
          doc.font(FONT_TITLE).fontSize(20);
        } catch (e) {
          doc.font('Helvetica-Bold').fontSize(20);
        }
        const textY = y + 18;
        doc.text('SCANSIONA', x, textY, { width: CARD_W, align: 'center', lineGap: -4 });
        doc.text('E VINCI', x, textY + 20, { width: CARD_W, align: 'center' });

        // 5. QR Code con padding bianco
        const playUrl = `${APP_URL}/play?token=${token.token_code}`;
        const qrData = await QRCode.toDataURL(playUrl, { margin: 1, width: 200 });
        const qrSize = 85;
        const qrX = x + (CARD_W - qrSize) / 2;
        const qrY = textY + 50;

        // Background bianco per QR
        doc.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8).fill('white');
        doc.image(qrData, qrX, qrY, { width: qrSize });

        // 6. Token Code
        doc.fillColor('black');
        try {
          doc.font(FONT_CODE).fontSize(11);
        } catch (e) {
          doc.font('Courier').fontSize(11);
        }
        // Background bianco per codice
        const codeY = qrY + qrSize + 8;
        doc.rect(x + 20, codeY - 2, CARD_W - 40, 16).fill('white');
        doc.fillColor('black');
        doc.text(token.token_code, x, codeY, { width: CARD_W, align: 'center', characterSpacing: 1 });

        // 7. Triangolo decorativo angolo in basso a destra
        doc.save();
        doc.moveTo(x + CARD_W - 25, y + CARD_H)
          .lineTo(x + CARD_W, y + CARD_H)
          .lineTo(x + CARD_W, y + CARD_H - 25)
          .fill(CAMPARI_RED);
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
      privacyUrl: token.promotion.privacy_url
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
app.post('/api/customer/register', async (req, res) => {
  const { promotionId, firstName, lastName, phoneNumber, consentMarketing, consentTerms } = req.body;

  if (!promotionId || !firstName || !lastName || !phoneNumber) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Validazione formato telefono
  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Formato numero di telefono non valido' });
  }

  const sanitizedPhone = sanitizePhoneNumber(phoneNumber);

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
app.post('/api/customer/play', authenticateCustomer, async (req: AuthRequest, res: any) => {
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

app.post('/api/staff/redeem', authenticateToken, async (req: AuthRequest, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});