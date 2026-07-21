const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['vendor', 'admin', 'user', 'worker'],
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel',
    required: false
  },
  senderModel: {
    type: String,
    enum: ['Vendor', 'Admin', 'User', 'Worker'],
    required: false
  },
  message: {
    type: String,
    required: true
  },
  attachment: {
    type: String, // URL to cloudinary
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true
  },
  creatorRole: {
    type: String,
    enum: ['vendor', 'user', 'worker'],
    required: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'creatorModel',
    required: false
  },
  creatorModel: {
    type: String,
    enum: ['Vendor', 'User', 'Worker'],
    required: false
  },
  guestName: { type: String, default: null },
  guestEmail: { type: String, default: null },
  guestPhone: { type: String, default: null },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['general', 'payout', 'booking', 'account', 'technical', 'other'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'],
    default: 'open'
  },
  messages: [messageSchema],
  relatedBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  }
}, {
  timestamps: true
});

// Generate ticket number before saving
ticketSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const random = Math.floor(1000 + Math.random() * 9000);
    const prefix = this.creatorRole === 'vendor' ? 'V' : this.creatorRole === 'worker' ? 'W' : 'U';
    this.ticketNumber = `TKT-${prefix}-${dateStr}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
