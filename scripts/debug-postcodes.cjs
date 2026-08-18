const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const rows = await prisma.postcode.findMany({
    take: 20,
    select: { code: true, outcode: true, incode: true, boroughId: true },
    orderBy: { code: 'asc' },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main().finally(() => prisma.$disconnect());
