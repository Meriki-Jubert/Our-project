// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===== Database Setup =====
const db = new sqlite3.Database('./studenthub.db', (err) => {
    if (err) return console.error('Database connection error:', err.message);
    console.log('Connected to SQLite database');
});

// ===== Create Tables =====
const createTables = () => {
    db.run(`CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS teacher_courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER,
        course_id INTEGER,
        FOREIGN KEY(teacher_id) REFERENCES users(id),
        FOREIGN KEY(course_id) REFERENCES courses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS student_grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        course_id INTEGER,
        grade TEXT,
        FOREIGN KEY(student_id) REFERENCES users(id),
        FOREIGN KEY(course_id) REFERENCES courses(id),
        UNIQUE(student_id, course_id)
    )`);

    db.run( `CREATE TABLE IF NOT EXISTS grade_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  reported_at TEXT NOT NULL
)`);
};

createTables();

const staticCourses = [
    "Architecture",
    "Basic Environment II",
    "Database & MERISE",
    "Engineering Maths",
    "Economics & Enterprise Organization",
    "General Accounting",
    "Maintenance and Legal Regulations",
    "Programming I"
];

function insertStaticCourses() {
    staticCourses.forEach(course => {
        db.run(`INSERT OR IGNORE INTO courses (name) VALUES (?)`, [course]);
    });
}
insertStaticCourses();

// ===== Routes =====

// Signup
app.post('/api/signup', (req, res) => {
    const { name, email, password, role, courses = [] } = req.body;
    db.run(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        [name, email, password, role],
        function (err) {
            if (err) return res.status(400).json({ message: 'User already exists or error occurred.' });
            const userId = this.lastID;

            if (role === 'teacher') {
                const stmt = db.prepare(`INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)`);
                let remaining = courses.length;

                courses.forEach(courseName => {
                    db.get(`SELECT id FROM courses WHERE name = ?`, [courseName], (err, row) => {
                        if (row) stmt.run(userId, row.id);
                        remaining--;
                        if (remaining === 0) {
                            stmt.finalize();
                        }
                    });
                });

                if (courses.length === 0) {
                    stmt.finalize();
                }
            }

            res.json({ message: 'Signup successful' });
        }
    );
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(
        `SELECT * FROM users WHERE email = ? AND password = ?`,
        [email, password],
        (err, user) => {
            if (err || !user) return res.status(400).json({ message: 'Invalid credentials' });

            if (user.role === 'teacher') {
                db.all(
                    `SELECT c.name AS course
                     FROM courses c
                     JOIN teacher_courses tc ON c.id = tc.course_id
                     WHERE tc.teacher_id = ?`,
                    [user.id],
                    (err, rows) => {
                        if (err) return res.status(500).json({ message: 'Failed to fetch teacher courses' });
                        const courses = rows.map(row => row.course);
                        res.json({ user: { ...user, courses } });
                    }
                );
            } else {
                res.json({ user });
            }
        }
    );
});

// Get student grades by email
app.get('/api/students/:email', (req, res) => {
    const email = req.params.email;
    db.get(
        `SELECT id, name FROM users WHERE email = ?`,
        [email],
        (err, user) => {
            if (err || !user) return res.status(404).json({ message: 'Student not found' });

            db.all(
                `SELECT c.name as course, sg.grade
                 FROM courses c
                 LEFT JOIN student_grades sg ON sg.course_id = c.id AND sg.student_id = ?
                 ORDER BY c.id`,
                [user.id],
                (err, rows) => {
                    if (err) return res.status(500).json({ message: 'Failed to retrieve grades' });
                    const grades = {};
                    rows.forEach(row => { grades[row.course] = row.grade || ''; });
                    res.json({ name: user.name, grades });
                }
            );
        }
    );
});

