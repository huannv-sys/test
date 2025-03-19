/**
 * Users functionality
 * Handles the user management view
 */

// Selected user ID for current operations
let selectedUserId = null;

/**
 * Initialize users page
 */
function initializeUsers() {
    console.log('Initializing users...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load users
    loadUsers();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Add user
    document.getElementById('add-user-btn').addEventListener('click', function() {
        document.getElementById('user-form').reset();
        document.getElementById('user-form-title').textContent = 'Thêm người dùng mới';
        document.getElementById('saveUserBtn').style.display = 'block';
        document.getElementById('updateUserBtn').style.display = 'none';
        document.getElementById('deleteUserBtn').style.display = 'none';
        document.getElementById('password-fields').style.display = 'block';
        document.getElementById('user_password').required = true;
        document.getElementById('user_password_confirm').required = true;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    });
    
    // Save user
    document.getElementById('saveUserBtn').addEventListener('click', function() {
        saveUser();
    });
    
    // Update user
    document.getElementById('updateUserBtn').addEventListener('click', function() {
        updateUser();
    });
    
    // Delete user confirmation
    document.getElementById('deleteUserBtn').addEventListener('click', function() {
        const userName = document.getElementById('user_username').value;
        
        document.getElementById('delete-user-name').textContent = userName;
        
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteUserConfirmModal'));
        deleteModal.show();
    });
    
    // Confirm delete
    document.getElementById('confirmDeleteUserBtn').addEventListener('click', function() {
        deleteUser();
    });
    
    // Toggle password visibility
    document.getElementById('togglePassword').addEventListener('click', function() {
        const passwordField = document.getElementById('user_password');
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });
    
    document.getElementById('togglePasswordConfirm').addEventListener('click', function() {
        const passwordField = document.getElementById('user_password_confirm');
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });
    
    // Password confirmation validation
    document.getElementById('user_password_confirm').addEventListener('input', function() {
        validatePasswordMatch();
    });
    
    document.getElementById('user_password').addEventListener('input', function() {
        validatePasswordMatch();
    });
    
    // Refresh users
    document.getElementById('refresh-users').addEventListener('click', function() {
        loadUsers();
    });
    
    // Search users
    document.getElementById('search-users').addEventListener('input', function() {
        const searchText = this.value.toLowerCase();
        const rows = document.querySelectorAll('#users-table tbody tr');
        
        rows.forEach(row => {
            const username = row.querySelector('.user-username').textContent.toLowerCase();
            const email = row.querySelector('.user-email').textContent.toLowerCase();
            const role = row.querySelector('.user-role').textContent.toLowerCase();
            
            if (username.includes(searchText) || email.includes(searchText) || role.includes(searchText)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

/**
 * Validate password match
 */
function validatePasswordMatch() {
    const password = document.getElementById('user_password').value;
    const confirmPassword = document.getElementById('user_password_confirm').value;
    const feedback = document.getElementById('password-match-feedback');
    
    if (!confirmPassword) {
        feedback.style.display = 'none';
        return;
    }
    
    if (password === confirmPassword) {
        feedback.textContent = 'Mật khẩu trùng khớp';
        feedback.className = 'password-feedback text-success';
        feedback.style.display = 'block';
    } else {
        feedback.textContent = 'Mật khẩu không trùng khớp';
        feedback.className = 'password-feedback text-danger';
        feedback.style.display = 'block';
    }
}

/**
 * Load users from API
 */
async function loadUsers() {
    try {
        document.getElementById('users-loading').style.display = 'block';
        document.getElementById('users-table').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getUsers();
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải danh sách người dùng');
        }
        
        updateUsersTable(response.users || []);
        
        document.getElementById('users-loading').style.display = 'none';
        document.getElementById('users-table').style.display = 'table';
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Không thể tải danh sách người dùng');
        document.getElementById('users-loading').style.display = 'none';
    }
}

/**
 * Update users table with data
 */
function updateUsersTable(users) {
    const tableBody = document.querySelector('#users-table tbody');
    tableBody.innerHTML = '';
    
    if (users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có người dùng nào</td>
            </tr>
        `;
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.setAttribute('data-user-id', user.id);
        
        const roleBadge = getRoleBadge(user.role);
        
        row.innerHTML = `
            <td class="user-username">${user.username}</td>
            <td class="user-email">${user.email}</td>
            <td class="user-role">${roleBadge}</td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>${user.last_login ? formatDateTime(user.last_login) : 'Chưa đăng nhập'}</td>
            <td>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary edit-user" title="Chỉnh sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger delete-user" title="Xóa"
                        ${user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1 ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Add event listeners
        row.querySelector('.edit-user').addEventListener('click', function() {
            showEditUserModal(user.id);
        });
        
        row.querySelector('.delete-user').addEventListener('click', function() {
            // Check if this is the last admin
            if (user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
                showError('Không thể xóa người dùng admin duy nhất');
                return;
            }
            
            selectedUserId = user.id;
            
            document.getElementById('delete-user-name').textContent = user.username;
            
            const deleteModal = new bootstrap.Modal(document.getElementById('deleteUserConfirmModal'));
            deleteModal.show();
        });
        
        tableBody.appendChild(row);
    });
}

/**
 * Get role badge HTML
 */
function getRoleBadge(role) {
    switch (role) {
        case 'admin':
            return '<span class="badge bg-danger">Admin</span>';
        case 'operator':
            return '<span class="badge bg-warning">Operator</span>';
        case 'user':
            return '<span class="badge bg-info">User</span>';
        default:
            return `<span class="badge bg-secondary">${role}</span>`;
    }
}

/**
 * Save new user
 */
async function saveUser() {
    try {
        const form = document.getElementById('user-form');
        
        // Basic validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const password = document.getElementById('user_password').value;
        const confirmPassword = document.getElementById('user_password_confirm').value;
        
        if (password !== confirmPassword) {
            showError('Mật khẩu không trùng khớp');
            return;
        }
        
        const userData = {
            username: document.getElementById('user_username').value,
            email: document.getElementById('user_email').value,
            password: password,
            role: document.getElementById('user_role').value
        };
        
        document.getElementById('saveUserBtn').disabled = true;
        
        const apiClient = new ApiClient();
        const response = await apiClient.createUser(userData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể thêm người dùng');
        }
        
        // Show success message
        showSuccess('Đã thêm người dùng thành công');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
        modal.hide();
        
        // Reload users
        loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        showError(error.message || 'Không thể thêm người dùng');
    } finally {
        document.getElementById('saveUserBtn').disabled = false;
    }
}

/**
 * Show edit user modal
 */
async function showEditUserModal(userId) {
    try {
        const apiClient = new ApiClient();
        const response = await apiClient.getUser(userId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải thông tin người dùng');
        }
        
        const user = response.user;
        selectedUserId = user.id;
        
        // Set form values
        document.getElementById('user_username').value = user.username;
        document.getElementById('user_email').value = user.email;
        document.getElementById('user_role').value = user.role;
        document.getElementById('user_password').value = '';
        document.getElementById('user_password_confirm').value = '';
        
        // For editing, password is optional
        document.getElementById('user_password').required = false;
        document.getElementById('user_password_confirm').required = false;
        document.getElementById('password-fields').style.display = 'block';
        document.getElementById('password-description').textContent = 'Để trống nếu không thay đổi mật khẩu';
        
        // Update form title and buttons
        document.getElementById('user-form-title').textContent = 'Chỉnh sửa người dùng';
        document.getElementById('saveUserBtn').style.display = 'none';
        document.getElementById('updateUserBtn').style.display = 'block';
        document.getElementById('deleteUserBtn').style.display = 'block';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading user:', error);
        showError(error.message || 'Không thể tải thông tin người dùng');
    }
}

/**
 * Update user
 */
async function updateUser() {
    try {
        const form = document.getElementById('user-form');
        
        // Basic validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const password = document.getElementById('user_password').value;
        const confirmPassword = document.getElementById('user_password_confirm').value;
        
        if (password && password !== confirmPassword) {
            showError('Mật khẩu không trùng khớp');
            return;
        }
        
        const userData = {
            username: document.getElementById('user_username').value,
            email: document.getElementById('user_email').value,
            role: document.getElementById('user_role').value
        };
        
        // Only include password if it was provided
        if (password) {
            userData.password = password;
        }
        
        document.getElementById('updateUserBtn').disabled = true;
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateUser(selectedUserId, userData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể cập nhật người dùng');
        }
        
        // Show success message
        showSuccess('Đã cập nhật người dùng thành công');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
        modal.hide();
        
        // Reload users
        loadUsers();
    } catch (error) {
        console.error('Error updating user:', error);
        showError(error.message || 'Không thể cập nhật người dùng');
    } finally {
        document.getElementById('updateUserBtn').disabled = false;
    }
}

/**
 * Delete user
 */
async function deleteUser() {
    try {
        document.getElementById('confirmDeleteUserBtn').disabled = true;
        
        const apiClient = new ApiClient();
        const response = await apiClient.deleteUser(selectedUserId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể xóa người dùng');
        }
        
        // Show success message
        showSuccess('Đã xóa người dùng thành công');
        
        // Close modals
        const userModal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
        const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteUserConfirmModal'));
        
        if (userModal) userModal.hide();
        if (deleteModal) deleteModal.hide();
        
        // Reload users
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showError(error.message || 'Không thể xóa người dùng');
    } finally {
        document.getElementById('confirmDeleteUserBtn').disabled = false;
    }
}

/**
 * Show error message
 */
function showError(message) {
    toast.showError(message);
}

/**
 * Show success message
 */
function showSuccess(message) {
    toast.showSuccess(message);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeUsers();
});