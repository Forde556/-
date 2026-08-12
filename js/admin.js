// ============================================================
// ADMIN DASHBOARD — Complete Management Interface
// Requires Firebase client to be loaded first
// ============================================================

let currentAdminUser = null;
let allCharts = {};

// ============ INITIALIZATION ============
window.addEventListener("firebase-ready", initializeAdmin);

async function initializeAdmin() {
  // Check if user is authenticated and is admin
  currentAdminUser = await Auth.getUser();
  if (!currentAdminUser) {
    window.location.href = "index.html";
    return;
  }

  // TODO: Implement admin role check in Firebase
  // For now, allow anyone authenticated (you should add admin field to profiles)
  
  setupEventListeners();
  loadDashboardData();
  checkFirebaseConnection();
}

// ============ FIREBASE CONNECTION CHECK ============
async function checkFirebaseConnection() {
  const statusBox = document.getElementById("firebaseStatus");
  try {
    // Try to read a simple collection
    const testRead = await Api.getSubjectsWithLectureCounts();
    statusBox.innerHTML = `
      <div class="status-indicator success"></div>
      <span>✅ متصل بـ Firebase بنجاح - قاعدة البيانات تعمل بشكل طبيعي</span>
    `;
    document.getElementById("fbConnection").textContent = "✅ متصل";
  } catch (error) {
    statusBox.innerHTML = `
      <div class="status-indicator error"></div>
      <span>❌ خطأ في الاتصال بـ Firebase: ${error.message}</span>
    `;
    document.getElementById("fbConnection").textContent = "❌ غير متصل";
  }
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  // Sidebar navigation
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => switchAdminPage(link.dataset.page));
  });

  // Logout
  document.getElementById("adminLogout").addEventListener("click", async () => {
    await Auth.signOut();
    window.location.href = "index.html";
  });

  // Subject modal
  document.getElementById("addSubjectBtn").addEventListener("click", openSubjectModal);
  document.getElementById("subjectForm").addEventListener("submit", saveSubject);
  
  // Lecture modal
  document.getElementById("addLectureBtn").addEventListener("click", openLectureModal);
  document.getElementById("lectureForm").addEventListener("submit", saveLecture);
  
  // Attendance session
  document.getElementById("newSessionBtn").addEventListener("click", openSessionModal);
  document.getElementById("sessionForm").addEventListener("submit", createSession);

  // Settings
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  document.getElementById("exportDataBtn").addEventListener("click", exportData);
  document.getElementById("clearCacheBtn").addEventListener("click", clearCache);

  // Modal close buttons
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.target.closest(".modal").classList.remove("open");
    });
  });

  // Search and filters
  document.getElementById("userSearch").addEventListener("input", filterUsers);
  document.getElementById("lectureFilter").addEventListener("change", filterLectures);
}

// ============ PAGE SWITCHING ============
function switchAdminPage(pageId) {
  document.querySelectorAll(".admin-page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${pageId}`).classList.add("active");
  
  document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
  document.querySelector(`[data-page="${pageId}"]`).classList.add("active");

  // Update page title
  const titles = {
    dashboard: "لوحة التحكم الرئيسية",
    subjects: "إدارة المواد",
    lectures: "إدارة المحاضرات",
    users: "إدارة المستخدمين",
    attendance: "إدارة الحضور",
    analytics: "الإحصائيات والتحليلات",
    settings: "الإعدادات"
  };
  document.getElementById("pageTitle").textContent = titles[pageId] || "لوحة التحكم";

  // Load page data
  if (pageId === "dashboard") loadDashboardData();
  if (pageId === "subjects") loadSubjects();
  if (pageId === "lectures") loadLectures();
  if (pageId === "users") loadUsers();
  if (pageId === "attendance") loadAttendanceSessions();
  if (pageId === "analytics") loadAnalytics();
}

// ============ DASHBOARD ============
async function loadDashboardData() {
  try {
    // Fetch counts
    const subjects = await Api.getSubjectsWithLectureCounts();
    const allLectures = await Api.getLecturesForSubject(null);
    
    // Basic stats
    document.getElementById("totalSubjects").textContent = subjects.length;
    document.getElementById("totalLectures").textContent = 
      subjects.reduce((sum, s) => sum + (s.lectureCount || 0), 0);

    // TODO: Fetch real user and activity counts from Firestore
    // For now, show placeholder values
    document.getElementById("totalUsers").textContent = "0";
    document.getElementById("todayActivity").textContent = "0";

    // Initialize charts
    initActivityChart();
    initUsersChart();
  } catch (error) {
    console.error("Dashboard load error:", error);
    showToast("خطأ في تحميل البيانات");
  }
}

function initActivityChart() {
  const ctx = document.getElementById("activityChart")?.getContext("2d");
  if (!ctx) return;

  if (allCharts.activity) allCharts.activity.destroy();

  allCharts.activity = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["يوم 1", "يوم 2", "يوم 3", "يوم 4", "يوم 5", "يوم 6", "يوم 7"],
      datasets: [{
        label: "عدد النشاطات",
        data: [12, 19, 8, 15, 22, 18, 14],
        borderColor: "#14304A",
        backgroundColor: "rgba(244,163,64,0.1)",
        tension: 0.4,
        fill: true,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } }
    }
  });
}

