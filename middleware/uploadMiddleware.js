const path = require("path");
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, path.join(__dirname,"..","uploads","products")),
  filename: (req,file,cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname).toLowerCase()}`)
});
module.exports = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req,file,cb) => /image\/(jpeg|png|webp)/.test(file.mimetype) ? cb(null,true) : cb(new Error("Only JPG, PNG and WebP images are allowed."))
});
