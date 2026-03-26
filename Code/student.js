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

    // ── SIGNUP: Department & Dynamic course selection ──
    const departmentSelect = document.getElementById('signupDepartment');
    const studentCourseGroup = document.getElementById('studentCourseGroup');
    const studentCourseList = document.getElementById('studentCourseList');

    async function loadDepartments() {
        if (!departmentSelect) return;
        try {
            const res = await fetch('/api/departments');
            const depts = await res.json();
            departmentSelect.innerHTML = '<option value="">Select a Department</option>' +
                depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        } catch (e) { console.error('Failed to load depts', e); }
    }

    async function loadCoursesForDepartment(deptId) {
        if (!deptId) {
            if (studentCourseList) studentCourseList.innerHTML = '';
            return;
        }
        try {
            const res = await fetch(`/api/departments/${deptId}/courses`);
            const courses = await res.json();
            const html = courses.length ? courses.map(c =>
                `<label><input type="checkbox" name="signupCourses" value="${c.id}"> ${c.name} (${c.credits} cr)</label>`
            ).join('<br>') : '<p style="color:#888;font-size:12px;">No courses available.</p>';

            if (studentCourseList) studentCourseList.innerHTML = html;
        } catch (e) { console.error('Failed.', e); }
    }

    loadDepartments();

    if (roleSelect) {
        roleSelect.addEventListener('change', function () {
            // Un-hide the studentCourseGroup for both student and teacher to let them select courses
            if (studentCourseGroup) {
                studentCourseGroup.classList.remove('hidden');
                document.querySelector('#studentCourseGroup label').innerHTML = this.value.toLowerCase() === 'student' ? 'Select Courses <i class="fas fa-book-reader"></i>' : 'Select Expertise <i class="fas fa-chalkboard-teacher"></i>';
            }
            if (departmentSelect && departmentSelect.value) {
                loadCoursesForDepartment(departmentSelect.value);
            }
        });
    }

    if (departmentSelect) {
        departmentSelect.addEventListener('change', function () {
            if (studentCourseGroup) studentCourseGroup.classList.remove('hidden');
            loadCoursesForDepartment(this.value);
        });
    }

    signupForm?.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmInput.value.trim();
        const role = roleSelect.value.toLowerCase();

        let departmentId = departmentSelect ? departmentSelect.value : null;
        let courses = Array.from(document.querySelectorAll('input[name="signupCourses"]:checked')).map(cb => cb.value);

        if (!departmentId) {
            alert('Please select a department.');
            return;
        }

        if (role === 'student' && courses.length === 0) {
            alert('Please select at least one course.');
            return;
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
        const _r1 = loginData.user.role; window.location.href = _r1 === 'teacher' ? 'teacher.html' : _r1 === 'admin' ? 'admin.html' : 'student.html';
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
        const _r2 = data.user.role; window.location.href = _r2 === 'teacher' ? 'teacher.html' : _r2 === 'admin' ? 'admin.html' : 'student.html';
    });

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && document.getElementById('userName')) {
        document.getElementById('userName').textContent = currentUser.name;
    }

    // Student dashboard
    if (currentUser?.role === 'student') {
        async function refreshDashboard() {
            if (document.getElementById('userName')) {
                document.getElementById('userName').textContent = currentUser.name;
            }
            // Fetch only the student's enrolled courses dynamically
            const res = await fetch(`/api/students/${encodeURIComponent(currentUser.email)}`);
            const student = await res.json();
            const gradesTable = document.getElementById('gradesTable');
            const subjectSelect = document.getElementById('subject');

            if (gradesTable) gradesTable.innerHTML = '';
            // Populate complaint dropdown with enrolled course names
            if (subjectSelect) {
                subjectSelect.innerHTML = '<option value="">Select a course...</option>';
            }

            if (student.grades) {
                Object.entries(student.grades).forEach(([course, info]) => {
                    const grade = typeof info === 'object' ? (info.grade || '—') : (info || '—');
                    if (gradesTable) gradesTable.innerHTML += `<tr><td>${course}</td><td>${grade}</td></tr>`;
                    if (subjectSelect) {
                        const opt = document.createElement('option');
                        opt.value = course;
                        opt.textContent = course;
                        subjectSelect.appendChild(opt);
                    }
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
        }
        refreshDashboard();

        // ── Student Profile & Enrollment Management ──
        const manageEnrollmentBtn = document.getElementById('manageEnrollmentBtn');
        const enrollmentModal = document.getElementById('enrollmentModal');
        const closeEnrollmentModal = document.getElementById('closeEnrollmentModal');
        const saveEnrollmentBtn = document.getElementById('saveEnrollmentBtn');
        const editStudentName = document.getElementById('editStudentName');
        const editStudentDept = document.getElementById('editStudentDept');
        const editStudentCourseList = document.getElementById('editStudentCourseList');

        async function openEnrollmentModal() {
            if (!currentUser) return;
            try {
                // Fetch current details
                const res = await fetch(`/api/students/${currentUser.id}/details`);
                const details = await res.json();

                // Populate Name
                if (editStudentName) editStudentName.value = details.name;

                // Load Departments
                const deptRes = await fetch('/api/departments');
                const depts = await deptRes.json();
                if (editStudentDept) {
                    editStudentDept.innerHTML = depts.map(d => `<option value="${d.id}" ${d.id === details.department_id ? 'selected' : ''}>${d.name}</option>`).join('');
                }

                // Load Courses for current/selected department
                await refreshManageCourseList(details.department_id, details.enrolledCourseIds);

                enrollmentModal.classList.add('open');
            } catch (e) { console.error(e); }
        }

        async function refreshManageCourseList(deptId, enrolledIds = []) {
            if (!deptId || !editStudentCourseList) return;
            const res = await fetch(`/api/departments/${deptId}/courses`);
            const courses = await res.json();
            editStudentCourseList.innerHTML = courses.length ? courses.map(c => `
                <label style="display:flex; align-items:center; gap:8px; font-size:0.9rem; background:#f4f7f6; padding:8px; border-radius:6px; cursor:pointer;">
                    <input type="checkbox" name="manageCourse" value="${c.id}" ${enrolledIds.includes(c.id) ? 'checked' : ''}>
                    ${c.name}
                </label>
            `).join('') : '<p style="color:#888; grid-column: 1 / -1; font-size: 0.9rem;">No courses available in this department.</p>';
        }

        editStudentDept?.addEventListener('change', () => refreshManageCourseList(editStudentDept.value));
        manageEnrollmentBtn?.addEventListener('click', openEnrollmentModal);
        closeEnrollmentModal?.addEventListener('click', () => enrollmentModal.classList.remove('open'));

        saveEnrollmentBtn?.addEventListener('click', async () => {
            const name = editStudentName ? editStudentName.value.trim() : currentUser.name;
            const departmentId = editStudentDept ? editStudentDept.value : currentUser.department_id;
            const courseIds = Array.from(document.querySelectorAll('input[name="manageCourse"]:checked')).map(cb => cb.value);

            if (!name) return alert('Name is required');

            const res = await fetch(`/api/students/${currentUser.id}/sync-enrollment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, departmentId, courseIds })
            });

            if (res.ok) {
                alert('Profile and enrollment updated!');
                enrollmentModal.classList.remove('open');
                currentUser.name = name;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                location.reload();
            } else {
                alert('Failed to update.');
            }
        });

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
                    loadMyComplaints();
                } else {
                    alert(data.error || 'Failed to report issue.');
                }
            } catch (err) {
                alert('Error reporting issue: ' + err.message);
            }
        });

        // Load student's own complaints with attended status
        async function loadMyComplaints() {
            const container = document.getElementById('myComplaintsContainer');
            if (!container) return;
            try {
                const res = await fetch(`/api/students/${currentUser.id}/complaints`);
                const complaints = await res.json();
                if (!complaints.length) {
                    container.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">You have not reported any issues yet.</p>';
                    return;
                }
                container.innerHTML = complaints.map(c => {
                    const attended = c.attended === 1;
                    return `
                    <div style="background:${attended ? '#f0faf4' : '#fff8f0'}; border:1px solid ${attended ? '#2dc653' : '#f77f00'}; border-left:4px solid ${attended ? '#2dc653' : '#f77f00'}; border-radius:8px; padding:12px 14px; margin-bottom:10px;">
                        <p style="margin:0 0 4px;"><strong>📚 ${c.subject}</strong></p>
                        <p style="margin:0 0 6px; color:#555; font-size:0.9rem;">${c.message}</p>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.78rem; color:#aaa;">🕐 ${new Date(c.reported_at).toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'})}</span>
                            ${attended
                                ? '<span style="background:#2dc653; color:white; font-size:0.75rem; padding:2px 10px; border-radius:12px;">✓ Attended</span>'
                                : '<span style="background:#f77f00; color:white; font-size:0.75rem; padding:2px 10px; border-radius:12px;">⏳ Pending</span>'
                            }
                        </div>
                    </div>`;
                }).join('');
            } catch (e) { container.innerHTML = '<p style="color:red; font-size:0.9rem;">Could not load complaints.</p>'; }
        }
        loadMyComplaints();
    }

    // Teacher dashboard
    if (currentUser?.role === 'teacher') {
        const courseButtonsDiv = document.getElementById('courseButtons');
        const activeCourseDisplay = document.getElementById('activeCourse');
        const clearAllBtn = document.getElementById('clearAllComplaints');

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete all your complaints?')) {
                    // Only delete complaints related to this teacher's courses
                    const coursesRes = await fetch(`/api/teachers/${currentUser.id}/courses`);
                    const teacherCourses = await coursesRes.json();
                    if (teacherCourses.length > 0) {
                        await fetch(`/api/complaints?courses=${encodeURIComponent(teacherCourses.join(','))}`, { method: 'DELETE' });
                    }
                    fetchComplaints(teacherCourses);
                }
            });
        }

        function fmtDate(iso) {
            if (!iso) return '—';
            const d = new Date(iso);
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }

        async function fetchComplaints(courses) {
            const container = document.getElementById('notificationContainer');
            if (!container) return;
            if (!courses || courses.length === 0) {
                container.innerHTML = '<p style="color:#888;">No complaints available. You have no assigned courses.</p>';
                return;
            }
            container.innerHTML = '<p style="color:#888;">Loading...</p>';
            try {
                const courseParams = courses.join(',');
                const res = await fetch(`/api/complaints?courses=${encodeURIComponent(courseParams)}`);
                const complaints = await res.json();

                if (complaints.length === 0) {
                    container.innerHTML = '<p style="color:#888;">No complaints for your courses.</p>';
                    return;
                }

                container.innerHTML = '';
                complaints.forEach(complaint => {
                    const isAttended = complaint.attended === 1;
                    const div = document.createElement('div');
                    div.style.cssText = `background:${isAttended ? '#f0faf4' : '#f8f9fc'}; border:1px solid ${isAttended ? '#2dc653' : '#e8ecf0'}; border-left:4px solid ${isAttended ? '#2dc653' : '#4361ee'}; border-radius:8px; padding:14px 16px; margin-bottom:12px; opacity:${isAttended ? '0.8' : '1'};`;
                    div.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                            <div style="flex:1;">
                                <p style="margin:0 0 4px;"><strong>📚 Course:</strong> ${complaint.subject}</p>
                                <p style="margin:0 0 4px;"><strong>👤 Student:</strong> ${complaint.student_name}</p>
                                <p style="margin:0 0 4px;"><strong>💬 Message:</strong> ${complaint.message}</p>
                                <p style="margin:0; font-size:0.82rem; color:#aaa;">🕐 ${fmtDate(complaint.reported_at)}</p>
                                ${isAttended ? '<span style="display:inline-block; margin-top:6px; background:#2dc653; color:white; font-size:0.75rem; padding:2px 10px; border-radius:12px;">✓ Attended</span>' : ''}
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
                                ${!isAttended ? `<button data-id="${complaint.id}" class="btn btn-sm btn-success attend-btn" style="white-space:nowrap;"><i class="fas fa-check"></i> Mark Attended</button>` : ''}
                                <button data-id="${complaint.id}" class="btn btn-sm btn-danger delete-btn" style="white-space:nowrap;"><i class="fas fa-trash"></i> Delete</button>
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                });

                container.querySelectorAll('.attend-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.target.closest('button').getAttribute('data-id');
                        const r = await fetch(`/api/complaints/${id}/attend`, { method: 'PATCH' });
                        if (r.ok) fetchComplaints(courses);
                    });
                });
                container.querySelectorAll('.delete-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        await deleteComplaint(e.target.closest('button').getAttribute('data-id'), courses);
                    });
                });
            } catch (err) {
                container.innerHTML = `<p style="color:red;">Error fetching complaints: ${err.message}</p>`;
            }
        }

        async function deleteComplaint(id, courses) {
            try {
                await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
                fetchComplaints(courses);
            } catch (err) { alert('Failed to delete complaint'); }
        }

        async function initTeacherDashboard() {
            try {
                const res = await fetch(`/api/teachers/${currentUser.id}/courses`);
                const courses = await res.json();

                if (courseButtonsDiv) {
                    courseButtonsDiv.innerHTML = '';
                    courses.forEach(course => {
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

                    if (courses.length > 0 && activeCourseDisplay) {
                        activeCourseDisplay.textContent = courses[0];
                        await renderStudentTable(courses[0]);
                    }
                }
                fetchComplaints(courses);
            } catch (e) { console.error('Error init teacher dashboard', e); }
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

        initTeacherDashboard();
    }
});