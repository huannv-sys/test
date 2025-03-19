/**
 * MikroTik Monitor - Main JavaScript File
 * Chứa các tiện ích và lớp quản lý chính cho ứng dụng
 */

// Cache Manager để lưu trữ dữ liệu client-side
class CacheManager {
    constructor() {
        this._cache = {};
    }
    
    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @param {number} maxAge - Maximum age in milliseconds (default: 30s)
     * @returns {any} Cached value or null if expired/not found
     */
    get(key, maxAge = 30000) {
        const cachedItem = this._cache[key];
        
        if (!cachedItem) return null;
        
        const now = Date.now();
        
        // Check if item has expired
        if (cachedItem.maxAge && now - cachedItem.timestamp > cachedItem.maxAge) {
            this.delete(key);
            return null;
        }
        
        // Check if user-defined maxAge has passed
        if (maxAge && now - cachedItem.timestamp > maxAge) {
            return null;
        }
        
        return cachedItem.data;
    }
    
    /**
     * Store value in cache
     * @param {string} key - Cache key
     * @param {any} data - Value to store
     * @param {number} maxAge - Maximum age in milliseconds (optional)
     */
    set(key, data, maxAge = null) {
        this._cache[key] = {
            data: data,
            timestamp: Date.now(),
            maxAge: maxAge
        };
    }
    
    /**
     * Delete item from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        delete this._cache[key];
    }
    
    /**
     * Clear cache entries matching a pattern
     * @param {string} pattern - Pattern to match
     */
    clearPattern(pattern) {
        for (const key in this._cache) {
            if (key.includes(pattern)) {
                this.delete(key);
            }
        }
    }
    
    /**
     * Clear all cache
     */
    clear() {
        this._cache = {};
    }
}

// Authentication Manager cho đăng nhập và quản lý token
class AuthenticationManager {
    constructor() {
        this._initialized = false;
        this._hasStorageAccess = true;
        this._checkStorageAccess();
    }
    
    /**
     * Check if we have access to localStorage
     * @private
     */
    _checkStorageAccess() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            this._hasStorageAccess = true;
        } catch (e) {
            this._hasStorageAccess = false;
            console.warn('localStorage is not available. Using in-memory storage.');
        }
    }
    
    /**
     * Get access token from localStorage
     * @returns {string|null} Access token or null
     */
    getAccessToken() {
        if (!this._hasStorageAccess) return null;
        return localStorage.getItem('access_token');
    }
    
    /**
     * Get refresh token from localStorage
     * @returns {string|null} Refresh token or null
     */
    getRefreshToken() {
        if (!this._hasStorageAccess) return null;
        return localStorage.getItem('refresh_token');
    }
    
    /**
     * Store authentication tokens
     * @param {string} accessToken - JWT access token
     * @param {string} refreshToken - JWT refresh token (optional)
     */
    setTokens(accessToken, refreshToken = null) {
        if (!this._hasStorageAccess) return;
        
        localStorage.setItem('access_token', accessToken);
        
        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
        }
        
        // Set initialization flag
        this._initialized = true;
    }
    
    /**
     * Clear authentication tokens
     */
    clearTokens() {
        if (!this._hasStorageAccess) return;
        
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // Reset initialization flag
        this._initialized = false;
    }
    
    /**
     * Decode JWT token
     * @param {string} token - JWT token
     * @returns {object|null} Decoded token payload or null
     */
    decodeToken(token) {
        if (!token) return null;
        
        try {
            // JWT tokens are base64 encoded with 3 parts separated by dots
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            // Get the payload (middle part)
            const payload = parts[1];
            
            // Base64 decode and parse JSON
            const decoded = JSON.parse(atob(payload));
            return decoded;
        } catch (e) {
            console.error('Error decoding token:', e);
            return null;
        }
    }
    
    /**
     * Store user data in localStorage
     * @param {object} userData - User data
     */
    setUser(userData) {
        if (!this._hasStorageAccess) return;
        
        localStorage.setItem('user', JSON.stringify(userData));
    }
    
    /**
     * Get user data from localStorage
     * @returns {object|null} User data or null
     */
    getUser() {
        if (!this._hasStorageAccess) return null;
        
        const userData = localStorage.getItem('user');
        if (!userData) return null;
        
        try {
            return JSON.parse(userData);
        } catch (e) {
            console.error('Error parsing user data:', e);
            return null;
        }
    }
    
    /**
     * Check if user is authenticated
     * @returns {boolean} True if authenticated
     */
    isAuthenticated() {
        const token = this.getAccessToken();
        if (!token) return false;
        
        // Check if token is expired
        const decoded = this.decodeToken(token);
        if (!decoded) return false;
        
        const now = Date.now() / 1000;
        return decoded.exp > now;
    }
}

