# PG Finder

A full-stack web application for finding and managing Paying Guest (PG) accommodations. Tenants can search and book PGs, while owners can list their properties and receive payouts.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Template Engine:** EJS
- **Authentication:** JWT (jsonwebtoken) with cookies
- **File Upload:** Multer
- **Image Hosting:** Cloudinary
- **Payments:** Razorpay
- **SMS/WhatsApp:** Twilio API

## Features

### For Seekers (Tenants)
- Search PG listings by location
- View detailed PG information
- Book available rooms
- Make payments via Razorpay
- Manage booking history
- Update profile

### For Owners
- Create and manage PG listings
- Upload property images
- View and manage bookings
- Set availability
- Receive payouts via Razorpay
- Message tenants

### For Admins
- View all listings
- Manage payments and payouts
- Generate reports
- System settings

## Project Structure

```
├── config/           # Configuration files
│   └── cloudinary.js
├── controller/       # Request handlers
│   ├── adminController.js
│   ├── authController.js
│   ├── ownerController.js
│   └── seekerController.js
├── middleware/       # Custom middleware
│   └── auth.js
├── models/           # Mongoose schemas
│   ├── Booking.js
│   ├── Message.js
│   ├── Otp.js
│   ├── Payment.js
│   ├── Payout.js
│   ├── Pg.js
│   ├── Report.js
│   └── User.js
├── router/           # Route definitions
│   ├── adminRouter.js
│   ├── authRouter.js
│   ├── ownerRouter.js
│   └── seekerRouter.js
├── services/         # Business logic
│   ├── availabilityService.js
│   └── twilioService.js
├── views/            # EJS templates
│   ├── admin/
│   ├── errors/
│   ├── owner/
│   ├── otp/
│   └── seeker/
├── app.js            # Main application entry
├── package.json
└── .env              # Environment variables
```

## Environment Variables

Create a `.env` file with the following:

```
PORT=3000
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_jwt_secret>

CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>

RAZORPAY_KEY_ID=<key_id>
RAZORPAY_KEY_SECRET=<key_secret>

TWILIO_ACCOUNT_SID=<account_sid>
TWILIO_AUTH_TOKEN=<auth_token>
TWILIO_WHATSAPP_NUMBER=<whatsapp_number>
```

## Installation

```bash
npm install
```

## Run Development Server

```bash
npm start
```

The server will start at `http://localhost:3000`

## Dependencies

- cloudinary: ^2.8.0
- cookie-parser: ^1.4.7
- ejs: ^3.1.10
- express: ^5.2.1
- jsonwebtoken: ^9.0.3
- mongoose: ^9.0.2
- multer: ^2.0.2
- razorpay: ^2.9.6
- twilio: ^5.11.2