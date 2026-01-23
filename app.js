const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static("uploads"));
app.use("/media", express.static("media"));

function attachUser(req, res, next) {
  const token = req.cookies.token;
  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.clearCookie("token");
  }
  return next();
}
app.use(attachUser);

dotenv.config();
app.set("view engine", "ejs");

const { requireAuth, requireAdmin } = require("./middleware/auth");

const authRouter = require("./router/authRouter");
app.use("/", authRouter);

const ownerRouter = require("./router/ownerRouter");
app.use("/owner", ownerRouter);

const seekerRouter = require("./router/seekerRouter");
const seekerController = require("./controller/seekerController");
app.use("/", seekerRouter);

app.get("/", (req, res) => {
  if (!req.user) {
    return seekerController.renderHome(req, res);
  }

  if (req.user.role === "owner") {
    return res.redirect("/owner");
  }

  if (req.user.role === "admin") {
    return res.redirect("/admin/listings");
  }

  return res.redirect("/home");
});

app.get("/home", requireAuth, async (req, res) => {
  if (req.user.role !== "seeker") {
    return res.redirect("/register/user");
  }
  return seekerController.renderHome(req, res);
});

const adminRouter = require("./router/adminRouter");

app.use("/admin", adminRouter);

app.use((req, res) => {
  res.status(404).render("errors/404", { url: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).render(err.status === 504 ? "errors/504" : "errors/500", {
    message: err.message || "Something went wrong",
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected!");
    app.listen(process.env.PORT, () => {
      console.log(
        `Server running at http://localhost:${process.env.PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(" MongoDB failed:", error.message);
    process.exit(1);
  });
