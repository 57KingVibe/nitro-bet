import test from 'node:test';
import assert from 'node:assert/strict';
import { isPooledUrl } from '../src/lib/db-url.js';

test('pooled Neon endpoints are recognised, direct ones are not', () => {
  assert.equal(isPooledUrl('postgresql://u:p@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'), true);
  assert.equal(isPooledUrl('postgresql://u:p@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require'), false);
  assert.equal(isPooledUrl('postgres://u:p@dpg-abc123-a.oregon-postgres.render.com/apexly'), false);
  assert.equal(isPooledUrl('postgres://user:pooler@localhost:5432/nitro'), false); // the word in a password does not count
  assert.equal(isPooledUrl('not a url'), false);
  assert.equal(isPooledUrl(undefined), false);
});
