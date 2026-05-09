/**
 * Global Jest setup — starts an in-memory MongoDB before any test suite
 * and tears it down after all suites finish.
 * afterEach clears every collection so each test starts with a clean slate.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Ensure JWT_SECRET is always available in the test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-for-orange-falcon';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Wipe every collection after each test — guarantees test isolation
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});
