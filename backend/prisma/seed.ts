import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Crea l'Admin
  const adminPassword = await bcrypt.hash('Campari2025!', 10);
  
  const admin = await prisma.staffUser.upsert({
    where: { username: 'admin' },
    update: {}, // Se esiste già, non fare nulla
    create: {
      username: 'admin',
      password_hash: adminPassword,
      role: 'admin',
      // Rimosso display_name che causava l'errore
    },
  });

  console.log({ admin });

  // 2. Crea uno Staff di prova (opzionale)
  const staffPassword = await bcrypt.hash('Staff123!', 10);
  
  const staff = await prisma.staffUser.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      password_hash: staffPassword,
      role: 'staff',
    },
  });

  console.log({ staff });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });