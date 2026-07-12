const path = require("path");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "..", "plant-shop.db"));
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK(price >= 0),
  sale_price REAL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  image_url TEXT,
  light_requirement TEXT,
  water_requirement TEXT,
  difficulty TEXT,
  pet_safe INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  zip_code TEXT,
  fulfillment TEXT NOT NULL CHECK(fulfillment IN ('delivery','pickup')),
  payment_method TEXT NOT NULL,
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id,user_id),
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

const seed = db.transaction(() => {
  const categoryCount = db.prepare("SELECT COUNT(*) count FROM categories").get().count;
  if (!categoryCount) {
    const insert = db.prepare("INSERT INTO categories (name,slug,description,image_url) VALUES (?,?,?,?)");
    [
      ["Indoor Plants","indoor-plants","Greenery selected for apartments and homes.","https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=85"],
      ["Low-Light Plants","low-light-plants","Resilient plants for lower-light rooms.","https://images.unsplash.com/photo-1593691509543-c55fb32e5cee?auto=format&fit=crop&w=900&q=85"],
      ["Pet-Friendly Plants","pet-friendly-plants","Safer options for homes with cats and dogs.","https://images.unsplash.com/photo-1611211232932-da3113c5b960?auto=format&fit=crop&w=900&q=85"],
      ["Succulents","succulents","Compact, sculptural plants for sunny spaces.","https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=900&q=85"],
      ["Large Floor Plants","large-floor-plants","Statement plants for open rooms and offices.","https://images.unsplash.com/photo-1614594575810-0144c2b5e091?auto=format&fit=crop&w=900&q=85"],
      ["Pots & Accessories","pots-accessories","Planters, soil, tools, and care essentials.","https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=85"]
    ].forEach(x => insert.run(...x));
  }
  const productCount = db.prepare("SELECT COUNT(*) count FROM products").get().count;
  if (!productCount) {
    const cats = Object.fromEntries(db.prepare("SELECT id,slug FROM categories").all().map(c => [c.slug,c.id]));
    const insert = db.prepare(`INSERT INTO products
      (category_id,name,slug,description,price,sale_price,stock,image_url,light_requirement,water_requirement,difficulty,pet_safe,featured)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    [
      [cats['indoor-plants'],"Monstera Deliciosa","monstera-deliciosa","A dramatic tropical plant with iconic split leaves. Each plant is nursery-grown and inspected before delivery.",38,null,14,"https://images.unsplash.com/photo-1614594575810-0144c2b5e091?auto=format&fit=crop&w=900&q=85","Bright indirect light","Every 7–10 days","Beginner",0,1],
      [cats['low-light-plants'],"Snake Plant","snake-plant","An architectural and forgiving plant that tolerates a wide range of indoor conditions.",28,24,22,"https://images.unsplash.com/photo-1593691509543-c55fb32e5cee?auto=format&fit=crop&w=900&q=85","Low to bright indirect","Every 2–3 weeks","Beginner",0,1],
      [cats['pet-friendly-plants'],"Calathea Orbifolia","calathea-orbifolia","Broad silver-striped leaves make this pet-friendly plant a calm focal point.",34,null,9,"https://images.unsplash.com/photo-1611211232932-da3113c5b960?auto=format&fit=crop&w=900&q=85","Medium indirect light","Keep lightly moist","Intermediate",1,1],
      [cats['succulents'],"Echeveria Rosette","echeveria-rosette","A compact rosette succulent with powdery blue-green foliage.",14,null,30,"https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=900&q=85","Bright light","When soil is dry","Beginner",0,1],
      [cats['large-floor-plants'],"Fiddle Leaf Fig","fiddle-leaf-fig","A tall statement plant with broad violin-shaped leaves.",72,64,7,"https://images.unsplash.com/photo-1597055181300-e3633a20700f?auto=format&fit=crop&w=900&q=85","Bright filtered light","Every 7–10 days","Intermediate",0,1],
      [cats['pet-friendly-plants'],"Parlor Palm","parlor-palm","A graceful, adaptable palm suitable for pet-friendly households.",42,null,11,"https://images.unsplash.com/photo-1593482892290-f54927ae2bb1?auto=format&fit=crop&w=900&q=85","Low to medium light","Weekly","Beginner",1,1],
      [cats['indoor-plants'],"Golden Pothos","golden-pothos","Fast-growing trailing foliage perfect for shelves and hanging planters.",22,null,25,"https://images.unsplash.com/photo-1596724878582-76f1a8fdc8f7?auto=format&fit=crop&w=900&q=85","Low to bright indirect","Every 1–2 weeks","Beginner",0,0],
      [cats['pots-accessories'],"Textured Ceramic Planter","textured-ceramic-planter","A neutral ceramic planter with drainage hole and matching saucer.",32,null,18,"https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=85","Not applicable","Not applicable","Not applicable",1,0]
    ].forEach(x => insert.run(...x));
  }
  const adminEmail = process.env.ADMIN_EMAIL || "admin@fogandfernsf.com";
  const admin = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if (!admin) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "Admin123!", 12);
    db.prepare("INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,'admin')")
      .run("Fog & Fern Admin", adminEmail, hash);
  }
});
seed();
module.exports = db;
