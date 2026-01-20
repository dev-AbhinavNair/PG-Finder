const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    pg_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pg",
      required: true,
    },
    reporter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      enum: [
        "incorrect_info",
        "bad_facilities",
        "harassment",
        "inappropriate_content",
        "safety_concern",
        "other",
      ],
      required: true,
    },
    description: String,
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "dismissed"],
      default: "open",
    },
    admin_action: {
      type: String,
      enum: ["warning", "suspend", "ban", "none"],
      default: "none",
    },
    admin_notes: String,
    resolved_at: Date,
    resolved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
