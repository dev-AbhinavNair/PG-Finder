const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");

router.get("/register/user", authController.getRegisterUser);
router.post("/register/user", authController.postRegisterUser);

router.get("/register/owner", authController.getRegisterOwner);
router.post("/register/owner", authController.postRegisterOwner);

router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);

router.post("/verify-otp", authController.postVerifyOtp);

router.post("/logout", authController.postLogout);

module.exports = router;
