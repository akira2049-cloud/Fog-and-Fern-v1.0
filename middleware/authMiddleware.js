exports.requireAuth = (req,res,next) => {
  if (!req.session.user) {
    req.flash("error","Please log in to access your account.");
    return res.redirect(`/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
};
exports.requireAdmin = (req,res,next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    req.flash("error","Administrator access is required.");
    return res.redirect("/auth/login");
  }
  next();
};
exports.redirectIfAuthenticated = (req,res,next) => {
  if (req.session.user) return res.redirect(req.session.user.role === "admin" ? "/admin" : "/account");
  next();
};
