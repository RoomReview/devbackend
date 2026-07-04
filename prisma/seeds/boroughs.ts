import { parseArgs } from 'node:util';

import prisma from '../../src/config/database.ts';
import logger, { type LogContext } from '../../src/utils/logger.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_NAME = 'boroughs';

const logCtx: LogContext = { service: 'Seed', function: SEED_NAME };

// ─── CLI args ─────────────────────────────────────────────────────────────────

const options = {
  environment: { type: 'string' },
} as const;

const {
  values: { environment },
} = parseArgs({ options, strict: false });

// ─── Borough seed data ───────────────────────────────────────────────────────

interface BoroughSeed {
  name: string;
  slug: string;
  description: string;
  image: string;
  latitude: number;
  longitude: number;
  metrics: {
    zones: string;
    avgRent: string;
    trend: string;
    reviewCount: number;
    rating: number;
  };
}

const BOROUGHS: BoroughSeed[] = [
  {
    name: 'Barking and Dagenham',
    slug: 'barking-and-dagenham',
    description:
      'An outer east London borough undergoing significant regeneration with growing transport links and affordable housing.',
    image:
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5397,
    longitude: 0.1312,
    metrics: {
      zones: 'Zones 4–5',
      avgRent: '£1,450',
      trend: '2.1%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Barnet',
    slug: 'barnet',
    description:
      'A large suburban borough in north London with leafy neighbourhoods, excellent schools, and good transport connections.',
    image:
      'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?q=80&w=400&auto=format&fit=crop',
    latitude: 51.6252,
    longitude: -0.1517,
    metrics: {
      zones: 'Zones 3–5',
      avgRent: '£1,850',
      trend: '1.5%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Bexley',
    slug: 'bexley',
    description:
      'A quiet outer south-east borough with green spaces, period housing, and proximity to the Thames.',
    image:
      'https://images.unsplash.com/photo-1549144511-f099e773c147?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4549,
    longitude: 0.1505,
    metrics: {
      zones: 'Zones 5–6',
      avgRent: '£1,350',
      trend: '0.8%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Brent',
    slug: 'brent',
    description:
      'A culturally diverse north-west London borough home to Wembley Stadium and vibrant high streets.',
    image:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5588,
    longitude: -0.2817,
    metrics: {
      zones: 'Zones 2–4',
      avgRent: '£1,750',
      trend: '3.2%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Bromley',
    slug: 'bromley',
    description:
      'London\'s largest borough by area, offering a semi-rural feel with excellent parks and shopping centres.',
    image:
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4039,
    longitude: 0.0198,
    metrics: {
      zones: 'Zones 3–6',
      avgRent: '£1,650',
      trend: '1.1%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Camden',
    slug: 'camden',
    description:
      'A vibrant inner London borough famous for its markets, music scene, and world-class academic institutions.',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5517,
    longitude: -0.1588,
    metrics: {
      zones: 'Zones 1–2',
      avgRent: '£2,450',
      trend: '4.5%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'City of London',
    slug: 'city-of-london',
    description:
      'The historic financial heart of London, home to iconic landmarks like St Paul\'s Cathedral and the Bank of England.',
    image:
      'https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5155,
    longitude: -0.0922,
    metrics: {
      zones: 'Zone 1',
      avgRent: '£2,950',
      trend: '3.8%',
      reviewCount: 8,
      rating: 4.7,
    },
  },
  {
    name: 'Croydon',
    slug: 'croydon',
    description:
      'A major south London hub with ambitious regeneration plans, a thriving food scene, and fast rail links to central London.',
    image:
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=400&auto=format&fit=crop',
    latitude: 51.3714,
    longitude: -0.0977,
    metrics: {
      zones: 'Zones 4–6',
      avgRent: '£1,550',
      trend: '1.9%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Ealing',
    slug: 'ealing',
    description:
      'Known as the "Queen of the Suburbs", Ealing offers leafy streets, excellent restaurants, and Crossrail connectivity.',
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5133,
    longitude: -0.3043,
    metrics: {
      zones: 'Zones 3–4',
      avgRent: '£1,950',
      trend: '2.8%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Enfield',
    slug: 'enfield',
    description:
      'London\'s northernmost borough with a mix of urban and rural living, green belt land, and family-friendly neighbourhoods.',
    image:
      'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?q=80&w=400&auto=format&fit=crop',
    latitude: 51.6538,
    longitude: -0.0799,
    metrics: {
      zones: 'Zones 4–6',
      avgRent: '£1,500',
      trend: '1.3%',
      reviewCount: 10,
      rating: 4.6,
    },
  },
  {
    name: 'Greenwich',
    slug: 'greenwich',
    description:
      'A Royal Borough famed for its maritime heritage, the Prime Meridian, and stunning river views from Greenwich Park.',
    image:
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4892,
    longitude: 0.0648,
    metrics: {
      zones: 'Zones 2–4',
      avgRent: '£1,700',
      trend: '2.5%',
      reviewCount: 14,
      rating: 4.8,
    },
  },
  {
    name: 'Hackney',
    slug: 'hackney',
    description:
      'One of London\'s trendiest boroughs, known for its creative community, street art, and buzzing nightlife.',
    image:
      'https://images.unsplash.com/photo-1517137879934-1697f282ae24?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5450,
    longitude: -0.0553,
    metrics: {
      zones: 'Zones 1–2',
      avgRent: '£2,100',
      trend: '3.4%',
      reviewCount: 18,
      rating: 4.7,
    },
  },
  {
    name: 'Hammersmith and Fulham',
    slug: 'hammersmith-and-fulham',
    description:
      'A riverside west London borough with a thriving arts scene, excellent restaurants, and strong transport links.',
    image:
      'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4927,
    longitude: -0.2339,
    metrics: {
      zones: 'Zones 1–2',
      avgRent: '£2,350',
      trend: '3.1%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Haringey',
    slug: 'haringey',
    description:
      'A diverse north London borough spanning from vibrant Tottenham to leafy Muswell Hill and Highgate.',
    image:
      'https://images.unsplash.com/photo-1444464666168-49d633b867ad?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5906,
    longitude: -0.1110,
    metrics: {
      zones: 'Zones 2–3',
      avgRent: '£1,850',
      trend: '2.4%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Harrow',
    slug: 'harrow',
    description:
      'A suburban north-west London borough with top-ranking schools, historic Harrow on the Hill, and strong community spirit.',
    image:
      'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5898,
    longitude: -0.3346,
    metrics: {
      zones: 'Zones 4–5',
      avgRent: '£1,650',
      trend: '1.2%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Havering',
    slug: 'havering',
    description:
      'London\'s easternmost borough offering countryside charm, affordable housing, and improving Elizabeth line access.',
    image:
      'https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5779,
    longitude: 0.2120,
    metrics: {
      zones: 'Zones 6–7',
      avgRent: '£1,450',
      trend: '0.9%',
      reviewCount: 12,
      rating: 4.9,
    },
  },
  {
    name: 'Hillingdon',
    slug: 'hillingdon',
    description:
      'London\'s second-largest borough, home to Heathrow Airport and the Colne Valley regional park.',
    image:
      'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5441,
    longitude: -0.4760,
    metrics: {
      zones: 'Zones 5–6',
      avgRent: '£1,550',
      trend: '1.0%',
      reviewCount: 9,
      rating: 4.5,
    },
  },
  {
    name: 'Hounslow',
    slug: 'hounslow',
    description:
      'A west London borough with excellent transport, Chiswick\'s riverside charm, and multicultural communities.',
    image:
      'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4746,
    longitude: -0.3680,
    metrics: {
      zones: 'Zones 3–5',
      avgRent: '£1,700',
      trend: '1.7%',
      reviewCount: 11,
      rating: 4.6,
    },
  },
  {
    name: 'Islington',
    slug: 'islington',
    description:
      'A trendy inner London borough with Georgian terraces, vibrant Upper Street, and superb canal-side living.',
    image:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5465,
    longitude: -0.1058,
    metrics: {
      zones: 'Zones 1–2',
      avgRent: '£2,250',
      trend: '3.6%',
      reviewCount: 16,
      rating: 4.8,
    },
  },
  {
    name: 'Kensington and Chelsea',
    slug: 'kensington-and-chelsea',
    description:
      'London\'s most affluent borough, famous for its museums, garden squares, and world-class shopping on King\'s Road.',
    image:
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4990,
    longitude: -0.1938,
    metrics: {
      zones: 'Zones 1–2',
      avgRent: '£3,250',
      trend: '5.2%',
      reviewCount: 20,
      rating: 4.8,
    },
  },
  {
    name: 'Kingston upon Thames',
    slug: 'kingston-upon-thames',
    description:
      'A Royal Borough in south-west London with a charming riverside town centre, excellent schools, and leafy parks.',
    image:
      'https://images.unsplash.com/photo-1491002052546-bf38f186af56?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4085,
    longitude: -0.3064,
    metrics: {
      zones: 'Zones 5–6',
      avgRent: '£1,750',
      trend: '1.4%',
      reviewCount: 13,
      rating: 4.7,
    },
  },
  {
    name: 'Lambeth',
    slug: 'lambeth',
    description:
      'A diverse inner south London borough home to the South Bank, Brixton\'s vibrant culture, and Clapham\'s nightlife.',
    image:
      'https://images.unsplash.com/photo-1534430480587-fd755c916206?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4571,
    longitude: -0.1231,
    metrics: {
      zones: 'Zones 1–3',
      avgRent: '£2,050',
      trend: '3.3%',
      reviewCount: 17,
      rating: 4.7,
    },
  },
  {
    name: 'Lewisham',
    slug: 'lewisham',
    description:
      'A south-east London borough with strong community spirit, thriving markets, and ongoing regeneration projects.',
    image:
      'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4415,
    longitude: -0.0117,
    metrics: {
      zones: 'Zones 2–4',
      avgRent: '£1,650',
      trend: '2.2%',
      reviewCount: 11,
      rating: 4.6,
    },
  },
  {
    name: 'Merton',
    slug: 'merton',
    description:
      'A south-west London borough famous for Wimbledon, offering village-like living with excellent parks and schools.',
    image:
      'https://images.unsplash.com/photo-1495900593003-8e3ebffd1bd5?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4098,
    longitude: -0.1949,
    metrics: {
      zones: 'Zones 3–4',
      avgRent: '£1,800',
      trend: '1.6%',
      reviewCount: 13,
      rating: 4.8,
    },
  },
  {
    name: 'Newham',
    slug: 'newham',
    description:
      'East London\'s most dynamic borough, transformed by the 2012 Olympics with booming development around Stratford.',
    image:
      'https://images.unsplash.com/photo-1534430480587-fd755c916206?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5255,
    longitude: 0.0352,
    metrics: {
      zones: 'Zones 2–4',
      avgRent: '£1,750',
      trend: '3.5%',
      reviewCount: 15,
      rating: 4.6,
    },
  },
  {
    name: 'Redbridge',
    slug: 'redbridge',
    description:
      'A family-oriented outer east London borough with good schools, Epping Forest access, and Elizabeth line stations.',
    image:
      'https://images.unsplash.com/photo-1465447142348-e9952c393450?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5590,
    longitude: 0.0741,
    metrics: {
      zones: 'Zones 4–5',
      avgRent: '£1,550',
      trend: '1.8%',
      reviewCount: 10,
      rating: 4.6,
    },
  },
  {
    name: 'Richmond upon Thames',
    slug: 'richmond-upon-thames',
    description:
      'One of London\'s greenest boroughs with Richmond Park, Kew Gardens, and a charming riverside town centre.',
    image:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4613,
    longitude: -0.3037,
    metrics: {
      zones: 'Zones 3–5',
      avgRent: '£2,200',
      trend: '2.0%',
      reviewCount: 15,
      rating: 4.9,
    },
  },
  {
    name: 'Southwark',
    slug: 'southwark',
    description:
      'A historic inner south London borough home to Borough Market, the Tate Modern, and rapidly evolving Elephant & Castle.',
    image:
      'https://images.unsplash.com/photo-1520986606214-8b456906c813?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5035,
    longitude: -0.0804,
    metrics: {
      zones: 'Zones 1–2',
      avgRent: '£2,150',
      trend: '3.7%',
      reviewCount: 16,
      rating: 4.7,
    },
  },
  {
    name: 'Sutton',
    slug: 'sutton',
    description:
      'A quiet outer south London borough consistently ranked for quality of life, with top grammar schools and green spaces.',
    image:
      'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?q=80&w=400&auto=format&fit=crop',
    latitude: 51.3618,
    longitude: -0.1945,
    metrics: {
      zones: 'Zones 5–6',
      avgRent: '£1,400',
      trend: '0.7%',
      reviewCount: 9,
      rating: 4.7,
    },
  },
  {
    name: 'Tower Hamlets',
    slug: 'tower-hamlets',
    description:
      'A fast-growing east London borough encompassing Canary Wharf\'s skyline, Brick Lane\'s culture, and the vibrant Docklands.',
    image:
      'https://images.unsplash.com/photo-1534430480587-fd755c916206?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5099,
    longitude: -0.0059,
    metrics: {
      zones: 'Zones 1–2',
      avgRent: '£2,300',
      trend: '4.1%',
      reviewCount: 19,
      rating: 4.7,
    },
  },
  {
    name: 'Waltham Forest',
    slug: 'waltham-forest',
    description:
      'A north-east London borough blending urban energy around Walthamstow with the tranquillity of Epping Forest.',
    image:
      'https://images.unsplash.com/photo-1504803900752-c2051699d0e8?q=80&w=400&auto=format&fit=crop',
    latitude: 51.5886,
    longitude: -0.0200,
    metrics: {
      zones: 'Zones 3–4',
      avgRent: '£1,700',
      trend: '2.6%',
      reviewCount: 12,
      rating: 4.7,
    },
  },
  {
    name: 'Wandsworth',
    slug: 'wandsworth',
    description:
      'A popular south-west London borough known for Clapham Junction, Battersea Park, and young professional communities.',
    image:
      'https://images.unsplash.com/photo-1517137879934-1697f282ae24?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4571,
    longitude: -0.1818,
    metrics: {
      zones: 'Zones 2–3',
      avgRent: '£2,100',
      trend: '3.0%',
      reviewCount: 16,
      rating: 4.8,
    },
  },
  {
    name: 'Westminster',
    slug: 'westminster',
    description:
      'The political and cultural heart of London, home to Parliament, Buckingham Palace, and the West End theatre district.',
    image:
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=400&auto=format&fit=crop',
    latitude: 51.4975,
    longitude: -0.1357,
    metrics: {
      zones: 'Zone 1',
      avgRent: '£3,100',
      trend: '4.8%',
      reviewCount: 22,
      rating: 4.8,
    },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info(logCtx, `Seeding ${BOROUGHS.length} London boroughs.`, {
    environment,
  });

  let created = 0;
  let updated = 0;

  for (const borough of BOROUGHS) {
    const result = await prisma.borough.upsert({
      where: { slug: borough.slug },
      update: {
        name: borough.name,
        description: borough.description,
        image: borough.image,
        latitude: borough.latitude,
        longitude: borough.longitude,
        metrics: borough.metrics,
      },
      create: {
        name: borough.name,
        slug: borough.slug,
        description: borough.description,
        image: borough.image,
        latitude: borough.latitude,
        longitude: borough.longitude,
        metrics: borough.metrics,
      },
    });

    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
    if (isNew) {
      created++;
    } else {
      updated++;
    }
  }

  logger.info(logCtx, `Borough seeding complete.`, { created, updated });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    logger.error(logCtx, 'Seed failed.', { error: e });
    await prisma.$disconnect();
    process.exit(1);
  });

export default null;
