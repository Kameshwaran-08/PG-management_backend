// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');

// Initialize Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// -------------------- 🔥 Firebase Admin Setup --------------------
// NOTE: You asked not to modify your Firebase setup, so this remains exactly as you provided.
const serviceAccount = require('./firebase-admin-key.json'); // download from Firebase console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware to verify Firebase token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized - Token missing' });

  admin
    .auth()
    .verifyIdToken(token)
    .then((decodedToken) => {
      req.user = decodedToken;
      next();
    })
    .catch((error) => {
      console.error('❌ Invalid Token:', error);
      res.status(401).json({ message: 'Unauthorized - Invalid token' });
    });
}

// -------------------- 🗄️ PostgreSQL (Supabase) Setup --------------------
// Uses environment variables if provided, otherwise falls back to your original values.
const db = new Pool({
  host: process.env.DB_HOST || 'db.mxzlmwvbzkgjwmjhwoyf.supabase.co',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Klmno1234#', // replace with your Supabase DB password or set env var
  database: process.env.DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
});

// -------------------- 🚀 Connect to DB --------------------
db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to PostgreSQL (Supabase)');

  // Use host-assigned port if provided (Render/Heroku/Railway), otherwise 8080
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  initRoutes();
});

// -------------------- 🌐 Routes --------------------
function initRoutes() {
  // --- Students ---
  app.get('/api/students', verifyToken, (req, res) => {
    db.query(
      'SELECT id, name, room_number, bed_number, contact, payment_status FROM students',
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch students', error: err.message });
        res.json(result.rows);
      }
    );
  });

  app.post('/api/students', verifyToken, (req, res) => {
    const { name, room_number, bed_number, contact } = req.body;
    const roomNum = parseInt(room_number);
    const bedNum = parseInt(bed_number);

    if (!name || isNaN(roomNum) || isNaN(bedNum) || roomNum < 1 || roomNum > 12 || bedNum < 1 || bedNum > 3) {
      return res.status(400).json({ message: 'Invalid student data' });
    }

    db.query(
      'INSERT INTO students (name, room_number, bed_number, contact) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, roomNum, bedNum, contact],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });
        res.json({ message: 'Student added successfully', id: result.rows[0].id });
      }
    );
  });

  app.delete('/api/students/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM students WHERE id = $1', [req.params.id], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to delete student', error: err.message });
      res.json({ message: 'Student deleted successfully' });
    });
  });

  app.put('/api/students/:id/payment', verifyToken, (req, res) => {
    const { payment_status } = req.body;
    db.query('UPDATE students SET payment_status = $1 WHERE id = $2', [payment_status, req.params.id], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update payment', error: err.message });
      res.json({ message: 'Payment status updated successfully' });
    });
  });

  // --- Food Menu ---
  app.get('/api/food-menu', (req, res) => {
    db.query('SELECT day, breakfast, lunch, dinner FROM food_menu', (err, result) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch menu', error: err.message });
      res.json(result.rows);
    });
  });

  app.post('/api/food-menu', verifyToken, (req, res) => {
    const menu = req.body;
    if (!Array.isArray(menu) || menu.length !== 7) {
      return res.status(400).json({ message: 'Menu should be an array of 7 items' });
    }

    db.query('DELETE FROM food_menu', (err) => {
      if (err) return res.status(500).json({ message: 'Failed to clear old menu', error: err.message });

      let completed = 0;
      menu.forEach((item) => {
        db.query(
          'INSERT INTO food_menu (day, breakfast, lunch, dinner) VALUES ($1, $2, $3, $4)',
          [item.day, item.breakfast, item.lunch, item.dinner],
          (err) => {
            if (err) console.error('❌ Failed to insert menu item:', err);
            completed++;
            if (completed === menu.length) res.json({ message: 'Menu updated successfully' });
          }
        );
      });
    });
  });

  // --- Feedback ---
  app.get('/api/feedback', (req, res) => {
    db.query('SELECT id, name, room_number, message, created_at FROM feedback ORDER BY created_at DESC', (err, result) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch feedback', error: err.message });
      res.json(result.rows);
    });
  });

  app.post('/api/feedback', (req, res) => {
    const { name, room_number, message } = req.body;
    db.query(
      'INSERT INTO feedback (name, room_number, message) VALUES ($1, $2, $3) RETURNING id',
      [name, room_number, message],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to submit feedback', error: err.message });
        res.json({ message: 'Feedback submitted successfully', id: result.rows[0].id });
      }
    );
  });

  app.delete('/api/feedback', verifyToken, (req, res) => {
    db.query('DELETE FROM feedback', (err) => {
      if (err) return res.status(500).json({ message: 'Failed to clear feedback', error: err.message });
      res.json({ message: 'All feedback cleared successfully' });
    });
  });

  // --- Laundry ---
  app.get('/api/laundry', verifyToken, (req, res) => {
    db.query('SELECT id, student_name, room_number, laundry_type, quantity, status FROM laundry', (err, result) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch laundry', error: err.message });
      res.json(result.rows);
    });
  });

  app.post('/api/laundry', (req, res) => {
    const { student_name, room_number, laundry_type, quantity } = req.body;
    db.query(
      'INSERT INTO laundry (student_name, room_number, laundry_type, quantity) VALUES ($1, $2, $3, $4) RETURNING id',
      [student_name, room_number, laundry_type, quantity],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to submit laundry', error: err.message });
        res.json({ message: 'Laundry request submitted successfully', id: result.rows[0].id });
      }
    );
  });

  app.put('/api/laundry/:id', verifyToken, (req, res) => {
    const { status } = req.body;
    db.query('UPDATE laundry SET status = $1 WHERE id = $2', [status, req.params.id], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update laundry', error: err.message });
      res.json({ message: 'Laundry status updated successfully' });
    });
  });

  app.delete('/api/laundry', verifyToken, (req, res) => {
    db.query('DELETE FROM laundry', (err) => {
      if (err) return res.status(500).json({ message: 'Failed to clear laundry', error: err.message });
      res.json({ message: 'All laundry requests cleared successfully' });
    });
  });
}

