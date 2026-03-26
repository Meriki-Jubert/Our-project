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
            const role = this.value.toLowerCase();
            // Un-hide the studentCourseGroup for both student and teacher to let them select courses
            if (studentCourseGroup) {
                studentCourseGroup.classList.remove('hidden');
                document.querySelector('#studentCourseGroup label').innerHTML = role === 'student' ? 'Select Courses <i class="fas fa-book-reader"></i>' : 'Select Expertise <i class="fas fa-chalkboard-teacher"></i>';
            }
            if (departmentSelect) {
                if (role === 'student') {
                    departmentSelect.setAttribute('required', 'true');
                } else {
                    departmentSelect.removeAttribute('required');
                }
            }
            if (departmentSelect && departmentSelect.value) {
                loadCoursesForDepartment(departmentSelect.value);
            }
        });
        // Set initial required state based on default role value
        if (roleSelect.value.toLowerCase() === 'student') {
            departmentSelect?.setAttribute('required', 'true');
        }
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

        if (role === 'student' && !departmentId) {
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
            if (document.getElementById('userName')) document.getElementById('userName').textContent = currentUser.name;
            const res = await fetch(`/api/students/${encodeURIComponent(currentUser.email)}`);
            const student = await res.json();
            
            const gradesContainer = document.getElementById('gradesContainer') || document.querySelector('.admin-card');
            const subjectSelect = document.getElementById('subject');

            if (subjectSelect) subjectSelect.innerHTML = '<option value="">Select a course...</option>';

            if (student.semesters) {
                // Populate courses into complaint dropdown from ALL semesters to allow reporting issues for past courses
                const allCourses = new Set();
                student.semesters.forEach(sem => {
                    sem.courses.forEach(c => allCourses.add(c.course));
                });
                if (subjectSelect) {
                    allCourses.forEach(course => {
                        const opt = document.createElement('option');
                        opt.value = course;
                        opt.textContent = course;
                        subjectSelect.appendChild(opt);
                    });
                }

                // Render semesters
                let html = '';
                student.semesters.forEach(sem => {
                    html += `
                    <div style="margin-bottom: 30px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #e8ecf0; padding-bottom:8px; margin-bottom:15px;">
                            <h3 style="margin:0; color:#3b4252;"><i class="fas fa-calendar-alt" style="margin-right:6px; color:#4361ee"></i> ${sem.name}</h3>
                            <div style="text-align:right;">
                                <div style="font-size:0.85rem; color:#666;">Attempted: <strong>${sem.attemptedCredits}</strong> | Earned: <strong>${sem.earnedCredits}</strong></div>
                                ${sem.gpa !== null ? `<div style="font-size:1.1rem; font-weight:bold; color:#4361ee;">Semester GPA: ${sem.gpa.toFixed(2)}</div> <div style="font-size:0.75rem; color:#888;">${sem.gpaClass}</div>` : ''}
                            </div>
                        </div>
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>Course</th>
                                    <th>Credits</th>
                                    <th>CA (/30)</th>
                                    <th>Exam (/70)</th>
                                    <th>Total (/100)</th>
                                    <th>Grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sem.courses.map(c => `
                                <tr>
                                    <td><strong>${c.course}</strong></td>
                                    <td>${c.credits}</td>
                                    <td>${c.ca_mark ?? '—'}</td>
                                    <td>${c.exam_mark ?? '—'}</td>
                                    <td><strong>${c.total ?? '—'}</strong></td>
                                    <td><span class="role-badge" style="background:${c.grade==='A+'||c.grade==='A'||c.grade==='A-'?'#2dc653':c.grade==='F'?'#e63946':'#4361ee'}; font-size:1rem;">${c.grade || '—'}</span></td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`;
                });
                
                // Replace everything except the header in the grades section
                const wrapper = document.getElementById('gradesTableWrap');
                if (wrapper) wrapper.innerHTML = html;
            }

            // Display Cumulative GPA & Credits
            const sec = document.getElementById('gpaSection');
            if (sec) sec.style.display = (student.totalAttempted > 0 || student.cumulativeGpa !== null) ? '' : 'none';
            
            const valEl = document.getElementById('gpaValue');
            const badgeEl = document.getElementById('gpaClassBadge');
            const attemptedEl = document.getElementById('totalAttempted');
            const earnedEl = document.getElementById('totalEarned');
            
            if (valEl) valEl.textContent = student.cumulativeGpa !== null ? student.cumulativeGpa.toFixed(2) : '—';
            if (attemptedEl) attemptedEl.textContent = student.totalAttempted || 0;
            if (earnedEl) earnedEl.textContent = student.totalEarned || 0;
            
            if (badgeEl) {
                badgeEl.textContent = student.cumulativeGpaClass || '';
                const g = student.cumulativeGpa;
                if (g !== null) {
                    badgeEl.style.display = 'inline-block';
                    badgeEl.style.background = g >= 3.5 ? '#2dc653' : g >= 3.0 ? '#4361ee' : g >= 2.0 ? '#f77f00' : '#ef233c';
                } else {
                    badgeEl.style.display = 'none';
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

        let allSemesters = [];
        let currentSemesterId = null;

        async function fetchSemesters() {
            const res = await fetch('/api/semesters');
            allSemesters = await res.json();
            const current = allSemesters.find(s => s.is_current);
            currentSemesterId = current ? current.id : (allSemesters[0]?.id || null);
            
            // Render semester selector
            const semContainer = document.getElementById('semesterSelectorContainer');
            if (semContainer) {
                semContainer.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom: 20px;">
                        <label style="font-weight:600; color:#4a5568;">Grading Semester:</label>
                        <select id="teacherSemesterSelect" style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; background:white; min-width:200px;">
                            ${allSemesters.map(s => `<option value="${s.id}" ${s.id === currentSemesterId ? 'selected' : ''}>${s.name} ${s.is_current ? '(Current)' : ''}</option>`).join('')}
                        </select>
                        <span id="semesterLockBadge" style="display:none; align-items:center; gap:4px; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold; background:#e63946; color:white;">
                            <i class="fas fa-lock"></i> Locked
                        </span>
                    </div>
                `;
                document.getElementById('teacherSemesterSelect').addEventListener('change', async (e) => {
                    currentSemesterId = e.target.value;
                    if (activeCourseDisplay && activeCourseDisplay.textContent) {
                        await renderStudentTable(activeCourseDisplay.textContent);
                    }
                });
            }
        }

        async function initTeacherDashboard() {
            try {
                await fetchSemesters();
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

        function computeGradePreview(ca, exam) {
            ca = ca !== '' ? parseFloat(ca) : null;
            exam = exam !== '' ? parseFloat(exam) : null;
            if (ca === null && exam === null) return { total: '—', grade: '—', color: '#888' };
            const total = (ca || 0) + (exam || 0);
            if (exam === null) return { total: total.toFixed(1), grade: '—', color: '#888' };
            let grade = 'F'; let color = '#e63946';
            if (total >= 80) { grade = 'A+'; color = '#2dc653'; }
            else if (total >= 75) { grade = 'A'; color = '#2dc653'; }
            else if (total >= 70) { grade = 'B+'; color = '#4361ee'; }
            else if (total >= 65) { grade = 'B'; color = '#4361ee'; }
            else if (total >= 60) { grade = 'C+'; color = '#f77f00'; }
            else if (total >= 55) { grade = 'C'; color = '#f77f00'; }
            else if (total >= 50) { grade = 'D'; color = '#ef233c'; }
            return { total: total.toFixed(1), grade, color };
        }

        async function renderStudentTable(course) {
            const tableBody = document.getElementById('studentTableBody');
            const studentSelect = document.getElementById('editStudent');
            
            if (!tableBody || !studentSelect) return;

            if (!currentSemesterId) {
                tableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#e63946;">No semesters available.</td></tr>';
                return;
            }

            const sem = allSemesters.find(s => s.id == currentSemesterId);
            const isLocked = sem ? sem.locked : false;
            
            const badge = document.getElementById('semesterLockBadge');
            if(badge) badge.style.display = isLocked ? 'flex' : 'none';

            const res = await fetch(`/api/students?course=${encodeURIComponent(course)}&semesterId=${currentSemesterId}`);
            const students = await res.json();
            
            // Populate Dropdown
            studentSelect.innerHTML = '<option value="">Select a student...</option>';
            
            if (students.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#888;">No students enrolled.</td></tr>`;
            } else {
                tableBody.innerHTML = '';
                students.forEach(student => {
                    const grd = student.grades[course] || '—';
                    const grdColor = grd === 'F' ? '#e63946' : (grd === '—' ? '#888' : '#2dc653');
                    
                    // Table row
                    tableBody.innerHTML += `
                    <tr>
                        <td><strong>${student.name}</strong></td>
                        <td><span class="role-badge" style="background:${grdColor};">${grd}</span></td>
                    </tr>
                    `;

                    // Dropdown option
                    const opt = document.createElement('option');
                    opt.value = student.id;
                    opt.textContent = student.name;
                    opt.dataset.ca = student.ca_mark || '';
                    opt.dataset.exam = student.exam_mark || '';
                    studentSelect.appendChild(opt);
                });
            }

            // Handle dropdown change to pre-fill marks
            studentSelect.onchange = (e) => {
                const opt = e.target.selectedOptions[0];
                if (opt && opt.value) {
                    document.getElementById('editCA').value = opt.dataset.ca;
                    document.getElementById('editExam').value = opt.dataset.exam;
                } else {
                    document.getElementById('editCA').value = '';
                    document.getElementById('editExam').value = '';
                }
            };

            // Handle form submit
            const gradeForm = document.getElementById('editGradeForm');
            if (gradeForm) {
                gradeForm.onsubmit = async (e) => {
                    e.preventDefault();
                    if (isLocked) return alert('Semester is locked.');

                    const studentId = studentSelect.value;
                    const ca = document.getElementById('editCA').value;
                    const exam = document.getElementById('editExam').value;

                    if (!studentId || (ca === '' && exam === '')) {
                        return alert('Please select a student and fill at least one mark (CA or Exam) before saving.');
                    }

                    try {
                        const sres = await fetch(`/api/students/${studentId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ course, semesterId: currentSemesterId, ca_mark: ca, exam_mark: exam })
                        });
                        const data = await sres.json();
                        if (sres.ok) {
                            alert('Grade saved');
                            await renderStudentTable(course); // Refresh
                        } else alert(data.message || 'Failed to save');
                    } catch(err) { alert('Error saving grade'); }
                };
            }
        }

        initTeacherDashboard();
    }
});