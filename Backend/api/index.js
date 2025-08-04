const router = require("express").Router();

router.use("/profiles", require("./profiles"));
router.use("/posts", require("./posts"));
router.use("/conversations", require("./conversations"));
router.use("/products", require("./products"));
router.use("/cart", require("./cart"));
router.use("/orders", require("./orders"));
router.use("/shipping-addresses", require("./shipping-addresses"));

// NEW: Add notifications routes
const { router: notificationsRouter } = require("./notifications");
router.use("/notifications", notificationsRouter);

module.exports = router;