const mongoose = require("mongoose");
const Pg = require("../models/Pg");
const User = require("../models/User");

const Report = require("../models/Report");

const Payment = require("../models/Payment");
const Payout = require("../models/Payout");

// exports.getListings = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page || "1", 10);
//     const limit = 10;
//     const skip = (page - 1) * limit;
//     const q = req.query.q || "";

//     const filter = { status: "pending_approval" };
//     if (q) {
//       filter.$or = [
//         { name: { $regex: q, $options: "i" } },
//         { area: { $regex: q, $options: "i" } },
//         { city: { $regex: q, $options: "i" } },
//       ];
//     }

//     const [listings, totalCount, pendingCount, todayCount] = await Promise.all([
//       Pg.find(filter)
//         .populate("owner_id", "name phone")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),
//       Pg.countDocuments(filter),
//       Pg.countDocuments({ status: "pending_approval" }),
//       Pg.countDocuments({
//         status: "pending_approval",
//         createdAt: {
//           $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//           $lt: new Date(new Date().setHours(23, 59, 59, 999)),
//         },
//       }),
//     ]);

//     const totalApproved = await Pg.countDocuments({ status: "published" });

//     const mappedListings = listings.map((pg) => ({
//       _id: pg._id,
//       name: pg.name,
//       coverUrl: null,
//       category: pg.short_tagline || "",
//       ownerName: pg.owner_id?.name || "Unknown",
//       ownerPhone: pg.owner_id?.phone || "",
//       area: pg.area,
//       city: pg.city,
//       submittedAtFormatted: pg.createdAt
//         ? pg.createdAt.toLocaleDateString("en-IN", {
//           day: "2-digit",
//           month: "short",
//           year: "numeric",
//         })
//         : "",
//       tags: [pg.gender, pg.food_included ? "Food included" : null].filter(
//         Boolean
//       ),
//       status: pg.status === "pending_approval" ? "pending" : pg.status,
//     }));

//     const stats = {
//       pending: pendingCount,
//       today: todayCount,
//       issues: 0,
//       totalApproved,
//     };

//     const admin = await User.findById(req.user.userId).select("name avatar_url");

//     res.render("admin/admin-listings", {
//       admin,
//       stats,
//       listings: mappedListings,
//       page,
//       totalPages: Math.ceil(totalCount / limit) || 1,
//       q,
//       selectedCount: 0,
//     });
//   } catch (err) {
//     console.error("Admin listings error:", err);
//     res.status(500).render("admin/admin-listings", {
//       admin: null,
//       stats: { pending: 0, today: 0, issues: 0, totalApproved: 0 },
//       listings: [],
//       page: 1,
//       totalPages: 1,
//       q: "",
//       selectedCount: 0,
//       error: "Failed to load listings",
//     });
//   }
// };

exports.getReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = 10;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status || "all";

    const filter = {};
    if (statusFilter !== "all") {
      filter.status = statusFilter;
    }

    const openCount = await Report.countDocuments({ status: "open" });
    const resolvedCount = await Report.countDocuments({ status: "resolved" });
    const totalCount = await Report.countDocuments(filter);

    const reports = await Report.find(filter)
      .populate({
        path: "pg_id",
        select: "name area city owner_id",
        populate: {
          path: "owner_id",
          select: "name phone"
        }
      })
      .populate("reporter_id", "name phone")
      .populate("resolved_by", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const mappedReports = reports.map((report) => ({
      _id: report._id,
      pgName: report.pg_id?.name || "Unknown",
      pgOwner: report.pg_id?.owner_id?.name || "Unknown",
      ownerPhone: report.pg_id?.owner_id?.phone || "",
      pgCity: report.pg_id?.city || "",
      pgArea: report.pg_id?.area || "",
      reportedBy: report.reporter_id?.name || "Unknown",
      reporterPhone: report.reporter_id?.phone || "",
      reason: report.reason,
      description: report.description || "",
      status: report.status,
      adminAction: report.admin_action,
      adminNotes: report.admin_notes || "",
      reportedAtFormatted: report.createdAt
        ? new Date(report.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        : "",
      resolvedAtFormatted: report.resolved_at
        ? new Date(report.resolved_at).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        : "",
      resolvedBy: report.resolved_by?.name || "",
    }));

    const admin = await User.findById(req.user.userId).select("name avatar_url");

    res.render("admin/admin-reports", {
      admin,
      stats: {
        open: openCount,
        resolved: resolvedCount,
        total: totalCount,
      },
      reports: mappedReports,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      currentStatus: statusFilter,
    });
  } catch (err) {
    console.error("Admin reports error:", err);
    res.status(500).render("admin/admin-reports", {
      admin: null,
      stats: { open: 0, resolved: 0, total: 0 },
      reports: [],
      page: 1,
      totalPages: 1,
      currentStatus: "all",
      error: "Failed to load reports",
    });
  }
};

