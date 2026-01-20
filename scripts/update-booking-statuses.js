
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AvailabilityService = require('../services/availabilityService');

dotenv.config();

async function updateBookingStatuses() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        console.log('Starting booking status update process...');
        
        const updatedCount = await AvailabilityService.updateBookingStatuses();
        
        console.log(`Successfully updated ${updatedCount} bookings to completed status`);
        
        console.log('Booking status update process completed successfully');
        
    } catch (error) {
        console.error('Error updating booking statuses:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

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