const Pg = require("../models/Pg");
const User = require("../models/User");

const Report = require("../models/Report");

const Payment = require("../models/Payment");

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

    const [payments, totalCount, totalRevenue] = await Promise.all([
      Payment.find(filter)
        .populate("user_id", "name phone email")
        .populate("listing_id", "name city")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Payment.countDocuments(filter),

      Payment.aggregate([
        { $match: { status: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
    ]);

    const admin = await User.findById(req.user.userId).select("name avatar_url");

    const mappedPayments = payments.map((p) => ({
      _id: p._id,
      transactionId: p.transaction_id,
      userName: p.user_id?.name || "Unknown",
      userPhone: p.user_id?.phone || "",
      listingName: p.listing_id?.name || "-",
      city: p.listing_id?.city || "",
      amount: `₹${p.amount}`,
      method: p.method,
      gateway: p.gateway || "",
      status: p.status,
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
      stats: { totalRevenue: 0, totalPayments: 0 },
      page: 1,
      totalPages: 1,
      q: "",
      currentStatus: "all",
      error: "Failed to load payments",
    });
  }
};
