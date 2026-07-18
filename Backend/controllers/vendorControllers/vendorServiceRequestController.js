const ServiceRequest = require('../../models/ServiceRequest');

/**
 * Create a new service request (Vendor)
 * POST /api/vendors/service-requests
 */
const createServiceRequest = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { categoryName, serviceName, suggestedPrice, description, requestType } = req.body;

    if (!categoryName || !serviceName || suggestedPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'categoryName, serviceName, and suggestedPrice are required'
      });
    }

    const request = await ServiceRequest.create({
      vendorId,
      categoryName: categoryName.trim(),
      serviceName: serviceName.trim(),
      suggestedPrice: Number(suggestedPrice),
      description: description?.trim() || '',
      requestType: requestType || 'SERVICE'
    });

    res.status(201).json({
      success: true,
      message: 'Service request submitted successfully. Admin will review it.',
      data: request
    });
  } catch (error) {
    console.error('createServiceRequest error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit service request' });
  }
};

/**
 * Get all service requests submitted by this vendor
 * GET /api/vendors/service-requests
 */
const getMyServiceRequests = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const requests = await ServiceRequest.find({ vendorId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error('getMyServiceRequests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service requests' });
  }
};

module.exports = { createServiceRequest, getMyServiceRequests };
