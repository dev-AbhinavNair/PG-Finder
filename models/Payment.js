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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
