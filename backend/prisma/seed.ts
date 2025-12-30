import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Genera una license key univoca
function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return segments.join('-'); // Es: "A1B2-C3D4-E5F6-G7H8"
}

async function main() {
  console.log('🌱 Starting seed...\n');

  // ============================================
  // 1. SUPER ADMIN
  // ============================================
  console.log('📌 Creating Super Admin...');

  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2025!';
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@instantwin.io';
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'superadmin';

  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

  const superAdmin = await prisma.superAdmin.upsert({
    where: { username: superAdminUsername },
    update: {
      passwordHash: superAdminPasswordHash,
      email: superAdminEmail,
    },
    create: {
      username: superAdminUsername,
      passwordHash: superAdminPasswordHash,
      email: superAdminEmail,
    },
  });

  console.log(`   ✅ Super Admin created: ${superAdmin.username} (${superAdmin.email})`);

  // ============================================
  // 2. TENANT CAMPARI (migrazione dati esistenti)
  // ============================================
  console.log('\n📌 Creating Campari tenant...');

  const campariTenant = await prisma.tenant.upsert({
    where: { slug: 'campari' },
    update: {},
    create: {
      name: 'Campari Group',
      slug: 'campari',
      subdomain: 'campari',
      customDomain: null,

      // Branding base
      logoUrl: '/assets/campari-logo.png',
      primaryColor: '#b42a28',
      secondaryColor: '#f3efe6',
      accentColor: '#2d2d2d',

      // Piano Enterprise (migrazione)
      plan: 'enterprise',
      maxPromotions: 100,
      maxTokensPerPromo: 10000,
      maxStaffUsers: 50,

      // Licenza attiva
      licenseKey: generateLicenseKey(),
      licenseStatus: 'active',
      licenseStart: new Date(),
      licenseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 anno

      // Contatti
      adminEmail: 'marketing@campari.com',
      companyName: 'Davide Campari-Milano N.V.',
      vatNumber: 'IT00202020202',
    },
  });

  console.log(`   ✅ Tenant created: ${campariTenant.name} (${campariTenant.slug})`);
  console.log(`   📋 License Key: ${campariTenant.licenseKey}`);

  // ============================================
  // 3. TENANT BRANDING (Campari)
  // ============================================
  console.log('\n📌 Creating Campari branding...');

  const camparibBranding = await prisma.tenantBranding.upsert({
    where: { tenantId: campariTenant.id },
    update: {},
    create: {
      tenantId: campariTenant.id,

      // Colori Campari
      colorPrimary: '#b42a28',
      colorSecondary: '#f3efe6',
      colorAccent: '#2d2d2d',
      colorTextDark: '#1a1a1a',
      colorTextLight: '#ffffff',
      colorTextMuted: '#6b7280',
      colorSuccess: '#22c55e',
      colorError: '#ef4444',

      // Font
      fontHeading: 'Josefin Sans',
      fontBody: 'Josefin Sans',
      fontHeadingUrl: 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600;700&display=swap',
      fontBodyUrl: 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600;700&display=swap',

      // Assets (placeholder)
      logoMainUrl: '/assets/campari-logo.png',
      faviconUrl: '/favicon.ico',
    },
  });

  console.log(`   ✅ Branding created for ${campariTenant.name}`);

  // ============================================
  // 4. TENANT CONTENT (Campari - Italiano)
  // ============================================
  console.log('\n📌 Creating Campari content (IT)...');

  const campariContent = await prisma.tenantContent.upsert({
    where: {
      tenantId_language: {
        tenantId: campariTenant.id,
        language: 'it',
      },
    },
    update: {},
    create: {
      tenantId: campariTenant.id,
      language: 'it',

      // Landing page
      landingTitle: 'Tenta la fortuna!',
      landingSubtitle: 'Partecipa al concorso Campari Soda',
      landingCtaText: 'Gioca Ora',
      tokenPlaceholder: 'Inserisci il tuo codice',
      errorInvalidToken: 'Codice non valido',
      errorUsedToken: 'Codice già utilizzato',

      // Form
      formTitle: 'Completa la registrazione',
      labelFirstName: 'Nome',
      labelLastName: 'Cognome',
      labelPhone: 'Numero di telefono',
      consentPrivacy: 'Accetto i termini e condizioni e la privacy policy',
      consentMarketing: 'Acconsento a ricevere comunicazioni marketing',
      formSubmitText: 'Partecipa',

      // Risultati
      winTitle: 'Congratulazioni!',
      winMessage: 'Hai vinto: {prize_name}',
      winInstructions: 'Mostra questo codice al bancone per ritirare il tuo premio.',
      loseTitle: 'Peccato!',
      loseMessage: 'Non hai vinto questa volta, ma non mollare!',
      thankYouMessage: 'Grazie per aver partecipato!',

      // Footer
      footerCopyright: '© 2025 Campari Group. Tutti i diritti riservati.',
      footerContact: 'Per assistenza: support@campari.com',
    },
  });

  console.log(`   ✅ Content (IT) created for ${campariTenant.name}`);

  // ============================================
  // 5. STAFF USERS (migrazione per Campari)
  // ============================================
  console.log('\n📌 Creating/migrating staff users for Campari...');

  // Admin Campari
  const adminPassword = await bcrypt.hash('Campari2025!', 10);

  const admin = await prisma.staffUser.upsert({
    where: { username: 'admin' },
    update: {
      tenantId: campariTenant.id,
    },
    create: {
      tenantId: campariTenant.id,
      username: 'admin',
      password_hash: adminPassword,
      role: 'admin',
    },
  });

  console.log(`   ✅ Admin: ${admin.username}`);

  // Staff Campari
  const staffUsers = [
    { username: 'Brian', password: 'MonferoneBrian' },
    { username: 'Andrea', password: 'SegattoAndrea' },
    { username: 'Matteo', password: 'MomessoMatteo' },
    { username: 'Silvia', password: 'CarnielloSilvia' },
    { username: 'Veronica', password: 'PaieroVeronica' },
    { username: 'Nicola', password: 'ScarpaNicola' },
    { username: 'Simone', password: 'MilaneseSimone' },
  ];

  for (const user of staffUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const staffUser = await prisma.staffUser.upsert({
      where: { username: user.username },
      update: {
        tenantId: campariTenant.id,
        password_hash: passwordHash,
      },
      create: {
        tenantId: campariTenant.id,
        username: user.username,
        password_hash: passwordHash,
        role: 'staff',
      },
    });
    console.log(`   ✅ Staff: ${staffUser.username}`);
  }

  // ============================================
  // 6. MIGRATE EXISTING PROMOTIONS (if any)
  // ============================================
  console.log('\n📌 Migrating existing promotions to Campari tenant...');

  // Conta promozioni esistenti senza tenant
  const promotionsWithoutTenant = await prisma.promotion.count({
    where: { tenantId: '' },
  });

  if (promotionsWithoutTenant > 0) {
    // Aggiorna tutte le promozioni esistenti per associarle a Campari
    const updated = await prisma.promotion.updateMany({
      where: {
        OR: [
          { tenantId: '' },
          { tenantId: null as any },
        ],
      },
      data: {
        tenantId: campariTenant.id,
      },
    });
    console.log(`   ✅ Migrated ${updated.count} promotions to Campari tenant`);
  } else {
    console.log('   ℹ️  No promotions to migrate');
  }

  // ============================================
  // 7. DEMO TENANT (opzionale, per testing)
  // ============================================
  if (process.env.CREATE_DEMO_TENANT === 'true') {
    console.log('\n📌 Creating Demo tenant...');

    const demoTenant = await prisma.tenant.upsert({
      where: { slug: 'demo' },
      update: {},
      create: {
        name: 'Demo Company',
        slug: 'demo',
        subdomain: 'demo',
        primaryColor: '#3b82f6',
        secondaryColor: '#f8fafc',
        accentColor: '#1e293b',
        plan: 'starter',
        maxPromotions: 1,
        maxTokensPerPromo: 100,
        maxStaffUsers: 2,
        licenseKey: generateLicenseKey(),
        licenseStatus: 'trial',
        licenseStart: new Date(),
        licenseEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 giorni trial
        adminEmail: 'demo@example.com',
        companyName: 'Demo Inc.',
      },
    });

    // Admin per demo tenant
    const demoAdminPassword = await bcrypt.hash('Demo2025!', 10);
    await prisma.staffUser.upsert({
      where: { username: 'demo-admin' },
      update: { tenantId: demoTenant.id },
      create: {
        tenantId: demoTenant.id,
        username: 'demo-admin',
        password_hash: demoAdminPassword,
        role: 'admin',
      },
    });

    console.log(`   ✅ Demo tenant created: ${demoTenant.name}`);
    console.log(`   📋 Demo License Key: ${demoTenant.licenseKey}`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Seed completed successfully!');
  console.log('='.repeat(50));
  console.log('\n📋 Summary:');
  console.log(`   • Super Admin: ${superAdminUsername} / ${superAdminPassword}`);
  console.log(`   • Campari Tenant: ${campariTenant.slug}`);
  console.log(`   • Campari Admin: admin / Campari2025!`);
  console.log(`   • Staff users: ${staffUsers.length} created`);
  console.log('\n⚠️  Remember to change default passwords in production!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
