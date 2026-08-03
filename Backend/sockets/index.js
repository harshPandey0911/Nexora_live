// Socket.io initialization
const { Server } = require('socket.io');
const { authenticateSocket } = require('../middleware/authMiddleware');

let io = null;

const initializeSocket = (server) => {
  const envOrigins = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) 
    : [];

  io = new Server(server, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: [
        ...envOrigins, 
        'http://localhost:5173', 
        'http://localhost:5174', 
        'http://127.0.0.1:5173', 
        'http://127.0.0.1:5174'
      ].filter(Boolean),
      credentials: true,
      methods: ["GET", "POST"]
    },
    transports: ['polling', 'websocket']
  });

  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token using the same method as HTTP middleware
      const { verifyAccessToken } = require('../utils/tokenService');
      const decoded = verifyAccessToken(token);

      socket.userId = decoded.userId;
      socket.userRole = (decoded.role || '').toUpperCase();

      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

    const role = (socket.userRole || '').toUpperCase();

    // Join user-specific room for notifications
    if (role === 'USER') {
      socket.join(`user_${socket.userId.toString()}`);
    } else if (role === 'VENDOR') {
      socket.join(`vendor_${socket.userId.toString()}`);
      // Register socketId without overriding manual isOnline toggle
      updateVendorSocketInfo(socket.userId, socket.id);
    } else if (role === 'WORKER') {
      socket.join(`worker_${socket.userId.toString()}`);
      // Register socketId without overriding manual isOnline toggle
      updateWorkerSocketInfo(socket.userId, socket.id);
    } else if (role === 'ADMIN') {
      socket.join(`admin_${socket.userId.toString()}`);
      socket.join('admin_room');
    }

    // Explicit Room Join Events (Fallback/Frontend Initiated)
    socket.on('join_vendor_room', (vendorId) => {
      // Security check: ensure the socket user actually IS this vendor
      if (socket.userRole === 'VENDOR' && socket.userId.toString() === vendorId.toString()) {
        socket.join(`vendor_${vendorId.toString()}`);
        console.log(`Socket ${socket.id} explicitly joined room vendor_${vendorId}`);
      }
    });

    socket.on('join_user_room', (userId) => {
      // Ensure strings for comparison
      if (socket.userRole === 'USER' && socket.userId.toString() === userId.toString()) {
        socket.join(`user_${userId.toString()}`);
        console.log(`Socket ${socket.id} explicitly joined room user_${userId}`);
      }
    });

    socket.on('join_worker_room', (workerId) => {
      if (socket.userRole === 'WORKER' && socket.userId === workerId) {
        socket.join(`worker_${workerId}`);
        console.log(`Socket ${socket.id} explicitly joined room worker_${workerId}`);
      }
    });

    // Live Tracking Events
    socket.on('join_tracking', async (bookingId) => {
      socket.join(`booking_${bookingId}`);
      console.log(`User ${socket.userId} joined tracking for booking_${bookingId}`);

      // Disconnect Recovery: Send last known location from Redis
      try {
        const { getLiveLocation } = require('../services/redisService');
        const cachedLocation = await getLiveLocation(bookingId);
        if (cachedLocation) {
          socket.emit('live_location_update', cachedLocation);
          console.log(`[Socket] Sent cached location to user for booking ${bookingId}`);
        }
      } catch (error) {
        console.error('[Socket] Error fetching cached location:', error);
      }
    });

    // Vendor acknowledges receiving booking alert
    socket.on('booking_alert_received', async (data) => {
      try {
        const BookingRequest = require('../models/BookingRequest');
        await BookingRequest.findOneAndUpdate(
          { bookingId: data.bookingId, vendorId: socket.userId },
          { status: 'VIEWED', viewedAt: new Date(), socketDelivered: true }
        );
        console.log(`[Socket] Vendor ${socket.userId} viewed booking ${data.bookingId}`);
      } catch (error) {
        console.error('[Socket] Error updating booking request:', error);
      }
    });

    // Worker/Vendor sets availability
    socket.on('set_availability', async (data) => {
      try {
        const Vendor = require('../models/Vendor');
        const Worker = require('../models/Worker');

        if (socket.userRole === 'VENDOR') {
          await Vendor.findByIdAndUpdate(socket.userId, {
            availability: data.status // 'AVAILABLE', 'BUSY', etc.
          });
        } else if (socket.userRole === 'WORKER') {
          await Worker.findByIdAndUpdate(socket.userId, {
            status: data.status // 'ONLINE', 'BUSY', etc.
          });
        }
        console.log(`[Socket] ${socket.userRole} ${socket.userId} set availability to ${data.status}`);
      } catch (error) {
        console.error('[Socket] Error setting availability:', error);
      }
    });

    // Rate limiting map for location updates
    const locationUpdateTimestamps = new Map();

    socket.on('update_location', async (data) => {
      // data: { bookingId, lat, lng, heading }
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      const heading = parseFloat(data.heading) || 0;

      if (isNaN(lat) || isNaN(lng)) return;

      // Rate limiting: max 1 update per 2 seconds per booking
      const rateLimitKey = `${socket.userId}:${data.bookingId}`;
      const lastUpdate = locationUpdateTimestamps.get(rateLimitKey) || 0;
      const now = Date.now();
      if (now - lastUpdate < 2000) {
        return; // Skip this update, too frequent
      }
      locationUpdateTimestamps.set(rateLimitKey, now);

      const locationPayload = {
        lat,
        lng,
        heading,
        role: socket.userRole
      };

      // DEBUG: Log the broadcast
      console.log(`[Socket] 📍 Broadcasting location to booking_${data.bookingId}:`, { lat: lat.toFixed(6), lng: lng.toFixed(6), heading });

      // 1. Broadcast to everyone in the booking room (User is listening)
      socket.to(`booking_${data.bookingId}`).emit('live_location_update', locationPayload);

      // 2. Cache in Redis with TTL for disconnect recovery
      try {
        const { setLiveLocation, setVendorLocation } = require('../services/redisService');
        await setLiveLocation(data.bookingId, locationPayload, 30); // 30 second TTL

        // Also update vendor geo cache
        if (socket.userRole === 'VENDOR') {
          await setVendorLocation(socket.userId, lat, lng);
        }
      } catch (error) {
        console.error('[Socket] Error caching live location:', error);
      }

      // 3. Save latest location to Database (for initial tracking load)
      try {
        const Vendor = require('../models/Vendor');
        const Worker = require('../models/Worker');

        const updateData = {
          location: {
            lat,
            lng,
            heading,
            updatedAt: new Date()
          },
          geoLocation: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        };

        if (socket.userRole === 'VENDOR') {
          await Vendor.findByIdAndUpdate(socket.userId, updateData);
        } else if (socket.userRole === 'WORKER') {
          await Worker.findByIdAndUpdate(socket.userId, updateData);
        }
      } catch (error) {
        console.error('Error saving live location:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Do not alter manual isOnline toggle status on disconnect
    });
  });

  console.log('Socket.io initialized successfully');
};

// Helper function to update vendor socket info without touching manual isOnline status
const updateVendorSocketInfo = async (vendorId, socketId) => {
  try {
    const Vendor = require('../models/Vendor');
    await Vendor.findByIdAndUpdate(vendorId, { currentSocketId: socketId });
    console.log(`[Socket] Vendor ${vendorId} socket updated: ${socketId}`);
  } catch (error) {
    console.error('[Socket] Error updating vendor socket info:', error);
  }
};

// Helper function to update worker socket info without touching manual isOnline status
const updateWorkerSocketInfo = async (workerId, socketId) => {
  try {
    const Worker = require('../models/Worker');
    await Worker.findByIdAndUpdate(workerId, { currentSocketId: socketId });
    console.log(`[Socket] Worker ${workerId} socket updated: ${socketId}`);
  } catch (error) {
    console.error('[Socket] Error updating worker socket info:', error);
  }
};

// Get io instance for emitting notifications
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };

