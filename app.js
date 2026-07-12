require("dotenv").config();

const path = require("path");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const flash = require("connect-flash");
const methodOverride = require("method-override");

require("./config/database");

const homeRoutes = require("./routes/homeRoutes");
const shopRoutes = require("./routes/shopRoutes");
const cartRoutes = require("./routes/cartRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/main");
app.use(expressLayouts);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(session({
  store: new SQLiteStore({ db: "sessions.db", dir: __dirname }),
  secret: process.env.SESSION_SECRET || "development-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true, sameSite: "lax" }
}));
app.use(flash());

app.use((req, res, next) => {
  const cart = req.session.cart || {};
  res.locals.currentUser = req.session.user || null;
  res.locals.cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  res.locals.successMessages = req.flash("success");
  res.locals.errorMessages = req.flash("error");
  res.locals.page = "";
  next();
});

app.use("/", homeRoutes);
app.use("/shop", shopRoutes);
app.use("/cart", cartRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/auth", authRoutes);
app.use("/account", accountRoutes);
app.use("/admin", adminRoutes);

app.use((req, res) => res.status(404).render("error", {
  title: "Page Not Found",
  page: "error",
  statusCode: 404,
  message: "The page you requested does not exist."
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render("error", {
    title: "Server Error",
    page: "error",
    statusCode: 500,
    message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong."
  });
});

app.listen(PORT, () => console.log(`Fog & Fern SF running at http://localhost:${PORT}`));