// Get students by course
app.get('/api/students', (req, res) => {
    const course = req.query.course;

    db.get(`SELECT id FROM courses WHERE name = ?`, [course], (err, courseRow) => {
        if (err || !courseRow) return res.status(400).json({ message: 'Course not found' });
        const courseId = courseRow.id;

        db.all(`SELECT id, name FROM users WHERE role = 'student'`, [], (err, students) => {
            if (err) return res.status(500).json({ message: 'Failed to get students' });

            const promises = students.map(student => {
                return new Promise(resolve => {
                    db.get(
                        `SELECT grade FROM student_grades WHERE student_id = ? AND course_id = ?`,
                        [student.id, courseId],
                        (err, row) => {
                            resolve({
                                id: student.id,
                                name: student.name,
                                grades: { [course]: row ? row.grade : '' }
                            });
                        }
                    );
                });
            });

            Promise.all(promises).then(results => res.json(results));
        });
    });
});
// Update student's grade for a specific course
app.put('/api/students/:studentId/grades', (req, res) => {
  const { studentId } = req.params;
  const { course, grade } = req.body;

  const sql = `UPDATE grades SET grade = ? WHERE student_id = ? AND course = ?`;
  const params = [grade, studentId, course];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Grade or course not found' });
    }
    res.json({ message: 'Grade updated successfully' });
  });
});
// Update student grade
app.put('/api/students/:id', (req, res) => {
    const studentId = req.params.id;
    const { course, grade } = req.body;

    db.get(`SELECT id FROM courses WHERE name = ?`, [course], (err, row) => {
        if (!row) return res.status(400).json({ message: 'Course not found' });
        const courseId = row.id;

        db.run(
            `INSERT INTO student_grades (student_id, course_id, grade)
             VALUES (?, ?, ?)
             ON CONFLICT(student_id, course_id) DO UPDATE SET grade = excluded.grade`,
            [studentId, courseId, grade],
            function (err) {
                if (err) return res.status(500).json({ message: 'Failed to update grade' });
                res.json({ message: 'Grade updated successfully' });
            }
        );
    });
});

// Report Grade Issue (Student Complaints)
app.post('/api/report-issue', (req, res) => {
    const { studentId, subject, message } = req.body;

    if (!studentId || !subject || !message) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    db.get(`SELECT name FROM users WHERE id = ?`, [studentId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const studentName = row.name;
        const reportedAt = new Date().toISOString();

        db.run(
            `INSERT INTO grade_issues (student_id, student_name, subject, message, reported_at)
             VALUES (?, ?, ?, ?, ?)`,
            [studentId, studentName, subject, message, reportedAt],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to record issue' });
                }
                res.json({ message: 'Grade issue reported successfully' });
            }
        );
    });
});

// Get complaints (grade issues) filtered by courses
app.get('/api/complaints', (req, res) => {
    const coursesParam = req.query.courses; // Comma-separated course names
    if (!coursesParam) {
        return res.status(400).json({ message: 'Courses query parameter is required' });
    }

    const courses = coursesParam.split(',').map(c => c.trim());

    // We'll fetch complaints where the subject matches any of the courses the teacher teaches
    const placeholders = courses.map(() => '?').join(',');

    const sql = `
      SELECT id, student_id, student_name, subject, message, reported_at
      FROM grade_issues
      WHERE subject IN (${placeholders})
      ORDER BY reported_at DESC
    `;

    db.all(sql, courses, (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch complaints' });
        }
        res.json(rows);
    });
});

// Delete a single complaint by id
app.delete('/api/complaints/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM grade_issues WHERE student_id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ message: 'Failed to delete complaint' });
        if (this.changes === 0) return res.status(404).json({ message: 'Complaint not found' });
        res.json({ message: 'Complaint deleted successfully' });
    });
});

// Delete all complaints
app.delete('/api/complaints', (req, res) => {
    db.run(`DELETE FROM grade_issues`, function(err) {
        if (err) return res.status(500).json({ message: 'Failed to delete complaints' });
        res.json({ message: 'All complaints deleted successfully' });
    });
});

// ===== Start Server =====
app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
});