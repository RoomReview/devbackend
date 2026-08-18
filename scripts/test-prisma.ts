import prisma from '../src/config/database';

async function main() {
  try {
    await prisma.$connect();
    console.log('Prisma connected');
  } catch (e) {
    console.error('Prisma connect error:', e);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}

main();
