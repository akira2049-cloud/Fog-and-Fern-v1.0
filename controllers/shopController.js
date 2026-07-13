const db = require("../config/database");
exports.index = (req,res) => {
  const { q="", category="", sort="featured", pet_safe="" }=req.query;
  let sql=`SELECT p.*,c.name category_name,c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1`;
  const params=[];
  if(q){ sql += " AND (p.name LIKE ? OR p.description LIKE ?)"; params.push(`%${q}%`,`%${q}%`); }
  if(category){ sql += " AND c.slug=?"; params.push(category); }
  if(pet_safe==="1") sql += " AND p.pet_safe=1";
  const sorts={price_asc:"COALESCE(p.sale_price,p.price) ASC",price_desc:"COALESCE(p.sale_price,p.price) DESC",newest:"p.id DESC",name:"p.name ASC",featured:"p.featured DESC,p.id DESC"};
  sql += ` ORDER BY ${sorts[sort]||sorts.featured}`;
  const products=db.prepare(sql).all(...params);
  const categories=db.prepare("SELECT * FROM categories WHERE active=1 ORDER BY name").all();
  res.render("shop/index",{title:"Shop Plants | Fog & Fern SF",page:"shop",products,categories,filters:{q,category,sort,pet_safe}});
};
exports.category = (req,res) => { req.query.category=req.params.slug; return exports.index(req,res); };
exports.details = (req,res,next) => {
  const product=db.prepare(`SELECT p.*,c.name category_name,c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.slug=? AND p.active=1`).get(req.params.slug);
  if(!product) return next();
  const related=db.prepare(`SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 AND p.category_id=? AND p.id<>? LIMIT 4`).all(product.category_id,product.id);
  const reviews=db.prepare(`SELECT r.*,u.full_name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? AND r.approved=1 ORDER BY r.id DESC`).all(product.id);
  const rating=db.prepare("SELECT ROUND(AVG(rating),1) average,COUNT(*) count FROM reviews WHERE product_id=? AND approved=1").get(product.id);
  res.render("shop/details",{title:`${product.name} | Fog & Fern SF`,page:"shop",product,related,reviews,rating});
};
exports.review = (req,res) => {
  if(!req.session.user){ req.flash("error","Log in to leave a review."); return res.redirect(`/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`); }
  const product=db.prepare("SELECT id,slug FROM products WHERE id=?").get(req.params.id);
  if(!product) return res.redirect("/shop");
  const rating=Math.max(1,Math.min(5,Number(req.body.rating)||5));
  const comment=(req.body.comment||"").trim();
  if(!comment){ req.flash("error","Please write a review comment."); return res.redirect(`/shop/${product.slug}`); }
  db.prepare(`INSERT INTO reviews (product_id,user_id,rating,comment) VALUES (?,?,?,?) ON CONFLICT(product_id,user_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,created_at=CURRENT_TIMESTAMP`).run(product.id,req.session.user.id,rating,comment);
  req.flash("success","Your review was saved."); res.redirect(`/shop/${product.slug}`);
};
