import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CreateBlogPostDto,
  UploadBlogFeaturedImageDto,
} from './blog-post.dto.ts';

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

  it('accepts a custom author and rejects a blank author', () => {
    const basePost = {
      title: 'Renting guide',
      content: 'Article content',
    };
    assert.equal(
      CreateBlogPostDto.safeParse({ ...basePost, author: 'Jordan Smith' })
        .success,
      true,
    );
    assert.equal(
      CreateBlogPostDto.safeParse({ ...basePost, author: ' ' }).success,
      false,
    );
  });

  it('accepts article content longer than the former six-million-character limit', () => {
    assert.equal(
      CreateBlogPostDto.safeParse({
        title: 'Long article',
        content: 'a'.repeat(6_000_001),
      }).success,
      true,
    );
  });

  it('accepts a stored featured-image path and rejects arbitrary image URLs', () => {
    const basePost = {
      title: 'Featured image article',
      content: 'Article content',
    };
    assert.equal(
      CreateBlogPostDto.safeParse({
        ...basePost,
        featuredImage:
          '/api/v1/blog/posts/featured-images/fc3d08b4-6924-4a46-8115-c42e53b7f946.webp',
      }).success,
      true,
    );
    assert.equal(
      CreateBlogPostDto.safeParse({
        ...basePost,
        featuredImage: 'https://example.com/image.jpg',
      }).success,
      false,
    );
  });

  it('validates uploaded featured image content types and base64 payloads', () => {
    assert.equal(
      UploadBlogFeaturedImageDto.safeParse({
        contentType: 'image/webp',
        imageBase64: 'UklGRiIAAABXRUJQVlA4',
      }).success,
      true,
    );
    assert.equal(
      UploadBlogFeaturedImageDto.safeParse({
        contentType: 'image/svg+xml',
        imageBase64: 'PHN2Zy8+',
      }).success,
      false,
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
