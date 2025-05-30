// routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

function isValidPassword(password) {
  return /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(
    password
  );
}

router.post("/signup", async (req, res) => {
  const { user_id, user_name, email, user_password, is_vendor } = req.body;

  if (!isValidPassword(user_password)) {
    return res.status(400).json({
      error:
        "Password must be 8+ chars, include a number, letter & special character.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(user_password, 10);

    // Insert user into Supabase
    const { error } = await supabase.from("user").insert({
      user_id,
      user_name,
      email,
      user_password: hashedPassword,
      is_vendor: is_vendor ? true : false, // Supabase uses boolean instead of 0/1
    });

    if (error) throw error;

    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    console.error("❌ Signup Error:", err.message);
    res.status(500).json({ error: "Signup failed." });
  }
});

// Password validation regex
const passwordRegex =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

router.post("/register", async (req, res) => {
  const {
    email,
    password,
    username,
    first_name,
    last_name,
    address,
    is_vendor,
  } = req.body;

  // Password validation
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters long and include 1 letter, 1 number, and 1 symbol.",
    });
  }

  try {
    // Check if user exists
    const { data: existing, error: queryError } = await supabase
      .from("user")
      .select("*")
      .eq("email", email);

    if (queryError) throw queryError;

    if (existing && existing.length > 0) {
      return res
        .status(400)
        .json({ message: "User with this email already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString(); // Or use uuid

    // Insert user
    const { error: insertError } = await supabase.from("user").insert({
      user_id: userId,
      user_name: username,
      email,
      user_password: hashedPassword,
      is_vendor: is_vendor ? true : false,
      first_name,
      last_name,
      address,
    });

    if (insertError) throw insertError;

    // Generate token
    const token = jwt.sign(
      { user_id: userId, email, is_vendor },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    const userPayload = {
      user_id: userId,
      user_name: username,
      email,
      is_vendor,
      first_name,
      last_name,
      address,
    };

    return res.status(200).json({
      token,
      user: userPayload,
      message: "User registered successfully!",
    });
  } catch (err) {
    console.error("❌ Register Error:", err.message);
    return res
      .status(500)
      .json({ message: "Server error during registration." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(
    `⏱️ Login attempt for email: ${email} at ${new Date().toISOString()}`
  );

  try {
    // Find user by email
    const { data: users, error: queryError } = await supabase
      .from("user")
      .select("*")
      .eq("email", email);

    if (queryError) throw queryError;

    if (!users || users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];
    console.log("User found:", {
      user_id: user.user_id,
      email: user.email,
      is_vendor: user.is_vendor,
    });

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.user_password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        is_vendor: user.is_vendor,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Prepare user data with consistent field names
    const userData = {
      user_id: user.user_id,
      id: user.user_id, // Include both forms for compatibility
      email: user.email,
      username: user.user_name,
      user_name: user.user_name,
      is_vendor: user.is_vendor,
      paid_user: user.paid_user || false,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      address: user.address || "",
    };

    res.json({
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (err) {
    console.error("❌ Login Error:", err.message);
    res.status(500).json({ message: "Login failed due to server error." });
  }
});

module.exports = router;
