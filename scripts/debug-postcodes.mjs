import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  await prisma.$connect();
  const rows = await prisma.postcode.findMany({
    take: 20,
    select: { code: true, outcode: true, incode: true, boroughId: true },
    orderBy: { code: 'asc' },
  });
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
}
