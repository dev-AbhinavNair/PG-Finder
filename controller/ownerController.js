const path = require("path");
const fs = require('fs').promises;
const multer = require("multer");
const cloudinary = require('../config/cloudinary');

const User = require("../models/User");
const Pg = require("../models/Pg");
const Booking = require("../models/Booking");
const Message = require("../models/Message");

const toTitleCase = (str) => {
  if (!str) return str;
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/pgs';
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage });

const getDashboard = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);

    const q = (req.query.q || "").trim();
    const statusParam = (req.query.status || "").trim();

    const filter = { owner_id: req.user.userId };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { area: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
      ];
    }

    if (statusParam) {
      if (statusParam === "pending") {
        filter.status = "pending_approval";
      } else if (["published", "unpublished"].includes(statusParam)) {
        filter.status = statusParam;
      }
    }

    const rawPgs = await Pg.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const pgs = await Promise.all(rawPgs.map(async (pg) => {
      const bookingsCount = await Booking.countDocuments({ pg_id: pg._id });
      
      const Payment = require("../models/Payment");
      const payments = await Payment.find({ listing_id: pg._id, status: "success" }).lean();
      const totalRevenue = payments.reduce((sum, p) => sum + (p.owner_amount || 0), 0);
      
      return {
        ...pg,
        coverUrl: pg.cover_url || null,
        startingPrice: pg.min_price || pg.max_price || 0,
        tags: [pg.gender || null, pg.food_included ? "Food included" : null].filter(Boolean),
        bookingsCount,
        totalRevenue,
        viewsCount: 0
      };
    }));

    return res.render("owner/owner-dashboard", {
      owner,
      pgs,
      q,
      status: statusParam,
    });
  } catch (err) {
    console.error("Owner dashboard error:", err);
    return res.status(500).render("owner/owner-dashboard", {
      owner: null,
      pgs: [],
      q: req.query.q || "",
      status: req.query.status || "",
      error: "Failed to load owner dashboard",
    });
  }
};

const getAddPgForm = async (req, res) => {
  const owner = await User.findById(req.user.userId);
  return res.render("owner/add-pg", { owner, error: null, form: {} });
};

const createPg = async (req, res) => {
  try {
    const files = req.files || [];

    const photoUrls = await Promise.all(
      files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'findmypg/pgs',
          resource_type: 'image'
        });
        await fs.unlink(file.path);
        return result.secure_url;
      })
    );

    await Pg.create({
      owner_id: req.user.userId,
      name: toTitleCase(req.body.name),
      short_tagline: req.body.short_tagline,
      description: req.body.description,
      long_description: req.body.long_description,
      address_line: toTitleCase(req.body.address_line),
      area: toTitleCase(req.body.area),
      city: toTitleCase(req.body.city),
      state: toTitleCase(req.body.state),
      pincode: req.body.pincode,
      gender: req.body.gender,
      food_included: req.body.food_included === "on",
      amenities: (req.body.amenities || "").split(",").map((s) => s.trim()).filter(Boolean),
      house_rules: req.body.house_rules,
      min_price: Number(req.body.min_price || 0),
      max_price: Number(req.body.max_price || 0),
      cover_url: photoUrls[0] || null,
      gallery_urls: photoUrls,
      status: "pending_approval",
    });

    return res.redirect("/owner?success=PG created successfully and is pending approval");
  } catch (err) {
    console.error("Create PG error:", err);
    if (req.files) {
      req.files.forEach(f => fs.unlink(f.path).catch(() => { }));
    }
    const owner = await User.findById(req.user.userId);
    return res.redirect(`/owner/pg/new?error=Failed to create PG`);
  }
};

const getEditPgForm = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);
    const pg = await Pg.findOne({ _id: req.params.id, owner_id: req.user.userId }).lean();

    if (!pg) return res.status(404).render("errors/404", { message: "PG not found" });

    pg.coverUrl = pg.cover_url || null;

    return res.render("owner/edit-pg", { owner, pg, error: null });
  } catch (err) {
    console.error("Edit page error:", err);
    return res.status(500).render("errors/500", { message: "Failed to load edit page" });
  }
};

