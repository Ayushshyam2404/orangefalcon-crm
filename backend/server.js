const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./app');

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5003, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5003}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
