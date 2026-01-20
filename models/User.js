const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["seeker", "owner", "admin"],
      default: "seeker",
      required: true,
    },
    address: String,
    avatar_url: String,

    bank_account_holder: { type: String, default: null },
    bank_account_number: { type: String, default: null },
    bank_ifsc_code: { type: String, default: null },
    bank_name: { type: String, default: null },
    upi_id: { type: String, default: null },

    is_deactivated: { type: Boolean, default: false },
    deactivated_at: { type: Date, default: null },

    saved_pgs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pg" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
