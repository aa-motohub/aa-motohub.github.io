// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbyuohfPve2swOYejua6XPZ9bQg9r8XhJALrcQstYplft8iKSMGIiVfbaScR8rROLtnS/exec';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupEventListeners();
    
    // Check for callback from redirect
    checkRedirectCallback();
});

// Check if we're returning from a redirect callback
function checkRedirectCallback() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#apiResponse=')) {
        try {
            const encoded = hash.replace('#apiResponse=', '');
            const json = JSON.parse(decodeURIComponent(encoded));
            
            // Store the result temporarily
            window._redirectResult = json;
            
            // Clean up the URL
            window.location.hash = '';
        } catch (e) {
            console.error('Failed to parse redirect response:', e);
        }
    }
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
    
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    document.getElementById('eodForm').addEventListener('submit', handleEODSubmit);
    document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('userForm').addEventListener('submit', handleUserSubmit);
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
    
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    });
}

// ============ API CALLS USING HIDDEN IFRAME + window.name ============

function apiCall(method, action, data = {}) {
    return new Promise((resolve) => {
        const uniqueId = 'api-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
        
        // Create hidden iframe
        const iframe = document.createElement('iframe');
        iframe.id = uniqueId;
        iframe.name = uniqueId;
        iframe.style.display = 'none';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        
        // Build URL
        const params = new URLSearchParams();
        params.append('action', action);
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value);
            }
        }
        
        // For Apps Script, we need a proxy approach
        // Use the web app URL that returns the JSON directly
        const url = `${API_URL}?${params.toString()}`;
        
        // Create a script tag instead of iframe (JSONP approach)
        const scriptId = 'script-' + uniqueId;
        const callbackName = 'jsonp_' + uniqueId.replace(/-/g, '_');
        
        // Define callback
        window[callbackName] = function(result) {
            delete window[callbackName];
            const scriptEl = document.getElementById(scriptId);
            if (scriptEl) scriptEl.remove();
            resolve(result);
        };
        
        // Add callback parameter to URL
        const finalUrl = url + '&callback=' + callbackName;
        
        // Create script tag
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = finalUrl;
        
        // Handle errors
        script.onerror = () => {
            delete window[callbackName];
            const scriptEl = document.getElementById(scriptId);
            if (scriptEl) scriptEl.remove();
            resolve({ success: false, message: 'Network error' });
        };
        
        // Timeout
        const timeout = setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                const scriptEl = document.getElementById(scriptId);
                if (scriptEl) scriptEl.remove();
                resolve({ success: false, message: 'Request timeout' });
            }
        }, 30000);
        
        // Override callback to clear timeout
        const originalCallback = window[callbackName];
        window[callbackName] = function(result) {
            clearTimeout(timeout);
            originalCallback(result);
        };
        
        document.body.appendChild(script);
    });
}

// ============ AUTHENTICATION ============

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
    const result = await apiCall('GET', 'validateSession', { sessionToken });
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
    
    if (!email || !password) {
        errorDiv.textContent = 'Please enter both email and password';
        errorDiv.classList.add('show');
        return;
    }
    
    errorDiv.classList.remove('show');
    
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    submitBtn.disabled = true;
    
    try {
        const result = await apiCall('GET', 'testLogin', { email, password });
        
        console.log('Login result:', result);
        
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
            await apiCall('GET', 'logout', { sessionToken });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userData');
    currentUser = null;
    
    showLogin();
}

function showApp() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('appPage').classList.add('active');
    
    document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    
    let roleName = 'Regular';
    if (currentUser.roleId == 1) roleName = 'Manager';
    else if (currentUser.roleId == 2) roleName = 'Admin';
    
    document.getElementById('userRole').textContent = roleName;
    
    const adminItems = document.querySelectorAll('.admin-only');
    if (currentUser.roleId == 1 || currentUser.roleId == 2) {
        adminItems.forEach(item => item.style.display = 'flex');
    } else {
        adminItems.forEach(item => item.style.display = 'none');
    }
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === 'dashboard') item.classList.add('active');
    });
}