const getPgDetails = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);
    const pg = await Pg.findOne({ _id: req.params.id, owner_id: req.user.userId }).lean();

    if (!pg) return res.status(404).render("errors/404", { message: "PG not found" });

    const bookings = await Booking.find({ pg_id: pg._id })
      .populate('tenant_id', 'name avatar_url phone email')
      .sort({ createdAt: -1 })
      .lean();

    const Payment = require("../models/Payment");
    const payments = await Payment.find({ listing_id: pg._id, status: "success" })
      .populate('user_id', 'name avatar_url phone email')
      .sort({ createdAt: -1 })
      .lean();

    const totalBookings = bookings.length;
    const totalRevenue = payments.reduce((sum, p) => sum + (p.owner_amount || 0), 0);
    const completedBookings = bookings.filter(b => b.booking_status === 'completed').length;
    const activeBookings = bookings.filter(b => ['confirmed', 'checked_in'].includes(b.booking_status)).length;
    const pendingBookings = bookings.filter(b => b.booking_status === 'pending').length;

    const monthlyRevenue = {};
    const currentYear = new Date().getFullYear();
    payments.forEach(payment => {
      const paymentDate = new Date(payment.createdAt);
      const monthKey = `${paymentDate.getFullYear()}-${paymentDate.getMonth() + 1}`;
      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = 0;
      }
      monthlyRevenue[monthKey] += payment.owner_amount || 0;
    });

    const recentActivity = [];
    
    bookings.slice(0, 5).forEach(booking => {
      recentActivity.push({
        type: 'booking',
        id: booking._id,
        description: `New booking from ${booking.tenant_id?.name || booking.tenant_name}`,
        status: booking.booking_status,
        amount: booking.monthly_rent,
        date: booking.createdAt,
        icon: 'bi-calendar-check'
      });
    });

    payments.slice(0, 5).forEach(payment => {
      recentActivity.push({
        type: 'payment',
        id: payment._id,
        description: `Payment received from ${payment.user_id?.name}`,
        status: payment.status,
        amount: payment.owner_amount,
        date: payment.createdAt,
        icon: 'bi-credit-card'
      });
    });

    recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

    const bookingDetails = bookings.map(booking => ({
      _id: booking._id,
      tenantName: booking.tenant_id?.name || booking.tenant_name,
      tenantAvatar: booking.tenant_id?.avatar_url || booking.tenant_avatar,
      tenantPhone: booking.tenant_id?.phone || booking.tenant_contact,
      tenantEmail: booking.tenant_id?.email,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      monthlyRent: booking.monthly_rent,
      roomType: booking.room_type,
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      createdAt: booking.createdAt,
      notes: booking.tenant_notes || booking.owner_notes
    }));

    const paymentDetails = payments.map(payment => ({
      _id: payment._id,
      transactionId: payment.transaction_id,
      userName: payment.user_id?.name || 'Unknown',
      userAvatar: payment.user_id?.avatar_url,
      amount: payment.amount,
      ownerAmount: payment.owner_amount,
      platformFee: payment.platform_fee,
      commissionRate: payment.commission_rate,
      method: payment.method,
      status: payment.status,
      payoutStatus: payment.payout_status,
      createdAt: payment.createdAt
    }));

    const pgData = {
      ...pg,
      coverUrl: pg.cover_url,
      galleryUrls: pg.gallery_urls || [],
      amenities: pg.amenities || [],
      minPrice: pg.min_price,
      maxPrice: pg.max_price,
      foodIncluded: pg.food_included,
      addressLine: pg.address_line,
      pincode: pg.pincode,
      tags: [pg.gender, pg.food_included ? "Food included" : null].filter(Boolean),
      createdAtFormatted: new Date(pg.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      lastUpdatedFormatted: new Date(pg.updatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    };

    return res.render("owner/pg-details", {
      owner,
      pg: pgData,
      bookings: bookingDetails,
      payments: paymentDetails,
      stats: {
        totalBookings,
        totalRevenue,
        completedBookings,
        activeBookings,
        pendingBookings,
        averageRating: 0,
        occupancyRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0
      },
      monthlyRevenue,
      recentActivity: recentActivity.slice(0, 10)
    });
  } catch (err) {
    console.error("PG details error:", err);
    return res.status(500).render("errors/500", { message: "Failed to load PG details" });
  }
};

