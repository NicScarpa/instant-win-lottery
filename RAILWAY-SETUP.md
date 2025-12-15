# Railway Production Setup Checklist

## 🔧 Configurazione Railway Backend

### 1. Environment Variables (CRITICO!)

Vai su Railway Dashboard → Backend Service → Variables e configura:

```bash
# Database (Railway PostgreSQL)
DATABASE_URL=<railway-fornisce-automaticamente-postgresql-url>

# JWT Secret (GENERA NUOVO!)
# Non usare lo stesso secret di development!
JWT_SECRET=<genera-con-openssl-rand-base64-32>

# Frontend URL
FRONTEND_URL=<url-del-frontend-su-vercel>

# Port (Railway configura automaticamente)
PORT=3001
```

**IMPORTANTE:** Per generare un nuovo JWT_SECRET sicuro:
```bash
openssl rand -base64 32
```

### 2. Schema Prisma - Cambiare Provider

**File:** `backend/prisma/schema.prisma`

**PRIMA DI DEPLOYARE**, cambia da SQLite a PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"  // ← Cambia da "sqlite"
  url      = env("DATABASE_URL")
}
```

**IMPORTANTE:** Questa modifica deve essere fatta PRIMA del deploy su Railway!

### 3. Build Command

Railway dovrebbe usare:
```bash
npm install && npx prisma generate && npm run build
```

### 4. Start Command

```bash
npm start
```

Oppure se usi ts-node in produzione:
```bash
npx ts-node src/server.ts
```

### 5. Database Setup (DOPO primo deploy)

Una volta che il backend è online con PostgreSQL configurato:

```bash
# 1. Applica le migrations (crea le tabelle)
npx prisma migrate deploy

# 2. Genera il Prisma Client
npx prisma generate

# 3. Esegui il seed (crea admin e staff)
npx prisma db seed
```

**Come eseguire su Railway:**
- Vai su Railway → Service → Settings → Deploy
- Oppure usa Railway CLI se installata

---

## 🌐 Frontend Configuration

### URL Configuration

**File:** `frontend/next.config.ts`

Cambia l'URL da Render a Railway:
```typescript
destination: 'https://<tuo-backend>.up.railway.app/api/:path*'
```

**File:** `frontend/.env.local` (crea se non esiste)
```bash
NEXT_PUBLIC_API_URL=https://<tuo-backend>.up.railway.app
```

---

## 🧪 Test Post-Deploy

### 1. Health Check
```bash
curl https://<tuo-backend>.up.railway.app/health
```
Risposta attesa: `OK`

### 2. Test Login Admin
```bash
curl -X POST https://<tuo-backend>.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Campari2025!"}'
```
Risposta attesa: JWT token

### 3. Verifica Database
- Railway → PostgreSQL → Data
- Controlla che esistano le tabelle: Promotion, StaffUser, Token, ecc.

---

## ⚠️ Problemi Comuni e Soluzioni

### "JWT_SECRET environment variable is not set!"
**Causa:** Variabile d'ambiente mancante
**Soluzione:** Aggiungi JWT_SECRET nelle variabili Railway

### "prisma.promotion is not a function"
**Causa:** Prisma Client non generato
**Soluzione:** Esegui `npx prisma generate` nella build command

### "relation does not exist"
**Causa:** Migrations non applicate
**Soluzione:** Esegui `npx prisma migrate deploy`

### "Invalid database URL"
**Causa:** Schema usa "sqlite" ma DATABASE_URL è PostgreSQL
**Soluzione:** Cambia provider a "postgresql" in schema.prisma

### CORS errors dal frontend
**Causa:** FRONTEND_URL non configurato correttamente
**Soluzione:** Verifica che FRONTEND_URL in Railway corrisponda all'URL Vercel

---

## 📝 Checklist Finale

- [ ] Environment variables configurate su Railway
- [ ] Nuovo JWT_SECRET generato (diverso da development)
- [ ] Schema Prisma cambiato a `provider = "postgresql"`
- [ ] Build command configurato con Prisma generate
- [ ] Primo deploy completato con successo
- [ ] Migrations applicate (`npx prisma migrate deploy`)
- [ ] Seed eseguito (admin e staff creati)
- [ ] Health check funziona (`/health` risponde OK)
- [ ] Login admin funziona
- [ ] Frontend configurato con URL Railway
- [ ] CORS configurato correttamente

---

## 🔐 Credenziali Default (dopo seed)

**Admin:**
- Username: `admin`
- Password: `Campari2025!`

**Staff:**
- Username: `staff`
- Password: `Staff123!`

**IMPORTANTE:** Cambia queste password in produzione per sicurezza!

---

## 📊 Monitoring

### Log in tempo reale
Railway Dashboard → Service → Logs

### Errori comuni da monitorare:
- `JWT_SECRET environment variable is not set` → Variabili mancanti
- `P1001: Can't reach database server` → Database non connesso
- `prisma:error` → Problemi con le query

---

## 🚀 Deployment Workflow

1. **Sviluppo locale** → SQLite, secret development
2. **Commit to GitHub** → Non committare .env!
3. **Railway auto-deploy** → Rileva push su main
4. **Configurazione** → Set environment variables
5. **Migrations** → `npx prisma migrate deploy`
6. **Seed** → `npx prisma db seed`
7. **Test** → Health check e API tests
8. **Frontend deploy** → Vercel auto-deploy

---

Hai bisogno di aiuto con qualcuno di questi passi?
