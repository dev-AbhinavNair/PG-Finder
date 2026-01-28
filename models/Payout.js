const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
    },
    payout_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    utr: {
      type: String,
      sparse: true,
    },
    mode: {
      type: String,
      enum: ["bank_transfer", "upi", "razorpay_payout"],
      default: "razorpay_payout",
    },
    processed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processed_at: {
      type: Date,
    },
    failure_reason: {
      type: String,
    },
    retry_count: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payout", payoutSchema);