const updatePg = async (req, res) => {
  try {
    const existing = await Pg.findOne({ _id: req.params.id, owner_id: req.user.userId });
    if (!existing) return res.status(404).render("errors/404", { message: "PG not found" });

    let remove = req.body.removePhotos || [];
    if (!Array.isArray(remove)) remove = [remove];
    remove = remove.filter(Boolean);

    const oldGallery = Array.isArray(existing.gallery_urls) ? existing.gallery_urls : [];
    const keptGallery = oldGallery.filter((u) => !remove.includes(u));

    const files = req.files || [];
    const newUrls = await Promise.all(
      files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'findmypg/pgs',
          resource_type: 'image'
        });
        await fs.unlink(file.path);
        return result.secure_url;
      })
    );

    const nextGallery = [...keptGallery, ...newUrls];

    let nextCover = req.body.coverPhoto || existing.cover_url || null;
    if (nextCover && !nextGallery.includes(nextCover)) nextCover = nextGallery[0] || null;
    if (!nextCover) nextCover = nextGallery[0] || null;

    existing.name = toTitleCase(req.body.name);
    existing.short_tagline = req.body.short_tagline;
    existing.description = req.body.description;
    existing.long_description = req.body.long_description;
    existing.address_line = toTitleCase(req.body.address_line);
    existing.area = toTitleCase(req.body.area);
    existing.city = toTitleCase(req.body.city);
    existing.state = toTitleCase(req.body.state);
    existing.pincode = req.body.pincode;
    existing.gender = req.body.gender;
    existing.food_included = req.body.food_included === "on";
    existing.amenities = (req.body.amenities || "").split(",").map((s) => s.trim()).filter(Boolean);
    existing.house_rules = req.body.house_rules;
    existing.min_price = Number(req.body.min_price || 0);
    existing.max_price = Number(req.body.max_price || 0);
    existing.gallery_urls = nextGallery;
    existing.cover_url = nextCover;

    await existing.save();
    return res.redirect("/owner?success=PG updated successfully");
  } catch (err) {
    console.error("Edit save error:", err);
    if (req.files) {
      req.files.forEach(f => fs.unlink(f.path).catch(() => { }));
    }
    const owner = await User.findById(req.user.userId);
    const pg = await Pg.findOne({ _id: req.params.id, owner_id: req.user.userId }).lean();
    if (pg) pg.coverUrl = pg.cover_url || null;
    return res.redirect(`/owner/pg/${req.params.id}/edit?error=Failed to update PG`);
  }
};

const deletePg = async (req, res) => {
  try {
    const pg = await Pg.findOne({ _id: req.params.id, owner_id: req.user.userId });
    if (!pg) {
      return res.json({ success: false, error: "PG not found" });
    }
    if (Array.isArray(pg.gallery_urls)) {
      pg.gallery_urls.forEach(url => {
        const rel = url.startsWith("/") ? url.slice(1) : url;
        try {
          if (rel.startsWith("uploads/")) fs.unlinkSync(rel);
        } catch (_) { }
      });
    }

    await Pg.deleteOne({ _id: req.params.id });

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete PG error:", err);
    return res.json({ success: false, error: err.message });
  }
};

