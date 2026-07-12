const router=require("express").Router();const c=require("../controllers/homeController");
router.get("/",c.home);
router.get("/plant-care",c.page("plant-care","Plant Care Guide | Fog & Fern SF","plant-care"));
router.get("/services",c.page("services","Plant Services | Fog & Fern SF","services"));
router.get("/about",c.page("about","About Fog & Fern SF","about"));
router.get("/delivery",c.page("delivery","Delivery & Pickup | Fog & Fern SF","delivery"));
router.get("/contact",c.contact);router.post("/contact",c.submitContact);router.post("/newsletter",c.newsletter);
router.get("/privacy",c.page("privacy","Privacy Policy | Fog & Fern SF",""));router.get("/terms",c.page("terms","Terms | Fog & Fern SF",""));router.get("/refund-policy",c.page("refund","Refund Policy | Fog & Fern SF",""));
module.exports=router;
