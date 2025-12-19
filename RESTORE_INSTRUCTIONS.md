# Istruzioni di Ripristino - Campari Lottery

Questo documento contiene tutte le informazioni necessarie per ripristinare il progetto allo stato precedente al cambio dominio a `camparinoweek.com`.

---

## 1. COMMIT DI RIFERIMENTO

Il commit di backup PRIMA delle modifiche al dominio:

```
Commit: 238de8c
Messaggio: "Backup: Pre-domain change to camparinoweek.com"
```

### Come Ripristinare il Codice

```bash
# Opzione 1: Reset completo (cancella tutte le modifiche non committate)
git reset --hard 238de8c

# Opzione 2: Crea un nuovo commit che annulla le modifiche
git revert HEAD~N..HEAD  # dove N = numero di commit da annullare
```

---

## 2. CONFIGURAZIONE ATTUALE (PRE-MODIFICA)

### 2.1 File Locali

**`backend/.env`**
```env
PORT=3001
DATABASE_URL="file:./dev.db"
JWT_SECRET="[NON MODIFICARE - VALORE SEGRETO]"
FRONTEND_URL="http://localhost:3000"
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2.2 Variabili di Produzione ATTUALI

**Servizio Backend (Railway - `backend-campari-lottery-production`):**
- [x] `DATABASE_URL`: [configurato su Railway - PostgreSQL]
- [x] `JWT_SECRET`: [configurato su Railway - NON MODIFICARE]
- [x] `FRONTEND_URL`: `https://campari-lottery-git-main-nicola-scarpas-projects.vercel.app/`
- [x] `CORS_ORIGINS`: NON CONFIGURATA (usa default nel codice)
- [x] `NODE_ENV`: production

**Servizio Frontend (Vercel):**
- [x] `NEXT_PUBLIC_API_URL`: `https://backend-campari-lottery-production.up.railway.app`

---

## 3. URL ATTUALI (PRE-MODIFICA)

- **Backend (Railway)**: `https://backend-campari-lottery-production.up.railway.app`
- **Frontend (Vercel)**: `https://campari-lottery.vercel.app`
- **Frontend alternativo**: `https://campari-lottery-git-main-nicola-scarpas-projects.vercel.app`

---

## 4. PROCEDURA DI ROLLBACK COMPLETA

### Step 1: Ripristina il Codice
```bash
cd /Users/nicolascarpa/Desktop/campari-lottery
git reset --hard 238de8c
```

### Step 2: Ripristina Variabili Railway Backend
1. Vai su Railway > Progetto > Backend Service > Variables
2. Ripristina:
   - `FRONTEND_URL` = [VALORE ORIGINALE]
   - `CORS_ORIGINS` = [VALORE ORIGINALE o rimuovi]

### Step 3: Ripristina Variabili Vercel Frontend
1. Vai su Vercel > Progetto campari-lottery > Settings > Environment Variables
2. Ripristina:
   - `NEXT_PUBLIC_API_URL` = `https://backend-campari-lottery-production.up.railway.app`

### Step 4: Rimuovi Domini Custom
**Railway (Backend):**
1. Vai su Railway > Backend Service > Settings > Domains
2. Rimuovi `api.camparinoweek.com`

**Vercel (Frontend):**
1. Vai su Vercel > Progetto > Settings > Domains
2. Rimuovi `www.camparinoweek.com` e `camparinoweek.com`

### Step 5: Redeploy
1. Forza redeploy su entrambi i servizi Railway
2. Verifica che gli URL Railway originali funzionino

---

## 5. DNS NAMECHEAP - COME RIMUOVERE

Se hai configurato DNS su Namecheap, per rimuoverli:

1. Accedi a Namecheap > Domain List > camparinoweek.com > Advanced DNS
2. Elimina i record:
   - Record CNAME per `www`
   - Record CNAME per `api`
   - Record A per `@` (se presente)

---

## 6. VALORI CORS ORIGINALI NEL CODICE

In `backend/src/server.ts`, la configurazione CORS originale include:
```typescript
const CORS_ORIGINS = [
  APP_URL,
  'http://localhost:3000',
  'https://new-frontend-camparino-week.up.railway.app',
  'https://campari-lottery-git-main-nicola-scarpas-projects.vercel.app',
  'https://campari-lottery.vercel.app'
];
```

---

## 7. CHECKLIST POST-ROLLBACK

- [ ] Backend risponde su URL Railway originale
- [ ] Frontend carica correttamente
- [ ] Login admin funziona
- [ ] CORS non da errori (controlla console browser)
- [ ] QR code token puntano all'URL corretto
- [ ] Gioco funziona (registrazione + play)

---

**Data creazione documento**: $(date)
**Ultimo aggiornamento**: Pre-migrazione a camparinoweek.com