const getBookings = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);
    const q = (req.query.q || "").trim();
    const status = (req.query.status || "").trim();

    const filter = { owner_id: req.user.userId };

    if (q) {
      filter.$or = [
        { tenant_name: { $regex: q, $options: "i" } },
        { pg_name: { $regex: q, $options: "i" } },
      ];
    }

    if (status && ["pending", "confirmed", "checked-in", "completed", "cancelled"].includes(status)) {
      filter.booking_status = status === "checked-in" ? "checked_in" : status;
    }

    const rawBookings = await Booking.find(filter)
      .populate('tenant_id', 'name avatar_url phone')
      .sort({ createdAt: -1 })
      .lean();

    const bookings = rawBookings.map(b => ({
      ...b,
      tenant_name: b.tenant_id ? b.tenant_id.name : b.tenant_name,
      tenant_avatar: b.tenant_id ? b.tenant_id.avatar_url : b.tenant_avatar,
      tenant_contact: b.tenant_id ? b.tenant_id.phone : b.tenant_contact
    }));

    return res.render("owner/bookings", { owner, bookings, q, status });
  } catch (err) {
    console.error("Bookings page error:", err);
    return res.status(500).render("owner/bookings", { owner: null, bookings: [], q: "", status: "", error: err.message });
  }
};

const approveBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      owner_id: req.user.userId
    });

    if (!booking) {
      return res.redirect("/owner/bookings?error=Booking not found");
    }

    if (booking.booking_status !== 'pending') {
      return res.redirect("/owner/bookings?error=Can only approve pending bookings");
    }

    booking.booking_status = 'confirmed';
    await booking.save();

    console.log(`Booking ${booking._id} approved. Tenant: ${booking.tenant_id}`);

    res.redirect("/owner/bookings?success=Booking approved successfully");
  } catch (err) {
    console.error("Approve booking error:", err);
    res.redirect("/owner/bookings?error=Failed to approve booking");
  }
};

const rejectBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      owner_id: req.user.userId
    });

    if (!booking) {
      return res.redirect("/owner/bookings?error=Booking not found");
    }

    if (booking.booking_status !== 'pending') {
      return res.redirect("/owner/bookings?error=Can only reject pending bookings");
    }

    booking.booking_status = 'cancelled';
    await booking.save();

    console.log(`Booking ${booking._id} rejected. Tenant: ${booking.tenant_id}`);

    res.redirect("/owner/bookings?success=Booking rejected successfully");
  } catch (err) {
    console.error("Reject booking error:", err);
    res.redirect("/owner/bookings?error=Failed to reject booking");
  }
};

const checkInBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      owner_id: req.user.userId
    });

    if (!booking) {
      return res.redirect("/owner/bookings?error=Booking not found");
    }

    if (booking.booking_status !== 'confirmed') {
      return res.redirect("/owner/bookings?error=Can only check in confirmed bookings");
    }

    booking.booking_status = 'checked_in';
    await booking.save();

    res.redirect("/owner/bookings?success=Tenant checked in successfully");
  } catch (err) {
    console.error("Check-in error:", err);
    res.redirect("/owner/bookings?error=Failed to check in tenant");
  }
};

const checkOutBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      owner_id: req.user.userId
    });

    if (!booking) {
      return res.redirect("/owner/bookings?error=Booking not found");
    }

    if (booking.booking_status !== 'checked_in') {
      return res.redirect("/owner/bookings?error=Can only check out checked-in bookings");
    }

    booking.booking_status = 'completed';
    await booking.save();

    res.redirect("/owner/bookings?success=Tenant checked out successfully");
  } catch (err) {
    console.error("Check-out error:", err);
    res.redirect("/owner/bookings?error=Failed to check out tenant");
  }
};

const getMessages = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);

    const messages = await Message.find({ receiver_id: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();

    const conversationsMap = {};
    messages.forEach(msg => {
      if (!conversationsMap[msg.conversation_id]) {
        conversationsMap[msg.conversation_id] = {
          id: msg.conversation_id,
          name: msg.sender_name,
          avatar: msg.sender_avatar,
          lastMessage: msg.message,
          time: new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          messages: [],
        };
      }
      conversationsMap[msg.conversation_id].messages.push({
        text: msg.message,
        timestamp: msg.createdAt,
        isOwner: false,
      });
    });

    const conversations = Object.values(conversationsMap).slice(0, 20);

    return res.render("owner/messages", { owner, conversations, currentChat: conversations[0] || null, selectedIdx: 0 });
  } catch (err) {
    console.error("Messages page error:", err);
    return res.status(500).render("owner/messages", { owner: null, conversations: [], currentChat: null, error: err.message });
  }
};

