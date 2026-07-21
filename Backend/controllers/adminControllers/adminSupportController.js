const Ticket = require('../../models/Ticket');
const cloudinaryService = require('../../services/cloudinaryService');
const Vendor = require('../../models/Vendor');
const User = require('../../models/User');

/**
 * Get all tickets (with filters)
 */
const getAllTickets = async (req, res) => {
  try {
    const { status, role, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (role) query.creatorRole = role;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get tickets
    let tickets = await Ticket.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Populate creator details manually since we use dynamic refPath
    for (let ticket of tickets) {
      if (ticket.creatorRole === 'vendor') {
        const vendor = ticket.creatorId ? await Vendor.findById(ticket.creatorId).select('name businessName phone email').lean() : null;
        ticket.creator = vendor || { name: ticket.guestName || 'Vendor Request', email: ticket.guestEmail || '', phone: ticket.guestPhone || '' };
      } else if (ticket.creatorRole === 'user') {
        const user = ticket.creatorId ? await User.findById(ticket.creatorId).select('name phone email').lean() : null;
        ticket.creator = user || { name: ticket.guestName || 'User Request', email: ticket.guestEmail || '', phone: ticket.guestPhone || '' };
      }
    }

    const total = await Ticket.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
};

/**
 * Get ticket details
 */
const getTicketDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findById(id).lean();
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Populate creator
    if (ticket.creatorRole === 'vendor') {
      const vendor = ticket.creatorId ? await Vendor.findById(ticket.creatorId).select('name businessName phone email').lean() : null;
      ticket.creator = vendor || { name: ticket.guestName || 'Vendor Request', email: ticket.guestEmail || '', phone: ticket.guestPhone || '' };
    } else if (ticket.creatorRole === 'user') {
      const user = ticket.creatorId ? await User.findById(ticket.creatorId).select('name phone email').lean() : null;
      ticket.creator = user || { name: ticket.guestName || 'User Request', email: ticket.guestEmail || '', phone: ticket.guestPhone || '' };
    }

    res.status(200).json({
      success: true,
      ticket
    });
  } catch (error) {
    console.error('Get ticket details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket details' });
  }
};

/**
 * Reply to a ticket
 */
const replyToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachment, status } = req.body;
    const adminId = req.user.id;

    if (!message && !status) {
      return res.status(400).json({ success: false, message: 'Message or status update is required' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    let attachmentUrl = null;
    if (attachment && attachment.startsWith('data:')) {
      const uploadRes = await cloudinaryService.uploadFile(attachment, { folder: 'support/tickets' });
      if (uploadRes.success) {
        attachmentUrl = uploadRes.url;
      }
    }

    if (message) {
      ticket.messages.push({
        sender: 'admin',
        senderId: adminId,
        senderModel: 'Admin',
        message: message,
        attachment: attachmentUrl
      });
    }

    if (status) {
      ticket.status = status;
    } else if (message && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    ticket.updatedAt = new Date();
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      ticket
    });
  } catch (error) {
    console.error('Reply to ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket' });
  }
};

/**
 * Update ticket status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.status = status;
    ticket.updatedAt = new Date();
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket status updated',
      ticket
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

module.exports = {
  getAllTickets,
  getTicketDetails,
  replyToTicket,
  updateTicketStatus
};
