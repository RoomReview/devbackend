import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ResetPasswordDto } from './auth.dto';
import { CreatePropertyDto, UpdatePropertyDto } from './property.dto';
import { UpdateReviewDto } from './review.dto';

describe('security request DTOs', () => {
  it('accepts only high-entropy password reset tokens', () => {
    const request = {
      email: 'user@example.com',
      code: 'a'.repeat(64),
      newPassword: 'Password123',
    };
    assert.equal(ResetPasswordDto.safeParse(request).success, true);
    assert.equal(ResetPasswordDto.safeParse({ ...request, code: '123456' }).success, false);
  });

  it('rejects privileged fields in property create and update payloads', () => {
    const createRequest = {
      title: 'Sample property',
      description: '',
      type: 'FLAT',
      listing_type: 'FOR_RENT',
      price: 1000,
      bedrooms: 1,
      bathrooms: 1,
      address: '1 Sample Street',
      postcode_id: 'postcode-id',
      landlord_id: 'another-user',
      verified: true,
    };
    assert.equal(CreatePropertyDto.safeParse(createRequest).success, false);
    assert.equal(UpdatePropertyDto.safeParse({ status: 'SOLD' }).success, false);
    assert.equal(UpdatePropertyDto.safeParse({ title: 'Updated title' }).success, true);
  });

  it('rejects privileged moderation fields in review updates', () => {
    assert.equal(UpdateReviewDto.safeParse({ title: 'Updated review' }).success, true);
    assert.equal(UpdateReviewDto.safeParse({ status: 'APPROVED' }).success, false);
    assert.equal(UpdateReviewDto.safeParse({ author_id: 'another-user' }).success, false);
  });
});
