const Pg = require("../models/Pg");
const Booking = require("../models/Booking");
const Report = require("../models/Report");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getSearchResults = async (req, res) => {
    try {
        const { q, area } = req.query;
        let query = { status: "published" };

        if (q) {
            query.$or = [
                { name: { $regex: q, $options: "i" } },
                { area: { $regex: q, $options: "i" } },
                { city: { $regex: q, $options: "i" } },
                { address_line: { $regex: q, $options: "i" } },
            ];
        }

        if (area) {
            query.area = { $regex: area, $options: "i" };
        }

        const pgs = await Pg.find(query).sort("-createdAt");

        let user = null;
        if (req.user) {
            const User = require("../models/User");
            user = await User.findById(req.user.userId || req.user._id);
        }

        res.render("seeker/results", {
            pgs,
            searchQuery: q || area || "",
            user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).render("errors/500", { message: "Error searching PGs" });
    }
};

const getPgDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const pg = await Pg.findById(id).populate("owner_id", "name email phone");

        if (!pg || pg.status !== "published") {
            return res.status(404).render("errors/404", { url: req.originalUrl });
        }

        let user = null;
        if (req.user) {
            const User = require("../models/User");
            user = await User.findById(req.user.userId || req.user._id);
        }

        res.render("seeker/pg-details", {
            pg,
            user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).render("errors/500", { message: "Error fetching PG details" });
    }
};

const renderHome = async (req, res) => {
    try {
        const featuredPgs = await Pg.find({ status: "published", featured: true })
            .limit(4)
            .sort("-createdAt");

        const popularAreas = [
            "Shimlapuri",
            "PuriShimla",
            "DianaLudhi",
            "Viman Nagar",
            "Ludhiana",
            "Pimple Saudagar",
            "Aundh",
            "Magarpatta"
        ];

        let user = null;
        if (req.user) {
            const User = require("../models/User");
            user = await User.findById(req.user.userId || req.user._id);
        }

        res.render("seeker/home", {
            user,
            featuredPgs,
            popularAreas,
        });
    } catch (err) {
        console.error(err);
        res.status(500).render("errors/500", { message: "Error loading home page" });
    }
};

const getBookingForm = async (req, res) => {
    try {
        const { pgId } = req.params;
        const pg = await Pg.findById(pgId);

        if (!pg || pg.status !== "published") {
            return res.status(404).render("errors/404", { url: req.originalUrl });
        }

        const userProfile = await require("../models/User").findById(req.user.userId);

        res.render("seeker/book", {
            pg,
            user: userProfile || req.user,
            error: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).render("errors/500", { message: "Error loading booking page" });
    }
};

const postBooking = async (req, res) => {
    try {
        const { pgId } = req.params;
        const { check_in_date, check_out_date, room_type, tenant_notes } = req.body;

        const pg = await Pg.findById(pgId);
        if (!pg) {
            return res.status(404).render("errors/404", { url: req.originalUrl });
        }

        if (!check_in_date || !check_out_date || !room_type) {
            return res.render("seeker/book", {
                pg,
                user: req.user,
                error: "Please fill in all required fields."
            });
        }

        const checkInDate = new Date(check_in_date);
        const checkOutDate = new Date(check_out_date);

        const AvailabilityService = require("../services/availabilityService");
        const dateValidation = AvailabilityService.validateDateRange(checkInDate, checkOutDate);

        if (!dateValidation.isValid) {
            return res.render("seeker/book", {
                pg,
                user: req.user,
                error: dateValidation.errors.join(", ")
            });
        }

        const isAvailable = await AvailabilityService.isPgAvailable(pgId, checkInDate, checkOutDate);
        if (!isAvailable) {
            return res.render("seeker/book", {
                pg,
                user: req.user,
                error: "PG is not available for the selected dates. Please choose different dates."
            });
        }

        const booking = await Booking.create({
            pg_id: pg._id,
            owner_id: pg.owner_id,
            tenant_id: req.user.userId || req.user._id,
            tenant_name: req.body.name || "Seeker",
            pg_name: pg.name,
            room_type,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            monthly_rent: pg.min_price,
            tenant_notes,
            booking_status: "pending"
        });

        res.redirect(`/bookings/${booking._id}/pay`);

    } catch (err) {
        console.error(err);

        if (err.name === 'ValidationError') {
            const pg = await Pg.findById(req.params.pgId);
            return res.render("seeker/book", {
                pg,
                user: req.user,
                error: err.message
            });
        }

        res.status(500).render("errors/500", { message: "Error creating booking" });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        const user = await require("../models/User").findById(userId)
            .populate({
                path: 'saved_pgs',
                select: 'name city address_line cover_url min_price rent area'
            });

        const bookings = await Booking.find({ tenant_id: userId })
            .populate("pg_id", "name city address_line cover_image")
            .populate("owner_id", "name phone email")
            .sort({ createdAt: -1 });

        const savedPgs = user.saved_pgs || [];

        res.render("seeker/profile", {
            user,
            bookings,
            savedPgs
        });
    } catch (err) {
        console.error(err);
        res.status(500).render("errors/500", { message: "Error loading profile" });
    }
};

const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const user = await require("../models/User").findById(userId);

        if (req.body.name) user.name = req.body.name;
        if (req.body.phone) user.phone = req.body.phone;
        if (req.body.email) user.email = req.body.email;
        if (req.body.address) user.address = req.body.address;
        if (req.body.about) user.about = req.body.about;

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'findmypg/avatars',
                resource_type: 'image'
            });
            await fs.unlink(req.file.path);
            user.avatar_url = result.secure_url;
        }

        await user.save();
        res.redirect("/profile?success=Profile updated successfully");
    } catch (err) {
        console.error(err);
        if (req.file) {
            fs.unlink(req.file.path).catch(() => { });
        }
        res.redirect("/profile?error=Failed to update profile");
    }
};

