// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg'); // <-- PostgreSQL client

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- Supabase PostgreSQL Connection ---
const db = new Pool({
  host: 'db.mxzlmwvbzkgjwmjhwoyf.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'Klmno1234#', // 🔒 Replace this with your Supabase DB password
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

// --- Database connection check ---
db.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to PostgreSQL (Supabase)');

  // Start server AFTER DB connection
  app.listen(8080, () => console.log('🚀 Server running on port 8080'));

  // --- Routes ---
  initRoutes();
});

// --- Routes Definition ---
function initRoutes() {

  // --- Students ---
  app.get('/api/students', (req, res) => {
    db.query(
      "SELECT id, name, room_number, bed_number, contact, payment_status FROM students",
      (err, result) => {
        if (err) {
          console.error('❌ Error fetching students:', err);
          return res.status(500).json({ message: 'Failed to fetch students', error: err.message });
        }
        res.json(result.rows);
      }
    );
  });

  app.post('/api/students', (req, res) => {
    console.log('📩 Incoming student data:', req.body);
    const { name, room_number, bed_number, contact } = req.body;
    const roomNum = parseInt(room_number);
    const bedNum = parseInt(bed_number);

    if (!name || isNaN(roomNum) || isNaN(bedNum) || roomNum < 1 || roomNum > 12 || bedNum < 1 || bedNum > 3) {
      return res.status(400).json({ message: 'Invalid student data' });
    }

    db.query(
      "INSERT INTO students (name, room_number, bed_number, contact) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, roomNum, bedNum, contact],
      (err, result) => {
        if (err) {
          console.error('❌ Error inserting student:', err);
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        res.json({ message: 'Student added successfully', id: result.rows[0].id });
      }
    );
  });

  app.delete('/api/students/:id', (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM students WHERE id = $1", [id], (err) => {
      if (err) {
        console.error('❌ Error deleting student:', err);
        return res.status(500).json({ message: 'Failed to delete student', error: err.message });
      }
      res.json({ message: 'Student deleted successfully' });
    });
  });

  app.put('/api/students/:id/payment', (req, res) => {
    const { id } = req.params;
    const { payment_status } = req.body;
    db.query(
      "UPDATE students SET payment_status = $1 WHERE id = $2",
      [payment_status, id],
      (err) => {
        if (err) {
          console.error('❌ Error updating payment status:', err);
          return res.status(500).json({ message: 'Failed to update payment', error: err.message });
        }
        res.json({ message: 'Payment status updated successfully' });
      }
    );
  });

  // --- Food Menu ---
  app.get('/api/food-menu', (req, res) => {
    db.query("SELECT day, breakfast, lunch, dinner FROM food_menu", (err, result) => {
      if (err) {
        console.error('❌ Error fetching food menu:', err);
        return res.status(500).json({ message: 'Failed to fetch menu', error: err.message });
      }
      res.json(result.rows);
    });
  });

  app.post('/api/food-menu', (req, res) => {
    const menu = req.body; // Array of 7 days
    if (!Array.isArray(menu) || menu.length !== 7) {
      return res.status(400).json({ message: 'Menu should be an array of 7 items' });
    }

    db.query("DELETE FROM food_menu", (err) => {
      if (err) return res.status(500).json({ message: 'Failed to clear old menu', error: err.message });

      let completed = 0;
      menu.forEach(item => {
        db.query(
          "INSERT INTO food_menu (day, breakfast, lunch, dinner) VALUES ($1, $2, $3, $4)",
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
    db.query(
      "SELECT id, name, room_number, message, created_at FROM feedback ORDER BY created_at DESC",
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch feedback', error: err.message });
        res.json(result.rows);
      }
    );
  });

  app.post('/api/feedback', (req, res) => {
    const { name, room_number, message } = req.body;
    db.query(
      "INSERT INTO feedback (name, room_number, message) VALUES ($1, $2, $3) RETURNING id",
      [name, room_number, message],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to submit feedback', error: err.message });
        res.json({ message: 'Feedback submitted successfully', id: result.rows[0].id });
      }
    );
  });

  app.delete('/api/feedback', (req, res) => {
    db.query("DELETE FROM feedback", (err) => {
      if (err) return res.status(500).json({ message: 'Failed to clear feedback', error: err.message });
      res.json({ message: 'All feedback cleared successfully' });
    });
  });

  // --- Laundry ---
  app.get('/api/laundry', (req, res) => {
    db.query(
      "SELECT id, student_name, room_number, laundry_type, quantity, status FROM laundry",
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch laundry', error: err.message });
        res.json(result.rows);
      }
    );
  });

  app.post('/api/laundry', (req, res) => {
    const { student_name, room_number, laundry_type, quantity } = req.body;
    db.query(
      "INSERT INTO laundry (student_name, room_number, laundry_type, quantity) VALUES ($1, $2, $3, $4) RETURNING id",
      [student_name, room_number, laundry_type, quantity],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to submit laundry', error: err.message });
        res.json({ message: 'Laundry request submitted successfully', id: result.rows[0].id });
      }
    );
  });

  app.put('/api/laundry/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.query(
      "UPDATE laundry SET status = $1 WHERE id = $2",
      [status, id],
      (err) => {
        if (err) return res.status(500).json({ message: 'Failed to update laundry', error: err.message });
        res.json({ message: 'Laundry status updated successfully' });
      }
    );
  });

  app.delete('/api/laundry', (req, res) => {
    db.query("DELETE FROM laundry", (err) => {
      if (err) return res.status(500).json({ message: 'Failed to clear laundry', error: err.message });
      res.json({ message: 'All laundry requests cleared successfully' });
    });
  });
}
