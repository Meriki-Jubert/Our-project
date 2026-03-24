// student.js

document.addEventListener('DOMContentLoaded', async function () { 
    // Contact button 
    document.querySelectorAll('.emailButton').forEach(btn => { 
        btn.addEventListener('click', e => { 
            e.preventDefault(); 
            window.location.href = "mailto:merikijubert27@gmail.com?subject=StudentHub&body=Hello, I would like to connect with you regarding StudentHub."; 
        }); 
    });

// Feature animation
const featureCards = document.querySelectorAll('.feature-card');
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = 1;
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

featureCards.forEach(card => {
    card.style.opacity = 0;
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
});

// Form toggle logic
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const passwordInput = document.getElementById('signupPassword');
const confirmInput = document.getElementById('signupConfirmPassword');
const roleSelect = document.getElementById("signupRole");
const courseGroup = document.getElementById("courseGroup");

showSignup?.addEventListener('click', e => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    document.querySelector('.card-header h2').textContent = 'Create Account';
    document.querySelector('.card-header p').textContent = 'Join StudentHub to manage your academic journey';
});

showLogin?.addEventListener('click', e => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    document.querySelector('.card-header h2').textContent = 'Welcome Back!';
    document.querySelector('.card-header p').textContent = 'Sign in to access your StudentHub account';
});

confirmInput?.addEventListener('input', () => {
    confirmInput.style.boxShadow = '';
    confirmInput.style.borderColor = '';
});

roleSelect?.addEventListener("change", function () {
    courseGroup.classList.toggle("hidden", this.value.toLowerCase() !== "teacher");
});

// ── SIGNUP: Dynamic department and course selection for students ──
const signupRole = document.getElementById('signupRole');
const departmentGroup = document.getElementById('departmentGroup');
const studentCourseGroup = document.getElementById('studentCourseGroup');
const signupDepartment = document.getElementById('signupDepartment');
const studentCourseList = document.getElementById('studentCourseList');

async function loadDepartments() {
  const res = await fetch('/api/departments');
  const depts = await res.json();
  signupDepartment.innerHTML = '<option value="">Select department</option>' +
    depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
}

async function loadCoursesForDept(deptId) {
  const res = await fetch(`/api/departments/${deptId}/courses`);
  const courses = await res.json();
  studentCourseList.innerHTML = courses.map(c =>
    `<label><input type="checkbox" name="studentCourses" value="${c.id}"> ${c.name} (${c.credits} cr)</label>`
  ).join('<br>');
}

async function loadAllCoursesForTeacher() {
  const res = await fetch('/api/admin/courses');
  const courses = await res.json();
  const courseGroup = document.getElementById('courseGroup');
  if (courseGroup) {
    courseGroup.innerHTML = courses.map(c =>
      `<label><input type="checkbox" name="courses" value="${c.id}"> ${c.name} (${c.credits} cr)</label>`
    ).join('<br>');
  }
}

if (roleSelect) {
  roleSelect.addEventListener('change', function () {
    if (this.value.toLowerCase() === 'teacher') {
      loadAllCoursesForTeacher();
    }
  });
}

if (signupRole) {
  signupRole.addEventListener('change', function () {
    const role = this.value.toLowerCase();
    if (role === 'student') {
      departmentGroup.classList.remove('hidden');
      studentCourseGroup.classList.remove('hidden');
      loadDepartments();
      document.getElementById('courseGroup').classList.add('hidden');
    } else if (role === 'teacher') {
      departmentGroup.classList.add('hidden');
      studentCourseGroup.classList.add('hidden');
      document.getElementById('courseGroup').classList.remove('hidden');
    } else {
      departmentGroup.classList.add('hidden');
      studentCourseGroup.classList.add('hidden');
      document.getElementById('courseGroup').classList.add('hidden');
    }
  });
}

signupDepartment?.addEventListener('change', function () {
  const deptId = this.value;
  if (deptId) loadCoursesForDept(deptId);
  else studentCourseList.innerHTML = '';
});

signupForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmInput.value.trim();
    const role = roleSelect.value.toLowerCase();
    let departmentId = null, courses = [];
    if (role === 'student') {
      departmentId = signupDepartment.value;
      courses = Array.from(document.querySelectorAll('input[name="studentCourses"]:checked')).map(cb => cb.value);
      if (!departmentId || courses.length === 0) {
        alert('Please select your department and at least one course.');
        return;
      }
    } else if (role === 'teacher') {
      courses = Array.from(document.querySelectorAll('input[name="courses"]:checked')).map(cb => cb.value);
    }
    if (password !== confirmPassword) {
        confirmInput.style.borderColor = 'red';
        confirmInput.style.boxShadow = '0 0 5px red';
        return;
    }
    const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, departmentId, courses })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Signup failed');
    const loginRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) return alert(loginData.message || 'Login failed after signup');
    localStorage.setItem('currentUser', JSON.stringify(loginData.user));
    const _r1=loginData.user.role; window.location.href=_r1==='teacher'?'teacher.html':_r1==='admin'?'admin.html':'student.html';
});

// Login
loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Invalid email or password');

    localStorage.setItem('currentUser', JSON.stringify(data.user));
    const _r2=data.user.role; window.location.href=_r2==='teacher'?'teacher.html':_r2==='admin'?'admin.html':'student.html';
});

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (currentUser && document.getElementById('userName')) {
    document.getElementById('userName').textContent = currentUser.name;
}

