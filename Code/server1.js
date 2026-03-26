// server1.js — StudentHub Backend
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const os = require('os');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database('./studenthub.db', err => {
    if (err) return console.error('DB error:', err.message);
    console.log('Connected to SQLite database');
});

// GPA: standard 4.0 scale
const GRADE_POINTS = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'E+': 0.5, 'E': 0.3, 'E-': 0.1,
    'F+': 0.0, 'F': 0.0, 'F-': 0.0
};

function gpaClassification(gpa) {
    if (gpa >= 3.5) return 'First Class / Distinction';
    if (gpa >= 3.0) return 'Second Class Upper / Merit';
    if (gpa >= 2.0) return 'Second Class Lower / Pass';
    return 'Fail';
}

function calculateGPA(rows) {
    let totalQP = 0, totalCreds = 0;
    rows.forEach(({ grade, credits }) => {
        if (!grade || !credits) return;
        const pts = GRADE_POINTS[grade.trim().toUpperCase()];
        if (pts !== undefined) { totalQP += pts * credits; totalCreds += credits; }
    });
    if (totalCreds === 0) return null;
    return parseFloat((totalQP / totalCreds).toFixed(2));
}

function getLanIPs() {
    const ips = [];
    Object.values(os.networkInterfaces()).forEach(iface => {
        iface.forEach(d => { if (d.family === 'IPv4' && !d.internal) ips.push(d.address); });
    });
    return ips;
}

// ── Schema & Migration ────────────────────────────────────────────────────────
function initDB() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)`);
        db.run(`CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, credits INTEGER DEFAULT 3, department_id INTEGER REFERENCES departments(id))`);
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, department_id INTEGER REFERENCES departments(id))`);
        db.run(`CREATE TABLE IF NOT EXISTS teacher_courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER, course_id INTEGER,
            FOREIGN KEY(teacher_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id),
            UNIQUE(teacher_id, course_id))`);
        db.run(`CREATE TABLE IF NOT EXISTS student_grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, course_id INTEGER, grade TEXT,
            FOREIGN KEY(student_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id),
            UNIQUE(student_id, course_id))`);
        db.run(`CREATE TABLE IF NOT EXISTS grade_issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL,
            student_name TEXT NOT NULL, subject TEXT NOT NULL,
            message TEXT NOT NULL, reported_at TEXT NOT NULL)`);
        db.run(`ALTER TABLE courses ADD COLUMN credits INTEGER DEFAULT 3`, () => { });
        db.run(`ALTER TABLE courses ADD COLUMN department_id INTEGER REFERENCES departments(id)`, () => { });
        db.run(`ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id)`, () => { });
        // Migration: add attended column to existing grade_issues tables
        db.run(`ALTER TABLE grade_issues ADD COLUMN attended INTEGER DEFAULT 0`, () => { });
    });
}
initDB();


// ══════════════ AUTH ══════════════════════════════════════════════════════════
const bcrypt = require('bcryptjs');

app.post('/api/signup', async (req, res) => {
    const { name, email, password, role, departmentId, courses = [] } = req.body;
    if (!password) return res.status(400).json({ message: 'Password required' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (name,email,password,role,department_id) VALUES (?,?,?,?,?)`,
            [name, email, hashedPassword, role, departmentId || null], function (err) {
                if (err) return res.status(400).json({ message: 'User already exists or error.' });
                const uid = this.lastID;
                if (role === 'teacher' && courses.length > 0) {
                    const stmt = db.prepare(`INSERT OR IGNORE INTO teacher_courses (teacher_id,course_id) VALUES (?,?)`);
                    let rem = courses.length;
                    courses.forEach(cid => {
                        stmt.run(uid, cid, () => { if (--rem === 0) stmt.finalize(); });
                    });
                } else if (role === 'student' && courses.length > 0) {
                    const stmt = db.prepare(`INSERT OR IGNORE INTO student_grades (student_id,course_id) VALUES (?,?)`);
                    let rem = courses.length;
                    courses.forEach(cid => {
                        stmt.run(uid, cid, () => { if (--rem === 0) stmt.finalize(); });
                    });
                }
                res.json({ message: 'Signup successful' });
            });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email=?`, [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ message: 'Invalid credentials' });

        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
        } catch (e) { }

        // Fallback for legacy plaintext passwords during the transition
        if (!isMatch && password === user.password) isMatch = true;

        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
        res.json({ user });
    });
});