// Toast Manager cho hiển thị thông báo popup
class ToastManager {
    constructor() {
        this._config = {
            autohide: true,
            delay: 5000,
            animation: true,
            position: 'bottom-right',
            maxToasts: 5
        };
        
        this._toasts = [];
        this._container = document.getElementById('toastContainer');
        
        if (!this._container) {
            console.warn('Toast container not found, creating one.');
            this._createContainer();
        }
    }
    
    /**
     * Create toast container
     * @private
     */
    _createContainer() {
        this._container = document.createElement('div');
        this._container.id = 'toastContainer';
        this._container.className = 'toast-container';
        document.body.appendChild(this._container);
    }
    
    /**
     * Get the proper container for toasts
     * @private
     * @returns {HTMLElement} Toast container
     */
    _getContainer() {
        if (!this._container) {
            this._createContainer();
        }
        return this._container;
    }
    
    /**
     * Check if toast message is a duplicate
     * @private
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @returns {boolean} True if duplicate
     */
    _isDuplicate(message, type) {
        return this._toasts.some(toast => 
            toast.message === message && toast.type === type && 
            Date.now() - toast.timestamp < 3000
        );
    }
    
    /**
     * Create and show a toast
     * @private
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @param {object} options - Toast options
     * @returns {HTMLElement} Toast element
     */
    _createToast(message, type, options = {}) {
        // Check for duplicates
        if (this._isDuplicate(message, type)) {
            return null;
        }
        
        // Apply options with defaults
        const toastOptions = { ...this._config, ...options };
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        if (toastOptions.autohide) {
            toast.setAttribute('data-bs-autohide', 'true');
            toast.setAttribute('data-bs-delay', toastOptions.delay);
        }
        
        // Create toast header
        const header = document.createElement('div');
        header.className = 'toast-header';
        
        // Icon based on type
        const iconMap = {
            success: 'fa-check-circle text-success',
            error: 'fa-exclamation-circle text-danger',
            warning: 'fa-exclamation-triangle text-warning',
            info: 'fa-info-circle text-info'
        };
        
        const icon = document.createElement('i');
        icon.className = `fas ${iconMap[type] || iconMap.info} me-2`;
        header.appendChild(icon);
        
        // Title based on type
        const titleMap = {
            success: 'Thành công',
            error: 'Lỗi',
            warning: 'Cảnh báo',
            info: 'Thông báo'
        };
        
        const title = document.createElement('strong');
        title.className = 'me-auto';
        title.textContent = titleMap[type] || titleMap.info;
        header.appendChild(title);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'toast');
        closeBtn.setAttribute('aria-label', 'Close');
        header.appendChild(closeBtn);
        
        toast.appendChild(header);
        
        // Toast body
        const body = document.createElement('div');
        body.className = 'toast-body';
        body.textContent = message;
        toast.appendChild(body);
        
        // Add to DOM
        const container = this._getContainer();
        container.appendChild(toast);
        
        // Limit number of toasts
        if (container.children.length > toastOptions.maxToasts) {
            container.removeChild(container.children[0]);
        }
        
        // Initialize Bootstrap toast
        const bsToast = new bootstrap.Toast(toast, {
            animation: toastOptions.animation,
            autohide: toastOptions.autohide,
            delay: toastOptions.delay
        });
        
        // Show toast
        bsToast.show();
        
        // Track toast
        this._toasts.push({
            element: toast,
            message: message,
            type: type,
            timestamp: Date.now()
        });
        
        // Clean up on hidden
        toast.addEventListener('hidden.bs.toast', () => {
            container.removeChild(toast);
            this._toasts = this._toasts.filter(t => t.element !== toast);
        });
        
        return toast;
    }
    
    /**
     * Show error toast
     * @param {string} message - Error message
     * @param {object} options - Toast options
     */
    showError(message, options = {}) {
        this._createToast(message, 'error', options);
    }
    
    /**
     * Show success toast
     * @param {string} message - Success message
     * @param {object} options - Toast options
     */
    showSuccess(message, options = {}) {
        this._createToast(message, 'success', options);
    }
    
    /**
     * Show warning toast
     * @param {string} message - Warning message
     * @param {object} options - Toast options
     */
    showWarning(message, options = {}) {
        this._createToast(message, 'warning', options);
    }
    
    /**
     * Show info toast
     * @param {string} message - Info message
     * @param {object} options - Toast options
     */
    showInfo(message, options = {}) {
        this._createToast(message, 'info', options);
    }
    
    /**
     * Clear all toasts
     */
    clearAll() {
        const container = this._getContainer();
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        this._toasts = [];
    }
    
    /**
     * Configure toast system
     * @param {object} newConfig - New configuration
     */
    configure(newConfig) {
        this._config = { ...this._config, ...newConfig };
    }
}

// Performance Monitor để theo dõi hiệu suất
class PerformanceMonitor {
    constructor() {
        this._timers = {};
    }
    
    /**
     * Start a performance timer
     * @param {string} label - Timer label
     */
    start(label) {
        this._timers[label] = performance.now();
    }
    
