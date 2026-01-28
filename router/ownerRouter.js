const express = require("express");
const router = express.Router();

const { requireAuth, requireOwner } = require("../middleware/auth");
const ownerController = require("../controller/ownerController");

router.get("/", requireAuth, requireOwner, ownerController.getDashboard);

router.get("/pg/new", requireAuth, requireOwner, ownerController.getAddPgForm);

router.post("/pg", requireAuth, requireOwner, ownerController.upload.array("photos", 8), ownerController.createPg);

router.get("/pg/:id/edit", requireAuth, requireOwner, ownerController.getEditPgForm);
router.get("/pg/:id/details", requireAuth, requireOwner, ownerController.getPgDetails);

router.post("/pg/:id/edit", requireAuth, requireOwner, ownerController.upload.array("photos", 8), ownerController.updatePg);

router.get("/bookings", requireAuth, requireOwner, ownerController.getBookings);
router.get("/messages", requireAuth, requireOwner, ownerController.getMessages);

router.get("/payouts", requireAuth, requireOwner, ownerController.getPayouts);
router.get("/settings", requireAuth, requireOwner, ownerController.getSettings);
router.post("/settings", requireAuth, requireOwner, ownerController.upload.single("avatar"), ownerController.updateSettings);
router.post("/payouts/request", requireAuth, requireOwner, ownerController.requestPayout);
router.get("/payouts/settings", requireAuth, requireOwner, ownerController.getPayoutSettings);
router.post("/payouts/settings", requireAuth, requireOwner, ownerController.updatePayoutSettings);

router.delete("/pg/:id/delete", requireAuth, requireOwner, ownerController.deletePg);
router.post("/bookings/:id/approve", requireAuth, requireOwner, ownerController.approveBooking);
router.post("/bookings/:id/reject", requireAuth, requireOwner, ownerController.rejectBooking);
router.post("/bookings/:id/checkin", requireAuth, requireOwner, ownerController.checkInBooking);
router.post("/bookings/:id/checkout", requireAuth, requireOwner, ownerController.checkOutBooking);
router.get("/api/bookings/availability/:pgId", requireAuth, requireOwner, ownerController.getBookingAvailability);
router.post("/bookings/update-statuses", requireAuth, requireOwner, ownerController.updateBookingStatuses);

module.exports = router;
