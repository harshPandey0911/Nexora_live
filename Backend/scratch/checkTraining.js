const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkTraining = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Training = require('../models/Training');
    
    // Find all training documents
    const trainings = await Training.find({});
    console.log('Total training docs:', trainings.length);
    
    if (trainings.length === 0) {
      console.log('No trainings found! Seeding a default active training doc...');
      
      const seed = await Training.create({
        title: 'Vendor Safety and Service Training',
        description: 'Learn the standard operating procedures and code of conduct.',
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Standard test video
        videoDuration: 10, // 10 seconds for quick testing
        minimumScore: 3,
        questions: [
          {
            questionText: 'What is the main priority of Nexora Go partners?',
            options: ['Customer safety and quality', 'Earning tips', 'Finishing quickly', 'None of the above'],
            correctOptionIndex: 0
          },
          {
            questionText: 'Should you share your login credentials with others?',
            options: ['Yes', 'No', 'Only with family', 'Only with co-workers'],
            correctOptionIndex: 1
          },
          {
            questionText: 'How should you behave with clients?',
            options: ['Rude', 'Polite and professional', 'Friendly and informal', 'Ignore them'],
            correctOptionIndex: 1
          },
          {
            questionText: 'What should you do if you are running late for a job?',
            options: ['Cancel without warning', 'Notify support and client immediately', 'Ignore it', 'None of the above'],
            correctOptionIndex: 1
          }
        ],
        isActive: true
      });
      console.log('Default training seeded successfully:', seed._id);
    } else {
      trainings.forEach(t => {
        console.log(`- ID: ${t._id}, Title: ${t.title}, Active: ${t.isActive}`);
      });
      
      // Make sure at least one is active
      const active = trainings.find(t => t.isActive);
      if (!active) {
        console.log('No training is active. Activating the first one...');
        trainings[0].isActive = true;
        await trainings[0].save();
        console.log('Activated training:', trainings[0]._id);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkTraining();
