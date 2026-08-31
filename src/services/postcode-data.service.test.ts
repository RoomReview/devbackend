import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildCrimeData,
  buildDistrictData,
  buildEducationData,
  buildHousingStockData,
  buildPropertyValueData,
  buildRentData,
} from '@/services/postcode-data.service';

describe('postcode-data.service mapping helpers', () => {
  it('builds rent data from quarterly rent rows', () => {
    const rentData = buildRentData([
      {
        rent_all: 1800,
        rent_one_bed: 1400,
        rent_two_bed: 1700,
        rent_three_bed: 2100,
        rent_four_plus_bed: 2500,
      },
    ]);

    assert.deepStrictEqual(rentData[0], { rent: 1800, type: 'average' });
    assert.strictEqual(rentData[1].type, '1-bed');
    assert.strictEqual(rentData[2].type, '2-bed');
  });

  it('builds crime data from police rows', () => {
    const crimeData = buildCrimeData({
      total_crimes_per_1000: 118.7,
      violent_crime_per_1000: 27.7,
      burglary_per_1000: 4.98,
      anti_social_behaviour_per_1000: 24.28,
    });

    assert.ok(crimeData.some((item) => item.label === 'Total crimes per 1,000' && item.value === 118.7));
    assert.ok(crimeData.some((item) => item.label === 'Violent crime' && item.value === 27.7));
  });

  it('builds property value data from housing price rows', () => {
    const propertyValueData = buildPropertyValueData([
      {
        avg_price: 650000,
        yoy_growth_pct: 2.4,
        quarter_label: '2025Q1',
      },
    ]);

    assert.strictEqual(propertyValueData[0].label, 'Average price');
    assert.strictEqual(propertyValueData[0].value, 650000);
    assert.strictEqual(propertyValueData[1].label, 'YoY growth');
    assert.strictEqual(propertyValueData[1].value, 2.4);
  });

  it('builds education data from education london rows', () => {
    const educationData = buildEducationData([
      {
        independent_school_count: 2,
        public_funded_nursery: 4,
        public_funded_primary: 6,
        public_funded_secondary: 3,
        total_school_count: 15,
        gcse_attainment_8: 58.6,
        strong_pass_eng_maths: 64.1,
        ofsted_goodand_outstanding: 82,
        education_rank: 12,
      },
    ]);

    assert.ok(educationData.some((item) => item.label === 'Total schools' && item.value === 15));
    assert.ok(educationData.some((item) => item.label === 'GCSE attainment 8' && item.value === 58.6));
  });

  it('builds housing stock data from annual housing rows', () => {
    const housingStockData = buildHousingStockData([
      {
        total_dwellings: 145000,
        net_additions: 1200,
        affordable_starts: 320,
        affordable_completions: 280,
        band_d: 6000,
      },
    ]);

    assert.ok(housingStockData.some((item) => item.label === 'Total dwellings' && item.value === 145000));
    assert.ok(housingStockData.some((item) => item.label === 'Affordable completions' && item.value === 280));
  });

  it('builds district data from district rows', () => {
    const districtData = buildDistrictData([
      {
        district_code: 'E09000030',
        borough_name: 'Tower Hamlets',
      },
    ]);

    assert.deepStrictEqual(districtData[0], {
      districtCode: 'E09000030',
      boroughName: 'Tower Hamlets',
    });
  });
});

