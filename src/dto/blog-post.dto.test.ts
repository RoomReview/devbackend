import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CreateBlogPostDto } from './blog-post.dto.ts';

describe('CreateBlogPostDto', () => {
  it('accepts a blog draft with optional excerpt', () => {
    assert.equal(
      CreateBlogPostDto.safeParse({
        title: 'Renting guide',
        content: 'Article content',
      }).success,
      true,
    );
  });

  it('rejects empty required fields and unexpected properties', () => {
    assert.equal(
      CreateBlogPostDto.safeParse({ title: ' ', content: 'Article content' })
        .success,
      false,
    );
    assert.equal(
      CreateBlogPostDto.safeParse({
        title: 'Renting guide',
        content: 'Article content',
        status: 'publish',
      }).success,
      false,
    );
  });
});