const getPayouts = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);

    const paidBookings = await Booking.find({
      owner_id: req.user.userId,
      payment_status: 'completed'
    }).sort({ createdAt: -1 }).lean();

    const totalEarnedVal = paidBookings.reduce((sum, b) => sum + (b.monthly_rent || 0), 0);
    const totalEarned = totalEarnedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const pendingPayout = (0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const lastPayoutDate = paidBookings.length > 0
      ? new Date(paidBookings[0].createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'N/A';

    let avgMonthlyPayout = '0.00';
    if (paidBookings.length > 0) {
      const firstBooking = paidBookings[paidBookings.length - 1].createdAt;
      const monthsDiff = Math.max(1, (new Date() - new Date(firstBooking)) / (1000 * 60 * 60 * 24 * 30.44));
      avgMonthlyPayout = (totalEarnedVal / monthsDiff).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }

    const transactions = paidBookings.map(b => ({
      date: new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Processed',
      amount: (b.monthly_rent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      pgs: [{ name: b.pg_name, amount: (b.monthly_rent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }]
    }));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartLabels = [];
    const chartValues = [];

    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      chartLabels.push(monthNames[m]);

      const monthlySum = paidBookings
        .filter(b => {
          const bd = new Date(b.createdAt);
          return bd.getMonth() === m && bd.getFullYear() === y;
        })
        .reduce((sum, b) => sum + (b.monthly_rent || 0), 0);
      chartValues.push(monthlySum);
    }

    return res.render("owner/payouts", {
      owner,
      transactions,
      totalEarned,
      pendingPayout,
      lastPayoutDate,
      avgMonthlyPayout,
      chartLabels,
      chartValues
    });
  } catch (err) {
    console.error("Payouts page error:", err);
    return res.status(500).render("owner/payouts", {
      owner: null,
      transactions: [],
      totalEarned: '0.00',
      pendingPayout: '0.00',
      lastPayoutDate: 'N/A',
      avgMonthlyPayout: '0.00',
      chartLabels: [],
      chartValues: [],
      error: err.message
    });
  }
};

const requestPayout = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);

    if (!owner.bank_account_holder || !owner.bank_account_number) {
      return res.redirect("/owner/payouts?error=Please setup bank details in Payout Settings first");
    }

    return res.redirect("/owner/payouts?success=Payout request submitted successfully. You will receive payment within 2-3 business days.");
  } catch (err) {
    console.error("Request payout error:", err);
    return res.redirect("/owner/payouts?error=Failed to request payout");
  }
};

const getPayoutSettings = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);
    return res.render("owner/payout-settings", { owner });
  } catch (err) {
    console.error("Payout settings error:", err);
    return res.status(500).render("errors/500", { message: "Failed to load payout settings" });
  }
};

const updatePayoutSettings = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);

    owner.bank_account_holder = req.body.account_holder;
    owner.bank_account_number = req.body.account_number;
    owner.bank_ifsc_code = req.body.ifsc_code;
    owner.bank_name = req.body.bank_name;
    owner.upi_id = req.body.upi_id;

    await owner.save();

    return res.redirect("/owner/payouts/settings?success=Bank details updated successfully");
  } catch (err) {
    console.error("Save payout settings error:", err);
    return res.redirect("/owner/payouts/settings?error=Failed to update bank details");
  }
};

