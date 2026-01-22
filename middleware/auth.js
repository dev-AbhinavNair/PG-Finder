const jwt = require("jsonwebtoken");
function requireAuth(req, res, next) {
  if (!req.user) return res.redirect("/login");

  try {
    jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    return next();
  }

  catch (err) {

    res.clearCookie("token");
    return res.redirect("/login");
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).redirect("/");
  }
  next();
}

function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).redirect("/");
  }
  next();
}

function requireSeeker(req, res, next) {
  if (!req.user || req.user.role !== "seeker") {
    return res.status(403).redirect("/");
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireOwner,
  requireSeeker,
};
