/**
 * E2E Test Seed Script
 *
 * Creates test data for Playwright E2E tests.
 * Run with: npm run seed:e2e
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return segments.join('-');
}

async function main() {
  console.log('🧪 Starting E2E Test Seed...\n');

  // ============================================
  // 1. SUPER ADMIN (matches e2e test credentials)
  // ============================================
  console.log('📌 Creating Super Admin for E2E tests...');

  const superAdminPassword = 'superadmin123'; // Matches e2e tests
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

  const superAdmin = await prisma.superAdmin.upsert({
    where: { username: 'superadmin' },
    update: {
      passwordHash: superAdminPasswordHash,
    },
    create: {
      username: 'superadmin',
      passwordHash: superAdminPasswordHash,
      email: 'superadmin@test.com',
    },
  });

  console.log(`   ✅ Super Admin: superadmin / superadmin123`);

  // ============================================
  // 2. TEST TENANT
  // ============================================
  console.log('\n📌 Creating Test Tenant...');

  const testTenant = await prisma.tenant.upsert({
    where: { slug: 'test' },
    update: {},
    create: {
      name: 'Test Company',
      slug: 'test',
      subdomain: 'test',
      customDomain: null,
      logoUrl: null,
      primaryColor: '#3b82f6',
      secondaryColor: '#f8fafc',
      accentColor: '#1e293b',
      plan: 'pro',
      maxPromotions: 10,
      maxTokensPerPromo: 1000,
      maxStaffUsers: 10,
      licenseKey: generateLicenseKey(),
      licenseStatus: 'active',
      licenseStart: new Date(),
      licenseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      adminEmail: 'admin@test.com',
      companyName: 'Test Inc.',
    },
  });

  console.log(`   ✅ Test Tenant: ${testTenant.name} (${testTenant.slug})`);

  // ============================================
  // 3. TENANT BRANDING
  // ============================================
  console.log('\n📌 Creating Test Tenant Branding...');

  await prisma.tenantBranding.upsert({
    where: { tenantId: testTenant.id },
    update: {},
    create: {
      tenantId: testTenant.id,
      colorPrimary: '#3b82f6',
      colorSecondary: '#f8fafc',
      colorAccent: '#1e293b',
      colorTextDark: '#1a1a1a',
      colorTextLight: '#ffffff',
      colorTextMuted: '#6b7280',
      colorSuccess: '#22c55e',
      colorError: '#ef4444',
      fontHeading: 'Inter',
      fontBody: 'Inter',
    },
  });

  console.log(`   ✅ Branding created`);

  // ============================================
  // 4. TENANT CONTENT (IT + EN)
  // ============================================
  console.log('\n📌 Creating Test Tenant Content...');

  // Italian content
  await prisma.tenantContent.upsert({
    where: {
      tenantId_language: {
        tenantId: testTenant.id,
        language: 'it',
      },
    },
    update: {},
    create: {
      tenantId: testTenant.id,
      language: 'it',
      landingTitle: 'Tenta la fortuna!',
      landingSubtitle: 'Test Promotion',
      landingCtaText: 'Gioca Ora',
      tokenPlaceholder: 'Inserisci il tuo codice',
      errorInvalidToken: 'Codice non valido',
      errorUsedToken: 'Codice già utilizzato',
      formTitle: 'Completa la registrazione',
      labelFirstName: 'Nome',
      labelLastName: 'Cognome',
      labelPhone: 'Numero di telefono',
      consentPrivacy: 'Accetto i termini e condizioni',
      consentMarketing: 'Acconsento al marketing',
      formSubmitText: 'Partecipa',
      winTitle: 'Congratulazioni!',
      winMessage: 'Hai vinto: {prize_name}',
      winInstructions: 'Mostra questo codice per ritirare il premio.',
      loseTitle: 'Peccato!',
      loseMessage: 'Non hai vinto questa volta.',
      thankYouMessage: 'Grazie per aver partecipato!',
    },
  });

  // English content
  await prisma.tenantContent.upsert({
    where: {
      tenantId_language: {
        tenantId: testTenant.id,
        language: 'en',
      },
    },
    update: {},
    create: {
      tenantId: testTenant.id,
      language: 'en',
      landingTitle: 'Try Your Luck!',
      landingSubtitle: 'Test Promotion',
      landingCtaText: 'Play Now',
      tokenPlaceholder: 'Enter your code',
      errorInvalidToken: 'Invalid code',
      errorUsedToken: 'Code already used',
      formTitle: 'Complete Registration',
      labelFirstName: 'First Name',
      labelLastName: 'Last Name',
      labelPhone: 'Phone Number',
      consentPrivacy: 'I accept terms and conditions',
      consentMarketing: 'I consent to marketing',
      formSubmitText: 'Submit',
      winTitle: 'Congratulations!',
      winMessage: 'You won: {prize_name}',
      winInstructions: 'Show this code to claim your prize.',
      loseTitle: 'Sorry!',
      loseMessage: 'You did not win this time.',
      thankYouMessage: 'Thank you for participating!',
    },
  });

  console.log(`   ✅ Content (IT, EN) created`);

  // ============================================
  // 5. ADMIN USER (matches e2e test credentials)
  // ============================================
  console.log('\n📌 Creating Admin User for E2E tests...');

  // On localhost, tenant middleware falls back to the FIRST tenant
  // So we need to update the admin for the first tenant, not just the test tenant
  const firstTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' }
  });

  const targetTenantId = firstTenant?.id || testTenant.id;
  console.log(`   ℹ️  Target tenant for admin: ${firstTenant?.slug || testTenant.slug}`);

  const adminPassword = 'admin123'; // Matches e2e tests
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  // Update existing admin user's password AND tenant
  const existingAdmin = await prisma.staffUser.findUnique({
    where: { username: 'admin' }
  });

  if (existingAdmin) {
    // Update BOTH password and tenant to ensure it matches the resolved tenant on localhost
    await prisma.staffUser.update({
      where: { username: 'admin' },
      data: {
        password_hash: adminPasswordHash,
        tenantId: targetTenantId, // Important: move to first tenant for localhost testing
      },
    });
    console.log(`   ✅ Admin updated: admin / admin123 (moved to tenant: ${targetTenantId})`);
  } else {
    await prisma.staffUser.create({
      data: {
        tenantId: targetTenantId,
        username: 'admin',
        password_hash: adminPasswordHash,
        role: 'admin',
      },
    });
    console.log(`   ✅ Admin created: admin / admin123`);
  }

  // Staff user for test tenant
  const staffPassword = 'staff123';
  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

  await prisma.staffUser.upsert({
    where: { username: 'staff' },
    update: {
      password_hash: staffPasswordHash,
    },
    create: {
      tenantId: testTenant.id,
      username: 'staff',
      password_hash: staffPasswordHash,
      role: 'staff',
    },
  });

  console.log(`   ✅ Staff: staff / staff123`);

  // ============================================
  // 6. TEST PROMOTION
  // ============================================
  console.log('\n📌 Creating Test Promotion...');

  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // First check if promotion exists
  let promotion = await prisma.promotion.findFirst({
    where: { name: 'E2E Test Promotion', tenantId: testTenant.id }
  });

  if (!promotion) {
    promotion = await prisma.promotion.create({
      data: {
        tenantId: testTenant.id,
        name: 'E2E Test Promotion',
        description: 'Promotion for E2E testing',
        start_datetime: now,
        end_datetime: endDate,
        status: 'active',
        leaderboard_enabled: true,
      },
    });
    console.log(`   ✅ Promotion created: ${promotion.name} (ID: ${promotion.id})`);
  } else {
    // Update existing promotion
    promotion = await prisma.promotion.update({
      where: { id: promotion.id },
      data: {
        status: 'active',
        start_datetime: now,
        end_datetime: endDate,
      },
    });
    console.log(`   ✅ Promotion updated: ${promotion.name} (ID: ${promotion.id})`);
  }

  // ============================================
  // 7. TEST PRIZES
  // ============================================
  console.log('\n📌 Creating Test Prizes...');

  const prizes = [
    { name: 'Test Prize 1', initial_stock: 10 },
    { name: 'Test Prize 2', initial_stock: 5 },
    { name: 'Test Prize 3', initial_stock: 3 },
  ];

  for (const prizeData of prizes) {
    // Check if prize exists
    let prize = await prisma.prizeType.findFirst({
      where: { promotion_id: promotion.id, name: prizeData.name }
    });

    if (!prize) {
      prize = await prisma.prizeType.create({
        data: {
          promotion_id: promotion.id,
          name: prizeData.name,
          initial_stock: prizeData.initial_stock,
          remaining_stock: prizeData.initial_stock,
        },
      });
      console.log(`   ✅ Prize created: ${prize.name} (stock: ${prize.initial_stock})`);
    } else {
      console.log(`   ✅ Prize exists: ${prize.name} (stock: ${prize.remaining_stock})`);
    }
  }

  // ============================================
  // 8. TEST TOKENS
  // ============================================
  console.log('\n📌 Creating Test Tokens...');

  const testTokens = [
    { code: 'TEST_TOKEN_001', status: 'available' },
    { code: 'TEST_TOKEN_002', status: 'available' },
    { code: 'TEST_TOKEN_003', status: 'available' },
    { code: 'TEST_TOKEN_USED', status: 'used' }, // Pre-used token for testing
  ];

  for (const tokenData of testTokens) {
    // Check if token exists
    let token = await prisma.token.findFirst({
      where: { token_code: tokenData.code }
    });

    if (!token) {
      token = await prisma.token.create({
        data: {
          promotion_id: promotion.id,
          token_code: tokenData.code,
          status: tokenData.status,
          used_at: tokenData.status === 'used' ? new Date() : null,
        },
      });
      console.log(`   ✅ Token created: ${token.token_code} (status: ${token.status})`);
    } else {
      console.log(`   ✅ Token exists: ${token.token_code} (status: ${token.status})`);
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('🎉 E2E Test Seed completed!');
  console.log('='.repeat(50));
  console.log('\n📋 Test Credentials:');
  console.log('   • Super Admin: superadmin / superadmin123');
  console.log('   • Admin: admin / admin123');
  console.log('   • Staff: staff / staff123');
  console.log('\n📋 Test Tokens:');
  console.log('   • Valid: TEST_TOKEN_001, TEST_TOKEN_002, TEST_TOKEN_003');
  console.log('   • Used: TEST_TOKEN_USED');
  console.log('\n📋 Test URLs:');
  console.log('   • Play: /play?token=TEST_TOKEN_001');
  console.log('   • Admin: /admin/login');
  console.log('   • Super Admin: /superadmin/login');
  console.log('\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ E2E Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
