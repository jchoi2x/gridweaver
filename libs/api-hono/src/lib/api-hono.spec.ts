import { apiHono } from './api-hono';

describe('apiHono', () => {
  it('should return api-hono', () => {
    expect(apiHono()).toEqual('api-hono');
  });
});
