const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listing_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pg",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    method: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "pending", "refunded"],
      default: "success",
    },
    transaction_id: {
      type: String,
      required: true,
      unique: true,
    },
    gateway: {
      type: String,
    },
    platform_fee: {
      type: Number,
      default: 0,
    },
    owner_amount: {
      type: Number,
      required: true,
    },
    commission_rate: {
      type: Number,
      default: 0.10, // 10% platform commission
    },
    payout_status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
