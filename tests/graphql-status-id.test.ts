import { describe, expect, it } from 'vitest';
import { extractStatusIdFromBody } from '../src/lib/feed/graphql-status-id';

describe('graphql status id extraction', () => {
  it('prefers tweet_id over generic rest_id', () => {
    const body = JSON.stringify({
      variables: { tweet_id: '1234567890123456789', rest_id: '999' },
    });
    expect(extractStatusIdFromBody(body)).toBe('1234567890123456789');
  });

  it('extracts tweetId camelCase', () => {
    const body = '{"tweetId":"9876543210987654321"}';
    expect(extractStatusIdFromBody(body)).toBe('9876543210987654321');
  });

  it('extracts from status URL in body', () => {
    const body = 'attachment_url=https://x.com/user/status/1112223334444';
    expect(extractStatusIdFromBody(body)).toBe('1112223334444');
  });
});
