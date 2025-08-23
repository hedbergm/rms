const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.log('No ADMIN_EMAIL / ADMIN_PASSWORD provided. Skipping admin seed.');
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin already exists.');
    return;
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({ data: { email: adminEmail, passwordHash, role: 'ADMIN' } });
  console.log('Admin user created:', adminEmail);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
