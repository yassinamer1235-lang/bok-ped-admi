
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    getDatabase,
    ref,
    get,
    set,
    update,
    push,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";


// ======================================================
// 1. FIREBASE CONFIGURATION
// ======================================================

const firebaseConfig = {
    apiKey: "AIzaSyDnvmRTgZl1p325V3TmCjIH-PnPfjJPPpk",
    authDomain: "bok-ped.firebaseapp.com",
    databaseURL: "https://bok-ped-default-rtdb.firebaseio.com",
    projectId: "bok-ped",
    storageBucket: "bok-ped.firebasestorage.app",
    messagingSenderId: "812838230843",
    appId: "1:812838230843:web:f3bd5f59343db42b52b51e",
    measurementId: "G-26SMZR0QCC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// ======================================================
// 2. GLOBAL VARIABLES
// ======================================================

let allUsers = {};
let allRequests = {};
let allBeneficiaries = {};
let currentBalanceAccount = "";
let currentBalanceUid = "";


// ======================================================
// 3. ELEMENTS
// ======================================================

const loadingScreen = document.getElementById("loadingScreen");
const loginSection = document.getElementById("loginSection");
const adminApp = document.getElementById("adminApp");

const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginButton = document.getElementById("loginButton");


// ======================================================
// 4. GENERAL FUNCTIONS
// ======================================================

function showNotification(message) {

    const notification = document.getElementById("notification");
    const notificationText = document.getElementById("notificationText");

    if (!notification || !notificationText) return;

    notificationText.textContent = message;

    notification.classList.remove("hidden");

    setTimeout(function() {
        notification.classList.add("hidden");
    }, 3500);
}


function escapeHTML(value) {

    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDate(value) {

    if (!value) return "غير محدد";

    const date = new Date(value);

    if (isNaN(date.getTime())) return "غير محدد";

    return date.toLocaleDateString("ar");
}


function formatMoney(value) {

    return Number(value || 0).toLocaleString("en-US");
}


function showLoading() {
    loadingScreen.classList.remove("hidden");
}


function hideLoading() {
    loadingScreen.classList.add("hidden");
}


function showLogin() {

    loginSection.classList.remove("hidden");
    adminApp.classList.add("hidden");

    hideLoading();
}


function showAdmin() {

    loginSection.classList.add("hidden");
    adminApp.classList.remove("hidden");

    hideLoading();
}


// ======================================================
// 5. AUTHENTICATION
// ======================================================

loginForm.addEventListener("submit", async function(e) {

    e.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();

    const password = document.getElementById("adminPassword").value;

    loginError.textContent = "";

    loginButton.disabled = true;
    loginButton.textContent = "جارٍ تسجيل الدخول...";

    try {

        await signInWithEmailAndPassword(auth, email, password);

    } catch(error) {

        loginError.textContent = "تعذر تسجيل الدخول. تحقق من البيانات وصلاحيات الحساب.";

        console.error(error);

    }

    loginButton.disabled = false;
    loginButton.textContent = "تسجيل الدخول";

});


document.getElementById("logoutButton").addEventListener("click", async function() {

    try {

        await signOut(auth);

        showNotification("تم تسجيل الخروج");

    } catch(error) {

        showNotification("تعذر تسجيل الخروج");

    }

});


onAuthStateChanged(auth, async function(user) {

    if (user) {

        showAdmin();

        await initializeDashboard();

    } else {

        showLogin();

    }

});


// ======================================================
// 6. NAVIGATION
// ======================================================

const pageNames = {

    dashboard: "لوحة التحكم",
    users: "إدارة المستخدمين",
    requests: "طلبات فتح الحسابات",
    subscriptions: "إدارة الاشتراكات",
    balances: "إدارة الأرصدة",
    balanceLogs: "سجل العمليات المالية",
    beneficiaries: "طلبات المستفيدين",
    messages: "الرسائل والإشعارات",
    settings: "إعدادات التطبيق"

};


function showPage(pageName) {

    const pages = document.querySelectorAll(".page");

    pages.forEach(function(page) {
        page.classList.remove("active");
    });

    const selected = document.getElementById("page-" + pageName);

    if (selected) {
        selected.classList.add("active");
    }

    document.querySelectorAll(".nav-item").forEach(function(item) {

        item.classList.remove("active");

        if (item.dataset.page === pageName) {
            item.classList.add("active");
        }

    });

    document.getElementById("pageTitle").textContent =
        pageNames[pageName] || "لوحة التحكم";

    document.getElementById("sidebar").classList.remove("open");

}


document.querySelectorAll("[data-page]").forEach(function(button) {

    button.addEventListener("click", function() {

        showPage(button.dataset.page);

    });

});


document.getElementById("menuButton").addEventListener("click", function() {

    document.getElementById("sidebar").classList.toggle("open");

});


// ======================================================
// 7. DASHBOARD INITIALIZATION
// ======================================================

async function initializeDashboard() {

    try {

        const results = await Promise.all([

            get(ref(db, "users")),

            get(ref(db, "requests")),

            get(ref(db, "beneficiaryRequests"))

        ]);

        allUsers = results[0].val() || {};

        allRequests = results[1].val() || {};

        allBeneficiaries = results[2].val() || {};

        updateStatistics();

        renderRecentRequests();

        renderRequests();

        renderBeneficiaries();

        loadSettings();

    } catch(error) {

        console.error(error);

        showNotification("تعذر تحميل البيانات. تحقق من صلاحيات Firebase.");

    }

}


// ======================================================
// 8. STATISTICS
// ======================================================

function updateStatistics() {

    const users = Object.values(allUsers);

    const requests = Object.values(allRequests);

    const beneficiaries = Object.values(allBeneficiaries);

    let active = 0;
    let disabled = 0;
    let expired = 0;

    const now = Date.now();

    users.forEach(function(user) {

        if (user.disabled === true || user.active === false) {

            disabled++;

        } else if (
            user.subscriptionEnd &&
            Number(user.subscriptionEnd) < now
        ) {

            expired++;

        } else {

            active++;

        }

    });

    document.getElementById("totalUsers").textContent = users.length;

    document.getElementById("activeUsers").textContent = active;

    document.getElementById("disabledUsers").textContent = disabled;

    document.getElementById("expiredUsers").textContent = expired;

    const pendingRequests = requests.filter(function(item) {

        return !item.status || item.status === "pending";

    });

    document.getElementById("totalRequests").textContent =
        pendingRequests.length;

    const pendingBeneficiaries = beneficiaries.filter(function(item) {

        return !item.status || item.status === "pending";

    });

    document.getElementById("totalBeneficiaries").textContent =
        pendingBeneficiaries.length;

    document.getElementById("requestsBadge").textContent =
        pendingRequests.length;

}


// ======================================================
// 9. USER SEARCH
// ======================================================

document.getElementById("searchUserButton").addEventListener("click", function() {

    searchUser();

});


document.getElementById("userSearch").addEventListener("keydown", function(e) {

    if (e.key === "Enter") {
        searchUser();
    }

});


function searchUser() {

    const query = document.getElementById("userSearch")
        .value.trim().toLowerCase();

    const container = document.getElementById("usersContainer");

    if (!query) {

        container.innerHTML =
            '<p class="empty-state">أدخل رقم الحساب أو اسم المستخدم</p>';

        return;

    }

    const matches = Object.keys(allUsers).filter(function(uid) {

        const user = allUsers[uid] || {};

        return (

            String(uid).toLowerCase().includes(query) ||

            String(user.username || "").toLowerCase().includes(query) ||

            String(user.accountNumber || "").includes(query) ||

            String(user.email || "").toLowerCase().includes(query)

        );

    });

    if (matches.length === 0) {

        container.innerHTML =
            '<p class="empty-state">لم يتم العثور على الحساب</p>';

        return;

    }

    let html = "";

    matches.forEach(function(uid) {

        const user = allUsers[uid];

        html += renderUserCard(uid, user);

    });

    container.innerHTML = html;

}


function renderUserCard(uid, user) {

    const disabled = user.disabled === true;

    const expired = user.subscriptionEnd &&
        Number(user.subscriptionEnd) < Date.now();

    return `

        <div class="user-card content-card">

            <h3>${escapeHTML(user.username || "مستخدم")}</h3>

            <p>رقم الحساب: ${escapeHTML(user.accountNumber || "غير محدد")}</p>

            <p>البريد: ${escapeHTML(user.email || "غير محدد")}</p>

            <p>الاشتراك: ${escapeHTML(user.subscriptionName || "غير محدد")}</p>

            <p>بداية الاشتراك: ${formatDate(user.subscriptionStart)}</p>

            <p>نهاية الاشتراك: ${formatDate(user.subscriptionEnd)}</p>

            <p>الحالة:
                ${disabled ? "موقوف" : expired ? "منتهي" : "نشط"}
            </p>

            <div class="action-buttons">

                <button data-action="toggle-user"
                        data-uid="${escapeHTML(uid)}">
                    ${disabled ? "تفعيل الحساب" : "إيقاف الحساب"}
                </button>

                <button data-action="extend-user"
                        data-uid="${escapeHTML(uid)}">
                    تمديد الاشتراك 30 يوم
                </button>

            </div>

        </div>

    `;

}


// ======================================================
// 10. USER MANAGEMENT
// ======================================================

document.getElementById("usersContainer")
.addEventListener("click", async function(e) {

    const button = e.target.closest("button[data-action]");

    if (!button) return;

    const uid = button.dataset.uid;

    if (!uid || !allUsers[uid]) return;

    const action = button.dataset.action;

    try {

        if (action === "toggle-user") {

            const disabled = allUsers[uid].disabled === true;

            await update(ref(db, "users/" + uid), {

                disabled: !disabled,

                active: disabled,

                updatedAt: Date.now()

            });

            allUsers[uid].disabled = !disabled;

            allUsers[uid].active = disabled;

            searchUser();

            updateStatistics();

            showNotification(disabled ? "تم تفعيل الحساب" : "تم إيقاف الحساب");

        }


        if (action === "extend-user") {

            const user = allUsers[uid];

            const currentEnd = Number(user.subscriptionEnd || 0);

            const start = Math.max(currentEnd, Date.now());

            const newEnd = start + (30 * 24 * 60 * 60 * 1000);

            await update(ref(db, "users/" + uid), {

                subscriptionStart: user.subscriptionStart || Date.now(),

                subscriptionEnd: newEnd,

                subscriptionName: user.subscriptionName || "شهر",

                subscriptionType: user.subscriptionType || "month",

                active: true,

                disabled: false,

                updatedAt: Date.now()

            });

            allUsers[uid].subscriptionEnd = newEnd;

            allUsers[uid].active = true;

            allUsers[uid].disabled = false;

            searchUser();

            updateStatistics();

            showNotification("تم تمديد الاشتراك بنجاح");

        }

    } catch(error) {

        console.error(error);

        showNotification("تعذر تنفيذ العملية");

    }

});


// ======================================================
// 11. REQUESTS
// ======================================================

function renderRecentRequests() {

    const container = document.getElementById("recentRequests");

    const entries = Object.entries(allRequests).slice(-5).reverse();

    if (entries.length === 0) {

        container.innerHTML =
            '<p class="empty-state">لا توجد طلبات حالياً</p>';

        return;

    }

    let html = "";

    entries.forEach(function(entry) {

        const item = entry[1] || {};

        html += `

            <div class="request-item">

                <strong>${escapeHTML(item.name || item.username || "طلب جديد")}</strong>

                <p>رقم الطلب: ${escapeHTML(entry[0])}</p>

                <p>الحالة: ${escapeHTML(item.status || "pending")}</p>

            </div>

        `;

    });

    container.innerHTML = html;

}


function renderRequests() {

    const container = document.getElementById("requestsContainer");

    const filter = document.getElementById("requestFilter").value;

    const entries = Object.entries(allRequests).reverse();

    let html = "";

    entries.forEach(function(entry) {

        const key = entry[0];

        const item = entry[1] || {};

        const status = item.status || "pending";

        if (filter !== "all") {

            if (filter === "pending" && status !== "pending") return;

            if (filter === "completed" && status !== "completed") return;

        }

        html += `

            <div class="content-card">

                <h3>${escapeHTML(item.name || item.username || "طلب حساب")}</h3>

                <p>رقم الطلب: ${escapeHTML(key)}</p>

                <p>البريد: ${escapeHTML(item.email || "غير محدد")}</p>

                <p>الحالة: ${escapeHTML(status)}</p>

                <p>التاريخ: ${formatDate(item.createdAt)}</p>

                ${status !== "completed" ? `

                    <button data-action="complete-request"
                            data-id="${escapeHTML(key)}">
                        إكمال الطلب
                    </button>

                ` : ""}

            </div>

        `;

    });

    container.innerHTML = html ||
        '<p class="empty-state">لا توجد طلبات مطابقة</p>';

}


document.getElementById("requestFilter")
.addEventListener("change", renderRequests);


document.getElementById("requestsContainer")
.addEventListener("click", async function(e) {

    const button = e.target.closest('[data-action="complete-request"]');

    if (!button) return;

    const id = button.dataset.id;

    try {

        await update(ref(db, "requests/" + id), {

            status: "completed",

            completedAt: Date.now()

        });

        allRequests[id].status = "completed";

        renderRequests();

        renderRecentRequests();

        updateStatistics();

        showNotification("تم تحديث الطلب");

    } catch(error) {

        showNotification("تعذر تحديث الطلب");

    }

});


// ======================================================
// 12. SUBSCRIPTIONS
// ======================================================

document.getElementById("subscriptionSearchButton")
.addEventListener("click", function() {

    const number = document.getElementById("subscriptionSearch")
        .value.trim();

    const container = document.getElementById("subscriptionContainer");

    const found = Object.keys(allUsers).find(function(uid) {

        return String(allUsers[uid].accountNumber || "") === number;

    });

    if (!found) {

        container.innerHTML =
            '<p class="empty-state">الحساب غير موجود</p>';

        return;

    }

    container.innerHTML = renderUserCard(found, allUsers[found]);

});


// ======================================================
// 13. BALANCE SEARCH
// ======================================================

document.getElementById("balanceSearchButton")
.addEventListener("click", async function() {

    const number = document.getElementById("balanceAccount")
        .value.trim();

    const info = document.getElementById("balanceUserInfo");

    const controls = document.getElementById("balanceControls");

    controls.classList.add("hidden");

    if (!/^[0-9]{7}$/.test(number)) {

        info.innerHTML =
            '<p class="empty-state">رقم الحساب يجب أن يتكون من 7 أرقام</p>';

        return;

    }

    try {

        const indexSnapshot = await get(
            ref(db, "accountNumbers/" + number)
        );

        if (!indexSnapshot.exists()) {

            info.innerHTML =
                '<p class="empty-state">رقم الحساب غير موجود</p>';

            return;

        }

        const indexValue = indexSnapshot.val();

        const uid = typeof indexValue === "string"
            ? indexValue
            : indexValue.uid;

        if (!uid) {

            info.innerHTML =
                '<p class="empty-state">بيانات ربط الحساب غير صحيحة</p>';

            return;

        }

        const userSnapshot = await get(ref(db, "users/" + uid));

        if (!userSnapshot.exists()) {

            info.innerHTML =
                '<p class="empty-state">بيانات المستخدم غير موجودة</p>';

            return;

        }

        const user = userSnapshot.val();

        const balanceSnapshot = await get(
            ref(db, "accounts/" + number + "/balance")
        );

        const balance = Number(balanceSnapshot.val() || 0);

        currentBalanceAccount = number;

        currentBalanceUid = uid;

        info.innerHTML = `

            <div class="content-card">

                <h3>${escapeHTML(user.username || "مستخدم")}</h3>

                <p>رقم الحساب: ${escapeHTML(number)}</p>

                <p>البريد: ${escapeHTML(user.email || "غير محدد")}</p>

            </div>

        `;

        document.getElementById("currentBalance").textContent =
            formatMoney(balance);

        controls.classList.remove("hidden");

    } catch(error) {

        console.error(error);

        info.innerHTML =
            '<p class="empty-state">تعذر تحميل بيانات الحساب</p>';

    }

});


// ======================================================
// 14. BALANCE OPERATIONS
// ======================================================

async function changeBalance(operation) {

    if (!currentBalanceAccount || !currentBalanceUid) {

        showNotification("ابحث عن الحساب أولاً");

        return;

    }

    const input = document.getElementById("balanceAmount");

    const amount = Number(input.value);

    if (!Number.isFinite(amount) || amount <= 0) {

        showNotification("أدخل مبلغاً صحيحاً");

        return;

    }

    const balanceRef = ref(
        db,
        "accounts/" + currentBalanceAccount + "/balance"
    );

    try {

        let oldBalance = 0;

        let newBalance = 0;

        const result = await runTransaction(balanceRef, function(current) {

            oldBalance = Number(current || 0);

            if (operation === "add") {

                newBalance = oldBalance + amount;

            } else if (operation === "subtract") {

                if (oldBalance < amount) {

                    return;

                }

                newBalance = oldBalance - amount;

            } else {

                newBalance = amount;

            }

            return newBalance;

        });

        if (!result.committed) {

            showNotification("الرصيد غير كافٍ أو لم تتم العملية");

            return;

        }

        newBalance = Number(result.snapshot.val() || 0);

        const logData = {

            accountNumber: currentBalanceAccount,

            uid: currentBalanceUid,

            type: operation,

            amount: amount,

            oldBalance: oldBalance,

            newBalance: newBalance,

            createdAt: Date.now(),

            adminUid: auth.currentUser.uid

        };

        await push(ref(db, "balanceLogs"), logData);

        document.getElementById("currentBalance").textContent =
            formatMoney(newBalance);

        input.value = "";

        showNotification("تم تحديث الرصيد بنجاح");

    } catch(error) {

        console.error(error);

        showNotification("تعذر تحديث الرصيد");

    }

}


document.getElementById("addBalanceButton")
.addEventListener("click", function() {

    changeBalance("add");

});


document.getElementById("subtractBalanceButton")
.addEventListener("click", function() {

    changeBalance("subtract");

});


document.getElementById("setBalanceButton")
.addEventListener("click", function() {

    changeBalance("set");

});


// ======================================================
// 15. BALANCE LOGS
// ======================================================

async function loadBalanceLogs() {

    const container = document.getElementById("balanceLogsContainer");

    try {

        const snapshot = await get(ref(db, "balanceLogs"));

        const logs = snapshot.val() || {};

        const search = document.getElementById("logsSearch")
            .value.trim();

        const entries = Object.entries(logs).reverse();

        let html = "";

        entries.forEach(function(entry) {

            const log = entry[1] || {};

            if (
                search &&
                String(log.accountNumber || "").indexOf(search) === -1
            ) return;

            html += `

                <div class="content-card">

                    <p>رقم الحساب: ${escapeHTML(log.accountNumber)}</p>

                    <p>نوع العملية: ${escapeHTML(log.type)}</p>

                    <p>المبلغ: ${formatMoney(log.amount)}</p>

                    <p>الرصيد السابق: ${formatMoney(log.oldBalance)}</p>

                    <p>الرصيد الجديد: ${formatMoney(log.newBalance)}</p>

                    <p>التاريخ: ${formatDate(log.createdAt)}</p>

                </div>

            `;

        });

        container.innerHTML = html ||
            '<p class="empty-state">لا توجد عمليات مالية</p>';

    } catch(error) {

        console.error(error);

        container.innerHTML =
            '<p class="empty-state">تعذر تحميل السجل</p>';

    }

}


document.getElementById("logsSearch")
.addEventListener("input", loadBalanceLogs);


document.querySelector('[data-page="balanceLogs"]')
.addEventListener("click", loadBalanceLogs);


// ======================================================
// 16. BENEFICIARY REQUESTS
// ======================================================

function renderBeneficiaries() {

    const container = document.getElementById("beneficiariesContainer");

    const filter = document.getElementById("beneficiaryFilter").value;

    let html = "";

    Object.entries(allBeneficiaries).reverse().forEach(function(entry) {

        const id = entry[0];

        const item = entry[1] || {};

        const status = item.status || "pending";

        if (filter === "pending" && status !== "pending") return;

        if (filter === "completed" && status !== "completed") return;

        html += `

            <div class="content-card">

                <h3>${escapeHTML(item.name || item.beneficiaryName || "طلب مستفيد")}</h3>

                <p>رقم الطلب: ${escapeHTML(id)}</p>

                <p>رقم الحساب: ${escapeHTML(item.accountNumber || "غير محدد")}</p>

                <p>الحالة: ${escapeHTML(status)}</p>

                ${status !== "completed" ? `

                    <button data-action="complete-beneficiary"
                            data-id="${escapeHTML(id)}">
                        إكمال الطلب
                    </button>

                ` : ""}

            </div>

        `;

    });

    container.innerHTML = html ||
        '<p class="empty-state">لا توجد طلبات</p>';

}


document.getElementById("beneficiaryFilter")
.addEventListener("change", renderBeneficiaries);


document.getElementById("beneficiariesContainer")
.addEventListener("click", async function(e) {

    const button = e.target.closest(
        '[data-action="complete-beneficiary"]'
    );

    if (!button) return;

    const id = button.dataset.id;

    try {

        await update(
            ref(db, "beneficiaryRequests/" + id),
            {
                status: "completed",
                completedAt: Date.now()
            }
        );

        allBeneficiaries[id].status = "completed";

        renderBeneficiaries();

        updateStatistics();

        showNotification("تم تحديث الطلب");

    } catch(error) {

        showNotification("تعذر تحديث الطلب");

    }

});


// ======================================================
// 17. IN-APP MESSAGES
// No SMS functionality
// ======================================================

document.getElementById("sendMessageButton")
.addEventListener("click", async function() {

    const title = document.getElementById("messageTitle")
        .value.trim();

    const content = document.getElementById("messageContent")
        .value.trim();

    if (!title || !content) {

        showNotification("أدخل عنوان الرسالة ومحتواها");

        return;

    }

    try {

        await push(ref(db, "messages"), {

            title: title,

            message: content,

            type: "in_app",

            createdAt: Date.now(),

            adminUid: auth.currentUser.uid

        });

        document.getElementById("messageTitle").value = "";

        document.getElementById("messageContent").value = "";

        showNotification("تم حفظ الرسالة داخل النظام");

    } catch(error) {

        console.error(error);

        showNotification("تعذر حفظ الرسالة");

    }

});


// ======================================================
// 18. APPLICATION SETTINGS
// ======================================================

async function loadSettings() {

    try {

        const snapshot = await get(ref(db, "app_update"));

        if (!snapshot.exists()) return;

        const data = snapshot.val() || {};

        document.getElementById("appVersion").value =
            data.version || "";

        document.getElementById("appUpdateUrl").value =
            data.url || "";

        document.getElementById("appUpdateMessage").value =
            data.message || "";

    } catch(error) {

        console.error(error);

    }

}


document.getElementById("saveSettingsButton")
.addEventListener("click", async function() {

    const version = document.getElementById("appVersion")
        .value.trim();

    const url = document.getElementById("appUpdateUrl")
        .value.trim();

    const message = document.getElementById("appUpdateMessage")
        .value.trim();

    try {

        await update(ref(db, "app_update"), {

            version: version,

            url: url,

            message: message,

            updatedAt: Date.now(),

            adminUid: auth.currentUser.uid

        });

        showNotification("تم حفظ الإعدادات بنجاح");

    } catch(error) {

        console.error(error);

        showNotification("تعذر حفظ الإعدادات");

    }

});


// ======================================================
// 19. INITIAL STATE
// ======================================================

showLoading();
