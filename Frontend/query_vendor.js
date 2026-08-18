const mongoose = require('c:/Users/Ishaa/Desktop/CompanyProjects/Nexora_live/Backend/node_modules/mongoose');

const uri = 'mongodb://nexoragoofficial:nexoragoofficial@ac-hluikrs-shard-00-00.b3m8y7a.mongodb.net:27017,ac-hluikrs-shard-00-01.b3m8y7a.mongodb.net:27017,ac-hluikrs-shard-00-02.b3m8y7a.mongodb.net:27017/?ssl=true&replicaSet=atlas-dn8jh4-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const VendorSchema = new mongoose.Schema({
      name: String,
      businessName: String,
      level: Number,
      wallet: mongoose.Schema.Types.Mixed
    }, { collection: 'vendors' });

    const SettingsSchema = new mongoose.Schema({
      type: String,
      servicePayoutPercentage: Number,
      commissionRates: mongoose.Schema.Types.Mixed
    }, { collection: 'settings' });

    const Vendor = mongoose.model('Vendor', VendorSchema);
    const Settings = mongoose.model('Settings', SettingsSchema);

    const vendor = await Vendor.findById('6a66e52b9731d132b5de639c');
    console.log('\n--- VENDOR DETAILS ---');
    console.log(JSON.stringify(vendor, null, 2));

    const settings = await Settings.findOne({ type: 'global' });
    console.log('\n--- GLOBAL SETTINGS ---');
    console.log(JSON.stringify(settings, null, 2));

    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Connection failed:', err);
  });
