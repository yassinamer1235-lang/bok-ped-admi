
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

const ADMIN_UID = "zuwXPgS4TPYF5GyAYEPEOrsYV0z1";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// ======================================================
// 2. GLOBAL DATA
// ======================================================

let allAccounts = {};
let allRequests = {};
let allBeneficiaries = {};

let currentBalanceUid = "";
let currentBalanceNumber = "";


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

function el(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US");
}

function formatDate(value) {

    if (!value) return "غير محدد";

    const date = new Date(Number(value));

    if (isNaN(date.getTime())) return "غير محدد";

    return date.toLocaleDateString("ar");
}

function showNotification(message) {

    const notification = el("notification");
    const text = el("notificationText");

    if (!notification || !text) return;

    text.textContent = message;
    notification.classList.remove("hidden");

    setTimeout(function() {
        notification.classList.add("hidden");
    }, 3500);
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

    const email = el("adminEmail").value.trim();
    const password = el("adminPassword").value;

    loginError.textContent = "";

    loginButton.disabled = true;
    loginButton.textContent = "جارٍ تسجيل الدخول...";

    try {

        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        if (result.user.uid !== ADMIN_UID) {

            await signOut(auth);

            loginError.textContent =
                "هذا الحساب غير مصرح له بدخول لوحة الإدارة.";

        }

    } catch(error) {

        console.error("LOGIN ERROR:", error);

        loginError.textContent =
            "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.";

    }

    loginButton.disabled = false;
    loginButton.textContent = "تسجيل الدخول";

});


el("logoutButton").addEventListener("click", async function() {

    try {

        await signOut(auth);

        showNotification("تم تسجيل الخروج");

    } catch(error) {

        console.error(error);
        showNotification("تعذر تسجيل الخروج");

    }

});


onAuthStateChanged(auth, async function(user) {

    if (!user) {

        showLogin();
        return;

    }

    if (user.uid !== ADMIN_UID) {

        await signOut(auth);
        showLogin();

        loginError.textContent =
            "هذا الحساب ليس حساب المسؤول المعتمد.";

        return;

    }

    showAdmin();

    await initializeDashboard();

});


// ======================================================
// 6. NAVIGATION
// ======================================================

const pageNames = {

    dashboard: "لوحة التحكم",
    users: "إدارة الحسابات",
    requests: "طلبات فتح الحسابات",
    balances: "إدارة الأرصدة",
    balanceLogs: "سجل العمليات المالية",
    beneficiaries: "طلبات المستفيدين",
    messages: "الرسائل والإشعارات",
    settings: "إعدادات التطبيق"

};

function showPage(pageName) {

    document.querySelectorAll(".page").forEach(function(page) {
        page.classList.remove("active");
    });

    const selected = el("page-" + pageName);

    if (selected) {
        selected.classList.add("active");
    }

    document.querySelectorAll(".nav-item").forEach(function(item) {

        item.classList.remove("active");

        if (item.dataset.page === pageName) {
            item.classList.add("active");
        }

    });

    el("pageTitle").textContent =
        pageNames[pageName] || "لوحة التحكم";

    el("sidebar").classList.remove("open");

    if (pageName === "balanceLogs") {
        loadBalanceLogs();
    }

}

document.querySelectorAll("[data-page]").forEach(function(button) {

    button.addEventListener("click", function() {
        showPage(button.dataset.page);
    });

});

el("menuButton").addEventListener("click", function() {
    el("sidebar").classList.toggle("open");
});


// ======================================================
// 7. DASHBOARD INITIALIZATION
// ======================================================

async function initializeDashboard() {

    showLoading();

    try {

        const results = await Promise.all([

            get(ref(db, "accounts")),

            get(ref(db, "requests")),

            get(ref(db, "beneficiaryRequests"))

        ]);

        allAccounts = results[0].val() || {};
        allRequests = results[1].val() || {};
        allBeneficiaries = results[2].val() || {};

        updateStatistics();

        renderRecentRequests();
        renderRequests();
        renderBeneficiaries();

        await loadSettings();

    } catch(error) {

        console.error("DASHBOARD ERROR:", error);

        showNotification(
            "تعذر تحميل البيانات. راجع قواعد Firebase."
        );

    } finally {

        hideLoading();

    }

}


