const express = require("express");
const router = express.Router();

const adminController = require("../controller/adminController");
const Pg = require("../models/Pg");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.get("/listings", requireAuth, requireAdmin, adminController.getListings);

router.get("/listings/:listingId", requireAuth, requireAdmin, adminController.getListingDetails);

router.post("/listings/:listingId/approve", requireAuth, requireAdmin, adminController.approveListing);

router.post("/listings/:listingId/reject", requireAuth, requireAdmin, adminController.rejectListing);

router.post("/listings/bulk-approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: "No listings selected" });
    }

    await Pg.updateMany(
      { _id: { $in: ids } },
      { status: "published" }
    );

    res.json({ success: true, message: `${ids.length} listings approved` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/listings/bulk-reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: "No listings selected" });
    }

    await Pg.updateMany(
      { _id: { $in: ids } },
      { status: "unpublished" }
    );

    res.json({ success: true, message: `${ids.length} listings rejected` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports", requireAuth, requireAdmin, adminController.getReports);

router.get("/reports/:reportId", requireAuth, requireAdmin, adminController.getReportDetails);

router.post("/reports/:reportId/warn", requireAuth, requireAdmin, adminController.warnPgOwner);

router.post("/reports/:reportId/ban", requireAuth, requireAdmin, adminController.banPgListing);

router.get("/settings", requireAuth, requireAdmin, adminController.getSettings);

router.post("/settings/profile", requireAuth, requireAdmin, adminController.updateAdminProfile);

router.get("/settings/stats", requireAuth, requireAdmin, adminController.getSystemStats);

router.get("/payments", requireAuth, requireAdmin, adminController.getPayments);

router.get("/payouts", requireAuth, requireAdmin, adminController.getPayouts);

router.post("/payouts/create", requireAuth, requireAdmin, adminController.createPayouts);

router.post("/payouts/:payoutId/process", requireAuth, requireAdmin, adminController.processPayout);

// router.get("/payments/:paymentId", requireAuth, requireAdmin, adminController.getPaymentDetails);

module.exports = router;
