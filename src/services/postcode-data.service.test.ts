/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSpacesObjectUrlSigner } from '../services/spaces-assets.service';
import {
  buildCrimeData,
  buildCrimeHighlight,
    buildCrimeTrendData,
  buildDistrictData,
  buildEducationData,
  buildWeightedLsoaDemographyData,
  buildHousingStockData,
  buildPropertyValueData,
  buildRentData,
} from '../services/postcode-data.service';

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

  it('builds chronological crime trend data from annual police rows', () => {
    const trend = buildCrimeTrendData([
      { year: 2025, total_crimes_per_1000: 81.4, lon_avg_total_crimes_per_1000: 95 },
      { year: 2023, total_crimes_per_1000: 87.8, lon_avg_total_crimes_per_1000: 101 },
      { year: 2024, total_crimes_per_1000: 84.1, lon_avg_total_crimes_per_1000: 98 },
    ]);

    assert.deepStrictEqual(trend, [
      { year: 2023, totalCrimesPer1000: 87.8, londonAveragePer1000: 101 },
      { year: 2024, totalCrimesPer1000: 84.1, londonAveragePer1000: 98 },
      { year: 2025, totalCrimesPer1000: 81.4, londonAveragePer1000: 95 },
    ]);
  });

  it('builds policing highlights from ranked and London-comparison fields', () => {
    const highlight = buildCrimeHighlight({
      year: 2025,
      total_crimes_per_1000: 81.4,
      safety_rank_total_crimes_per_1000: 8,
      yoy_pct_change_total_crimes_per_1000: -7.3,
      pct_diff_bicycle_theft_per_1000: -74,
      pct_diff_burglary_per_1000: null,
      yoy_pct_change_possession_of_weapons_per_1000: 36,
      yoy_pct_change_vehicle_crime_per_1000: null,
    });

    assert.deepStrictEqual(highlight, {
      year: 2025,
      totalCrimesPer1000: 81.4,
      rank: 8,
      yoyChangePct: -7.3,
      lowestGapCategory: 'Bicycle theft',
      lowestGapPct: -74,
      largestIncreaseCategory: 'Possession of weapons',
      largestIncreasePct: 36,
    });
  });

  it('builds property value data from housing price rows', () => {
    const propertyValueData = buildPropertyValueData([
      {
        avg_price: 650000,
        yoy_growth_pct: 2.4,
        quarter_label: '2025Q1',
      },
    ]);

    assert.strictEqual(propertyValueData[0].label, '2025Q1');
    assert.strictEqual(propertyValueData[0].value, 650000);
    assert.strictEqual(propertyValueData[1].label, 'YoY growth · 2025Q1');
    assert.strictEqual(propertyValueData[1].value, 2.4);
  });

  it('builds weighted female and male percentages in the demographic display bands', () => {
    const demographics = buildWeightedLsoaDemographyData([
      { allocationWeight: 0.5, total: 100, F0: 5, M0: 5, F1: 5, M1: 5, F10: 20, M10: 20, 'F90+': 5, 'M90+': 5 },
      { allocationWeight: 0.5, total: 200, F0: 10, M0: 10, F1: 10, M1: 10, F10: 50, M10: 50, 'F90+': 10, 'M90+': 10 },
    ]);

    assert.strictEqual(demographics[0].age_group, '0-9');
    assert.strictEqual(demographics[0].female_percentage, 10);
    assert.strictEqual(demographics[0].male_percentage, 10);
    assert.strictEqual(demographics[1].female_percentage, 23.3);
    assert.strictEqual(demographics.at(-1)?.age_group, '60+');
    assert.strictEqual(demographics.at(-1)?.female_percentage, 5);
    assert.strictEqual(demographics.at(-1)?.male_percentage, 5);
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

describe('spaces-assets.service', () => {
  it('creates short-lived signed object URLs using the configured bucket and key', async () => {
    const signObjectUrl = createSpacesObjectUrlSigner({
      bucket: 'roomreview-lsoa-maps',
      region: 'lon1',
      endpoint: 'https://lon1.digitaloceanspaces.com',
      mapPrefix: 'lsoa_maps',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      signedUrlTtlSeconds: 900,
    });

    const signedUrl = await signObjectUrl('E01000001_2026-09.webp');
    assert.ok(signedUrl);
    const parsedUrl = new URL(signedUrl);
    assert.strictEqual(parsedUrl.hostname, 'roomreview-lsoa-maps.lon1.digitaloceanspaces.com');
    assert.strictEqual(parsedUrl.pathname, '/lsoa_maps/E01000001_2026-09.webp');
    assert.strictEqual(parsedUrl.searchParams.get('X-Amz-Expires'), '900');
    assert.ok(parsedUrl.searchParams.has('X-Amz-Signature'));
  });

  it('does not create a URL unless bucket credentials are configured', async () => {
    const signObjectUrl = createSpacesObjectUrlSigner({
      bucket: 'roomreview-lsoa-maps',
      region: 'lon1',
      endpoint: 'https://lon1.digitaloceanspaces.com',
      mapPrefix: 'lsoa_maps',
      accessKeyId: '',
      secretAccessKey: '',
      signedUrlTtlSeconds: 900,
    });

    assert.strictEqual(await signObjectUrl('E01000001_2026-09.webp'), null);
  });

  it('uses the regional origin when configured with a CDN endpoint', async () => {
    const signObjectUrl = createSpacesObjectUrlSigner({
      bucket: 'roomreview-lsoa-maps',
      region: 'lon1',
      endpoint: 'https://roomreview-lsoa-maps.lon1.cdn.digitaloceanspaces.com',
      mapPrefix: 'lsoa_maps',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      signedUrlTtlSeconds: 900,
    });

    const signedUrl = await signObjectUrl('E01000001_2026-09.webp');
    assert.ok(signedUrl);
    assert.strictEqual(new URL(signedUrl).hostname, 'roomreview-lsoa-maps.lon1.digitaloceanspaces.com');
    assert.strictEqual(new URL(signedUrl).pathname, '/lsoa_maps/E01000001_2026-09.webp');
  });
});

