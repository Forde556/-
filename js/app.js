if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

let currentUser = null;
let realtimeUpdateInterval = null;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------- bottom nav / page switching ----------
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});
function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n =>
    n.classList.toggle("active", n.dataset.page === pageId));
  if (currentUser) Api.logActivity(currentUser.id, "view_" + pageId);
}

// ---------- side drawer ----------
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
function openDrawer() { drawer.classList.add("open"); drawerOverlay.classList.add("open"); }
function closeDrawer() { drawer.classList.remove("open"); drawerOverlay.classList.remove("open"); }
document.getElementById("openDrawerBtn").addEventListener("click", openDrawer);
document.getElementById("closeDrawerBtn").addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

document.querySelectorAll(".drawer-list [data-action]").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const action = link.dataset.action;
    closeDrawer();
    if (action === "settings") return switchPage("page-settings");
    if (action === "support") return switchPage("page-contact");
    if (action === "qr") return showToast("جاري فتح ماسح QR...");
    showToast("قسم قيد التطوير: " + link.textContent.trim());
  });
});

// ---------- settings toggles ----------
document.querySelectorAll(".switch").forEach(sw => {
  sw.addEventListener("click", () => sw.classList.toggle("on"));
});
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await Auth.signOut();
  window.location.href = "index.html";
});

// ---------- QR banner ----------
document.getElementById("qrBanner").addEventListener("click", () => {
  showToast("جاري فتح رمز الحضور...");
  if (currentUser) Api.logActivity(currentUser.id, "qr_open");
});

document.getElementById("editProfileBtn").addEventListener("click", async () => {
  const newName = prompt("الاسم الجديد:");
  if (!newName || !currentUser) return;
  await Api.updateProfile(currentUser.id, { full_name: newName });
  document.getElementById("profileName").textContent = newName;
  document.getElementById("drawerName").textContent = newName;
  showToast("تم تحديث الاسم");
});

document.getElementById("openArchiveBtn").addEventListener("click", async () => {
  if (!currentUser) return;
  const items = await Api.getSavedItems(currentUser.id);
  showToast(items.length ? `لديك ${items.length} عناصر محفوظة` : "لا توجد عناصر محفوظة بعد");
});

// ---------- render subject grid ----------
const TILE_COLORS = ["#14304A", "#3FA796", "#F4A340", "#C1440E"];
function renderSubjects(subjects) {
  const grid = document.getElementById("subjectGrid");
  grid.innerHTML = "";
  subjects.forEach((s, i) => {
    const card = document.createElement("button");
    card.className = "subject-card";
    card.style.textAlign = "right";
    card.style.border = "1px solid var(--line)";
    card.innerHTML = `
      <div class="tile-icon" style="background:${s.color || TILE_COLORS[i % 4]}22; color:${s.color || TILE_COLORS[i % 4]}">
        ${s.icon || "📘"}
      </div>
      <div class="tile-title">${s.title}</div>
      <div class="tile-meta">${s.lectureCount ?? 0} محاضرة</div>
    `;
    card.addEventListener("click", () => {
      showToast(`فتح مادة: ${s.title}`);
      if (currentUser) Api.logActivity(currentUser.id, "lecture_view", s.id);
    });
    grid.appendChild(card);
  });
}

// ---------- streak ring ----------
function paintStreakRing(current) {
  const ring = document.getElementById("streakRing");
  const circumference = 364;
  const capped = Math.min(current, 30);
  const offset = circumference - (capped / 30) * circumference;
  ring.style.strokeDashoffset = offset;
}

// ---------- real-time updates ----------
function startRealtimeUpdates() {
  if (realtimeUpdateInterval) clearInterval(realtimeUpdateInterval);
  
  realtimeUpdateInterval = setInterval(async () => {
    if (!currentUser) return;
    
    try {
      const streak = await Api.getStreak(currentUser.id);
      document.getElementById("currentStreak").textContent = streak.current_streak ?? 0;
      document.getElementById("longestStreak").textContent = streak.longest_streak ?? 0;
      paintStreakRing(streak.current_streak ?? 0);
      
      // Update online users count from app
      if (window.onlineTracker) {
        const onlineCount = window.onlineTracker.getOnlineCount();
        const label = document.querySelector(".online-users-label");
        if (label) {
          label.textContent = onlineCount === 1 ? "مستخدم متصل" : `${onlineCount} مستخدمين متصلين`;
        }
      }
    } catch (error) {
      console.error("Real-time update error:", error);
    }
  }, 10000); // Update every 10 seconds
}

// ---------- load real data ----------
async function bootstrap() {
  currentUser = await Auth.getUser();
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  await Api.logActivity(currentUser.id, "login");

  const profile = await Api.getProfile(currentUser.id);
  if (profile) {
    document.getElementById("profileName").textContent = profile.full_name;
    document.getElementById("profileUsername").textContent = "@" + profile.username;
    document.getElementById("drawerName").textContent = profile.full_name;
    const initial = (profile.full_name || "ط").trim().charAt(0);
    document.getElementById("avatarFallback").textContent = initial;
    document.getElementById("drawerAvatar").textContent = initial;
  }

  const streak = await Api.getStreak(currentUser.id);
  document.getElementById("currentStreak").textContent = streak.current_streak ?? 0;
  document.getElementById("longestStreak").textContent = streak.longest_streak ?? 0;
  paintStreakRing(streak.current_streak ?? 0);

  const subjects = await Api.getSubjectsWithLectureCounts();
  renderSubjects(subjects);
  
  // Start real-time updates
  startRealtimeUpdates();
}

bootstrap();
