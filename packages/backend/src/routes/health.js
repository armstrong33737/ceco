const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    centerId: req.centerId,
    mode: process.env.CECO_MODE || "local",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
