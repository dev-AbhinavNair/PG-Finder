const mongoose = require('mongoose');
const Booking = require('../models/Booking');

class AvailabilityService {

    static async isPgAvailable(pgId, checkInDate, checkOutDate, excludeBookingId = null) {
        try {
            const hasConflict = await Booking.checkDateConflict(
                pgId,
                checkInDate,
                checkOutDate,
                excludeBookingId
            );
            return !hasConflict;
        } catch (error) {
            console.error('Error checking PG availability:', error);
            throw error;
        }
    }

    static async getBookedDates(pgId, startDate, endDate) {
        try {
            return await Booking.getBookedDates(pgId, startDate, endDate);
        } catch (error) {
            console.error('Error getting booked dates:', error);
            throw error;
        }
    }

    static async getUnavailableDateRanges(pgId) {
        try {
            const bookings = await Booking.find({
                pg_id: pgId,
                booking_status: { $in: ['pending', 'confirmed', 'checked_in'] }
            }).select('check_in_date check_out_date booking_status').sort('check_in_date');

            return bookings.map(booking => ({
                start: booking.check_in_date,
                end: booking.check_out_date,
                status: booking.booking_status
            }));
        } catch (error) {
            console.error('Error getting unavailable date ranges:', error);
            throw error;
        }
    }

    static async getAvailabilityCalendar(pgId) {
        try {
            const today = new Date();
            const endDate = new Date(today);
            endDate.setMonth(endDate.getMonth() + 12);

            const bookedDates = await this.getBookedDates(pgId, today, endDate);
            const unavailableRanges = await this.getUnavailableDateRanges(pgId);

            return {
                bookedDates: bookedDates.map(date => date.toISOString().split('T')[0]),
                unavailableRanges: unavailableRanges.map(range => ({
                    start: range.start.toISOString().split('T')[0],
                    end: range.end.toISOString().split('T')[0],
                    status: range.status
                })),
                period: {
                    start: today.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0]
                }
            };
        } catch (error) {
            console.error('Error getting availability calendar:', error);
            throw error;
        }
    }

    static validateDateRange(checkInDate, checkOutDate) {
        const errors = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkInDate < today) {
            errors.push('Check-in date must be in the future');
        }

        if (checkOutDate <= checkInDate) {
            errors.push('Check-out date must be after check-in date');
        }

        const minStay = 30;
        const minCheckOut = new Date(checkInDate);
        minCheckOut.setDate(minCheckOut.getDate() + minStay);

        if (checkOutDate < minCheckOut) {
            errors.push(`Minimum stay of ${minStay} days required`);
        }

        const maxStay = 365;
        const maxCheckOut = new Date(checkInDate);
        maxCheckOut.setDate(maxCheckOut.getDate() + maxStay);

        if (checkOutDate > maxCheckOut) {
            errors.push(`Maximum stay of ${maxStay} days allowed`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    static async updateBookingStatuses() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const bookingsToUpdate = await Booking.find({
                check_out_date: { $lt: today },
                booking_status: { $in: ['confirmed', 'checked_in'] }
            });

            const result = await Booking.updateMany(
                {
                    check_out_date: { $lt: today },
                    booking_status: { $in: ['confirmed', 'checked_in'] }
                },
                {
                    booking_status: 'completed'
                }
            );

            console.log(`Updated ${result.modifiedCount} bookings to completed status`);
            return result.modifiedCount;
        } catch (error) {
            console.error('Error updating booking statuses:', error);
            throw error;
        }
    }

    static async getBookingStatistics(pgId) {
        try {
            const stats = await Booking.aggregate([
                { $match: { pg_id: mongoose.Types.ObjectId(pgId) } },
                {
                    $group: {
                        _id: '$booking_status',
                        count: { $sum: 1 },
                        totalRevenue: { $sum: '$monthly_rent' }
                    }
                }
            ]);

            const totalBookings = await Booking.countDocuments({ pg_id: pgId });
            const occupiedDays = await this.calculateOccupiedDays(pgId);

            return {
                totalBookings,
                occupiedDays,
                statusBreakdown: stats.reduce((acc, stat) => {
                    acc[stat._id] = {
                        count: stat.count,
                        revenue: stat.totalRevenue
                    };
                    return acc;
                }, {})
            };
        } catch (error) {
            console.error('Error getting booking statistics:', error);
            throw error;
        }
    }

    static async calculateOccupiedDays(pgId) {
        try {
            const bookings = await Booking.find({
                pg_id: pgId,
                booking_status: { $in: ['confirmed', 'checked_in', 'completed'] }
            });

            let totalDays = 0;
            bookings.forEach(booking => {
                const start = new Date(booking.check_in_date);
                const end = new Date(booking.check_out_date);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                totalDays += days;
            });

            return totalDays;
        } catch (error) {
            console.error('Error calculating occupied days:', error);
            throw error;
        }
    }
}

module.exports = AvailabilityService;