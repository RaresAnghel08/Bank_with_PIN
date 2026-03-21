/* ═══════════════════════════════════════════════════════════════════════════
   SecureBank — SPA Application Logic
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';
let accountsCache = [];

// ─── DOM References ───────────────────────────────────────────────────────────
const mainContent   = document.getElementById('main-content');
const sidebar       = document.getElementById('sidebar');
const hamburger     = document.getElementById('hamburger');
const overlay       = document.getElementById('sidebar-overlay');
const toastContainer = document.getElementById('toast-container');


// ═══════════════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.dataset.page;
        navigateTo(page);
    });
});

function navigateTo(page) {
    currentPage = page;

    // Update active state
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Close mobile sidebar
    sidebar.classList.remove('open');
    overlay.classList.remove('active');

    // Render page
    renderPage(page);
}

// Mobile sidebar toggle
hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
});


// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

function renderPage(page) {
    const contentArea = getContentArea();

    switch (page) {
        case 'dashboard':      renderDashboard(contentArea);    break;
        case 'new-account':    renderNewAccount(contentArea);   break;
        case 'all-accounts':   renderAllAccounts(contentArea);  break;
        case 'deposit':        renderDeposit(contentArea);      break;
        case 'withdraw':       renderWithdraw(contentArea);     break;
        case 'balance':        renderBalance(contentArea);      break;
        case 'modify':         renderModify(contentArea);       break;
        case 'close':          renderClose(contentArea);        break;
        default:               renderDashboard(contentArea);
    }
}

function getContentArea() {
    // Preserve the toast container, replace everything else
    const toastEl = document.getElementById('toast-container');
    mainContent.innerHTML = '';
    mainContent.appendChild(toastEl);
    return mainContent;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function api(endpoint, options = {}) {
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    const res = await fetch(`/api${endpoint}`, config);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
    }
    return data;
}

async function fetchAccounts() {
    const data = await api('/accounts');
    accountsCache = data.accounts || [];
    return accountsCache;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
    const icons = {
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        ${icons[type] || icons.info}
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300);">&times;</button>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4500);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════════

async function renderDashboard(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>Dashboard</h1>
            <p>Welcome to SecureBank Management System</p>
        </div>
        <div class="stats-grid" id="stats-grid">
            <div class="stat-card purple stagger-1"><div class="stat-label">Total Accounts</div><div class="stat-value" id="stat-total">—</div></div>
            <div class="stat-card green stagger-2"><div class="stat-label">Savings Accounts</div><div class="stat-value" id="stat-savings">—</div></div>
            <div class="stat-card blue stagger-3"><div class="stat-label">Current Accounts</div><div class="stat-value" id="stat-current">—</div></div>
            <div class="stat-card amber stagger-4"><div class="stat-label">Newest Account</div><div class="stat-value" id="stat-newest">—</div></div>
        </div>
        <div class="card card-static stagger-5" id="recent-accounts-card">
            <div class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Recent Accounts
            </div>
            <div id="recent-accounts-body"></div>
        </div>
    `;

    try {
        const accounts = await fetchAccounts();
        document.getElementById('stat-total').textContent = accounts.length;
        document.getElementById('stat-savings').textContent = accounts.filter(a => a.acc_type === 'S').length;
        document.getElementById('stat-current').textContent = accounts.filter(a => a.acc_type === 'C').length;
        document.getElementById('stat-newest').textContent = accounts.length > 0 ? accounts[0].name : 'N/A';

        const body = document.getElementById('recent-accounts-body');
        if (accounts.length === 0) {
            body.innerHTML = renderEmptyState('No accounts yet', 'Create your first account to get started.');
        } else {
            body.innerHTML = renderAccountsTable(accounts.slice(0, 5));
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  NEW ACCOUNT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderNewAccount(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>New Account</h1>
            <p>Create a new bank account with PIN protection</p>
        </div>
        <div class="card card-static" style="max-width: 640px;">
            <form id="form-new-account">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label" for="inp-acc-no">Account Number</label>
                        <input class="form-input" id="inp-acc-no" type="number" min="1" placeholder="e.g. 1001" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="inp-name">Account Holder Name</label>
                        <input class="form-input" id="inp-name" type="text" placeholder="Full name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="inp-type">Account Type</label>
                        <select class="form-select" id="inp-type" required>
                            <option value="" disabled selected>Select type</option>
                            <option value="S">Savings</option>
                            <option value="C">Current</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="inp-deposit">Initial Deposit</label>
                        <input class="form-input" id="inp-deposit" type="number" min="0" placeholder="Amount" required>
                        <span class="form-hint">Min ₹500 (Savings) / ₹1000 (Current)</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="inp-pin">PIN</label>
                        <input class="form-input" id="inp-pin" type="password" minlength="4" maxlength="6" placeholder="4-6 digit PIN" required>
                        <span class="form-hint">Set a secure 4-6 digit PIN</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="inp-pin-confirm">Confirm PIN</label>
                        <input class="form-input" id="inp-pin-confirm" type="password" minlength="4" maxlength="6" placeholder="Repeat PIN" required>
                    </div>
                </div>
                <div class="btn-row">
                    <button type="submit" class="btn btn-primary btn-lg" id="btn-create">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        Create Account
                    </button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('form-new-account').addEventListener('submit', async e => {
        e.preventDefault();
        const pin = document.getElementById('inp-pin').value;
        const pinConfirm = document.getElementById('inp-pin-confirm').value;

        if (pin !== pinConfirm) {
            showToast('PINs do not match', 'error');
            return;
        }

        const btn = document.getElementById('btn-create');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Creating...`;

        try {
            await api('/accounts', {
                method: 'POST',
                body: {
                    acc_no:  parseInt(document.getElementById('inp-acc-no').value),
                    name:    document.getElementById('inp-name').value,
                    acc_type: document.getElementById('inp-type').value,
                    deposit: parseFloat(document.getElementById('inp-deposit').value),
                    pin:     pin
                }
            });
            showToast('Account created successfully!', 'success');
            navigateTo('dashboard');
        } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Create Account`;
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ALL ACCOUNTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

async function renderAllAccounts(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>All Account Holders</h1>
            <p>View all registered accounts</p>
        </div>
        <div class="card card-static" id="all-accounts-card">
            <div class="page-spinner"><div class="spinner"></div></div>
        </div>
    `;

    try {
        const accounts = await fetchAccounts();
        const card = document.getElementById('all-accounts-card');
        if (accounts.length === 0) {
            card.innerHTML = renderEmptyState('No accounts found', 'Create a new account to get started.');
        } else {
            card.innerHTML = `
                <div class="card-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    ${accounts.length} Account${accounts.length !== 1 ? 's' : ''}
                </div>
                ${renderAccountsTable(accounts)}
            `;
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  DEPOSIT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderDeposit(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>Deposit Amount</h1>
            <p>Add funds to an existing account</p>
        </div>
        <div class="card card-static" style="max-width: 500px;">
            <form id="form-deposit">
                <div class="form-grid" style="grid-template-columns: 1fr;">
                    <div class="form-group">
                        <label class="form-label" for="dep-acc">Account Number</label>
                        <input class="form-input" id="dep-acc" type="number" min="1" placeholder="Enter account number" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="dep-amount">Amount to Deposit</label>
                        <input class="form-input" id="dep-amount" type="number" min="1" step="0.01" placeholder="₹0.00" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="dep-pin">Account PIN</label>
                        <input class="form-input" id="dep-pin" type="password" minlength="4" maxlength="6" placeholder="Enter PIN" required>
                    </div>
                </div>
                <div class="btn-row">
                    <button type="submit" class="btn btn-success btn-lg" id="btn-deposit">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        Deposit Funds
                    </button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('form-deposit').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-deposit');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Processing...`;

        try {
            const accNo = document.getElementById('dep-acc').value;
            const result = await api(`/accounts/${accNo}/deposit`, {
                method: 'POST',
                body: {
                    pin:    document.getElementById('dep-pin').value,
                    amount: parseFloat(document.getElementById('dep-amount').value)
                }
            });
            showToast(result.message, 'success');
            showToast(`New balance: ₹${result.new_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'info');
            document.getElementById('form-deposit').reset();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> Deposit Funds`;
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  WITHDRAW PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderWithdraw(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>Withdraw Amount</h1>
            <p>Withdraw funds from an existing account</p>
        </div>
        <div class="card card-static" style="max-width: 500px;">
            <form id="form-withdraw">
                <div class="form-grid" style="grid-template-columns: 1fr;">
                    <div class="form-group">
                        <label class="form-label" for="wd-acc">Account Number</label>
                        <input class="form-input" id="wd-acc" type="number" min="1" placeholder="Enter account number" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="wd-amount">Amount to Withdraw</label>
                        <input class="form-input" id="wd-amount" type="number" min="1" step="0.01" placeholder="₹0.00" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="wd-pin">Account PIN</label>
                        <input class="form-input" id="wd-pin" type="password" minlength="4" maxlength="6" placeholder="Enter PIN" required>
                    </div>
                </div>
                <div class="btn-row">
                    <button type="submit" class="btn btn-danger btn-lg" id="btn-withdraw">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                        Withdraw Funds
                    </button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('form-withdraw').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-withdraw');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Processing...`;

        try {
            const accNo = document.getElementById('wd-acc').value;
            const result = await api(`/accounts/${accNo}/withdraw`, {
                method: 'POST',
                body: {
                    pin:    document.getElementById('wd-pin').value,
                    amount: parseFloat(document.getElementById('wd-amount').value)
                }
            });
            showToast(result.message, 'success');
            showToast(`Remaining balance: ₹${result.new_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'info');
            document.getElementById('form-withdraw').reset();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> Withdraw Funds`;
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  BALANCE ENQUIRY PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderBalance(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>Balance Enquiry</h1>
            <p>Check your account balance and recent transactions</p>
        </div>
        <div class="card card-static" style="max-width: 500px;" id="balance-form-card">
            <form id="form-balance">
                <div class="form-grid" style="grid-template-columns: 1fr;">
                    <div class="form-group">
                        <label class="form-label" for="bal-acc">Account Number</label>
                        <input class="form-input" id="bal-acc" type="number" min="1" placeholder="Enter account number" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="bal-pin">Account PIN</label>
                        <input class="form-input" id="bal-pin" type="password" minlength="4" maxlength="6" placeholder="Enter PIN" required>
                    </div>
                </div>
                <div class="btn-row">
                    <button type="submit" class="btn btn-primary btn-lg" id="btn-balance">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Check Balance
                    </button>
                </div>
            </form>
        </div>
        <div id="balance-result"></div>
    `;

    document.getElementById('form-balance').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-balance');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Verifying...`;

        try {
            const accNo = document.getElementById('bal-acc').value;
            const data = await api(`/accounts/${accNo}/verify-pin`, {
                method: 'POST',
                body: { pin: document.getElementById('bal-pin').value }
            });

            const acc = data.account;
            const resultDiv = document.getElementById('balance-result');
            resultDiv.innerHTML = `
                <div class="card card-static result-card" style="max-width: 640px; margin-top: var(--space-6);">
                    <div class="card-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                        Account Details
                    </div>
                    <div class="account-detail">
                        <div class="detail-item">
                            <span class="detail-label">Account Number</span>
                            <span class="detail-value">${acc.acc_no}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Account Holder</span>
                            <span class="detail-value">${escapeHtml(acc.name)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Account Type</span>
                            <span class="detail-value"><span class="badge ${acc.acc_type === 'S' ? 'badge-savings' : 'badge-current'}">${acc.acc_type === 'S' ? 'Savings' : 'Current'}</span></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Balance</span>
                            <span class="detail-value balance">₹${acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    ${acc.transactions && acc.transactions.length > 0 ? `
                        <div class="card-title" style="margin-top: var(--space-6);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            Recent Transactions
                        </div>
                        ${renderTransactionsTable(acc.transactions)}
                    ` : ''}
                </div>
            `;
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Check Balance`;
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  MODIFY ACCOUNT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderModify(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>Modify Account</h1>
            <p>Update account holder details</p>
        </div>
        <div class="card card-static" style="max-width: 500px;">
            <form id="form-modify-verify">
                <div class="form-grid" style="grid-template-columns: 1fr;">
                    <div class="form-group">
                        <label class="form-label" for="mod-acc">Account Number</label>
                        <input class="form-input" id="mod-acc" type="number" min="1" placeholder="Enter account number" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="mod-pin">Account PIN</label>
                        <input class="form-input" id="mod-pin" type="password" minlength="4" maxlength="6" placeholder="Enter PIN" required>
                    </div>
                </div>
                <div class="btn-row">
                    <button type="submit" class="btn btn-primary btn-lg" id="btn-mod-verify">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Verify &amp; Modify
                    </button>
                </div>
            </form>
        </div>
        <div id="modify-form-area"></div>
    `;

    document.getElementById('form-modify-verify').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-mod-verify');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Verifying...`;

        try {
            const accNo = document.getElementById('mod-acc').value;
            const pin   = document.getElementById('mod-pin').value;

            const data = await api(`/accounts/${accNo}/verify-pin`, {
                method: 'POST',
                body: { pin }
            });

            const acc = data.account;
            const area = document.getElementById('modify-form-area');
            area.innerHTML = `
                <div class="card card-static result-card" style="max-width: 640px; margin-top: var(--space-6);">
                    <div class="card-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit Account #${acc.acc_no}
                    </div>
                    <form id="form-modify-details">
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label" for="mod-name">Account Holder Name</label>
                                <input class="form-input" id="mod-name" type="text" value="${escapeHtml(acc.name)}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="mod-type">Account Type</label>
                                <select class="form-select" id="mod-type" required>
                                    <option value="S" ${acc.acc_type === 'S' ? 'selected' : ''}>Savings</option>
                                    <option value="C" ${acc.acc_type === 'C' ? 'selected' : ''}>Current</option>
                                </select>
                            </div>
                        </div>
                        <div class="btn-row">
                            <button type="submit" class="btn btn-primary btn-lg" id="btn-save-modify">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                Save Changes
                            </button>
                            <button type="button" class="btn btn-ghost btn-lg" onclick="navigateTo('modify')">Cancel</button>
                        </div>
                    </form>
                </div>
            `;

            document.getElementById('form-modify-details').addEventListener('submit', async ev => {
                ev.preventDefault();
                const saveBtn = document.getElementById('btn-save-modify');
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<span class="spinner"></span> Saving...`;

                try {
                    await api(`/accounts/${accNo}`, {
                        method: 'PUT',
                        body: {
                            pin,
                            name:     document.getElementById('mod-name').value,
                            acc_type: document.getElementById('mod-type').value,
                        }
                    });
                    showToast('Account updated successfully!', 'success');
                    navigateTo('dashboard');
                } catch (err) {
                    showToast(err.message, 'error');
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save Changes`;
                }
            });

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Verify & Modify`;
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  CLOSE ACCOUNT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderClose(container) {
    container.innerHTML += `
        <div class="page-header">
            <h1>Close Account</h1>
            <p>Permanently close a bank account</p>
        </div>
        <div class="card card-static" style="max-width: 500px;">
            <form id="form-close">
                <div class="form-grid" style="grid-template-columns: 1fr;">
                    <div class="form-group">
                        <label class="form-label" for="cl-acc">Account Number</label>
                        <input class="form-input" id="cl-acc" type="number" min="1" placeholder="Enter account number" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="cl-pin">Account PIN</label>
                        <input class="form-input" id="cl-pin" type="password" minlength="4" maxlength="6" placeholder="Enter PIN" required>
                    </div>
                </div>
                <div class="btn-row">
                    <button type="submit" class="btn btn-danger btn-lg" id="btn-close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Close Account
                    </button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('form-close').addEventListener('submit', async e => {
        e.preventDefault();

        // Show confirmation modal
        const accNo = document.getElementById('cl-acc').value;
        const pin   = document.getElementById('cl-pin').value;

        showConfirmModal(
            'Close Account',
            `Are you sure you want to permanently close account #${accNo}? This action cannot be undone.`,
            async () => {
                const btn = document.getElementById('btn-close');
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner"></span> Closing...`;

                try {
                    const result = await api(`/accounts/${accNo}`, {
                        method: 'DELETE',
                        body: { pin }
                    });
                    showToast(result.message, 'success');
                    navigateTo('dashboard');
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Close Account`;
                }
            }
        );
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function renderAccountsTable(accounts) {
    return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Acc #</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Opened</th>
                    </tr>
                </thead>
                <tbody>
                    ${accounts.map(a => `
                        <tr>
                            <td><strong>${a.acc_no}</strong></td>
                            <td>${escapeHtml(a.name)}</td>
                            <td><span class="badge ${a.acc_type === 'S' ? 'badge-savings' : 'badge-current'}">${a.acc_type === 'S' ? 'Savings' : 'Current'}</span></td>
                            <td>${formatDate(a.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderTransactionsTable(transactions) {
    return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(t => `
                        <tr>
                            <td>${formatDate(t.created_at)}</td>
                            <td><span class="badge badge-${t.type}">${capitalize(t.type)}</span></td>
                            <td>${t.type === 'withdrawal' ? '-' : '+'}₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${t.balance_after.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderEmptyState(title, description) {
    return `
        <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h3>${title}</h3>
            <p>${description}</p>
        </div>
    `;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function showConfirmModal(title, message, onConfirm) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
        <div class="modal">
            <h2>${title}</h2>
            <p>${message}</p>
            <div class="btn-row" style="margin-top: 0;">
                <button class="btn btn-danger" id="modal-confirm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Confirm
                </button>
                <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalOverlay);

    document.getElementById('modal-confirm').addEventListener('click', () => {
        modalOverlay.remove();
        onConfirm();
    });

    document.getElementById('modal-cancel').addEventListener('click', () => {
        modalOverlay.remove();
    });

    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) modalOverlay.remove();
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'Z');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════

// Render initial page
navigateTo('dashboard');
