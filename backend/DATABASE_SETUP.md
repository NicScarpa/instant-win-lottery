# Database Setup Guide

## Overview

This project supports two database providers:
- **SQLite** - for local development (simple, no setup required)
- **PostgreSQL** - for production (Railway, Supabase, etc.)

## Quick Start

### Local Development (SQLite)

SQLite is the default for local development. No database server required.

```bash
# Ensure SQLite schema is active
npm run db:use-sqlite

# Push schema to database
npm run db:push

# Seed with test data
npm run seed
```

### Production (PostgreSQL)

```bash
# Switch to PostgreSQL schema
npm run db:use-postgres

# Set DATABASE_URL in .env
# DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# Deploy migrations
npm run db:migrate:deploy

# Seed initial data
npm run seed
```

## Schema Files

| File | Provider | Usage |
|------|----------|-------|
| `schema.prisma` | Active | Currently active schema |
| `schema.sqlite.prisma` | SQLite | Local development backup |
| `schema.postgresql.prisma` | PostgreSQL | Production backup |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run db:use-sqlite` | Switch to SQLite (local dev) |
| `npm run db:use-postgres` | Switch to PostgreSQL (production) |
| `npm run db:push` | Push schema to database (dev) |
| `npm run db:migrate` | Create migration (dev) |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database |
| `npm run seed` | Seed production data |
| `npm run seed:e2e` | Seed E2E test data |

## Railway Deployment

### 1. Add PostgreSQL Plugin

In Railway dashboard:
1. Click "New" > "Database" > "PostgreSQL"
2. Copy the `DATABASE_URL` from Variables tab

### 2. Environment Variables

Set these in Railway:

```env
DATABASE_URL=<from Railway PostgreSQL>
JWT_SECRET=<generate with: openssl rand -base64 32>
FRONTEND_URL=https://your-frontend.railway.app
NODE_ENV=production
```

### 3. Build Command

Railway will auto-detect `npm run build`. The build script:
1. Pushes schema to database
2. Compiles TypeScript
3. Copies assets

### 4. First Deploy

After first deploy, run seed via Railway shell:

```bash
npm run seed
```

## Migration Workflow

### Development (SQLite)

During development, use `db push` for quick iterations:

```bash
# Make schema changes in schema.sqlite.prisma
# Then apply:
npm run db:use-sqlite
npm run db:push
```

### Production (PostgreSQL)

For production, use proper migrations:

```bash
# 1. Switch to PostgreSQL
npm run db:use-postgres

# 2. Create migration
npm run db:migrate -- --name add_new_feature

# 3. Review migration in prisma/migrations/

# 4. Deploy to production
npm run db:migrate:deploy
```

## Troubleshooting

### "Provider mismatch" error

If you see provider errors, ensure you're using the correct schema:

```bash
# For SQLite
npm run db:use-sqlite

# For PostgreSQL
npm run db:use-postgres
```

### Reset local database

```bash
rm prisma/dev.db
npm run db:push
npm run seed
```

### View database

```bash
# SQLite
sqlite3 prisma/dev.db

# Or use Prisma Studio
npm run db:studio
```

## Schema Sync

If you modify the schema, update both files:

1. Edit `schema.prisma` (your working copy)
2. Copy changes to `schema.sqlite.prisma` (for SQLite)
3. Copy changes to `schema.postgresql.prisma` (for PostgreSQL)

Or use this workflow:
```bash
# After editing schema.prisma for PostgreSQL:
cp prisma/schema.prisma prisma/schema.postgresql.prisma

# After editing schema.prisma for SQLite:
cp prisma/schema.prisma prisma/schema.sqlite.prisma
```
