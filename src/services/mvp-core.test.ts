import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProperty } from './property.service';
import { createReview } from './review.service';

describe('mvp core data layer', () => {
  it('creates a valid property record with a persisted id and essential fields', async () => {
    const property = await createProperty({
      title: 'Two-bedroom flat',
      description: 'Family-friendly flat near the station',
      type: 'FLAT',
      listing_type: 'FOR_RENT',
      price: 2200,
      bedrooms: 2,
      bathrooms: 1,
      address: '12 Market Street',
      landlord_id: '11111111-1111-4111-8111-111111111111',
      postcode_id: '22222222-2222-4222-8222-222222222222',
    });

    assert.ok(property.property_id);
    assert.equal(property.title, 'Two-bedroom flat');
    assert.equal(property.type, 'FLAT');
    assert.equal(property.address, '12 Market Street');
  });

  it('creates a valid review record with ratings and persisted review id', async () => {
    const review = await createReview({
      title: 'Good transport links',
      content: 'The area feels safe and well connected.',
      safety_rating: 5,
      transport_rating: 4,
      amenities_rating: 5,
      value_rating: 4,
      author_id: '33333333-3333-4333-8333-333333333333',
      postcode_id: '22222222-2222-4222-8222-222222222222',
    });

    assert.ok(review.review_id);
    assert.equal(review.title, 'Good transport links');
    assert.equal(review.overall_rating, 4.5);
    assert.equal(review.status, 'PENDING');
  });
});