const getPayoutHistory = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);
    const Payout = require("../models/Payout");
    const Payment = require("../models/Payment");

    const status = (req.query.status || "").trim();
    const filter = { owner_id: req.user.userId };

    if (status && ["pending", "processing", "completed", "failed", "cancelled"].includes(status)) {
      filter.status = status;
    }

    const payouts = await Payout.find(filter)
      .populate('payment_id', 'amount transaction_id')
      .populate('processed_by', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const payoutsWithDetails = await Promise.all(payouts.map(async (payout) => {
      const payment = payout.payment_id;
      return {
        ...payout,
        paymentAmount: payment?.amount || 0,
        transactionId: payment?.transaction_id || 'N/A',
        pgName: payment?.listing_id?.name || 'Unknown PG',
        processedByName: payout.processed_by?.name || 'System',
        formattedDate: new Date(payout.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        formattedProcessedDate: payout.processed_at ? 
          new Date(payout.processed_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }) : 'N/A'
      };
    }));

    const stats = {
      totalPayouts: payoutsWithDetails.length,
      totalAmount: payoutsWithDetails.reduce((sum, p) => sum + p.amount, 0),
      completedPayouts: payoutsWithDetails.filter(p => p.status === 'completed').length,
      pendingPayouts: payoutsWithDetails.filter(p => p.status === 'pending').length
    };

    return res.render("owner/payout-history", {
      owner,
      payouts: payoutsWithDetails,
      stats,
      status
    });
  } catch (err) {
    console.error("Payout history error:", err);
    return res.status(500).render("owner/payout-history", {
      owner: null,
      payouts: [],
      stats: { totalPayouts: 0, totalAmount: 0, completedPayouts: 0, pendingPayouts: 0 },
      status: "",
      error: "Failed to load payout history"
    });
  }
};

const getSettings = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);

    return res.render("owner/settings", {
      owner
    });
  } catch (err) {
    console.error("Settings page error:", err);
    return res.status(500).render("owner/settings", {
      owner: null,
      error: err.message
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId);

    if (req.body.name) owner.name = req.body.name;
    if (req.body.email) owner.email = req.body.email;
    if (req.body.phone) owner.phone = req.body.phone;
    if (req.body.address) owner.address = req.body.address;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'findmypg/avatars',
        resource_type: 'image'
      });
      await fs.unlink(req.file.path);
      owner.avatar_url = result.secure_url;
    }

    await owner.save();
    return res.redirect("/owner/settings?success=Settings updated successfully");
  } catch (err) {
    console.error("Settings update error:", err);
    return res.redirect("/owner/settings?error=Failed to update settings");
  }
};

const getBookingAvailability = async (req, res) => {
  try {
    const { pgId } = req.params;

    const pg = await Pg.findOne({ _id: pgId, owner_id: req.user.userId });
    if (!pg) {
      return res.status(404).json({ success: false, error: "PG not found" });
    }

    const AvailabilityService = require("../services/availabilityService");
    const availabilityData = await AvailabilityService.getAvailabilityCalendar(pgId);

    res.json({ success: true, data: availabilityData });
  } catch (err) {
    console.error("Get availability error:", err);
    res.status(500).json({ success: false, error: "Failed to get availability data" });
  }
};

const updateBookingStatuses = async (req, res) => {
  try {
    const AvailabilityService = require("../services/availabilityService");
    const updatedCount = await AvailabilityService.updateBookingStatuses();

    res.json({
      success: true,
      message: `Successfully updated ${updatedCount} bookings to completed status`
    });
  } catch (err) {
    console.error("Manual update error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update booking statuses"
    });
  }
};

module.exports = {
  getDashboard,
  getAddPgForm,
  createPg,
  getEditPgForm,
  getPgDetails,
  updatePg,
  deletePg,
  getBookings,
  approveBooking,
  rejectBooking,
  checkInBooking,
  checkOutBooking,
  getMessages,
  getPayouts,
  getPayoutHistory,
  requestPayout,
  getPayoutSettings,
  updatePayoutSettings,
  getSettings,
  updateSettings,
  getBookingAvailability,
  updateBookingStatuses,
  upload
};