import { getPostcodeLookupCandidates } from './src/utils/postcode';
import prisma from './src/config/database';

async function testPostcodeLookup() {
  const testCodes = ['E16AN', 'E1 6AN', 'e1 6an'];
  
  console.log('=== Testing postcode lookup candidates ===\n');
  
  for (const code of testCodes) {
    const candidates = getPostcodeLookupCandidates(code);
    console.log(`Input: "${code}"`);
    console.log(`Candidates: ${JSON.stringify(candidates)}\n`);
  }

  console.log('=== Testing database lookup ===\n');
  
  const dbCount = await prisma.postcode.count();
  console.log(`Total postcodes in database: ${dbCount}`);
  
  if (dbCount > 0) {
    const sample = await prisma.postcode.findFirst();
    console.log(`Sample postcode: ${JSON.stringify(sample, null, 2)}`);
  }

  await prisma.$disconnect();
}

testPostcodeLookup().catch(console.error);
