/*
  Seed script (TypeScript version)
  Run with:  npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed.ts
*/

// Using dynamic require to avoid ESM/CJS issues when running via ts-node or ts-node/register.
// If you prefer pure JS, keep using prisma/seed.js instead.
// This TypeScript version is optional.
// To run: npx ts-node --transpile-only prisma/seed.ts

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL as string | undefined;
  const adminPassword = process.env.ADMIN_PASSWORD as string | undefined;

  if (!adminEmail || !adminPassword) {
    console.log('[seed] Skipper: ADMIN_EMAIL / ADMIN_PASSWORD mangler i .env');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('[seed] Admin finnes allerede:', adminEmail);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({ data: { email: adminEmail, passwordHash, role: 'ADMIN' } });
  console.log('[seed] Admin opprettet:', adminEmail);
}

main().then(() => prisma.$disconnect()).catch((err: unknown) => {
  console.error('[seed] Feil:', err);
  return prisma.$disconnect().finally(() => process.exit(1));
});