// ══════════════ DEPARTMENTS ═══════════════════════════════════════════════════
app.get('/api/departments', (req, res) => {
    db.all(`SELECT * FROM departments ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch departments' });
        res.json(rows);
    });
});

app.get('/api/departments/:id/courses', (req, res) => {
    db.all(`SELECT id, name, credits FROM courses WHERE department_id=? ORDER BY name`, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch courses' });
        res.json(rows);
    });
});

app.post('/api/admin/departments', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    db.run(`INSERT INTO departments (name) VALUES (?)`, [name], function (err) {
        if (err) return res.status(400).json({ message: 'Check if department already exists' });
        res.status(201).json({ id: this.lastID, name });
    });
});

app.delete('/api/admin/departments/:id', (req, res) => {
    const id = req.params.id;
    // For simplicity, we just delete or ignore constraints depending on sqlite PRAGMA foreign_keys,
    // Typically we'd need to clear courses/users first, but this is a POC.
    // Let's set department_id to null for users/courses before deleting
    db.serialize(() => {
        db.run(`UPDATE users SET department_id=NULL WHERE department_id=?`, [id]);
        db.run(`UPDATE courses SET department_id=NULL WHERE department_id=?`, [id]);
        db.run(`DELETE FROM departments WHERE id=?`, [id], function (err) {
            if (err) return res.status(500).json({ message: 'Delete failed' });
            res.json({ message: 'Deleted' });
        });
    });
});

// ══════════════ STUDENT ═══════════════════════════════════════════════════════
app.get('/api/students/:email', (req, res) => {
    db.get(`SELECT id,name FROM users WHERE email=?`, [req.params.email], (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'Student not found' });
        db.all(`SELECT c.name AS course, c.credits, sg.grade FROM courses c
                JOIN student_grades sg ON sg.course_id=c.id AND sg.student_id=?
                ORDER BY c.id`, [user.id], (_, rows) => {
            const grades = {};
            rows.forEach(r => { grades[r.course] = { grade: r.grade || '', credits: r.credits || 3 }; });
            const graded = rows.filter(r => r.grade).map(r => ({ grade: r.grade, credits: r.credits || 3 }));
            const gpa = calculateGPA(graded);
            res.json({ name: user.name, grades, gpa, gpaClass: gpa !== null ? gpaClassification(gpa) : null });
        });
    });
});

app.get('/api/teachers/:id/courses', (req, res) => {
    db.all(`SELECT c.name FROM courses c 
            JOIN teacher_courses tc ON c.id = tc.course_id 
            WHERE tc.teacher_id=?`, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch courses' });
        res.json(rows.map(r => r.name));
    });
});

app.get('/api/students/:id/details', (req, res) => {
    db.get(`SELECT u.id, u.name, u.email, u.department_id, d.name as department_name 
            FROM users u LEFT JOIN departments d ON u.department_id = d.id 
            WHERE u.id=?`, [req.params.id], (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'User not found' });

        db.all(`SELECT course_id FROM student_grades WHERE student_id=?`, [user.id], (err, rows) => {
            user.enrolledCourseIds = rows.map(r => r.course_id);
            res.json(user);
        });
    });
});

app.post('/api/students/:id/sync-enrollment', (req, res) => {
    const { name, departmentId, courseIds = [] } = req.body;
    const studentId = req.params.id;
    const newIds = courseIds.map(Number);

    db.serialize(() => {
        // Update name and department
        db.run(`UPDATE users SET name=?, department_id=? WHERE id=?`, [name, departmentId, studentId]);

        // Fetch current enrollments
        db.all(`SELECT course_id FROM student_grades WHERE student_id=?`, [studentId], (err, rows) => {
            const currentIds = rows.map(r => r.course_id);

            // Remove courses that are no longer selected (preserves grade rows for kept courses)
            const toRemove = currentIds.filter(id => !newIds.includes(id));
            if (toRemove.length > 0) {
                const placeholders = toRemove.map(() => '?').join(',');
                db.run(`DELETE FROM student_grades WHERE student_id=? AND course_id IN (${placeholders})`,
                    [studentId, ...toRemove]);
            }

            // Add only newly selected courses (INSERT OR IGNORE won't disturb existing grade rows)
            const toAdd = newIds.filter(id => !currentIds.includes(id));
            if (toAdd.length === 0) return res.json({ message: 'Enrollment synced successfully' });

            const stmt = db.prepare(`INSERT OR IGNORE INTO student_grades (student_id, course_id) VALUES (?, ?)`);
            let rem = toAdd.length;
            toAdd.forEach(cid => {
                stmt.run(studentId, cid, () => {
                    if (--rem === 0) {
                        stmt.finalize();
                        res.json({ message: 'Enrollment synced successfully' });
                    }
                });
            });
        });
    });
});

app.get('/api/students', (req, res) => {
    const course = req.query.course;
    db.get(`SELECT id FROM courses WHERE name=?`, [course], (err, cRow) => {
        if (err || !cRow) return res.status(400).json({ message: 'Course not found' });
        // BUG FIX: Only return students actually enrolled in the course (via student_grades)
        db.all(`SELECT u.id, u.name FROM users u
                JOIN student_grades sg ON sg.student_id=u.id AND sg.course_id=?
                WHERE u.role='student'`, [cRow.id], (_, students) => {
            const p = students.map(s => new Promise(resolve => {
                db.get(`SELECT grade FROM student_grades WHERE student_id=? AND course_id=?`,
                    [s.id, cRow.id], (_, row) => resolve({ id: s.id, name: s.name, grades: { [course]: row?.grade || '' } }));
            }));
            Promise.all(p).then(r => res.json(r));
        });
    });
});

app.put('/api/students/:id', (req, res) => {
    const { course, grade } = req.body;
    db.get(`SELECT id FROM courses WHERE name=?`, [course], (_, row) => {
        if (!row) return res.status(400).json({ message: 'Course not found' });
        db.run(`INSERT INTO student_grades (student_id,course_id,grade) VALUES (?,?,?)
                ON CONFLICT(student_id,course_id) DO UPDATE SET grade=excluded.grade`,
            [req.params.id, row.id, grade], err => {
                if (err) return res.status(500).json({ message: 'Failed' });
                res.json({ message: 'Grade updated' });
            });
    });
});

app.post('/api/report-issue', (req, res) => {
    const { studentId, subject, message } = req.body;
    if (!studentId || !subject || !message) return res.status(400).json({ error: 'Missing fields' });
    db.get(`SELECT name FROM users WHERE id=?`, [studentId], (_, row) => {
        if (!row) return res.status(404).json({ error: 'Student not found' });
        db.run(`INSERT INTO grade_issues (student_id,student_name,subject,message,reported_at) VALUES (?,?,?,?,?)`,
            [studentId, row.name, subject, message, new Date().toISOString()], err => {
                if (err) return res.status(500).json({ error: 'Failed' });
                res.json({ message: 'Issue reported' });
            });
    });
});

// ══════════════ TEACHER / COMPLAINTS ═════════════════════════════════════════
app.get('/api/complaints', (req, res) => {
    const courses = (req.query.courses || '').split(',').map(c => c.trim()).filter(Boolean);
    if (!courses.length) return res.status(400).json({ message: 'courses param required' });
    const ph = courses.map(() => '?').join(',');
    db.all(`SELECT id,student_id,student_name,subject,message,reported_at,attended FROM grade_issues
            WHERE subject IN (${ph}) ORDER BY reported_at DESC`, courses,
        (err, rows) => { if (err) return res.status(500).json({ message: 'Failed' }); res.json(rows); });
});

app.patch('/api/complaints/:id/attend', (req, res) => {
    db.run(`UPDATE grade_issues SET attended=1 WHERE id=?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Failed' });
        if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Marked as attended' });
    });
});

