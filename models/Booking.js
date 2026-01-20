const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    pg_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pg",
      required: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenant_name: String,
    tenant_avatar: String,
    tenant_contact: String,
    pg_name: String,
    room_type: String,
    check_in_date: {
      type: Date,
      required: true,
      validate: {
        validator: function(value) {
          return value > new Date();
        },
        message: "Check-in date must be in the future"
      }
    },
    check_out_date: {
      type: Date,
      required: true,
      validate: {
        validator: function(value) {
          if (!this.check_in_date) return false;
          const minStay = 30; 
          const minCheckOut = new Date(this.check_in_date);
          minCheckOut.setDate(minCheckOut.getDate() + minStay);
          return value >= minCheckOut;
        },
        message: "Check-out date must be at least 30 days after check-in date"
      }
    },
    monthly_rent: Number,
    payment_method: String,
    payment_status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    booking_status: {
      type: String,
      enum: ["pending", "confirmed", "checked_in", "completed", "cancelled"],
      default: "pending",
    },
    tenant_notes: String,
    owner_notes: String,
  },
  { timestamps: true }
);

bookingSchema.statics.checkDateConflict = async function(pgId, checkInDate, checkOutDate, excludeBookingId = null) {
  const query = {
    pg_id: pgId,
    booking_status: { $in: ["pending", "confirmed", "checked_in"] },
    $or: [
      {
        check_in_date: { $lte: checkInDate },
        check_out_date: { $gte: checkInDate }
      },
      {
        check_in_date: { $lte: checkOutDate },
        check_out_date: { $gte: checkOutDate }
      },
      {
        check_in_date: { $gte: checkInDate, $lte: checkOutDate }
      }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBookings = await this.find(query);
  return conflictingBookings.length > 0;
};

bookingSchema.methods.isDateRangeAvailable = async function(startDate, endDate) {
  return !(await this.constructor.checkDateConflict(this.pg_id, startDate, endDate, this._id));
};

bookingSchema.statics.getBookedDates = async function(pgId, startDate, endDate) {
  const bookings = await this.find({
    pg_id: pgId,
    booking_status: { $in: ["pending", "confirmed", "checked_in"] },
    $or: [
      { check_in_date: { $lte: endDate }, check_out_date: { $gte: startDate } }
    ]
  });

  const bookedDates = [];
  bookings.forEach(booking => {
    const start = new Date(booking.check_in_date);
    const end = new Date(booking.check_out_date);
    const current = new Date(start);
    
    while (current <= end) {
      if (current >= startDate && current <= endDate) {
        bookedDates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
  });

  return bookedDates;
};

bookingSchema.pre('save', async function(next) {
  if (this.isNew && this.check_in_date && this.check_out_date) {
    const hasConflict = await this.constructor.checkDateConflict(
      this.pg_id, 
      this.check_in_date, 
      this.check_out_date
    );
    
    if (hasConflict) {
      const error = new Error('PG is not available for the selected dates');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
