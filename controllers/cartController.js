const db=require("../config/database");
function hydrate(req){
  const cart=req.session.cart||{}; const items=[];
  for(const [id,row] of Object.entries(cart)){
    const p=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(id);
    if(p){ const price=p.sale_price||p.price; const quantity=Math.min(row.quantity,p.stock); items.push({...p,quantity,unit_price:price,line_total:price*quantity}); }
  }
  return items;
}
exports.index=(req,res)=>{const items=hydrate(req); const subtotal=items.reduce((s,i)=>s+i.line_total,0); res.render("cart/index",{title:"Your Cart | Fog & Fern SF",page:"cart",items,subtotal});};
exports.add=(req,res)=>{
  const p=db.prepare("SELECT id,name,stock FROM products WHERE id=? AND active=1").get(req.params.id);
  if(!p||p.stock<1){req.flash("error","This product is currently unavailable.");return res.redirect(req.get("referer")||"/shop");}
  req.session.cart=req.session.cart||{}; const current=req.session.cart[p.id]?.quantity||0; const quantity=Math.max(1,Number(req.body.quantity)||1);
  req.session.cart[p.id]={quantity:Math.min(current+quantity,p.stock)}; req.flash("success",`${p.name} was added to your cart.`); res.redirect(req.get("referer")||"/cart");
};
exports.update=(req,res)=>{const id=req.params.id; const q=Math.max(0,Number(req.body.quantity)||0); const p=db.prepare("SELECT stock FROM products WHERE id=?").get(id); if(!req.session.cart)req.session.cart={}; if(!p||q===0)delete req.session.cart[id]; else req.session.cart[id]={quantity:Math.min(q,p.stock)}; res.redirect("/cart");};
exports.remove=(req,res)=>{if(req.session.cart)delete req.session.cart[req.params.id];req.flash("success","Item removed from cart.");res.redirect("/cart");};
exports.clear=(req,res)=>{req.session.cart={};req.flash("success","Your cart is now empty.");res.redirect("/cart");};
exports.hydrate=hydrate;
