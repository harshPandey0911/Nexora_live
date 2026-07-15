const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  type: {
    type: String,
    default: 'global',
    unique: true
  },
  visitedCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  serviceGstPercentage: {
    type: Number,
    default: 18,
    min: 0,
    max: 100
  },
  partsGstPercentage: {
    type: Number,
    default: 18,
    min: 0,
    max: 100
  },
  servicePayoutPercentage: {
    type: Number,
    default: 90, // Vendor gets 90% of service base price
    min: 0,
    max: 100
  },
  partsPayoutPercentage: {
    type: Number,
    default: 100, // Vendor gets 100% of parts base price
    min: 0,
    max: 100
  },
  tdsPercentage: {
    type: Number,
    default: 1, // 1% default TDS u/s 194-O
    min: 0,
    max: 100
  },
  platformFeePercentage: {
    type: Number,
    default: 1, // 1% default platform fee
    min: 0,
    max: 100
  },
  commissionRates: {
    level1: { type: Number, default: 10 },
    level2: { type: Number, default: 15 },
    level3: { type: Number, default: 20 }
  },
  platformFeeRates: {
    level1: { type: Number, default: 0.5 },
    level2: { type: Number, default: 1.0 },
    level3: { type: Number, default: 2.0 }
  },
  vendorCashLimit: {
    type: Number,
    default: 10000,
    min: 0
  },
  cancellationPenalty: {
    type: Number,
    default: 49,
    min: 0
  },
  maxSearchTime: {
    type: Number,
    default: 5, // 5 minutes default
    min: 1
  },
  waveDuration: {
    type: Number,
    default: 60, // 60 seconds per wave default
    min: 10
  },
  searchRadius: {
    type: Number,
    default: 10, // 10 km default search radius
    min: 1
  },
  // Razorpay Settings
  razorpayKeyId: {
    type: String,
    default: null
  },
  razorpayKeySecret: {
    type: String,
    default: null
  },
  razorpayWebhookSecret: {
    type: String,
    default: null
  },
  // Cloudinary Settings
  cloudinaryCloudName: {
    type: String,
    default: null
  },
  cloudinaryApiKey: {
    type: String,
    default: null
  },
  cloudinaryApiSecret: {
    type: String,
    default: null
  },
  // Future extensible fields
  currency: {
    type: String,
    default: 'INR'
  },

  // Billing & Invoice Configuration
  companyName: {
    type: String,
    default: 'TodayMyDream'
  },
  companyGSTIN: {
    type: String,
    default: ''
  },
  companyPAN: {
    type: String,
    default: ''
  },
  companyAddress: {
    type: String,
    default: ''
  },
  companyCity: {
    type: String,
    default: ''
  },
  companyState: {
    type: String,
    default: ''
  },
  companyPincode: {
    type: String,
    default: ''
  },
  companyPhone: {
    type: String,
    default: ''
  },
  companyEmail: {
    type: String,
    default: ''
  },

  // Invoice Settings
  invoicePrefix: {
    type: String,
    default: 'INV'
  },
  sacCode: {
    type: String,
    default: '998599'  // Event services SAC code
  },
  currentInvoiceNumber: {
    type: Number,
    default: 0
  },

  // Support Settings
  supportEmail: {
    type: String,
    default: ''
  },
  supportPhone: {
    type: String,
    default: ''
  },
  supportWhatsapp: {
    type: String,
    default: ''
  },
  isOnlinePaymentEnabled: {
    type: Boolean,
    default: true
  },
  termsAndConditions: {
    title: { type: String, default: 'Nexora Go Terms of Service' },
    lastUpdated: { type: String, default: 'July 15, 2026' },
    introduction: { type: String, default: 'Please read these Terms & Conditions carefully before using our website or mobile application. By accessing or using Nexora Go (Homestr), you agree to be bound by these terms.' },
    sections: {
      type: [
        {
          title: { type: String },
          content: { type: String },
          iconType: { type: String }
        }
      ],
      default: [
        {
          title: "1. User Account & Eligibility",
          content: "To use Nexora Go (Homestr) services, you must register for an account and provide accurate, current information. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years of age to create an account.",
          iconType: "user"
        },
        {
          title: "2. Service Bookings & Partner Platform",
          content: "Nexora Go operates as an intermediary platform connecting users with independent service professionals. While we run background checks and maintain quality control protocols, services are executed by third-party professionals. Users agree to provide a safe and respectful working environment for our service partners.",
          iconType: "shield"
        },
        {
          title: "3. Payments, Cancellations & Refunds",
          content: "All payments must be made online through the platform's integrated payment systems. Cancellation of booked services is subject to our Cancellation Policy. Penalties may apply if bookings are cancelled after a professional has been assigned or has started traveling to your location.",
          iconType: "payment"
        },
        {
          title: "4. Limitations of Liability",
          content: "Nexora Go is not liable for indirect, incidental, special, exemplary, or consequential damages, including lost profits, lost data, personal injury, or property damage related to or resulting from any use of the services. Maximum liability is capped at the amount paid by the user for the specific service booking.",
          iconType: "alert"
        },
        {
          title: "5. Modifications of Terms",
          content: "We reserve the right to modify these Terms and Conditions at any time. Updated terms will be posted on the platform, and your continued use of Nexora Go services constitutes acceptance of the amended terms. We recommend reviewing these terms periodically.",
          iconType: "file"
        }
      ]
    }
  },
  privacyPolicy: {
    title: { type: String, default: 'Nexora Go Privacy Policy' },
    lastUpdated: { type: String, default: 'July 15, 2026' },
    introduction: { type: String, default: 'Your privacy is highly important to us. This Privacy Policy details the types of personal information we collect, how we use it, and the safeguards in place to protect your data.' },
    sections: {
      type: [
        {
          title: { type: String },
          content: { type: String },
          iconType: { type: String }
        }
      ],
      default: [
        {
          title: "1. Information We Collect",
          content: "We collect information you provide directly to us when creating an account, updating your profile, or booking a service. This includes your name, phone number, email address, and service address details.",
          iconType: "lock"
        },
        {
          title: "2. Location and Tracking Data",
          content: "To facilitate real-time tracking of service professionals and ensure accurate logistics, Nexora Go collects precise location data from your device. This location tracking is used solely to coordinate active service bookings.",
          iconType: "map"
        },
        {
          title: "3. How We Use Your Data",
          content: "Your data is used to process bookings, verify partner identities, facilitate communication between you and the assigned service professional, send promotional alerts (if opted in), and enhance application performance and security.",
          iconType: "eye"
        },
        {
          title: "4. Information Sharing & Disclosure",
          content: "We do not sell your personal data. We share necessary details (such as name, phone number, and address) with the assigned service professional to carry out the service. We may disclose data when legally required by public authorities.",
          iconType: "share"
        },
        {
          title: "5. Push Notifications & Security",
          content: "We use FCM notifications to keep you updated on your booking status. We implement robust administrative, technical, and physical security measures to protect your personal information against unauthorized access, loss, or alteration.",
          iconType: "bell"
        }
      ]
    }
  },
  workerTermsAndConditions: {
    title: { type: String, default: 'Nexora Go Worker Terms of Service' },
    lastUpdated: { type: String, default: 'July 15, 2026' },
    introduction: { type: String, default: 'Please read these Terms & Conditions carefully before joining our platform as a service professional.' },
    sections: {
      type: [
        {
          title: { type: String },
          content: { type: String },
          iconType: { type: String }
        }
      ],
      default: [
        {
          title: "1. Worker Obligations",
          content: "As an independent service professional, you agree to maintain high standards of service, punctuality, and professionalism.",
          iconType: "user"
        }
      ]
    }
  },
  workerPrivacyPolicy: {
    title: { type: String, default: 'Nexora Go Worker Privacy Policy' },
    lastUpdated: { type: String, default: 'July 15, 2026' },
    introduction: { type: String, default: 'This Privacy Policy details how we handle the personal information of our service professionals.' },
    sections: {
      type: [
        {
          title: { type: String },
          content: { type: String },
          iconType: { type: String }
        }
      ],
      default: [
        {
          title: "1. Data Collection for Professionals",
          content: "We collect information necessary to verify your identity, background, and facilitate service bookings.",
          iconType: "lock"
        }
      ]
    }
  },
  vendorTermsAndConditions: {
    title: { type: String, default: 'Nexora Go Vendor Terms of Service' },
    lastUpdated: { type: String, default: 'July 15, 2026' },
    introduction: { type: String, default: 'Please read these Terms & Conditions carefully before registering as a Vendor/Agency on our platform.' },
    sections: {
      type: [
        {
          title: { type: String },
          content: { type: String },
          iconType: { type: String }
        }
      ],
      default: [
        {
          title: "1. Agency Responsibilities",
          content: "Agencies are responsible for the vetting, management, and performance of the workers operating under their vendor account.",
          iconType: "shield"
        }
      ]
    }
  },
  vendorPrivacyPolicy: {
    title: { type: String, default: 'Nexora Go Vendor Privacy Policy' },
    lastUpdated: { type: String, default: 'July 15, 2026' },
    introduction: { type: String, default: 'This Privacy Policy explains how we collect and process data for Vendor/Agency accounts.' },
    sections: {
      type: [
        {
          title: { type: String },
          content: { type: String },
          iconType: { type: String }
        }
      ],
      default: [
        {
          title: "1. Business Data Processing",
          content: "We process business registration details and payout information to facilitate secure transactions and compliance.",
          iconType: "payment"
        }
      ]
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