    /**
     * End a performance timer
     * @param {string} label - Timer label
     * @returns {number} Elapsed time in ms
     */
    end(label) {
        if (!this._timers[label]) {
            console.warn(`Timer "${label}" hasn't been started`);
            return 0;
        }
        
        const endTime = performance.now();
        const startTime = this._timers[label];
        const elapsed = endTime - startTime;
        
        delete this._timers[label];
        
        return elapsed;
    }
    
    /**
     * Measure and log performance
     * @param {string} label - Operation label
     * @param {number} thresholdMs - Warning threshold in ms
     */
    measure(label, thresholdMs = 100) {
        return {
            start: () => this.start(label),
            end: () => {
                const elapsed = this.end(label);
                
                if (elapsed > thresholdMs) {
                    console.warn(`Performance warning: ${label} took ${elapsed.toFixed(2)}ms`);
                }
                
                return elapsed;
            }
        };
    }
}

// Khởi tạo các quản lý toàn cục
const CacheStore = new CacheManager();
const AuthManager = new AuthenticationManager();
const ToastManager = new ToastManager();
const PerformanceMonitor = new PerformanceMonitor();

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
function isAuthenticated() {
    return AuthManager.isAuthenticated();
}

/**
 * Refresh JWT token
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<boolean>} Success status
 */
async function refreshToken(retries = 1) {
    const refreshToken = AuthManager.getRefreshToken();
    
    if (!refreshToken) {
        return false;
    }
    
    try {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${refreshToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Token refresh failed');
        }
        
        const data = await response.json();
        
        AuthManager.setTokens(data.access_token, data.refresh_token);
        
        return true;
    } catch (error) {
        console.error('Token refresh error:', error);
        
        if (retries > 0) {
            return refreshToken(retries - 1);
        }
        
        return false;
    }
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
    // Clear auth tokens
    AuthManager.clearTokens();
    
    // Redirect to login page
    window.location.href = '/auth/login';
}

/**
 * Format date and time
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted date
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted size
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format network traffic (bps to human-readable)
 * @param {number} bitsPerSecond - Traffic in bits per second
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted traffic
 */
function formatTraffic(bitsPerSecond, decimals = 2) {
    if (bitsPerSecond === 0) return '0 bps';
    
    const k = 1000; // Network uses 1000, not 1024
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    
    return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[Math.min(i, sizes.length - 1)];
}

/**
 * Show error message
 * @param {string} message - Error message
 * @param {object} options - Toast options
 */
function showError(message, options = {}) {
    ToastManager.showError(message, options);
}

/**
 * Show success message
 * @param {string} message - Success message
 * @param {object} options - Toast options
 */
function showSuccess(message, options = {}) {
    ToastManager.showSuccess(message, options);
}

/**
 * Show warning message
 * @param {string} message - Warning message
 * @param {object} options - Toast options
 */
function showWarning(message, options = {}) {
    ToastManager.showWarning(message, options);
}

/**
 * Show info message
 * @param {string} message - Info message
 * @param {object} options - Toast options
 */
function showInfo(message, options = {}) {
    ToastManager.showInfo(message, options);
}

// Document ready event handler
document.addEventListener('DOMContentLoaded', function() {
    // Attach interceptors for API requests
    setupFetchInterceptor();
    
    // Add custom class to current page link in sidebar
    highlightCurrentPage();
});

/**
 * Setup fetch interceptor for API calls
 */
function setupFetchInterceptor() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(url, options = {}) {
        // Skip interceptor for non-API calls
        if (!url.includes('/api/')) {
            return originalFetch(url, options);
        }
        
        // Don't intercept auth endpoints to avoid infinite loops
        if (url.includes('/api/auth/')) {
            return originalFetch(url, options);
        }
        
        // Measure API call performance
        const perf = PerformanceMonitor.measure(`API Call: ${url}`, 500);
        perf.start();
        
        try {
            // Check if token exists and is valid
            if (isAuthenticated()) {
                // Add authorization header
                options.headers = options.headers || {};
                options.headers['Authorization'] = `Bearer ${AuthManager.getAccessToken()}`;
            }
            
            // Make the request
            let response = await originalFetch(url, options);
            
            // Handle 401 Unauthorized (token expired)
            if (response.status === 401) {
                const refreshSuccess = await refreshToken();
                
                if (refreshSuccess) {
                    // Update authorization header with new token
                    options.headers['Authorization'] = `Bearer ${AuthManager.getAccessToken()}`;
                    
                    // Retry the request
                    response = await originalFetch(url, options);
                } else {
                    // Redirect to login if refresh failed
                    redirectToLogin();
                }
            }
            
            // Log timing
            perf.end();
            
            return response;
        } catch (error) {
            perf.end();
            console.error('API request error:', error);
            throw error;
        }
    };
}

/**
 * Highlight current page in sidebar
 */
function highlightCurrentPage() {
    const currentPath = window.location.pathname;
    
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}