const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const sendOtp = async (phone, otp) => {
    try {
        if (!process.env.TWILIO_WHATSAPP_NUMBER) {
            throw new Error('TWILIO_WHATSAPP_NUMBER is not defined in .env');
        }

        let formattedPhone = phone.trim().replace(/\s+/g, '');

        if (formattedPhone.length === 10 && !formattedPhone.startsWith('+')) {
            formattedPhone = `+91${formattedPhone}`;
        } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = `+${formattedPhone}`;
        }

        const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER.trim()}`;
        const toNumber = `whatsapp:${formattedPhone}`;

        console.log(`Attempting to send WhatsApp OTP from ${fromNumber} to ${toNumber}`);

        const message = await client.messages.create({
            body: `Your FindMyPG verification code is: ${otp}. Valid for 5 minutes.`,
            from: fromNumber,
            to: toNumber
        });

        console.log(`Twilio WhatsApp message sent: ${message.sid}`);
        return message;
    } catch (err) {
        console.error('Error sending Twilio WhatsApp message:', {
            error: err.message,
            code: err.code,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: phone
        });
        throw err;
    }
};

module.exports = {
    sendOtp
};
