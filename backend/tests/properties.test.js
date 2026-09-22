const request = require('supertest');
const app = require('../app');
const Hotel = require('../models/Hotel');
const { createAdminUser, authHeader } = require('./helpers');

describe('property de-duplication', () => {
  it('combines formatting variants of one property into a single card', async () => {
    const admin = await createAdminUser();
    await Hotel.create({ name: 'Falcon Hotel & Suites', city: 'Austin', category: 'sales', createdBy: admin._id });
    await Hotel.create({ name: '  Fálcon Hotel and Suites  ', city: 'Austin', category: 'reputation', createdBy: admin._id });

    const res = await request(app).get('/api/properties').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ hasSales: true, hasReputation: true });
  });

  it('opens the combined detail using the displayed property name', async () => {
    const admin = await createAdminUser();
    await Hotel.create({ name: 'Orange-Falcon Plaza', city: 'Miami', category: 'sales', createdBy: admin._id });
    await Hotel.create({ name: 'Orange Falcon Plaza', city: 'Miami', category: 'reputation', createdBy: admin._id });

    const res = await request(app).get('/api/properties/detail?name=Orange-Falcon%20Plaza').set(authHeader(admin._id));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasSales: true, hasReputation: true });
  });
});
