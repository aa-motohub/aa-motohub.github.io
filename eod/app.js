// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbxRUYxrO6fZT9EM3f2P_68avCkRXD0qK4CmXOsdHPsFFic1COLu6KeD3s_OxbtLSvOS/exec';
let currentUser = null;
let userRoles = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Forms
    document.getElementById('eodForm').addEventListener('submit', handleEODSubmit);
    document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('userForm').addEventListener('submit', handleUserSubmit);
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    });
    
    // Keyboard support for login
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && document.getElementById('loginPage').classList.contains('active')) {
            handleLogin(e);
        }
    });
}

// API Calls
async function apiCall(method, action, data = {}) {
    try {
        let url = API_URL;
        let options = {
            method: method
        };

        if (method === 'POST') {
            // For POST requests, send JSON in the body with action included
            const requestData = {
                action: action,
                ...data
            };
            options.body = JSON.stringify(requestData);
            options.headers = {
                'Content-Type': 'application/json'
            };
        } else if (method === 'GET') {
            // For GET requests, add parameters to URL
            const params = new URLSearchParams({
                action: action,
                ...data
            });
            url = `${API_URL}?${params.toString()}`;
        }

        const response = await fetch(url, options);
        const text = await response.text();
        
        // Try to parse JSON
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('JSON Parse Error:', text);
            return { success: false, message: 'Invalid response from server' };
        }
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Authentication Functions
function checkSession() {
    const sessionToken = localStorage.getItem('sessionToken');
    const userData = localStorage.getItem('userData');
    
    if (sessionToken && userData) {
        currentUser = JSON.parse(userData);
        validateAndSetup(sessionToken);
    } else {
        showLogin();
    }
}

async function validateAndSetup(sessionToken) {
    const result = await apiCall('POST', 'validateSession', { sessionToken });
    if (result.success) {
        showApp();
        loadDashboard();
    } else {
        handleLogout();
    }
}

function showLogin() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('appPage').classList.remove('active');
    document.getElementById('email').focus();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    // Validation
    if (!email || !password) {
        errorDiv.textContent = 'Please enter both email and password';
        errorDiv.classList.add('show');
        return;
    }
    
    errorDiv.classList.remove('show');
    
    // Show loading state
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    submitBtn.disabled = true;
    
    try {
        const result = await apiCall('POST', 'login', { email, password });
        
        console.log('Login result:', result); // Debug log
        
        if (result.success) {
            currentUser = result.data;
            localStorage.setItem('sessionToken', result.data.sessionToken);
            localStorage.setItem('userData', JSON.stringify(result.data));
            document.getElementById('loginForm').reset();
            showApp();
            loadDashboard();
        } else {
            errorDiv.textContent = result.message || 'Invalid email or password';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.add('show');
        console.error('Login error:', error);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function handleLogout() {
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
        try {
            await apiCall('POST', 'logout', { sessionToken });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userData');
    currentUser = null;
    
    showLogin();
}

// App Display Functions
function showApp() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('appPage').classList.add('active');
    
    // Update user info
    document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    
    let roleName = 'Regular';
    if (currentUser.roleId == 1) roleName = 'Manager';
    else if (currentUser.roleId == 2) roleName = 'Admin';
    
    document.getElementById('userRole').textContent = roleName;
    
    // Show/hide admin menu items
    const adminItems = document.querySelectorAll('.admin-only');
    if (currentUser.roleId == 1 || currentUser.roleId == 2) {
        adminItems.forEach(item => item.style.display = 'flex');
    } else {
        adminItems.forEach(item => item.style.display = 'none');
    }
    
    // Set active nav to dashboard
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === 'dashboard') item.classList.add('active');
    });
}

// Navigation
function navigateTo(page) {
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) item.classList.add('active');
    });
    
    // Show selected page
    document.querySelectorAll('.content-page').forEach(p => p.classList.remove('active'));
    const pageElement = document.getElementById(page);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    // Load page data
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'eod':
            loadEODs();
            break;
        case 'expenses':
            loadExpenses();
            break;
        case 'users':
            if (currentUser.roleId == 1 || currentUser.roleId == 2) {
                loadUsers();
            } else {
                alert('Access denied. Admin privileges required.');
                navigateTo('dashboard');
            }
            break;
        default:
            console.warn('Unknown page:', page);
    }
}

