import prisma from './src/config/database';

async function checkPostcodes() {
  try {
    const count = await prisma.postcode.count();
    console.log(`Total postcodes in database: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.postcode.findMany({ take: 5 });
      console.log('Sample postcodes:', JSON.stringify(sample, null, 2));
    } else {
      console.log('No postcodes found in database.');
    }
  } catch (error) {
    console.error('Error checking postcodes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPostcodes();
