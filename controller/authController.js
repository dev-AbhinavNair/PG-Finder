const Otp = require("../models/Otp");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.getRegisterUser = (req, res) => {
  res.render("seeker/register-user", { error: null });
};

exports.postRegisterUser = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res.render("seeker/register-user", {
        error: "Name and phone are required",
      });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.render("seeker/register-user", {
        error: "Phone already registered. Please login.",
      });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.updateMany({ phone, used: false }, { used: true });
    await Otp.create({ phone, code, expiresAt, used: false });

    console.log(`OTP for ${phone}: ${code}`);

    return res.render("otp/verify-otp", {
      phone,
      purpose: "register",
      name,
      email: email || "",
      role: "seeker",
      error: null,
    });
  } catch (err) {
    console.error(err);
    return res.render("seeker/register-user", {
      error: "Something went wrong. Try again.",
    });
  }
};

exports.getRegisterOwner = (req, res) => {
  res.render("owner/register-owner", { error: null });
};

exports.postRegisterOwner = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res.render("owner/register-owner", {
        error: "Name and phone are required",
      });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.render("owner/register-owner", {
        error: "Phone already registered. Please login.",
      });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.updateMany({ phone, used: false }, { used: true });
    await Otp.create({ phone, code, expiresAt, used: false });

    console.log(`OTP for ${phone}: ${code}`);

    return res.render("otp/verify-otp", {
      phone,
      purpose: "register",
      name,
      email: email || "",
      role: "owner",
      error: null,
    });
  } catch (err) {
    console.error(err);
    return res.render("owner/register-owner", {
      error: "Something went wrong. Try again.",
    });
  }
};

exports.getLogin = (req, res) => {
  res.render("seeker/login", { error: null });
};

exports.postLogin = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.render("seeker/login", { error: "Phone number is required" });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.updateMany({ phone, used: false }, { used: true });
    await Otp.create({ phone, code, expiresAt, used: false });

    console.log(`OTP for ${phone}: ${code}`);

    return res.render("otp/verify-otp", {
      phone,
      error: null,
      purpose: "login",
    });
  }
  catch (err) {
    console.error(err);
    return res.render("seeker/login", {
      error: "Something went wrong. Try again.",
    });
  }
};

exports.postVerifyOtp = async (req, res) => {
  try {
    const { phone, otp, purpose, name, email, role } = req.body;

    if (!phone || !otp) {
      return res.render("otp/verify-otp", {
        phone,
        error: "Phone and OTP are required",
        purpose,
      });
    }

    const record = await Otp.findOne({ phone, used: false }).sort({
      createdAt: -1,
    });
    
    if (!record) {
      return res.render("otp/verify-otp", {
        phone,
        error: "OTP expired. Please resend.",
        purpose,
      });
    }

    if (new Date() > record.expiresAt) {
      record.used = true;
      await record.save();
      return res.render("otp/verify-otp", {
        phone,
        error: "OTP expired. Please resend.",
        purpose,
      });
    }

    if (record.code !== otp) {
      return res.render("otp/verify-otp", {
        phone,
        error: "Invalid OTP.",
        purpose,
      });
    }

    record.used = true;
    await record.save();

    let user = await User.findOne({ phone });

    if (!user) {
      const finalRole = role === "owner" ? "owner" : "seeker";

      user = await User.create({
        name: name || "User",
        phone,
        email: email || undefined,
        role: finalRole,
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect("/");
  } catch (err) {
    console.error(err);
    return res.render("otp/verify-otp", {
      phone: req.body.phone,
      error: "Something went wrong.",
      purpose: req.body.purpose,
    });
  }
};

exports.postLogout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res.redirect("/login");
};
