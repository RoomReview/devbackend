import prisma from '../src/config/database';

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    console.log('QUERY RESULT', user);
  } catch (err) {
    console.error('QUERY ERROR', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