const updatePaymentMethods = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const user = await require("../models/User").findById(userId);

        user.bank_account_holder = req.body.account_holder;
        user.bank_account_number = req.body.account_number;
        user.bank_ifsc_code = req.body.ifsc_code;
        user.bank_name = req.body.bank_name;
        user.upi_id = req.body.upi_id;

        await user.save();
        res.redirect("/profile?success=Payment methods updated");
    } catch (err) {
        console.error(err);
        res.redirect("/profile?error=Failed to update payment methods");
    }
};

const toggleSavedPg = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user._id;
        const user = await require("../models/User").findById(userId);

        if (!user.saved_pgs) user.saved_pgs = [];

        const index = user.saved_pgs.indexOf(id);

        let isSaved = false;
        if (index === -1) {
            user.saved_pgs.push(id);
            isSaved = true;
        } else {
            user.saved_pgs.splice(index, 1);
            isSaved = false;
        }

        await user.save();

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ success: true, isSaved });
        }

        res.redirect('back');
    } catch (err) {
        console.error(err);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ success: false, error: "Failed to toggle save" });
        }
        res.redirect('back');
    }
};

const reportPg = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, description } = req.body;
        const userId = req.user.userId || req.user._id;

        await Report.create({
            pg_id: id,
            reporter_id: userId,
            reason,
            description,
            status: 'open'
        });

        res.redirect(`/pgs/${id}?success=Report submitted successfully`);
    } catch (err) {
        console.error(err);
        res.redirect(`/pgs/${req.params.id}?error=Failed to submit report`);
    }
};

const createOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, error: "Booking not found" });
        }

        const options = {
            amount: booking.monthly_rent * 100,
            currency: "INR",
            receipt: `receipt_${id}`,
        };

        const order = await instance.orders.create(options);

        res.json({
            success: true,
            key: instance.key_id,
            order: order
        });
    } catch (err) {
        console.error("Razorpay Error:", err);
        res.status(500).json({ success: false, error: "Payment initiation failed" });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const generated_signature = crypto.createHmac('sha256', instance.key_secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature == razorpay_signature) {

            await Booking.findByIdAndUpdate(id, {
                payment_status: 'completed',
                booking_status: 'confirmed',
            });

            res.json({ success: true });
        } else {
            res.json({ success: false, error: "Invalid Signature" });
        }

    } catch (err) {
        console.error("Verification Error:", err);
        res.status(500).json({ success: false, error: "Verification failed" });
    }
};

const checkPgAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { check_in, check_out } = req.query;

        if (!check_in || !check_out) {
            return res.status(400).json({
                success: false,
                error: "Check-in and check-out dates are required"
            });
        }

        const checkInDate = new Date(check_in);
        const checkOutDate = new Date(check_out);

        const AvailabilityService = require("../services/availabilityService");
        const dateValidation = AvailabilityService.validateDateRange(checkInDate, checkOutDate);

        if (!dateValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: dateValidation.errors.join(", ")
            });
        }

        const isAvailable = await AvailabilityService.isPgAvailable(id, checkInDate, checkOutDate);

        res.json({
            success: true,
            available: isAvailable,
            message: isAvailable ? "PG is available for selected dates" : "PG is not available for selected dates"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Error checking availability"
        });
    }
};

const renderPaymentPage = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.redirect("/profile?error=Booking not found");
        }

        res.render("seeker/payment", {
            booking,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.redirect("/profile?error=Unable to start payment");
    }
};


module.exports = {
    getSearchResults,
    getPgDetails,
    renderHome,
    getBookingForm,
    postBooking,
    getProfile,
    updateProfile,
    updatePaymentMethods,
    toggleSavedPg,
    reportPg,
    createOrder,
    verifyPayment,
    checkPgAvailability,
    renderPaymentPage
};