// ======================================================
// 8. STATISTICS
// ======================================================

function updateStatistics() {

    const accounts = Object.values(allAccounts);

    const requests = Object.values(allRequests);

    const beneficiaries = Object.values(allBeneficiaries);

    let active = 0;
    let disabled = 0;

    accounts.forEach(function(account) {

        if (account.status === "active") {
            active++;
        } else {
            disabled++;
        }

    });

    const pendingRequests = requests.filter(function(item) {

        return !item.status || item.status === "pending";

    });

    const pendingBeneficiaries = beneficiaries.filter(function(item) {

        return !item.status || item.status === "pending";

    });

    el("totalUsers").textContent = accounts.length;
    el("activeUsers").textContent = active;
    el("disabledUsers").textContent = disabled;
    el("expiredUsers").textContent = "0";

    el("totalRequests").textContent =
        pendingRequests.length;

    el("totalBeneficiaries").textContent =
        pendingBeneficiaries.length;

    el("requestsBadge").textContent =
        pendingRequests.length;

}


// ======================================================
// 9. ACCOUNT SEARCH
// ======================================================

el("searchUserButton").addEventListener("click", searchUser);

el("userSearch").addEventListener("keydown", function(e) {

    if (e.key === "Enter") {
        searchUser();
    }

});

function searchUser() {

    const query = el("userSearch")
        .value.trim().toLowerCase();

    const container = el("usersContainer");

    if (!query) {

        container.innerHTML =
            '<p class="empty-state">أدخل رقم الحساب أو اسم المستخدم</p>';

        return;

    }

    const matches = Object.keys(allAccounts).filter(function(uid) {

        const account = allAccounts[uid] || {};

        return (

            String(uid).toLowerCase().includes(query) ||

            String(account.username || "").toLowerCase().includes(query) ||

            String(account.accountNumber || "").includes(query) ||

            String(account.email || "").toLowerCase().includes(query)

        );

    });

    if (matches.length === 0) {

        container.innerHTML =
            '<p class="empty-state">لم يتم العثور على الحساب</p>';

        return;

    }

    let html = "";

    matches.forEach(function(uid) {
        html += renderAccountCard(uid, allAccounts[uid]);
    });

    container.innerHTML = html;

}


// ======================================================
// 10. ACCOUNT CARD
// ======================================================

function renderAccountCard(uid, account) {

    const active = account.status === "active";

    return `

        <div class="user-card content-card">

            <h3>${escapeHTML(account.username || "مستخدم")}</h3>

            <p>رقم الحساب:
                ${escapeHTML(account.accountNumber || "غير محدد")}
            </p>

            <p>UID:
                ${escapeHTML(uid)}
            </p>

            <p>البريد:
                ${escapeHTML(account.email || "غير محدد")}
            </p>

            <p>الرصيد:
                ${formatMoney(account.balance)}
            </p>

            <p>تاريخ الإنشاء:
                ${formatDate(account.createdAt)}
            </p>

            <p>الحالة:
                ${active ? "نشط" : "موقوف"}
            </p>

            <div class="action-buttons">

                <button data-action="toggle-account"
                        data-uid="${escapeHTML(uid)}">

                    ${active ? "إيقاف الحساب" : "تفعيل الحساب"}

                </button>

            </div>

        </div>

    `;

}


// ======================================================
// 11. ACCOUNT MANAGEMENT
// ======================================================

el("usersContainer").addEventListener("click", async function(e) {

    const button = e.target.closest(
        'button[data-action="toggle-account"]'
    );

    if (!button) return;

    const uid = button.dataset.uid;

    const account = allAccounts[uid];

    if (!account) return;

    const newStatus =
        account.status === "active" ? "disabled" : "active";

    try {

        await update(ref(db, "accounts/" + uid), {

            status: newStatus,
            updatedAt: Date.now()

        });

        account.status = newStatus;

        searchUser();
        updateStatistics();

        showNotification(
            newStatus === "active"
                ? "تم تفعيل الحساب"
                : "تم إيقاف الحساب"
        );

    } catch(error) {

        console.error(error);
        showNotification("تعذر تحديث الحساب");

    }

});


// ======================================================
// 12. GENERATE UNIQUE 7-DIGIT ACCOUNT NUMBER
// ======================================================

