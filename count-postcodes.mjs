import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
try {
  const count = await prisma.postcode.count();
  console.log("POSTCODE_COUNT=" + count);
} finally {
  await prisma.$disconnect();
}
