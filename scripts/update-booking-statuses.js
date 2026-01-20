#!/usr/bin/env node

/**
 * Scheduled Task: Update Booking Statuses
 * 
 * This script runs daily to automatically update booking statuses
 * and manage availability for completed bookings.
 * 
 * Usage: 
 * - Run manually: node scripts/update-booking-statuses.js
 * - Set up cron: 0 2 * * * /usr/bin/node /path/to/scripts/update-booking-statuses.js
 *   (Runs every day at 2:00 AM)
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AvailabilityService = require('../services/availabilityService');

// Load environment variables
dotenv.config();

async function updateBookingStatuses() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        console.log('Starting booking status update process...');
        
        // Update completed bookings
        const updatedCount = await AvailabilityService.updateBookingStatuses();
        
        console.log(`✅ Successfully updated ${updatedCount} bookings to completed status`);
        
        // You can add more automated tasks here:
        // - Send reminder emails for upcoming check-outs
        // - Generate monthly reports
        // - Clean up old data
        
        console.log('✅ Booking status update process completed successfully');
        
    } catch (error) {
        console.error('❌ Error updating booking statuses:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the update process
if (require.main === module) {
    updateBookingStatuses()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { updateBookingStatuses };