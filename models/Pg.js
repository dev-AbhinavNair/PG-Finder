const mongoose = require("mongoose");

const pgSchema = new mongoose.Schema(
  {
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    short_tagline: String,
    description: String,
    long_description: String,

    address_line: { type: String, required: true },
    area: { type: String, required: true },
    city: { type: String, required: true },
    state: String,
    pincode: String,

    latitude: Number,
    longitude: Number,

    gender: { type: String, enum: ["boys", "girls", "mixed"] },
    food_included: Boolean,
    amenities: [String],
    house_rules: String,

    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["published", "draft", "pending_approval", "unpublished"],
      default: "draft",
    },

    min_price: Number,
    max_price: Number,

    cover_url: String,
    gallery_urls: [String]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pg", pgSchema);
