const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbFile = 'studenthub.db';

// Ensure fresh DB if it already exists
if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
    console.log('Deleted existing database.');
}

const db = new sqlite3.Database(dbFile);

const schema = `
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    department_id INTEGER
);
CREATE TABLE departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
);
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    department_id INTEGER,
    credits INTEGER DEFAULT 3
);
CREATE TABLE teacher_courses (
    teacher_id INTEGER,
    course_id INTEGER,
    PRIMARY KEY (teacher_id, course_id)
);
CREATE TABLE student_courses (
    student_id INTEGER,
    course_id INTEGER,
    PRIMARY KEY (student_id, course_id)
);
CREATE TABLE semesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    is_current BOOLEAN DEFAULT 0,
    locked BOOLEAN DEFAULT 0
);
CREATE TABLE student_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    course_id TEXT,
    grade TEXT,
    ca_mark REAL,
    exam_mark REAL,
    total REAL,
    semester_id INTEGER DEFAULT 1
);
CREATE TABLE complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    subject TEXT,
    message TEXT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    attended BOOLEAN DEFAULT 0
);
`;

const seedData = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.exec(schema, (err) => {
                if (err) return reject(err);
                
                // 1. Semesters
                db.run("INSERT INTO semesters (name, is_current, locked) VALUES ('Fall 2024', 0, 1)");
                db.run("INSERT INTO semesters (name, is_current, locked) VALUES ('Spring 2025', 1, 0)");
                
                // 2. Departments
                db.run("INSERT INTO departments (name) VALUES ('Computer Science')");
                db.run("INSERT INTO departments (name) VALUES ('Business')");
                db.run("INSERT INTO departments (name) VALUES ('Engineering')");
                
                // 3. Admin Account
                db.run("INSERT INTO users (name, email, password, role) VALUES ('Admin User', 'admin@school.edu', 'admin123', 'admin')");
                
                // 4. Teachers
                const teachers = [
                    { name: 'Dr. John Smith', email: 'john.smith@school.edu', role: 'teacher', dept: 1 },
                    { name: 'Prof. Sarah Connor', email: 'sarah.connor@school.edu', role: 'teacher', dept: 2 },
                    { name: 'Dr. Alan Turing', email: 'alan.turing@school.edu', role: 'teacher', dept: 3 }
                ];
                teachers.forEach(t => {
                    db.run("INSERT INTO users (name, email, password, role, department_id) VALUES (?, ?, 'pass123', ?, ?)", [t.name, t.email, t.role, t.dept]);
                });

                // 5. Courses (with credits)
                const courses = [
                    { name: 'CS101 Intro to Programming', dept: 1, cred: 4 },
                    { name: 'CS201 Data Structures', dept: 1, cred: 3 },
                    { name: 'BUS101 Principles of Management', dept: 2, cred: 3 },
                    { name: 'BUS201 Accounting', dept: 2, cred: 4 },
                    { name: 'ENG101 Mechanics', dept: 3, cred: 3 },
                    { name: 'ENG201 Thermodynamics', dept: 3, cred: 4 }
                ];
                courses.forEach(c => {
                    db.run("INSERT INTO courses (name, department_id, credits) VALUES (?, ?, ?)", [c.name, c.dept, c.cred]);
                });

                // 6. Assign Teachers to Courses
                // Dr. John Smith (ID 2) -> CS101(1), CS201(2)
                db.run("INSERT INTO teacher_courses (teacher_id, course_id) VALUES (2, 1)");
                db.run("INSERT INTO teacher_courses (teacher_id, course_id) VALUES (2, 2)");
                // Prof. Sarah (ID 3) -> BUS101(3), BUS201(4)
                db.run("INSERT INTO teacher_courses (teacher_id, course_id) VALUES (3, 3)");
                db.run("INSERT INTO teacher_courses (teacher_id, course_id) VALUES (3, 4)");
                // Dr. Alan (ID 4) -> ENG101(5), ENG201(6)
                db.run("INSERT INTO teacher_courses (teacher_id, course_id) VALUES (4, 5)");
                db.run("INSERT INTO teacher_courses (teacher_id, course_id) VALUES (4, 6)");

                // 7. Students
                const students = [
                    { name: 'Alice Johnson', email: 'alice@student.edu', dept: 1 },
                    { name: 'Bob Williams', email: 'bob@student.edu', dept: 1 },
                    { name: 'Charlie Brown', email: 'charlie@student.edu', dept: 2 },
                    { name: 'Diana Prince', email: 'diana@student.edu', dept: 2 },
                    { name: 'Eve Adams', email: 'eve@student.edu', dept: 3 }
                ];
                let studentId = 5; // since IDs 1-4 are taken
                students.forEach(s => {
                    db.run("INSERT INTO users (name, email, password, role, department_id) VALUES (?, ?, 'pass123', 'student', ?)", [s.name, s.email, s.dept]);
                });

                // 8. Student Courses and Grades
                const enrollmentsAndGrades = [
                    // Alice (CS)
                    { sid: 5, cid: 1, cname: 'CS101 Intro to Programming', semId: 1, ca: 28, exam: 65, tot: 93, grade: 'A+' }, // Fall
                    { sid: 5, cid: 2, cname: 'CS201 Data Structures', semId: 2, ca: null, exam: null, tot: null, grade: null }, // Spring (current)
                    // Bob (CS)
                    { sid: 6, cid: 1, cname: 'CS101 Intro to Programming', semId: 1, ca: 20, exam: 45, tot: 65, grade: 'B' },
                    { sid: 6, cid: 2, cname: 'CS201 Data Structures', semId: 2, ca: null, exam: null, tot: null, grade: null },
                    // Charlie (BUS)
                    { sid: 7, cid: 3, cname: 'BUS101 Principles of Management', semId: 1, ca: 25, exam: 50, tot: 75, grade: 'A' },
                    { sid: 7, cid: 4, cname: 'BUS201 Accounting', semId: 2, ca: null, exam: null, tot: null, grade: null },
                    // Diana (BUS)
                    { sid: 8, cid: 3, cname: 'BUS101 Principles of Management', semId: 1, ca: 15, exam: 30, tot: 45, grade: 'F' }, // Failed Fall
                    { sid: 8, cid: 4, cname: 'BUS201 Accounting', semId: 2, ca: null, exam: null, tot: null, grade: null },
                    // Eve (ENG)
                    { sid: 9, cid: 5, cname: 'ENG101 Mechanics', semId: 1, ca: 22, exam: 58, tot: 80, grade: 'A+' }
                ];

                enrollmentsAndGrades.forEach(eg => {
                    db.run("INSERT OR IGNORE INTO student_courses (student_id, course_id) VALUES (?, ?)", [eg.sid, eg.cid]);
                    if(eg.grade) {
                        db.run("INSERT INTO student_grades (student_id, course_id, grade, ca_mark, exam_mark, total, semester_id) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                            [eg.sid, eg.cname, eg.grade, eg.ca, eg.exam, eg.tot, eg.semId]);
                    }
                });

                resolve();
            });
        });
    });
};

seedData().then(() => {
    console.log("Database seeded successfully with new semester system.");
    db.close();
}).catch(err => {
    console.error("Error seeding DB:", err);
});