async function generateAccountNumber(uid) {

    for (let i = 0; i < 40; i++) {

        const number = String(
            Math.floor(1000000 + Math.random() * 9000000)
        );

        const indexRef = ref(db, "accountIndex/" + number);

        const result = await runTransaction(
            indexRef,
            function(current) {

                if (current === null) {
                    return uid;
                }

                return;

            }
        );

        if (result.committed) {
            return number;
        }

    }

    throw new Error("ACCOUNT_NUMBER_GENERATION_FAILED");

}


// ======================================================
// 13. REQUESTS
// ======================================================

function renderRecentRequests() {

    const container = el("recentRequests");

    const entries = Object.entries(allRequests)
        .slice(-5)
        .reverse();

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

                <strong>
                    ${escapeHTML(item.name || item.username || "طلب جديد")}
                </strong>

                <p>رقم الطلب: ${escapeHTML(entry[0])}</p>

                <p>الحالة: ${escapeHTML(item.status || "pending")}</p>

            </div>

        `;

    });

    container.innerHTML = html;

}


function renderRequests() {

    const container = el("requestsContainer");

    const filter = el("requestFilter").value;

    const search = el("requestSearch").value
        .trim().toLowerCase();

    const entries = Object.entries(allRequests).reverse();

    let html = "";

    entries.forEach(function(entry) {

        const id = entry[0];
        const item = entry[1] || {};

        const status = item.status || "pending";

        if (filter === "pending" && status !== "pending") return;

        if (filter === "completed" && status !== "completed") return;

        const searchable = (

            String(item.name || "") +
            String(item.username || "") +
            String(item.email || "") +
            String(item.accountNumber || "") +
            id

        ).toLowerCase();

        if (search && searchable.indexOf(search) === -1) return;

        html += `

            <div class="content-card">

                <h3>${escapeHTML(item.name || item.username || "طلب حساب")}</h3>

                <p>رقم الطلب: ${escapeHTML(id)}</p>

                <p>UID: ${escapeHTML(item.uid || "غير موجود")}</p>

                <p>البريد: ${escapeHTML(item.email || "غير محدد")}</p>

                <p>الحالة: ${escapeHTML(status)}</p>

                <p>التاريخ: ${formatDate(item.createdAt)}</p>

                ${status !== "completed" ? `

                    <button data-action="approve-request"
                            data-id="${escapeHTML(id)}">

                        اعتماد الطلب وإنشاء الحساب

                    </button>

                ` : ""}

            </div>

        `;

    });

    container.innerHTML = html ||
        '<p class="empty-state">لا توجد طلبات مطابقة</p>';

}


el("requestFilter").addEventListener("change", renderRequests);
el("requestSearch").addEventListener("input", renderRequests);


// ======================================================
// 14. APPROVE REQUEST AND CREATE ACCOUNT
// ======================================================

el("requestsContainer").addEventListener("click", async function(e) {

    const button = e.target.closest(
        '[data-action="approve-request"]'
    );

    if (!button) return;

    const id = button.dataset.id;

    const request = allRequests[id];

    if (!request) return;

    const uid = String(request.uid || "").trim();

    if (!uid) {

        showNotification(
            "الطلب لا يحتوي على UID. لا يمكن إنشاء الحساب."
        );

        return;

    }

    if (allAccounts[uid]) {

        showNotification("هذا الحساب موجود بالفعل");
        return;

    }

    button.disabled = true;

    try {

        const number = await generateAccountNumber(uid);

        const accountData = {

            uid: uid,

            username: request.username || request.name || "مستخدم",

            email: request.email || "",

            accountNumber: number,

            balance: 0,

            status: "active",

            createdAt: Date.now()

        };

        await set(ref(db, "accounts/" + uid), accountData);

        await update(ref(db, "requests/" + id), {

            status: "completed",
            accountNumber: number,
            completedAt: Date.now()

        });

        allAccounts[uid] = accountData;

        allRequests[id].status = "completed";
        allRequests[id].accountNumber = number;

        updateStatistics();
        renderRequests();
        renderRecentRequests();

        showNotification(
            "تم إنشاء الحساب. الرقم: " + number
        );

    } catch(error) {

        console.error("APPROVE ERROR:", error);

        showNotification(
            "تعذر إنشاء الحساب. راجع البيانات والصلاحيات."
        );

    } finally {

        button.disabled = false;

    }

});


// ======================================================
// 15. BALANCE SEARCH
// ======================================================

el("balanceSearchButton").addEventListener("click", async function() {

    const number = el("balanceAccount").value.trim();

    const info = el("balanceUserInfo");

    const controls = el("balanceControls");

    controls.classList.add("hidden");

    currentBalanceUid = "";
    currentBalanceNumber = "";

    if (!/^[0-9]{7}$/.test(number)) {

        info.innerHTML =
            '<p class="empty-state">رقم الحساب يجب أن يتكون من 7 أرقام</p>';

        return;

    }

    try {

        const indexSnapshot = await get(
            ref(db, "accountIndex/" + number)
        );

        if (!indexSnapshot.exists()) {

            info.innerHTML =
                '<p class="empty-state">رقم الحساب غير موجود</p>';

            return;

        }

        const uid = String(indexSnapshot.val());

        const accountSnapshot = await get(
            ref(db, "accounts/" + uid)
        );

        if (!accountSnapshot.exists()) {

            info.innerHTML =
                '<p class="empty-state">بيانات الحساب غير موجودة</p>';

            return;

        }

        const account = accountSnapshot.val();

        currentBalanceUid = uid;
        currentBalanceNumber = number;

        info.innerHTML = `

            <div class="content-card">

                <h3>${escapeHTML(account.username || "مستخدم")}</h3>

                <p>رقم الحساب: ${escapeHTML(number)}</p>

                <p>البريد: ${escapeHTML(account.email || "غير محدد")}</p>

            </div>

        `;

        el("currentBalance").textContent =
            formatMoney(account.balance);

        controls.classList.remove("hidden");

    } catch(error) {

        console.error(error);

        info.innerHTML =
            '<p class="empty-state">تعذر تحميل بيانات الحساب</p>';

    }

});


// ======================================================
// 16. BALANCE OPERATIONS
// ======================================================

async function changeBalance(operation) {

    if (!currentBalanceUid) {

        showNotification("ابحث عن الحساب أولاً");
        return;

    }

    const amount = Number(el("balanceAmount").value);

    if (!Number.isFinite(amount) || amount <= 0) {

        showNotification("أدخل مبلغاً صحيحاً");
        return;

    }

    const balanceRef = ref(
        db,
        "accounts/" + currentBalanceUid + "/balance"
    );

    try {

        let oldBalance = 0;

        const result = await runTransaction(
            balanceRef,
            function(current) {

                oldBalance = Number(current || 0);

                if (operation === "subtract" && oldBalance < amount) {
                    return;
                }

                if (operation === "add") {
                    return oldBalance + amount;
                }

                if (operation === "subtract") {
                    return oldBalance - amount;
                }

                return amount;

            }
        );

        if (!result.committed) {

            showNotification("الرصيد غير كافٍ أو لم تتم العملية");
            return;

        }

        const newBalance = Number(result.snapshot.val() || 0);

        const logData = {

            accountNumber: currentBalanceNumber,

            uid: currentBalanceUid,

            type: operation,

            amount: amount,

            oldBalance: oldBalance,

            newBalance: newBalance,

            createdAt: Date.now(),

            adminUid: auth.currentUser.uid

        };

        await push(
            ref(db, "balanceLogs/" + currentBalanceUid),
            logData
        );

        el("currentBalance").textContent =
            formatMoney(newBalance);

        el("balanceAmount").value = "";

        if (allAccounts[currentBalanceUid]) {
            allAccounts[currentBalanceUid].balance = newBalance;
        }

        showNotification("تم تحديث الرصيد بنجاح");

    } catch(error) {

        console.error(error);

        showNotification("تعذر تحديث الرصيد");

    }

}


el("addBalanceButton").addEventListener("click", function() {
    changeBalance("add");
});

el("subtractBalanceButton").addEventListener("click", function() {
    changeBalance("subtract");
});

el("setBalanceButton").addEventListener("click", function() {
    changeBalance("set");
});


// ======================================================
// 17. BALANCE LOGS
// ======================================================

async function loadBalanceLogs() {

    const container = el("balanceLogsContainer");

    container.innerHTML =
        '<p class="empty-state">جارٍ تحميل العمليات...</p>';

    try {

        const snapshot = await get(ref(db, "balanceLogs"));

        const logs = snapshot.val() || {};

        const search = el("logsSearch").value.trim();

        let html = "";

        Object.keys(logs).forEach(function(uid) {

            const userLogs = logs[uid] || {};

            Object.entries(userLogs).reverse().forEach(function(entry) {

                const log = entry[1] || {};

                if (
                    search &&
                    String(log.accountNumber || "").indexOf(search) === -1
                ) {
                    return;
                }

                html += `

                    <div class="content-card">

                        <p>رقم الحساب:
                            ${escapeHTML(log.accountNumber)}
                        </p>

                        <p>UID:
                            ${escapeHTML(uid)}
                        </p>

                        <p>نوع العملية:
                            ${escapeHTML(log.type)}
                        </p>

                        <p>المبلغ:
                            ${formatMoney(log.amount)}
                        </p>

                        <p>الرصيد السابق:
                            ${formatMoney(log.oldBalance)}
                        </p>

                        <p>الرصيد الجديد:
                            ${formatMoney(log.newBalance)}
                        </p>

                        <p>التاريخ:
                            ${formatDate(log.createdAt)}
                        </p>

                    </div>

                `;

            });

        });

        container.innerHTML = html ||
            '<p class="empty-state">لا توجد عمليات مالية</p>';

    } catch(error) {

        console.error(error);

        container.innerHTML =
            '<p class="empty-state">تعذر تحميل السجل</p>';

    }

}

el("logsSearch").addEventListener("input", loadBalanceLogs);


// ======================================================
// 18. BENEFICIARY REQUESTS
// ======================================================

function renderBeneficiaries() {

    const container = el("beneficiariesContainer");

    const filter = el("beneficiaryFilter").value;

    let html = "";

    Object.entries(allBeneficiaries).reverse().forEach(function(entry) {

        const id = entry[0];
        const item = entry[1] || {};

        const status = item.status || "pending";

        if (filter === "pending" && status !== "pending") return;

        if (filter === "completed" && status !== "completed") return;

        html += `

            <div class="content-card">

                <h3>
                    ${escapeHTML(item.name || item.beneficiaryName || "طلب مستفيد")}
                </h3>

                <p>رقم الطلب: ${escapeHTML(id)}</p>

                <p>رقم الحساب:
                    ${escapeHTML(item.accountNumber || "غير محدد")}
                </p>

                <p>رقم المستفيد:
                    ${escapeHTML(item.accountNumber16 || "غير محدد")}
                </p>

                <p>الفرع:
                    ${escapeHTML(item.branch || "غير محدد")}
                </p>

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

el("beneficiaryFilter").addEventListener(
    "change",
    renderBeneficiaries
);


el("beneficiariesContainer").addEventListener(
    "click",
    async function(e) {

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

            console.error(error);
            showNotification("تعذر تحديث الطلب");

        }

    }
);


