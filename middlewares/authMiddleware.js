// middlewares/authMiddleware.js
// DEPRECATED: Use middlewares/index.js instead
// This file is kept for backwards compatibility
const jwt = require("jsonwebtoken");
const { pool } = require('../db/config');
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (req.accepts("html")) {
      return res.redirect("/dashboard/loginSignup.html");
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const userId = decoded.userId || decoded.id;

    // PASO 3: Validate token_version from database
    if (decoded.tokenVersion !== undefined) {
      const result = await pool.query(
        'SELECT token_version FROM clients WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        if (req.accepts("html")) {
          return res.redirect("/dashboard/loginSignup.html");
        }
        return res.status(401).json({ message: "User not found" });
      }

      const currentTokenVersion = result.rows[0].token_version;

      if (decoded.tokenVersion !== currentTokenVersion) {
        if (req.accepts("html")) {
          return res.redirect("/dashboard/loginSignup.html?reason=token_invalidated");
        }
        return res.status(401).json({
          message: "Token has been invalidated. Please login again.",
          reason: "token_invalidated"
        });
      }
    }

    req.user = {
      id: userId,
      email: decoded.email,
      tokenVersion: decoded.tokenVersion
    };

    next();
  } catch (err) {
    if (req.accepts("html")) {
      return res.redirect("/dashboard/loginSignup.html");
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