// ============ NAVIGATION ============

function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) item.classList.add('active');
    });
    
    document.querySelectorAll('.content-page').forEach(p => p.classList.remove('active'));
    const pageElement = document.getElementById(page);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'eod': loadEODs(); break;
        case 'expenses': loadExpenses(); break;
        case 'users':
            if (currentUser.roleId == 1 || currentUser.roleId == 2) {
                loadUsers();
            } else {
                alert('Access denied. Admin privileges required.');
                navigateTo('dashboard');
            }
            break;
    }
}

// ============ DASHBOARD ============

async function loadDashboard() {
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        document.getElementById('totalEOD').textContent = '...';
        document.getElementById('totalExpenses').textContent = '...';
        document.getElementById('todayExpenses').textContent = '...';
        document.getElementById('totalUsers').textContent = '...';
        
        const eodsResult = await apiCall('GET', 'getEODs', { sessionToken });
        document.getElementById('totalEOD').textContent = eodsResult.success ? eodsResult.data.length : '0';
        
        const expensesResult = await apiCall('GET', 'getExpenses', { sessionToken });
        if (expensesResult.success) {
            document.getElementById('totalExpenses').textContent = expensesResult.data.length;
            const today = new Date().toISOString().split('T')[0];
            const todayExpenses = expensesResult.data.filter(e => e.date === today);
            const todayTotal = todayExpenses.reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);
            document.getElementById('todayExpenses').textContent = `$${todayTotal.toFixed(2)}`;
        } else {
            document.getElementById('totalExpenses').textContent = '0';
            document.getElementById('todayExpenses').textContent = '$0.00';
        }
        
        // Recent activity
        const activity = [];
        if (eodsResult.success && eodsResult.data.length > 0) {
            eodsResult.data.slice(-5).reverse().forEach(e => {
                activity.push({
                    type: 'EOD',
                    icon: 'fa-calendar-check',
                    description: 'End of Day Record',
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
        
        activity.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const activityHtml = activity.slice(0, 10).map(a => `
            <div class="activity-item">
                <div class="activity-icon"><i class="fas ${a.icon}"></i></div>
                <div class="activity-details">
                    <strong>${a.description}</strong>
                    <span>${a.amount}</span>
                </div>
                <div class="activity-date"><small>${formatDate(a.date)}</small></div>
            </div>
        `).join('');
        
        document.getElementById('recentActivity').innerHTML = activityHtml || 
            '<p style="text-align:center; color: #64748b;">No recent activity</p>';
        
        if (currentUser && (currentUser.roleId == 1 || currentUser.roleId == 2)) {
            const usersResult = await apiCall('GET', 'getUsers', { sessionToken });
            document.getElementById('totalUsers').textContent = usersResult.success ? usersResult.data.length : '0';
        } else {
            document.getElementById('totalUsers').textContent = '-';
        }
        
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// ============ EOD FUNCTIONS ============

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
                        <button class="btn btn-sm btn-primary" onclick="editEOD('${eod.eodId}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEODRecord('${eod.eodId}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;">No EOD records found</td></tr>';
        }
    } catch (error) {
        console.error('Load EODs error:', error);
    }
}

function showEODModal(eodId = null) {
    document.getElementById('eodModalTitle').textContent = eodId ? 'Edit EOD Record' : 'Add EOD Record';
    document.getElementById('eodId').value = eodId || '';
    document.getElementById('eodDate').value = eodId ? '' : new Date().toISOString().split('T')[0];
    document.getElementById('eodAmount').value = '';
    document.getElementById('eodError').classList.remove('show');
    document.getElementById('eodError').textContent = '';
    
    if (eodId) loadEODData(eodId);
    
    document.getElementById('eodModal').classList.add('active');
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
    const data = { sessionToken, date, amount: parseFloat(amount) };
    if (eodId) data.eodId = eodId;
    
    try {
        const result = await apiCall('GET', action, data);
        
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

async function editEOD(eodId) { showEODModal(eodId); }

async function deleteEODRecord(eodId) {
    if (!confirm('Are you sure you want to delete this EOD record?')) return;
    
    const sessionToken = localStorage.getItem('sessionToken');
    
    try {
        const result = await apiCall('GET', 'deleteEOD', { eodId, sessionToken });
        
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

// ============ EXPENSE FUNCTIONS ============

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
                        <button class="btn btn-sm btn-primary" onclick="editExpense('${expense.expensesId}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteExpenseRecord('${expense.expensesId}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;">No expenses found</td></tr>';
        }
    } catch (error) {
        console.error('Load expenses error:', error);
    }
}

function showExpenseModal(expenseId = null) {
    document.getElementById('expenseModalTitle').textContent = expenseId ? 'Edit Expense' : 'Add Expense';
    document.getElementById('expenseId').value = expenseId || '';
    document.getElementById('expenseDate').value = expenseId ? '' : new Date().toISOString().split('T')[0];
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseCost').value = '';
    document.getElementById('expenseError').classList.remove('show');
    document.getElementById('expenseError').textContent = '';
    
    if (expenseId) loadExpenseData(expenseId);
    
    document.getElementById('expenseModal').classList.add('active');
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
    const data = { sessionToken, date, description, cost: parseFloat(cost) };
    if (expenseId) data.expensesId = expenseId;
    
    try {
        const result = await apiCall('GET', action, data);
        
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

async function editExpense(expenseId) { showExpenseModal(expenseId); }

async function deleteExpenseRecord(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    const sessionToken = localStorage.getItem('sessionToken');
    
    try {
        const result = await apiCall('GET', 'deleteExpense', { expensesId: expenseId, sessionToken });
        
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

// ============ USER MANAGEMENT ============

async function loadUsers() {
    const sessionToken = localStorage.getItem('sessionToken');
    const tbody = document.getElementById('usersTableBody');
    
    try {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
        
        const result = await apiCall('GET', 'getUsers', { sessionToken });
        const rolesResult = await apiCall('GET', 'getUserRoles');
        if (rolesResult.success) userRoles = rolesResult.data;
        
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(user => {
                const role = userRoles.find(r => r.roleId == user.roleId);
                return `
                    <tr>
                        <td><div class="user-name"><i class="fas fa-user-circle"></i>${user.firstName} ${user.lastName}</div></td>
                        <td>${user.email}</td>
                        <td><span class="badge role-badge">${role ? role.role : 'Unknown'}</span></td>
                        <td class="actions">
                            <button class="btn btn-sm btn-primary" onclick="editUser('${user.userId}')" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUserRecord('${user.userId}')" title="Delete"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px;">No users found</td></tr>';
        }
    } catch (error) {
        console.error('Load users error:', error);
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
    document.getElementById('userFirstName').focus();
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
        try {
            const updateResult = await apiCall('GET', 'updateUser', {
                userId, roleId: parseInt(roleId), firstName, lastName, email, sessionToken
            });
            
            if (updateResult.success) {
                if (password) {
                    await apiCall('GET', 'updateUserPassword', {
                        userId, newPassword: password, sessionToken
                    });
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
            const createResult = await apiCall('GET', 'createUser', {
                roleId: parseInt(roleId), firstName, lastName, email, password, sessionToken
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

async function editUser(userId) { showUserModal(userId); }

async function deleteUserRecord(userId) {
    if (currentUser && currentUser.userId === userId) {
        alert('You cannot delete your own account.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    const sessionToken = localStorage.getItem('sessionToken');
    
    try {
        const result = await apiCall('GET', 'deleteUser', { userId, sessionToken });
        
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

// ============ UTILITY FUNCTIONS ============

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

console.log('EOD & Expenses Tracker initialized successfully');
