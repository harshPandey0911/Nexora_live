const ServiceRequest = require('../../models/ServiceRequest');

/**
 * Get all service requests (Admin)
 * GET /api/admin/service-requests
 */
const getAllServiceRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const requests = await ServiceRequest.find(filter)
      .populate('vendorId', 'name businessName phone profilePhoto')
      .sort({ createdAt: -1 })
      .lean();

    const pending = await ServiceRequest.countDocuments({ status: 'pending' });

    res.status(200).json({ success: true, requests, pendingCount: pending });
  } catch (error) {
    console.error('getAllServiceRequests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service requests' });
  }
};

/**
 * Approve or reject a service request (Admin)
 * PATCH /api/admin/service-requests/:id/action
 * body: { action: 'approved' | 'rejected', adminNote?: string }
 */
const updateServiceRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approved or rejected' });
    }

    const request = await ServiceRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    request.status = action;
    request.adminNote = adminNote?.trim() || '';
    await request.save();

    res.status(200).json({
      success: true,
      message: `Request ${action} successfully`,
      data: request
    });
  } catch (error) {
    console.error('updateServiceRequestStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update service request' });
  }
};

module.exports = { getAllServiceRequests, updateServiceRequestStatus };
