const db = require("../config/database");
exports.home = (req,res) => {
  const categories = db.prepare("SELECT * FROM categories WHERE active=1 ORDER BY id LIMIT 6").all();
  const products = db.prepare(`SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 AND p.featured=1 ORDER BY p.id DESC LIMIT 8`).all();
  res.render("home", { title:"Fog & Fern SF | San Francisco Plant Shop", page:"home", categories, products });
};
exports.page = (view,title,page) => (req,res) => res.render(`pages/${view}`, { title, page });
exports.contact = (req,res) => res.render("pages/contact", { title:"Contact | Fog & Fern SF", page:"contact" });
exports.submitContact = (req,res) => {
  const {name,email,subject,message}=req.body;
  if(!name||!email||!subject||!message){ req.flash("error","Please complete every contact field."); return res.redirect("/contact"); }
  db.prepare("INSERT INTO contact_messages (name,email,subject,message) VALUES (?,?,?,?)").run(name.trim(),email.trim().toLowerCase(),subject.trim(),message.trim());
  req.flash("success","Thanks! Your message has been received."); res.redirect("/contact");
};
exports.newsletter = (req,res) => {
  const email=(req.body.email||"").trim().toLowerCase();
  if(!email){ req.flash("error","Please enter an email address."); return res.redirect(req.get("referer")||"/"); }
  try { db.prepare("INSERT INTO newsletter_subscribers (email) VALUES (?)").run(email); req.flash("success","You are subscribed to Fog & Fern updates."); }
  catch { req.flash("success","You are already subscribed."); }
  res.redirect(req.get("referer")||"/");
};