// ======================================================
// 19. IN-APP MESSAGES
// NO SMS
// ======================================================

el("sendMessageButton").addEventListener(
    "click",
    async function() {

        const title = el("messageTitle").value.trim();

        const content = el("messageContent").value.trim();

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

            el("messageTitle").value = "";
            el("messageContent").value = "";

            showNotification("تم حفظ الرسالة داخل النظام");

        } catch(error) {

            console.error(error);
            showNotification("تعذر حفظ الرسالة");

        }

    }
);


// ======================================================
// 20. APPLICATION UPDATE SETTINGS
// ======================================================

async function loadSettings() {

    try {

        const snapshot = await get(ref(db, "app_update"));

        if (!snapshot.exists()) return;

        const data = snapshot.val() || {};

        el("appVersion").value = data.version || "";
        el("appUpdateUrl").value = data.url || "";
        el("appUpdateMessage").value = data.message || "";

    } catch(error) {

        console.error("SETTINGS ERROR:", error);

    }

}


el("saveSettingsButton").addEventListener(
    "click",
    async function() {

        const version = el("appVersion").value.trim();

        const url = el("appUpdateUrl").value.trim();

        const message = el("appUpdateMessage").value.trim();

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

    }
);


// ======================================================
// 21. INITIAL STATE
// ======================================================

showLoading();
