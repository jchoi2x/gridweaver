import { dbMongodb } from './db-mongodb';

describe('dbMongodb', () => {
  it('should return db-mongodb', () => {
    expect(dbMongodb()).toEqual('db-mongodb');
  });
});