// Student dashboard
if (currentUser?.role === 'student') {
    // Fetch only the student's enrolled courses dynamically
    const res = await fetch(`/api/students/${encodeURIComponent(currentUser.email)}`);
    const student = await res.json();
    const gradesTable = document.getElementById('gradesTable');
    if (!gradesTable) return;
    gradesTable.innerHTML = '';
    // Display only enrolled courses
    if (student.grades) {
        Object.entries(student.grades).forEach(([course, info]) => {
            const grade   = typeof info === 'object' ? (info.grade   || '—') : (info || '—');
            gradesTable.innerHTML += `<tr><td>${course}</td><td>${grade}</td></tr>`;
        });
    }

    // Display GPA
    if (student.gpa !== null && student.gpa !== undefined) {
        const sec = document.getElementById('gpaSection');
        if (sec) sec.style.display = '';
        const valEl = document.getElementById('gpaValue');
        const badgeEl = document.getElementById('gpaClassBadge');
        if (valEl) valEl.textContent = student.gpa.toFixed(2);
        if (badgeEl) {
            badgeEl.textContent = student.gpaClass || '';
            const g = student.gpa;
            badgeEl.style.background = g >= 3.5 ? '#2dc653' : g >= 3.0 ? '#4361ee' : g >= 2.0 ? '#f77f00' : '#ef233c';
        }
    }

    const reportForm = document.getElementById('reportForm');

reportForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!subject || !message) {
        alert('Please fill in both subject and message.');
        return;
    }

    try {
        const res = await fetch('/api/report-issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: currentUser.id,
                subject,
                message
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Issue reported successfully.');
            reportForm.reset();
        } else {
            alert(data.error || 'Failed to report issue.');
        }
    } catch (err) {
        alert('Error reporting issue: ' + err.message);
    }
});
}

// Teacher dashboard
if (currentUser?.role === 'teacher') {
    const courseButtonsDiv = document.getElementById('courseButtons');
    const activeCourseDisplay = document.getElementById('activeCourse');
    const clearAllBtn = document.getElementById('clearAllComplaints');

    if(clearAllBtn) {
        clearAllBtn.addEventListener('click', async() => {
            if(confirm('Are you sure you want to delete all complaints')){
                await fetch('/api/complaints',{
                    method: 'DELETE'
                });
                fetchComplaints();
            }
        })

    }
    async function fetchComplaints(){
    const container = document.getElementById('notificationContainer');
    if(!container) return;

    container.innerHTML = '<p>Loading complaints....</p>';
    try {
        const courseParams = currentUser.courses.join(',');
        const res = await fetch(`/api/complaints?courses=${encodeURIComponent(courseParams)}`);
        const complaints = await res.json();

        if(complaints.length === 0){
            container.innerHTML = '<p>No complaints available.</p>';
            return;
        }

        container.innerHTML = '';
       complaints.forEach(complaint => {
    const div = document.createElement('div');
    div.classList.add('notification-box');
    div.innerHTML = `
        <p><strong>Course:</strong> ${complaint.subject}</p>
        <p><strong>Student:</strong> ${complaint.student_name} (ID: ${complaint.student_id})</p>
        <p><strong>Message:</strong> ${complaint.message}</p>
        <p><strong>Reported At:</strong> ${complaint.reported_at}</p>
        <button data-id="${complaint.id}" class="btn delete-btn">Delete</button>
        <hr/>
    `;
    container.appendChild(div);
});

// Attach event listeners
container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        await deleteComplaint(id);
    });
});

    } catch (err) {
        container.innerHTML = `<p>Error fetching complaints: ${err.message}</p>`;
    }
}
     async function deleteComplaint(id) {
    try {
        await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
        fetchComplaints();
    } catch (err) {
        alert('Failed to delete complaint: ' + err.message);
    }
}
        

    if (courseButtonsDiv && currentUser.courses) {
        courseButtonsDiv.innerHTML = '';
        currentUser.courses.forEach(course => {
            const btn = document.createElement('button');
            btn.className = 'btn course-btn';
            btn.setAttribute('data-course', course);
            btn.textContent = course;
            courseButtonsDiv.appendChild(btn);
        });

        courseButtonsDiv.addEventListener('click', async e => {
            if (e.target.classList.contains('course-btn')) {
                const course = e.target.getAttribute('data-course');
                if (activeCourseDisplay) activeCourseDisplay.textContent = course;
                await renderStudentTable(course);
            }
        });

        if (currentUser.courses.length > 0 && activeCourseDisplay) {
            activeCourseDisplay.textContent = currentUser.courses[0];
            await renderStudentTable(currentUser.courses[0]);
        }
    }

    async function renderStudentTable(course) {
        const tbody = document.querySelector('.dashboard-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const res = await fetch(`/api/students?course=${encodeURIComponent(course)}`);
        const students = await res.json();

        students.forEach(student => {
            const grade = student.grades[course] || '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${student.name}</td>
                <td><input type="text" value="${grade}" class="form-control" readonly></td>
            `;
            tbody.appendChild(tr);
        });

        const select = document.getElementById('editStudent');
        if (select) {
            select.innerHTML = '';
            students.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = s.name;
                select.appendChild(option);
            });
        }
    }

    const form = document.querySelector('form');
    form?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const studentId = document.getElementById('editStudent').value;
        const grade = document.getElementById('editGrade').value;
        const course = document.getElementById('activeCourse').textContent;

        await fetch(`/api/students/${studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course, grade })
        });

        await renderStudentTable(course);
    });

    

    fetchComplaints();
}


});