app.get('/api/students/:id/complaints', (req, res) => {
    db.all(`SELECT id,subject,message,reported_at,attended FROM grade_issues
            WHERE student_id=? ORDER BY reported_at DESC`, [req.params.id],
        (err, rows) => { if (err) return res.status(500).json({ message: 'Failed' }); res.json(rows); });
});
app.delete('/api/complaints/:id', (req, res) => {
    db.run(`DELETE FROM grade_issues WHERE id=?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Failed' });
        if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted' });
    });
});
app.delete('/api/complaints', (req, res) => {
    const courses = (req.query.courses || '').split(',').map(c => c.trim()).filter(Boolean);
    if (courses.length > 0) {
        // Delete only complaints matching specific courses (for teacher-scoped clear)
        const ph = courses.map(() => '?').join(',');
        db.run(`DELETE FROM grade_issues WHERE subject IN (${ph})`, courses, err => {
            if (err) return res.status(500).json({ message: 'Failed' });
            res.json({ message: 'Cleared' });
        });
    } else {
        db.run(`DELETE FROM grade_issues`, err => {
            if (err) return res.status(500).json({ message: 'Failed' });
            res.json({ message: 'Cleared' });
        });
    }
});

// ══════════════ ADMIN ═════════════════════════════════════════════════════════
app.get('/api/admin/stats', (req, res) => {
    db.get(`SELECT (SELECT COUNT(*) FROM users WHERE role='student') AS students,
            (SELECT COUNT(*) FROM users WHERE role='teacher') AS teachers,
            (SELECT COUNT(*) FROM courses) AS courses,
            (SELECT COUNT(*) FROM departments) AS departments,
            (SELECT COUNT(*) FROM grade_issues) AS feedback`,
        [], (err, row) => { if (err) return res.status(500).json({ message: 'Failed' }); res.json(row); });
});

app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT u.id,u.name,u.email,u.role,u.department_id, d.name AS department_name 
            FROM users u LEFT JOIN departments d ON u.department_id=d.id 
            ORDER BY u.role,u.name`, [],
        (err, rows) => { if (err) return res.status(500).json({ message: 'Failed' }); res.json(rows); });
});
app.put('/api/admin/users/:id', (req, res) => {
    const { name, email, role, departmentId } = req.body;
    if (!name || !email || !role) return res.status(400).json({ message: 'Missing fields' });
    db.run(`UPDATE users SET name=?,email=?,role=?,department_id=? WHERE id=?`,
        [name, email, role, departmentId || null, req.params.id], function (err) {
            if (err) return res.status(500).json({ message: 'Update failed. Email may exist.' });
            if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
            if (role !== 'teacher') db.run(`DELETE FROM teacher_courses WHERE teacher_id=?`, [req.params.id]);
            res.json({ message: 'Updated' });
        });
});
app.delete('/api/admin/users/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM users WHERE id=?`, [id], function (err) {
        if (err) return res.status(500).json({ message: 'Failed' });
        if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
        db.run(`DELETE FROM teacher_courses WHERE teacher_id=?`, [id]);
        db.run(`DELETE FROM student_grades WHERE student_id=?`, [id]);
        db.run(`DELETE FROM grade_issues WHERE student_id=?`, [id]);
        res.json({ message: 'Deleted' });
    });
});

