const express = require("express");
const router = express.Router();
const seekerController = require("../controller/seekerController");
const { requireAuth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/avatars';
        require('fs').mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});
const upload = multer({ storage });

router.get("/pgs", seekerController.getSearchResults);
router.get("/pgs/:id", seekerController.getPgDetails);

router.get("/book/:pgId", requireAuth, seekerController.getBookingForm);
router.post("/book/:pgId", requireAuth, seekerController.postBooking);

router.get("/profile", requireAuth, seekerController.getProfile);

router.post("/profile", requireAuth, upload.single("avatar"), seekerController.updateProfile);
router.post("/profile/payment-methods", requireAuth, seekerController.updatePaymentMethods);
router.post("/pgs/:id/save", requireAuth, seekerController.toggleSavedPg);
router.post("/pgs/:id/report", requireAuth, seekerController.reportPg);

router.post("/bookings/:id/create-order", requireAuth, seekerController.createOrder);
router.post("/bookings/:id/verify-payment", requireAuth, seekerController.verifyPayment);

// API Routes
router.get("/api/pgs/:id/availability", seekerController.checkPgAvailability);

module.exports = router;
