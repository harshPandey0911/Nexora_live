const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const fixTrainingScore = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Training = require('../models/Training');
    
    // Find the active training
    const training = await Training.findOne({ isActive: true });
    
    if (training) {
      console.log(`Current Training: ${training.title}`);
      console.log(`Questions Count: ${training.questions.length}`);
      console.log(`Current Minimum Score: ${training.minimumScore}`);
      
      if (training.minimumScore > training.questions.length) {
        console.log(`Fixing minimumScore... Setting it to ${training.questions.length}`);
        training.minimumScore = training.questions.length; // Max score possible
        await training.save();
        console.log('Update successful!');
      } else {
        console.log('Minimum score is already valid relative to questions count.');
      }
    } else {
      console.log('No active training found to update.');
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

fixTrainingScore();