app.get('/api/admin/teachers', (req, res) => {
    db.all(`SELECT id,name,email FROM users WHERE role='teacher' ORDER BY name`, [],
        (err, rows) => { if (err) return res.status(500).json({ message: 'Failed' }); res.json(rows); });
});

app.get('/api/admin/courses', (req, res) => {
    db.all(`SELECT c.id,c.name,c.credits,c.department_id, d.name AS department_name,
            GROUP_CONCAT(DISTINCT u.name) AS teachers,
            GROUP_CONCAT(DISTINCT u.id)   AS teacher_ids,
            COUNT(DISTINCT sg.student_id) AS graded
            FROM courses c
            LEFT JOIN departments d ON d.id=c.department_id
            LEFT JOIN teacher_courses tc ON tc.course_id=c.id
            LEFT JOIN users u ON u.id=tc.teacher_id
            LEFT JOIN student_grades sg ON sg.course_id=c.id
            GROUP BY c.id ORDER BY c.name`,
        [], (err, rows) => { if (err) return res.status(500).json({ message: 'Failed' }); res.json(rows); });
});
app.post('/api/admin/courses', (req, res) => {
    const { name, credits, departmentId, teacherId } = req.body;
    if (!name || !departmentId) return res.status(400).json({ message: 'Name and Department required' });
    db.run(`INSERT INTO courses (name,credits,department_id) VALUES (?,?,?)`, [name, credits || 3, departmentId], function (err) {
        if (err) return res.status(400).json({ message: 'Course exists or error.' });
        const cid = this.lastID;
        if (teacherId) db.run(`INSERT OR IGNORE INTO teacher_courses (teacher_id,course_id) VALUES (?,?)`, [teacherId, cid]);
        res.json({ message: 'Created', id: cid });
    });
});
app.put('/api/admin/courses/:id', (req, res) => {
    const { name, credits, departmentId, teacherId } = req.body;
    db.run(`UPDATE courses SET name=?,credits=?,department_id=? WHERE id=?`, [name, credits || 3, departmentId, req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Update failed. Name may exist.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
        db.run(`DELETE FROM teacher_courses WHERE course_id=?`, [req.params.id], () => {
            if (teacherId) db.run(`INSERT OR IGNORE INTO teacher_courses (teacher_id,course_id) VALUES (?,?)`, [teacherId, req.params.id]);
            res.json({ message: 'Updated' });
        });
    });
});
app.delete('/api/admin/courses/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM courses WHERE id=?`, [id], function (err) {
        if (err) return res.status(500).json({ message: 'Failed' });
        if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
        db.run(`DELETE FROM teacher_courses WHERE course_id=?`, [id]);
        db.run(`DELETE FROM student_grades WHERE course_id=?`, [id]);
        res.json({ message: 'Deleted' });
    });
});