// Dashboard Functions
async function loadDashboard() {
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        // Show loading state
        document.getElementById('totalEOD').textContent = '...';
        document.getElementById('totalExpenses').textContent = '...';
        document.getElementById('todayExpenses').textContent = '...';
        document.getElementById('totalUsers').textContent = '...';
        
        // Load EODs
        const eodsResult = await apiCall('GET', 'getEODs', { sessionToken });
        if (eodsResult.success) {
            document.getElementById('totalEOD').textContent = eodsResult.data.length;
        } else {
            document.getElementById('totalEOD').textContent = '0';
        }
        
        // Load Expenses
        const expensesResult = await apiCall('GET', 'getExpenses', { sessionToken });
        if (expensesResult.success) {
            document.getElementById('totalExpenses').textContent = expensesResult.data.length;
            
            // Calculate today's expenses
            const today = new Date().toISOString().split('T')[0];
            const todayExpenses = expensesResult.data.filter(e => e.date === today);
            const todayTotal = todayExpenses.reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);
            document.getElementById('todayExpenses').textContent = `$${todayTotal.toFixed(2)}`;
        } else {
            document.getElementById('totalExpenses').textContent = '0';
            document.getElementById('todayExpenses').textContent = '$0.00';
        }
        
        // Build recent activity
        const activity = [];
        
        if (eodsResult.success && eodsResult.data.length > 0) {
            eodsResult.data.slice(-5).reverse().forEach(e => {
                activity.push({
                    type: 'EOD',
                    icon: 'fa-calendar-check',
                    description: `End of Day Record`,
                    amount: `$${parseFloat(e.amount || 0).toFixed(2)}`,
                    date: e.date || e.recordDateAndTime
                });
            });
        }
        
        if (expensesResult.success && expensesResult.data.length > 0) {
            expensesResult.data.slice(-5).reverse().forEach(e => {
                activity.push({
                    type: 'Expense',
                    icon: 'fa-receipt',
                    description: e.description || 'Expense',
                    amount: `$${parseFloat(e.cost || 0).toFixed(2)}`,
                    date: e.date || e.recordDateAndTime
                });
            });
        }
        
        // Sort by date (newest first)
        activity.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Display recent activity
        const activityHtml = activity.slice(0, 10).map(a => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${a.icon}"></i>
                </div>
                <div class="activity-details">
                    <strong>${a.description}</strong>
                    <span>${a.amount}</span>
                </div>
                <div class="activity-date">
                    <small>${formatDate(a.date)}</small>
                </div>
            </div>
        `).join('');
        
        document.getElementById('recentActivity').innerHTML = activityHtml || 
            '<p style="text-align:center; color: #64748b;">No recent activity</p>';
        
        // Load total users if admin
        if (currentUser && (currentUser.roleId == 1 || currentUser.roleId == 2)) {
            const usersResult = await apiCall('GET', 'getUsers', { sessionToken });
            if (usersResult.success) {
                document.getElementById('totalUsers').textContent = usersResult.data.length;
            } else {
                document.getElementById('totalUsers').textContent = '0';
            }
        } else {
            document.getElementById('totalUsers').textContent = '-';
        }
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        document.getElementById('recentActivity').innerHTML = 
            '<p style="text-align:center; color: #ef4444;">Error loading dashboard data</p>';
    }
}

// EOD Functions
async function loadEODs() {
    const sessionToken = localStorage.getItem('sessionToken');
    const tbody = document.getElementById('eodTableBody');
    
    try {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
        
        const result = await apiCall('GET', 'getEODs', { sessionToken });
        
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(eod => `
                <tr>
                    <td>${formatDate(eod.date)}</td>
                    <td class="amount">$${parseFloat(eod.amount).toFixed(2)}</td>
                    <td>${formatDateTime(eod.recordDateAndTime)}</td>
                    <td>${formatDateTime(eod.lastMaintainDateAndTime)}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="editEOD('${eod.eodId}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEODRecord('${eod.eodId}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;">No EOD records found. Click "Add EOD Record" to create one.</td></tr>';
        }
    } catch (error) {
        console.error('Load EODs error:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ef4444;">Error loading EOD records</td></tr>';
    }
}

function showEODModal(eodId = null) {
    document.getElementById('eodModalTitle').textContent = eodId ? 'Edit EOD Record' : 'Add EOD Record';
    document.getElementById('eodId').value = eodId || '';
    document.getElementById('eodDate').value = '';
    document.getElementById('eodAmount').value = '';
    document.getElementById('eodError').classList.remove('show');
    document.getElementById('eodError').textContent = '';
    
    if (eodId) {
        loadEODData(eodId);
    } else {
        // Set default date to today
        document.getElementById('eodDate').value = new Date().toISOString().split('T')[0];
    }
    
    document.getElementById('eodModal').classList.add('active');
    document.getElementById('eodDate').focus();
}

