const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true, trim: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", otpSchema);
