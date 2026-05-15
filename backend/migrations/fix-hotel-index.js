/**
 * One-time migration: replace the old unique-name index on hotels
 * with a compound name+category index.
 *
 * Run once from the backend/ directory:
 *   node migrations/fix-hotel-index.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.collection('hotels');

  // List existing indexes so we can report what we're changing
  const before = await collection.indexes();
  console.log('Indexes before:', before.map((i) => i.name));

  // Drop the old single-field unique index if it exists
  try {
    await collection.dropIndex('name_1');
    console.log('✅ Dropped old index: name_1');
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log('ℹ️  Old index name_1 not found — already removed or never existed');
    } else {
      throw err;
    }
  }

  // Load the Hotel model so Mongoose creates the new compound index
  require('../models/Hotel');
  await mongoose.connection.syncIndexes();

  const after = await collection.indexes();
  console.log('Indexes after:', after.map((i) => i.name));
  console.log('✅ Migration complete');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
