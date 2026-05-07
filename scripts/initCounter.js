const mongoose = require('mongoose');
const { Counter } = require('../models/Counter');

const initCounter = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Initialize counter if not exists
    const counter = await Counter.findById('customerId');
    if (!counter) {
      const existingCustomers = await mongoose.model('Customer').countDocuments();
      await Counter.create({
        _id: 'customerId',
        seq: existingCustomers
      });
      console.log(`✅ Counter initialized with value: ${existingCustomers}`);
    } else {
      console.log(`✅ Counter already exists with value: ${counter.seq}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize counter:', error);
    process.exit(1);
  }
};

initCounter();