app.get('/api/admin/feedback', (req, res) => {
    db.all(`SELECT * FROM grade_issues ORDER BY reported_at DESC`, [],
        (err, rows) => { if (err) return res.status(500).json({ message: 'Failed' }); res.json(rows); });
});
app.delete('/api/admin/feedback/:id', (req, res) => {
    db.run(`DELETE FROM grade_issues WHERE id=?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Failed' });
        if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted' });
    });
});
app.delete('/api/admin/feedback', (req, res) => {
    db.run(`DELETE FROM grade_issues`, err => {
        if (err) return res.status(500).json({ message: 'Failed' }); res.json({ message: 'Cleared' });
    });
});

// ══════════════ NEW: DEPARTMENTS & CACHE-FREE ROUTES ══════════════════════════
app.get('/api/departments', (req, res) => {
    db.all(`SELECT * FROM departments ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Failed' });
        res.json(rows);
    });
});
app.post('/api/admin/departments', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    db.run(`INSERT INTO departments (name) VALUES (?)`, [name], function (err) {
        if (err) return res.status(400).json({ message: 'Department exists or error.' });
        res.json({ message: 'Created', id: this.lastID });
    });
});
app.delete('/api/admin/departments/:id', (req, res) => {
    db.run(`DELETE FROM departments WHERE id=?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Failed' });
        if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
        db.run(`UPDATE courses SET department_id=NULL WHERE department_id=?`, [req.params.id]);
        res.json({ message: 'Deleted' });
    });
});

app.get('/api/departments/:id/courses', (req, res) => {
    db.all(`SELECT c.id, c.name, c.credits, d.name AS department_name FROM courses c 
            LEFT JOIN departments d ON d.id=c.department_id 
            WHERE c.department_id=? ORDER BY c.name`, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Failed' });
        res.json(rows);
    });
});

app.get('/api/teachers/:id/courses', (req, res) => {
    db.all(`SELECT c.name FROM courses c
            JOIN teacher_courses tc ON c.id=tc.course_id WHERE tc.teacher_id=?`, [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ message: 'Failed' });
            res.json(rows.map(r => r.name));
        });
});

app.get('/api/network-info', (req, res) => res.json({ ips: getLanIPs(), port: PORT }));

const QRCodeNode = require('qrcode');
app.get('/api/qrcode', async (req, res) => {
    try {
        const ips = getLanIPs();
        // Priority: Use the 2nd IP if available or fallback. Allow override via query params.
        const defaultIp = ips.length > 1 ? ips[1] : (ips[0] || 'localhost');
        const selectedIp = req.query.ip || defaultIp;

        const networkUrl = `http://${selectedIp}:${PORT}`;
        const dataUrl = await QRCodeNode.toDataURL(networkUrl);
        res.json({ qrCode: dataUrl, url: networkUrl, ips: ips });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});
app.get('/api/admin/seed', (req, res) => {
    db.get(`SELECT id FROM users WHERE role='admin' LIMIT 1`, [], async (_, row) => {
        if (row) return res.json({ message: 'Admin already exists.' });
        try {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            db.run(`INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)`,
                ['Administrator', 'admin@studenthub.edu', hashedPassword, 'admin'], err => {
                    if (err) return res.status(500).json({ message: 'Seed failed.' });
                    res.json({ message: 'Admin created. Email: admin@studenthub.edu | Password: admin123' });
                });
        } catch (e) {
            res.status(500).json({ message: 'Server error parsing hash' });
        }
    });
});

// ══════════════ START ═════════════════════════════════════════════════════════
const qrcode = require('qrcode-terminal');

app.listen(PORT, '0.0.0.0', () => {
    const ips = getLanIPs();
    const selectedIp = ips.length > 1 ? ips[1] : (ips[0] || 'localhost');
    const networkUrl = `http://${selectedIp}:${PORT}`;

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║    🎓  StudentHub is Running!                ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}                ║`);
    ips.forEach(ip => console.log(`║  Network: http://${ip}:${PORT}`.padEnd(47) + '║'));
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Share Network URL with devices on same LAN  ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    if (ips.length > 0) {
        console.log(`Scan the QR Code below to connect via ${selectedIp}:\n`);
        qrcode.generate(networkUrl, { small: true });
    }
});
