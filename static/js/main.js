/**
 * Main JavaScript file for MikroTik Monitor
 * Contains utility functions and initialization code
 */

// Utility cache system
const cache = {
    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @param {number} maxAge - Maximum age in milliseconds (default: 30s)
     * @returns {any} Cached value or null if expired/not found
     */
    get(key, maxAge = 30000) {
        const item = localStorage.getItem(`cache_${key}`);
        if (!item) return null;
        
        try {
            const data = JSON.parse(item);
            if (data.expiry && data.expiry < Date.now()) {
                localStorage.removeItem(`cache_${key}`);
                return null;
            }
            return data.value;
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Store value in cache
     * @param {string} key - Cache key
     * @param {any} data - Value to store
     * @param {number} maxAge - Maximum age in milliseconds (optional)
     */
    set(key, data, maxAge = null) {
        const item = {
            value: data,
            expiry: maxAge ? Date.now() + maxAge : null
        };
        localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    },
    
    /**
     * Delete item from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        localStorage.removeItem(`cache_${key}`);
    },
    
    /**
     * Clear cache entries matching a pattern
     * @param {string} pattern - Pattern to match
     */
    clearPattern(pattern) {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith('cache_') && key.includes(pattern)) {
                localStorage.removeItem(key);
            }
        }
    },
    
    /**
     * Clear all cache
     */
    clear() {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith('cache_')) {
                localStorage.removeItem(key);
            }
        }
    },
    
    /**
     * Get access token from localStorage
     * @returns {string|null} Access token or null
     */
    getAccessToken() {
        return localStorage.getItem('access_token');
    },
    
    /**
     * Get refresh token from localStorage
     * @returns {string|null} Refresh token or null
     */
    getRefreshToken() {
        return localStorage.getItem('refresh_token');
    },
    
    /**
     * Store authentication tokens
     * @param {string} accessToken - JWT access token
     * @param {string} refreshToken - JWT refresh token (optional)
     */
    setTokens(accessToken, refreshToken = null) {
        localStorage.setItem('access_token', accessToken);
        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
        }
    },
    
    /**
     * Clear authentication tokens
     */
    clearTokens() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    },
    
    /**
     * Decode JWT token
     * @param {string} token - JWT token
     * @returns {object|null} Decoded token payload or null
     */
    decodeToken(token) {
        if (!token) return null;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            return JSON.parse(atob(parts[1]));
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Store user data in localStorage
     * @param {object} userData - User data
     */
    setUser(userData) {
        localStorage.setItem('user', JSON.stringify(userData));
    },
    
    /**
     * Get user data from localStorage
     * @returns {object|null} User data or null
     */
    getUser() {
        const data = localStorage.getItem('user');
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    }
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
function isAuthenticated() {
    const token = cache.getAccessToken();
    if (!token) return false;
    
    const decoded = cache.decodeToken(token);
    if (!decoded) return false;
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp > now;
}

/**
 * Refresh JWT token
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<boolean>} Success status
 */
async function refreshToken(retries = 1) {
    try {
        const apiClient = new ApiClient();
        return await apiClient.refreshAccessToken();
    } catch (error) {
        console.error('Error refreshing token:', error);
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
    window.location.href = '/login';
}

/**
 * Format date and time
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted date
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted size
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0 || bytes === undefined || bytes === null) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Format network traffic (bps to human-readable)
 * @param {number} bitsPerSecond - Traffic in bits per second
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted traffic
 */
function formatTraffic(bitsPerSecond, decimals = 2) {
    if (bitsPerSecond === 0 || bitsPerSecond === undefined || bitsPerSecond === null) {
        return '0 bps';
    }
    
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    
    return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

// Toast notification system
const toast = (() => {
    let toastContainer;
    let toasts = [];
    let defaultConfig = {
        autoHide: true,
        delay: 5000,
        animation: true
    };
    
    function getToastContainer() {
        if (!toastContainer) {
            toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
                toastContainer.style.zIndex = 1050;
                document.body.appendChild(toastContainer);
            }
        }
        return toastContainer;
    }
    
    function isDuplicate(message, type) {
        return toasts.some(t => t.message === message && t.type === type);
    }
    
    function createToast(message, type, options = {}) {
        if (isDuplicate(message, type)) return;
        
        const config = { ...defaultConfig, ...options };
        const container = getToastContainer();
        
        const toastElement = document.createElement('div');
        toastElement.className = `toast ${config.animation ? 'fade show' : ''}`;
        toastElement.setAttribute('role', 'alert');
        toastElement.setAttribute('aria-live', 'assertive');
        toastElement.setAttribute('aria-atomic', 'true');
        
        const headerClass = type === 'error' ? 'text-danger' :
                           type === 'success' ? 'text-success' :
                           type === 'warning' ? 'text-warning' : 'text-info';
        
        const headerIcon = type === 'error' ? 'exclamation-circle' :
                          type === 'success' ? 'check-circle' :
                          type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        toastElement.innerHTML = `
            <div class="toast-header">
                <i class="fas fa-${headerIcon} me-2 ${headerClass}"></i>
                <strong class="me-auto ${headerClass}">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <small>${new Date().toLocaleTimeString()}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        container.appendChild(toastElement);
        
        // Bootstrap toast initialization
        const toast = new bootstrap.Toast(toastElement, {
            autohide: config.autoHide,
            delay: config.delay
        });
        
        toast.show();
        
        // Store toast information
        const toastInfo = { element: toastElement, message, type };
        toasts.push(toastInfo);
        
        // Remove toast on hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            container.removeChild(toastElement);
            toasts = toasts.filter(t => t !== toastInfo);
        });
    }
    
    return {
        /**
         * Show error toast
         * @param {string} message - Error message
         * @param {object} options - Toast options
         */
        showError(message, options = {}) {
            createToast(message, 'error', options);
        },
        
        /**
         * Show success toast
         * @param {string} message - Success message
         * @param {object} options - Toast options
         */
        showSuccess(message, options = {}) {
            createToast(message, 'success', options);
        },
        
        /**
         * Show warning toast
         * @param {string} message - Warning message
         * @param {object} options - Toast options
         */
        showWarning(message, options = {}) {
            createToast(message, 'warning', options);
        },
        
        /**
         * Show info toast
         * @param {string} message - Info message
         * @param {object} options - Toast options
         */
        showInfo(message, options = {}) {
            createToast(message, 'info', options);
        },
        
        /**
         * Clear all toasts
         */
        clearAll() {
            toasts.forEach(t => {
                t.element.querySelector('.btn-close').click();
            });
        },
        
        /**
         * Configure toast system
         * @param {object} newConfig - New configuration
         */
        configure(newConfig) {
            defaultConfig = { ...defaultConfig, ...newConfig };
        }
    };
})();

/**
 * Show error message
 * @param {string} message - Error message
 * @param {object} options - Toast options
 */
function showError(message, options = {}) {
    toast.showError(message, options);
}

/**
 * Show success message
 * @param {string} message - Success message
 * @param {object} options - Toast options
 */
function showSuccess(message, options = {}) {
    toast.showSuccess(message, options);
}

// Performance measurement
const performance = (() => {
    const timers = {};
    
    return {
        /**
         * Start a performance timer
         * @param {string} label - Timer label
         */
        start(label) {
            timers[label] = Date.now();
        },
        
        /**
         * End a performance timer
         * @param {string} label - Timer label
         * @returns {number} Elapsed time in ms
         */
        end(label) {
            if (!timers[label]) return 0;
            
            const elapsed = Date.now() - timers[label];
            delete timers[label];
            return elapsed;
        },
        
        /**
         * Measure and log performance
         * @param {string} label - Operation label
         * @param {number} thresholdMs - Warning threshold in ms
         */
        measure(label, thresholdMs = 100) {
            performance.start(label);
            
            return {
                end() {
                    const elapsed = performance.end(label);
                    if (elapsed > thresholdMs) {
                        console.warn(`Performance warning: ${label} took ${elapsed}ms`);
                    }
                    return elapsed;
                }
            };
        }
    };
})();

// Document ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize bootstrap popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
});