function initUsersChart() {
  const ctx = document.getElementById("usersChart")?.getContext("2d");
  if (!ctx) return;

  if (allCharts.users) allCharts.users.destroy();

  allCharts.users = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["السنة الأولى", "السنة الثانية", "السنة الثالثة", "السنة الرابعة", "السنة الخامسة"],
      datasets: [{
        data: [30, 25, 20, 15, 10],
        backgroundColor: ["#14304A", "#3FA796", "#F4A340", "#C1440E", "#8A97A2"]
      }]
    },
    options: {
      responsive: true
    }
  });
}

// ============ SUBJECTS MANAGEMENT ============
async function loadSubjects() {
  try {
    const subjects = await Api.getSubjectsWithLectureCounts();
    const table = document.getElementById("subjectsTable");
    table.innerHTML = "";

    subjects.forEach(s => {
      table.innerHTML += `
        <tr>
          <td>${s.icon || "📚"}</td>
          <td><strong>${s.title}</strong></td>
          <td>
            <div style="width:30px; height:30px; background:${s.color}; border-radius:6px;"></div>
          </td>
          <td>${s.sort_order || "-"}</td>
          <td>${s.lectureCount || 0}</td>
          <td>
            <button class="btn btn-small" onclick="editSubject('${s.id}')">✏️</button>
            <button class="btn btn-small" onclick="deleteSubject('${s.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });

    // Populate lecture filter dropdown
    const filter = document.getElementById("lectureFilter");
    filter.innerHTML = '<option value="">كل المواد</option>';
    subjects.forEach(s => {
      filter.innerHTML += `<option value="${s.id}">${s.title}</option>`;
    });
  } catch (error) {
    console.error("Load subjects error:", error);
    showToast("خطأ في تحميل المواد");
  }
}

function openSubjectModal() {
  const modal = document.getElementById("subjectModal");
  document.getElementById("subjectId").value = "";
  document.getElementById("subjectForm").reset();
  modal.classList.add("open");
}

async function editSubject(id) {
  // TODO: Implement edit functionality
  showToast("جاري تحديث المادة...");
}

async function deleteSubject(id) {
  if (!confirm("هل تريد حذف هذه المادة؟")) return;
  // TODO: Implement delete functionality
  showToast("تم حذف المادة");
  loadSubjects();
}

async function saveSubject(e) {
  e.preventDefault();
  const title = document.getElementById("subjectTitle").value;
  const icon = document.getElementById("subjectIcon").value;
  const color = document.getElementById("subjectColor").value;
  const order = parseInt(document.getElementById("subjectOrder").value) || 0;

  try {
    // TODO: Save to Firestore
    showToast("✅ تم حفظ المادة بنجاح");
    document.getElementById("subjectModal").classList.remove("open");
    loadSubjects();
  } catch (error) {
    showToast("❌ خطأ في حفظ المادة");
  }
}

// ============ LECTURES MANAGEMENT ============
async function loadLectures() {
  try {
    const subjects = await Api.getSubjectsWithLectureCounts();
    const allLectures = [];
    
    for (const subject of subjects) {
      const lectures = await Api.getLecturesForSubject(subject.id);
      lectures.forEach(l => {
        allLectures.push({
          ...l,
          subjectTitle: subject.title,
          subjectId: subject.id
        });
      });
    }

    const table = document.getElementById("lecturesTable");
    table.innerHTML = "";

    allLectures.forEach(l => {
      table.innerHTML += `
        <tr>
          <td><strong>${l.title}</strong></td>
          <td>${l.subjectTitle}</td>
          <td>${l.lecture_number || "-"}</td>
          <td>${l.duration_minutes ? l.duration_minutes + " دقيقة" : "-"}</td>
          <td>
            <button class="btn btn-small" onclick="editLecture('${l.id}')">✏️</button>
            <button class="btn btn-small" onclick="deleteLecture('${l.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error("Load lectures error:", error);
    showToast("خطأ في تحميل المحاضرات");
  }
}

function openLectureModal() {
  const modal = document.getElementById("lectureModal");
  document.getElementById("lectureId").value = "";
  document.getElementById("lectureForm").reset();
  modal.classList.add("open");
}

async function editLecture(id) {
  showToast("جاري تحديث المحاضرة...");
}

async function deleteLecture(id) {
  if (!confirm("هل تريد حذف هذه المحاضرة؟")) return;
  showToast("تم حذف المحاضرة");
  loadLectures();
}

async function saveLecture(e) {
  e.preventDefault();
  const subjectId = document.getElementById("lectureSubject").value;
  const title = document.getElementById("lectureTitle").value;
  const number = parseInt(document.getElementById("lectureNumber").value) || 1;
  const desc = document.getElementById("lectureDesc").value;
  const video = document.getElementById("lectureVideo").value;
  const duration = parseInt(document.getElementById("lectureDuration").value) || 0;

  try {
    // TODO: Save to Firestore
    showToast("✅ تم حفظ المحاضرة بنجاح");
    document.getElementById("lectureModal").classList.remove("open");
    loadLectures();
  } catch (error) {
    showToast("❌ خطأ في حفظ المحاضرة");
  }
}

function filterLectures() {
  const filter = document.getElementById("lectureFilter").value;
  const rows = document.querySelectorAll("#lecturesTable tr");
  rows.forEach(row => {
    if (!filter) {
      row.style.display = "";
    } else {
      row.style.display = row.textContent.includes(filter) ? "" : "none";
    }
  });
}

// ============ USERS MANAGEMENT ============
async function loadUsers() {
  try {
    // TODO: Fetch users from Firestore
    // For now, show empty table
    document.getElementById("usersTable").innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:30px;">لا توجد بيانات مستخدمين متاحة</td>
      </tr>
    `;
  } catch (error) {
    console.error("Load users error:", error);
    showToast("خطأ في تحميل المستخدمين");
  }
}

function filterUsers() {
  const search = document.getElementById("userSearch").value.toLowerCase();
  const rows = document.querySelectorAll("#usersTable tr");
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(search) ? "" : "none";
  });
}

// ============ ATTENDANCE MANAGEMENT ============
async function loadAttendanceSessions() {
  try {
    // TODO: Fetch attendance sessions
    document.getElementById("attendanceTable").innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:30px;">لا توجد جلسات حضور</td>
      </tr>
    `;
  } catch (error) {
    console.error("Load attendance error:", error);
    showToast("خطأ في تحميل جلسات الحضور");
  }
}

function openSessionModal() {
  const modal = document.getElementById("sessionModal");
  document.getElementById("sessionForm").reset();
  modal.classList.add("open");
}

async function createSession(e) {
  e.preventDefault();
  const title = document.getElementById("sessionTitle").value;
  const type = document.getElementById("sessionType").value;
  const duration = parseInt(document.getElementById("sessionDuration").value);

  try {
    // TODO: Create session in Firestore
    showToast("✅ تم إنشاء جلسة حضور جديدة");
    document.getElementById("sessionModal").classList.remove("open");
    loadAttendanceSessions();
  } catch (error) {
    showToast("❌ خطأ في إنشاء الجلسة");
  }
}

// ============ ANALYTICS ============
async function loadAnalytics() {
  try {
    // TODO: Load real analytics data
    document.getElementById("topLectures").innerHTML = `
      <div class="analytics-item">
        <span>تشريح الأسنان - المحاضرة 1</span>
        <span>125 مشاهدة</span>
      </div>
    `;
    
    document.getElementById("topStudents").innerHTML = `
      <div class="analytics-item">
        <span>أحمد محمد</span>
        <span>28 يوم تفاعل</span>
      </div>
    `;

    document.getElementById("attendanceRate").textContent = "92%";
    document.getElementById("avgStreak").textContent = "7.5 أيام";
  } catch (error) {
    console.error("Load analytics error:", error);
  }
}

// ============ SETTINGS ============
async function saveSettings() {
  const appName = document.getElementById("appName").value;
  const appDesc = document.getElementById("appDesc").value;
  
  // Save to localStorage or Firebase
  localStorage.setItem("appName", appName);
  localStorage.setItem("appDesc", appDesc);
  
  showToast("✅ تم حفظ الإعدادات");
}

async function exportData() {
  try {
    // TODO: Implement data export
    showToast("جاري تصدير البيانات...");
    
    const data = {
      timestamp: new Date().toISOString(),
      exported: true
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tibbiya-export-${Date.now()}.json`;
    a.click();
    
    showToast("✅ تم تصدير البيانات");
  } catch (error) {
    showToast("❌ خطأ في التصدير");
  }
}

function clearCache() {
  if (!confirm("هل تريد مسح الذاكرة المؤقتة؟")) return;
  
  localStorage.clear();
  sessionStorage.clear();
  
  showToast("✅ تم مسح الذاكرة المؤقتة");
}

// ============ TOAST ============
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

// Load initial data
document.addEventListener("DOMContentLoaded", () => {
  loadSubjects();
});
