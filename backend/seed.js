/**
 * Run this once to seed the initial admin user:
 * node seed.js
 */
const mongoose = require('mongoose');
const User = require('./models/User');
const Hotel = require('./models/Hotel');
require('dotenv').config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const adminExists = await User.findOne({ username: 'aayush' });
  if (!adminExists) {
    await User.create({
      name: 'Aayush',
      username: 'aayush',
      password: 'admin123',
      role: 'admin',
    });
    console.log('✅ Admin user created: aayush / admin123');
  } else {
    console.log('Admin user already exists');
  }

  const empExists = await User.findOne({ username: 'employee' });
  if (!empExists) {
    await User.create({
      name: 'Employee',
      username: 'employee',
      password: 'employee123',
      role: 'staff',
    });
    console.log('✅ Employee user created: employee / employee123');
  } else {
    console.log('Employee user already exists');
  }

  const takshilExists = await User.findOne({ username: 'takshil' });
  if (!takshilExists) {
    await User.create({
      name: 'Takshil Mehta',
      username: 'takshil',
      password: 'takshil123',
      role: 'admin',
    });
    console.log('✅ Admin user created: takshil / takshil123');
  } else {
    console.log('Takshil admin user already exists');
  }

  // Seed default hotels
  const admin = await User.findOne({ username: 'aayush' });
  const defaultHotels = [
    { name: 'Grand Plaza Hotel', city: 'New York' },
    { name: 'Ocean View Resort', city: 'Miami' },
    { name: 'Mountain Lodge', city: 'Denver' },
    { name: 'Downtown Suite', city: 'Austin' },
    { name: 'Beach Paradise', city: 'Cancun' },
  ];

  for (const hotel of defaultHotels) {
    const hotelExists = await Hotel.findOne({ name: hotel.name });
    if (!hotelExists) {
      await Hotel.create({
        ...hotel,
        createdBy: admin._id,
      });
      console.log(`✅ Hotel created: ${hotel.name}`);
    }
  }

  console.log('⚠️  Change the password after first login!');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