async function loadEODData(eodId) {
    const sessionToken = localStorage.getItem('sessionToken');
    try {
        const result = await apiCall('GET', 'getEODs', { sessionToken });
        if (result.success) {
            const eod = result.data.find(e => e.eodId === eodId);
            if (eod) {
                document.getElementById('eodDate').value = eod.date;
                document.getElementById('eodAmount').value = eod.amount;
            }
        }
    } catch (error) {
        console.error('Load EOD data error:', error);
    }
}

async function handleEODSubmit(e) {
    e.preventDefault();
    const eodId = document.getElementById('eodId').value;
    const date = document.getElementById('eodDate').value;
    const amount = document.getElementById('eodAmount').value;
    const errorDiv = document.getElementById('eodError');
    const sessionToken = localStorage.getItem('sessionToken');
    
    // Validation
    if (!date || !amount) {
        errorDiv.textContent = 'Please fill in all fields';
        errorDiv.classList.add('show');
        return;
    }
    
    if (parseFloat(amount) <= 0) {
        errorDiv.textContent = 'Amount must be greater than 0';
        errorDiv.classList.add('show');
        return;
    }
    
    errorDiv.classList.remove('show');
    
    const action = eodId ? 'updateEOD' : 'createEOD';
    const data = {
        sessionToken,
        date,
        amount: parseFloat(amount)
    };
    
    if (eodId) data.eodId = eodId;
    
    try {
        const result = await apiCall('POST', action, data);
        
        if (result.success) {
            closeModal('eodModal');
            await loadEODs();
            await loadDashboard();
        } else {
            errorDiv.textContent = result.message || 'An error occurred';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
}

async function editEOD(eodId) {
    showEODModal(eodId);
}

async function deleteEODRecord(eodId) {
    if (!confirm('Are you sure you want to delete this EOD record? This action cannot be undone.')) return;
    
    const sessionToken = localStorage.getItem('sessionToken');
    
    try {
        const result = await apiCall('POST', 'deleteEOD', {
            eodId,
            sessionToken
        });
        
        if (result.success) {
            await loadEODs();
            await loadDashboard();
        } else {
            alert(result.message || 'Error deleting EOD record');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

// Expense Functions
async function loadExpenses() {
    const sessionToken = localStorage.getItem('sessionToken');
    const tbody = document.getElementById('expensesTableBody');
    
    try {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
        
        const result = await apiCall('GET', 'getExpenses', { sessionToken });
        
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(expense => `
                <tr>
                    <td>${formatDate(expense.date)}</td>
                    <td>${expense.description}</td>
                    <td class="amount">$${parseFloat(expense.cost).toFixed(2)}</td>
                    <td>${formatDateTime(expense.recordDateAndTime)}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="editExpense('${expense.expensesId}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteExpenseRecord('${expense.expensesId}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;">No expenses found. Click "Add Expense" to create one.</td></tr>';
        }
    } catch (error) {
        console.error('Load expenses error:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ef4444;">Error loading expenses</td></tr>';
    }
}

function showExpenseModal(expenseId = null) {
    document.getElementById('expenseModalTitle').textContent = expenseId ? 'Edit Expense' : 'Add Expense';
    document.getElementById('expenseId').value = expenseId || '';
    document.getElementById('expenseDate').value = '';
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseCost').value = '';
    document.getElementById('expenseError').classList.remove('show');
    document.getElementById('expenseError').textContent = '';
    
    if (expenseId) {
        loadExpenseData(expenseId);
    } else {
        // Set default date to today
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    }
    
    document.getElementById('expenseModal').classList.add('active');
    document.getElementById('expenseDescription').focus();
}

async function loadExpenseData(expenseId) {
    const sessionToken = localStorage.getItem('sessionToken');
    try {
        const result = await apiCall('GET', 'getExpenses', { sessionToken });
        if (result.success) {
            const expense = result.data.find(e => e.expensesId === expenseId);
            if (expense) {
                document.getElementById('expenseDate').value = expense.date;
                document.getElementById('expenseDescription').value = expense.description;
                document.getElementById('expenseCost').value = expense.cost;
            }
        }
    } catch (error) {
        console.error('Load expense data error:', error);
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    const expenseId = document.getElementById('expenseId').value;
    const date = document.getElementById('expenseDate').value;
    const description = document.getElementById('expenseDescription').value.trim();
    const cost = document.getElementById('expenseCost').value;
    const errorDiv = document.getElementById('expenseError');
    const sessionToken = localStorage.getItem('sessionToken');
    
    // Validation
    if (!date || !description || !cost) {
        errorDiv.textContent = 'Please fill in all fields';
        errorDiv.classList.add('show');
        return;
    }
    
    if (parseFloat(cost) <= 0) {
        errorDiv.textContent = 'Cost must be greater than 0';
        errorDiv.classList.add('show');
        return;
    }
    
    errorDiv.classList.remove('show');
    
    const action = expenseId ? 'updateExpense' : 'createExpense';
    const data = {
        sessionToken,
        date,
        description,
        cost: parseFloat(cost)
    };
    
    if (expenseId) data.expensesId = expenseId;
    
    try {
        const result = await apiCall('POST', action, data);
        
        if (result.success) {
            closeModal('expenseModal');
            await loadExpenses();
            await loadDashboard();
        } else {
            errorDiv.textContent = result.message || 'An error occurred';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
}

async function editExpense(expenseId) {
    showExpenseModal(expenseId);
}

async function deleteExpenseRecord(expenseId) {
    if (!confirm('Are you sure you want to delete this expense? This action cannot be undone.')) return;
    
    const sessionToken = localStorage.getItem('sessionToken');
    
    try {
        const result = await apiCall('POST', 'deleteExpense', {
            expensesId: expenseId,
            sessionToken
        });
        
        if (result.success) {
            await loadExpenses();
            await loadDashboard();
        } else {
            alert(result.message || 'Error deleting expense');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

// User Management Functions
async function loadUsers() {
    const sessionToken = localStorage.getItem('sessionToken');
    const tbody = document.getElementById('usersTableBody');
    
    try {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
        
        const result = await apiCall('GET', 'getUsers', { sessionToken });
        
        // Load user roles for display
        const rolesResult = await apiCall('GET', 'getUserRoles');
        if (rolesResult.success) {
            userRoles = rolesResult.data;
        }
        
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(user => {
                const role = userRoles.find(r => r.roleId == user.roleId);
                return `
                    <tr>
                        <td>
                            <div class="user-name">
                                <i class="fas fa-user-circle"></i>
                                ${user.firstName} ${user.lastName}
                            </div>
                        </td>
                        <td>${user.email}</td>
                        <td>
                            <span class="badge role-badge">${role ? role.role : 'Unknown'}</span>
                        </td>
                        <td class="actions">
                            <button class="btn btn-sm btn-primary" onclick="editUser('${user.userId}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUserRecord('${user.userId}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px;">No users found</td></tr>';
        }
    } catch (error) {
        console.error('Load users error:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #ef4444;">Error loading users</td></tr>';
    }
}

async function showUserModal(userId = null) {
    document.getElementById('userModalTitle').textContent = userId ? 'Edit User' : 'Add User';
    document.getElementById('userId').value = userId || '';
    document.getElementById('userFirstName').value = '';
    document.getElementById('userLastName').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userError').classList.remove('show');
    document.getElementById('userError').textContent = '';
    
    // Load roles
    try {
        const rolesResult = await apiCall('GET', 'getUserRoles');
        const roleSelect = document.getElementById('userRoleId');
        roleSelect.innerHTML = '<option value="">Select Role</option>';
        
        if (rolesResult.success && rolesResult.data.length > 0) {
            rolesResult.data.forEach(role => {
                roleSelect.innerHTML += `<option value="${role.roleId}">${role.role}</option>`;
            });
        }
    } catch (error) {
        console.error('Load roles error:', error);
    }
    
    const passwordHelp = document.getElementById('passwordHelp');
    if (userId) {
        await loadUserData(userId);
        passwordHelp.style.display = 'block';
    } else {
        passwordHelp.style.display = 'none';
    }
    
    document.getElementById('userModal').classList.add('active');
    
    if (userId) {
        document.getElementById('userFirstName').focus();
    } else {
        document.getElementById('userFirstName').focus();
    }
}

async function loadUserData(userId) {
    const sessionToken = localStorage.getItem('sessionToken');
    try {
        const result = await apiCall('GET', 'getUsers', { sessionToken });
        if (result.success) {
            const user = result.data.find(u => u.userId === userId);
            if (user) {
                document.getElementById('userFirstName').value = user.firstName;
                document.getElementById('userLastName').value = user.lastName;
                document.getElementById('userEmail').value = user.email;
                document.getElementById('userRoleId').value = user.roleId;
            }
        }
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

async function handleUserSubmit(e) {
    e.preventDefault();
    const userId = document.getElementById('userId').value;
    const firstName = document.getElementById('userFirstName').value.trim();
    const lastName = document.getElementById('userLastName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const roleId = document.getElementById('userRoleId').value;
    const errorDiv = document.getElementById('userError');
    const sessionToken = localStorage.getItem('sessionToken');
    
    // Validation
    if (!firstName || !lastName || !email || !roleId) {
        errorDiv.textContent = 'Please fill in all required fields';
        errorDiv.classList.add('show');
        return;
    }
    
    if (!isValidEmail(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.add('show');
        return;
    }
    
    errorDiv.classList.remove('show');
    
    if (userId) {
        // Update user
        try {
            const updateResult = await apiCall('POST', 'updateUser', {
                userId,
                roleId: parseInt(roleId),
                firstName,
                lastName,
                email,
                sessionToken
            });
            
            if (updateResult.success) {
                if (password) {
                    const passwordResult = await apiCall('POST', 'updateUserPassword', {
                        userId,
                        newPassword: password,
                        sessionToken
                    });
                    
                    if (!passwordResult.success) {
                        errorDiv.textContent = 'User updated but password change failed: ' + passwordResult.message;
                        errorDiv.classList.add('show');
                        return;
                    }
                }
                closeModal('userModal');
                await loadUsers();
                await loadDashboard();
            } else {
                errorDiv.textContent = updateResult.message || 'Error updating user';
                errorDiv.classList.add('show');
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.classList.add('show');
        }
    } else {
        // Create user
        if (!password) {
            errorDiv.textContent = 'Password is required for new users';
            errorDiv.classList.add('show');
            return;
        }
        
        if (password.length < 6) {
            errorDiv.textContent = 'Password must be at least 6 characters';
            errorDiv.classList.add('show');
            return;
        }
        
        try {
            const createResult = await apiCall('POST', 'createUser', {
                roleId: parseInt(roleId),
                firstName,
                lastName,
                email,
                password,
                sessionToken
            });
            
            if (createResult.success) {
                closeModal('userModal');
                await loadUsers();
                await loadDashboard();
            } else {
                errorDiv.textContent = createResult.message || 'Error creating user';
                errorDiv.classList.add('show');
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.classList.add('show');
        }
    }
}

async function editUser(userId) {
    showUserModal(userId);
}

async function deleteUserRecord(userId) {
    // Prevent deleting yourself
    if (currentUser && currentUser.userId === userId) {
        alert('You cannot delete your own account.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    const sessionToken = localStorage.getItem('sessionToken');
    
    try {
        const result = await apiCall('POST', 'deleteUser', {
            userId,
            sessionToken
        });
        
        if (result.success) {
            await loadUsers();
            await loadDashboard();
        } else {
            alert(result.message || 'Error deleting user');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

// Utility Functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    // Reset forms when closing
    const form = document.querySelector(`#${modalId} form`);
    if (form) {
        form.reset();
        const errorDiv = form.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
        }
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Add some additional CSS for better UI
const additionalStyles = `
    .amount {
        font-weight: 600;
        color: #059669;
    }
    
    .user-name {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .user-name i {
        color: #64748b;
        font-size: 20px;
    }
    
    .role-badge {
        background-color: #e0e7ff;
        color: #4f46e5;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .activity-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: #f8fafc;
        border-radius: 8px;
        transition: all 0.3s;
    }
    
    .activity-item:hover {
        background: #f1f5f9;
        transform: translateX(4px);
    }
    
    .activity-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: #e0e7ff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #4f46e5;
    }
    
    .activity-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .activity-details strong {
        color: #1e293b;
    }
    
    .activity-details span {
        color: #059669;
        font-weight: 500;
    }
    
    .activity-date {
        color: #64748b;
        font-size: 12px;
    }
    
    .table-container {
        overflow-x: auto;
    }
    
    .btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
        .sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s;
        }
        
        .sidebar.mobile-open {
            transform: translateX(0);
        }
        
        .main-content {
            margin-left: 0;
        }
        
        .stats-grid {
            grid-template-columns: 1fr;
        }
        
        .page-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
        }
    }
`;

// Add the additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Handle session expiration
setInterval(async () => {
    if (currentUser && localStorage.getItem('sessionToken')) {
        const result = await apiCall('POST', 'validateSession', { 
            sessionToken: localStorage.getItem('sessionToken') 
        });
        if (!result.success) {
            alert('Your session has expired. Please login again.');
            handleLogout();
        }
    }
}, 300000); // Check every 5 minutes

console.log('EOD & Expenses Tracker initialized successfully');