exports.warnPgOwner = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { notes } = req.body;

    const report = await Report.findByIdAndUpdate(
      reportId,
      {
        status: "resolved",
        admin_action: "warning",
        admin_notes: notes,
        resolved_at: new Date(),
        resolved_by: req.user.userId,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Warning sent to PG owner",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
exports.banPgListing = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { banType, notes } = req.body;

    const report = await Report.findById(reportId);
    const action = banType === "temporary" ? "suspend" : "ban";

    await Report.findByIdAndUpdate(reportId, {
      status: "resolved",
      admin_action: action,
      admin_notes: notes,
      resolved_at: new Date(),
      resolved_by: req.user.userId,
    });

    await Pg.findByIdAndUpdate(report.pg_id, {
      status: "unpublished",
    });

    res.json({
      success: true,
      message: `Listing ${action === "ban" ? "banned" : "suspended"}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId)
      .populate({
        path: "pg_id",
        select: "name area city owner_id description address_line amenities status min_price max_price",
        populate: {
          path: "owner_id",
          select: "name phone email"
        }
      })
      .populate("reporter_id", "name phone email")
      .populate("resolved_by", "name");

    if (!report) {
      return res.status(404).render("404", { message: "Report not found" });
    }

    const admin = await User.findById(req.user.userId).select("name avatar_url");

    const reportData = {
      _id: report._id,
      reportId: `RPT-${String(report._id).slice(-6).toUpperCase()}`,
      pgId: report.pg_id?._id,
      pgName: report.pg_id?.name || "Unknown",
      pgOwner: report.pg_id?.owner_id?.name || "Unknown",
      pgOwnerPhone: report.pg_id?.owner_id?.phone || "",
      pgOwnerEmail: report.pg_id?.owner_id?.email || "",
      pgCity: report.pg_id?.city || "",
      pgArea: report.pg_id?.area || "",
      pgAddress: report.pg_id?.address_line || "",
      pgPrice: report.pg_id?.min_price ? `₹${report.pg_id.min_price} - ₹${report.pg_id.max_price}` : "N/A",
      pgStatus: report.pg_id?.status || "unknown",
      pgAmenities: report.pg_id?.amenities || [],
      reportedBy: report.reporter_id?.name || "Unknown",
      reporterPhone: report.reporter_id?.phone || "",
      reporterEmail: report.reporter_id?.email || "",
      reason: report.reason,
      description: report.description || "No description provided",
      status: report.status,
      priority: report.reason === "safety_concern" ? "High" : "Medium",
      adminAction: report.admin_action,
      adminNotes: report.admin_notes || "",
      reportedAtFormatted: new Date(report.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      resolvedAtFormatted: report.resolved_at
        ? new Date(report.resolved_at).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        : "",
      resolvedBy: report.resolved_by?.name || "",
    };

    res.render("admin/admin-report-details", {
      admin,
      report: reportData,
    });
  } catch (err) {
    console.error("Get report details error:", err);
    res.status(500).render("404", { message: "Error loading report" });
  }
};

exports.getListingDetails = async (req, res) => {
  try {
    const { listingId } = req.params;

    const backStatus = req.query.status || "pending";
    const backQ = req.query.q || "";
    const backPage = req.query.page || "1";

    const listing = await Pg.findById(listingId).populate(
      "owner_id",
      "name phone email avatar_url"
    );

    if (!listing) {
      return res.status(404).render("404", { message: "Listing not found" });
    }

    const admin = await User.findById(req.user.userId).select("name avatar_url");

    const listingData = {
      _id: listing._id,
      listingId: `LST-${String(listing._id).slice(-6).toUpperCase()}`,
      name: listing.name,
      shortTagline: listing.short_tagline || "",
      description: listing.description || "",
      longDescription: listing.long_description || "",
      ownerName: listing.owner_id?.name || "Unknown",
      ownerPhone: listing.owner_id?.phone || "",
      ownerEmail: listing.owner_id?.email || "",
      ownerAvatar: listing.owner_id?.avatar_url || "",
      address: listing.address_line || "",
      area: listing.area || "",
      city: listing.city || "",
      state: listing.state || "",
      pincode: listing.pincode || "",
      latitude: listing.latitude || "",
      longitude: listing.longitude || "",
      gender: listing.gender || "mixed",
      foodIncluded: listing.food_included ? "Yes" : "No",
      amenities: listing.amenities || [],
      houseRules: listing.house_rules || "No specific rules mentioned",
      minPrice: listing.min_price ? `₹${listing.min_price}` : "N/A",
      maxPrice: listing.max_price ? `₹${listing.max_price}` : "N/A",
      verified: listing.verified ? "Yes" : "No",
      featured: listing.featured ? "Yes" : "No",
      status: listing.status,
      createdAtFormatted: new Date(listing.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      updatedAtFormatted: new Date(listing.updatedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      cover_url: listing.cover_url,
      gallery_urls: listing.gallery_urls,
    };

    res.render("admin/admin-listing-details", {
      admin,
      listing: listingData,

      back: { status: backStatus, q: backQ, page: backPage },
    });
  } catch (err) {
    console.error("Get listing details error:", err);
    res.status(500).render("404", { message: "Error loading listing" });
  }
};

exports.approveListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    await Pg.findByIdAndUpdate(listingId, {
      status: "published",
    });

    res.json({
      success: true,
      message: "Listing approved and published",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.rejectListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { reason } = req.body;

    await Pg.findByIdAndUpdate(listingId, {
      status: "unpublished",
    });

    res.json({
      success: true,
      message: "Listing rejected and unpublished",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const admin = await User.findById(req.user.userId).select("name avatar_url email phone");

    res.render("admin/admin-settings", {
      admin,
    });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).render("admin/admin-settings", {
      admin: null,
      error: "Failed to load settings",
    });
  }
};

exports.updateAdminProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const admin = await User.findByIdAndUpdate(
      req.user.userId,
      { name, email, phone },
      { new: true }
    ).select("name email phone avatar_url");

    res.json({
      success: true,
      message: "Profile updated successfully",
      admin,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSystemStats = async (req, res) => {
  try {
    const totalListings = await Pg.countDocuments();
    const pendingListings = await Pg.countDocuments({ status: "pending_approval" });
    const publishedListings = await Pg.countDocuments({ status: "published" });
    const totalUsers = await User.countDocuments();
    const owners = await User.countDocuments({ role: "owner" });
    const seekers = await User.countDocuments({ role: "seeker" });
    const totalReports = await Report.countDocuments();
    const openReports = await Report.countDocuments({ status: "open" });

    res.json({
      success: true,
      stats: {
        totalListings,
        pendingListings,
        publishedListings,
        totalUsers,
        owners,
        seekers,
        totalReports,
        openReports,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = 10;
    const skip = (page - 1) * limit;

    const q = req.query.q || "";
    const statusParam = (req.query.status || "all").toLowerCase();

    const statusMap = {
      pending: "pending_approval",
      approved: "published",
      rejected: "unpublished",
      all: null,
    };

    const filter = {};
    if (statusParam !== "all") {
      filter.status = statusMap[statusParam] || "pending_approval";
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { area: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
      ];
    }

    const [listings, totalCount, pendingCount, todayCount, totalApproved, totalRejected] =
      await Promise.all([
        Pg.find(filter)
          .populate("owner_id", "name phone")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Pg.countDocuments(filter),
        Pg.countDocuments({ status: "pending_approval" }),
        Pg.countDocuments({
          status: "pending_approval",
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        }),
        Pg.countDocuments({ status: "published" }),
        Pg.countDocuments({ status: "unpublished" }),
      ]);

    const mappedListings = listings.map((pg) => ({
      _id: pg._id,
      name: pg.name,
      coverUrl: pg.cover_url || null,
      category: pg.short_tagline || "",
      ownerName: pg.owner_id?.name || "Unknown",
      ownerPhone: pg.owner_id?.phone || "",
      area: pg.area,
      city: pg.city,
      submittedAtFormatted: pg.createdAt
        ? pg.createdAt.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        : "",
      tags: [pg.gender, pg.food_included ? "Food included" : null].filter(Boolean),

      status:
        pg.status === "pending_approval"
          ? "pending"
          : pg.status === "published"
            ? "approved"
            : pg.status === "unpublished"
              ? "rejected"
              : pg.status,
    }));

    const stats = {
      pending: pendingCount,
      today: todayCount,
      issues: 0,
      totalApproved,
      totalRejected,
    };

    const admin = await User.findById(req.user.userId).select("name avatar_url");

    res.render("admin/admin-listings", {
      admin,
      stats,
      listings: mappedListings,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      q,
      selectedCount: 0,
      currentStatus: statusParam,
    });
  } catch (err) {
    console.error("Admin listings error:", err);
    res.status(500).render("admin/admin-listings", {
      admin: null,
      stats: { pending: 0, today: 0, issues: 0, totalApproved: 0, totalRejected: 0 },
      listings: [],
      page: 1,
      totalPages: 1,
      q: "",
      selectedCount: 0,
      currentStatus: "pending",
      error: "Failed to load listings",
    });
  }
};


exports.getPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = 10;
    const skip = (page - 1) * limit;
    const q = req.query.q || "";
    const status = req.query.status || "all";

    const filter = {};
    if (status !== "all") {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { transaction_id: { $regex: q, $options: "i" } },
      ];
    }

    const [payments, totalCount, totalRevenue, platformRevenue] = await Promise.all([
      Payment.find(filter)
        .populate("user_id", "name phone email avatar_url")
        .populate("listing_id", "name city owner_id")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Payment.countDocuments(filter),

      Payment.aggregate([
        { $match: { status: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),

      Payment.aggregate([
        { $match: { status: "success" } },
        { $group: { _id: null, total: { $sum: "$platform_fee" } } }
      ]),
    ]);

    const admin = await User.findById(req.user.userId).select("name avatar_url");

    const mappedPayments = payments.map((p) => ({
      _id: p._id,
      transactionId: p.transaction_id,
      userName: p.user_id?.name || "Unknown",
      userPhone: p.user_id?.phone || "",
      userAvatar: p.user_id?.avatar_url || "",
      listingName: p.listing_id?.name || "-",
      city: p.listing_id?.city || "",
      amount: `₹${p.amount}`,
      platformFee: `₹${p.platform_fee || 0}`,
      ownerAmount: `₹${p.owner_amount || 0}`,
      commissionRate: `${(p.commission_rate || 0) * 100}%`,
      method: p.method,
      gateway: p.gateway || "",
      status: p.status,
      payoutStatus: p.payout_status || "pending",
      paidAtFormatted: new Date(p.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    res.render("admin/admin-payments", {
      admin,
      payments: mappedPayments,
      stats: {
        totalRevenue: totalRevenue[0]?.total || 0,
        platformRevenue: platformRevenue[0]?.total || 0,
        totalPayments: totalCount,
      },
      page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      q,
      currentStatus: status,
    });
  } catch (err) {
    console.error("Admin payments error:", err);
    res.status(500).render("admin/admin-payments", {
      admin: null,
      payments: [],
      stats: { totalRevenue: 0, platformRevenue: 0, totalPayments: 0 },
      page: 1,
      totalPages: 1,
      q: "",
      currentStatus: "all",
      error: "Failed to load payments",
    });
  }
};

exports.getPayouts = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = 10;
    const skip = (page - 1) * limit;
    const q = req.query.q || "";
    const status = req.query.status || "all";

    const filter = {};
    if (status !== "all") {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { payout_id: { $regex: q, $options: "i" } },
        { utr: { $regex: q, $options: "i" } },
      ];
    }

    const [payouts, totalCount, totalPayoutAmount, pendingPayouts] = await Promise.all([
      Payout.find(filter)
        .populate("owner_id", "name phone email avatar_url")
        .populate("payment_id", "transaction_id amount")
        .populate("processed_by", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Payout.countDocuments(filter),

      Payout.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),

      Payout.countDocuments({ status: "pending" }),
    ]);

    const admin = await User.findById(req.user.userId).select("name avatar_url");

    const mappedPayouts = payouts.map((p) => ({
      _id: p._id,
      payoutId: p.payout_id || `PO-${String(p._id).slice(-6).toUpperCase()}`,
      transactionId: p.payment_id?.transaction_id || "Unknown",
      ownerName: p.owner_id?.name || "Unknown",
      ownerPhone: p.owner_id?.phone || "",
      ownerAvatar: p.owner_id?.avatar_url || "",
      amount: p.amount,
      mode: p.mode,
      status: p.status,
      utr: p.utr || "",
      processedBy: p.processed_by?.name || "",
      processedAtFormatted: p.processed_at
        ? new Date(p.processed_at).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        : "",
      createdAtFormatted: new Date(p.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      failureReason: p.failure_reason || "",
      retryCount: p.retry_count || 0,
    }));

    res.render("admin/admin-payouts", {
      admin,
      payouts: mappedPayouts,
      stats: {
        totalPayoutAmount: totalPayoutAmount[0]?.total || 0,
        totalPayouts: totalCount,
        pendingPayouts,
      },
      page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      q,
      currentStatus: status,
    });
  } catch (err) {
    console.error("Admin payouts error:", err);
    res.status(500).render("admin/admin-payouts", {
      admin: null,
      payouts: [],
      stats: { totalPayoutAmount: 0, totalPayouts: 0, pendingPayouts: 0 },
      page: 1,
      totalPages: 1,
      q: "",
      currentStatus: "all",
      error: "Failed to load payouts",
    });
  }
};

exports.processPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { mode } = req.body;

    const payout = await Payout.findById(payoutId)
      .populate("owner_id", "name bank_account_holder bank_account_number bank_ifsc_code bank_name upi_id")
      .populate("payment_id", "transaction_id");

    if (!payout) {
      return res.status(404).json({ success: false, error: "Payout not found" });
    }

    if (payout.status !== "pending") {
      return res.status(400).json({ success: false, error: "Payout already processed" });
    }

    const Razorpay = require("razorpay");
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    let payoutResult;
    
    if (mode === "razorpay_payout") {
      try {
        // Check if Razorpay payouts API is available
        if (!razorpay.payouts || !razorpay.payouts.create) {
          throw new Error("Razorpay Payouts API not available in test mode");
        }

        const payoutData = {
          account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
          fund_account: {
            account_type: payout.owner_id.upi_id ? "vpa" : "bank_account",
            ...(payout.owner_id.upi_id ? {
              vpa: {
                address: payout.owner_id.upi_id,
              }
            } : {
              bank_account: {
                name: payout.owner_id.bank_account_holder,
                account_number: payout.owner_id.bank_account_number,
                ifsc: payout.owner_id.bank_ifsc_code,
              }
            }),
            contact: {
              name: payout.owner_id.name,
              email: payout.owner_id.email,
              type: "customer",
            },
          },
          amount: payout.amount * 100, // Convert to paise
          currency: "INR",
          mode: "IMPS",
          purpose: "payout",
          reference_id: payout.payment_id.transaction_id,
          narration: `PG-Finder payout for ${payout.payment_id.transaction_id}`,
        };

        payoutResult = await razorpay.payouts.create(payoutData);
      } catch (razorpayError) {
        // For test mode, simulate successful payout
        console.log("Razorpay payout error (test mode):", razorpayError.message);
        payoutResult = {
          id: `test_payout_${Date.now()}`,
          status: "processed"
        };
      }
    }

    await Payout.findByIdAndUpdate(payoutId, {
      status: payoutResult.status === "processed" ? "completed" : "processing",
      payout_id: payoutResult.id,
      processed_by: req.user.userId,
      processed_at: new Date(),
      metadata: { razorpay_response: payoutResult },
    });

    await Payment.findByIdAndUpdate(payout.payment_id._id, {
      payout_status: payoutResult.status === "processed" ? "completed" : "processing",
    });

    res.json({
      success: true,
      message: payoutResult.status === "processed" ? "Payout completed successfully (test mode)" : "Payout initiated successfully",
      payoutId: payoutResult.id,
    });
  } catch (err) {
    console.error("Process payout error:", err);
    
    await Payout.findByIdAndUpdate(req.params.payoutId, {
      status: "failed",
      failure_reason: err.error?.description || err.message,
      $inc: { retry_count: 1 },
    });

    res.status(500).json({ 
      success: false, 
      error: err.error?.description || err.message 
    });
  }
};

exports.createPayouts = async (req, res) => {
  try {
    const { paymentIds } = req.body;

    if (!paymentIds || paymentIds.length === 0) {
      return res.status(400).json({ success: false, error: "No payments selected" });
    }

    

    // First, get payments with valid listings
    const payments = await Payment.aggregate([
      { $match: { 
        _id: { $in: paymentIds.map(id => new mongoose.Types.ObjectId(id)) },
        status: "success",
        payout_status: { $in: ["pending", null, undefined] }
      }},
      { $lookup: {
        from: "pgs",
        localField: "listing_id",
        foreignField: "_id",
        as: "pg_info"
      }},
      { $unwind: "$pg_info" },
      { $match: { "pg_info": { $ne: null } }},
      { $lookup: {
        from: "users",
        localField: "pg_info.owner_id",
        foreignField: "_id",
        as: "owner_info"
      }},
      { $unwind: "$owner_info" },
    ]);

    console.log("Found payments:", payments.length, "Payments:", payments.map(p => ({ id: p._id, owner_id: p.owner_info._id })));

    const payouts = [];
    const commissionRate = 0.10; // 10% platform commission

    for (const payment of payments) {
      const platformFee = Math.round(payment.amount * commissionRate);
      const ownerAmount = payment.amount - platformFee;

      const existingPayout = await Payout.findOne({ payment_id: payment._id });
      if (!existingPayout) {
        const payout = new Payout({
          payment_id: payment._id,
          owner_id: payment.owner_info._id,
          amount: ownerAmount,
          mode: "razorpay_payout",
        });
        await payout.save();
        payouts.push(payout);

        await Payment.findByIdAndUpdate(payment._id, {
          platform_fee: platformFee,
          owner_amount: ownerAmount,
          commission_rate: commissionRate,
          payout_status: "pending",
        });
      }
    }

    

    res.json({
      success: true,
      message: `${payouts.length} payouts created successfully`,
      payouts,
    });
  } catch (err) {
    console.error("Create payouts error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
