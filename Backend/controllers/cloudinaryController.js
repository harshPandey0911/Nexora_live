const cloudinary = require('../config/cloudinary');
const Settings = require('../models/Settings');

/**
 * Cloudinary Controller
 * Handles server-side logic for Cloudinary interactions
 */

/**
 * Generate a signed upload signature for direct frontend uploads
 * This offloads the file transfer from our server to Cloudinary directly.
 */
exports.getSignature = async (req, res) => {
  try {
    const { folder = 'appzeto' } = req.query;
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Fetch dynamic settings from database if available
    const settings = await Settings.findOne({ type: 'global' }).lean();
    
    const cloudName = settings?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = settings?.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY;
    const apiSecret = settings?.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(400).json({
        success: false,
        message: 'Cloudinary credentials are not configured.'
      });
    }

    // Params to be signed
    const paramsToSign = {
      timestamp,
      folder
    };

    // Generate signature using API Secret
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret
    );

    res.status(200).json({
      success: true,
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder
    });
  } catch (error) {
    console.error('Cloudinary signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
      error: error.message
    });
  }
};
