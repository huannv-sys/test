/**
 * MikroTik Monitor - Payment Integration
 * Xử lý các tính năng liên quan đến thanh toán và đăng ký
 */

/**
 * Khởi tạo trang thanh toán
 */
function initializePayments() {
    // Cài đặt các sự kiện
    setupEventListeners();
    
    // Tải trạng thái đăng ký hiện tại
    loadSubscriptionStatus();
}

/**
 * Cài đặt các trình xử lý sự kiện
 */
function setupEventListeners() {
    // Bắt sự kiện nút thanh toán
    const paymentButtons = document.querySelectorAll('.payment-button');
    paymentButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const plan = this.getAttribute('data-plan');
            const period = this.getAttribute('data-period');
            createCheckoutSession(plan, period);
        });
    });
    
    // Bắt sự kiện nút hủy đăng ký
    const cancelButton = document.getElementById('cancelSubscriptionBtn');
    if (cancelButton) {
        cancelButton.addEventListener('click', function(e) {
            e.preventDefault();
            showCancelConfirmation();
        });
    }
}

/**
 * Tạo phiên thanh toán Stripe Checkout
 * @param {string} plan - Gói đăng ký (pro, enterprise)
 * @param {string} period - Kỳ hạn (monthly, yearly)
 */
async function createCheckoutSession(plan, period) {
    try {
        showLoading('Đang tạo phiên thanh toán...');
        
        const response = await fetch('/api/payments/create-checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            },
            body: JSON.stringify({
                plan: plan,
                period: period
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            hideLoading();
            showError(errorData.error || 'Không thể tạo phiên thanh toán');
            return;
        }
        
        const data = await response.json();
        
        // Chuyển hướng đến trang thanh toán Stripe
        window.location.href = data.url;
        
    } catch (error) {
        hideLoading();
        console.error('Error creating checkout session:', error);
        showError('Đã xảy ra lỗi khi tạo phiên thanh toán');
    }
}

/**
 * Tải trạng thái đăng ký hiện tại
 */
async function loadSubscriptionStatus() {
    try {
        showLoading('Đang tải thông tin đăng ký...');
        
        const response = await fetch('/api/payments/subscription-status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        hideLoading();
        
        if (!response.ok) {
            // Không có đăng ký hoặc lỗi - hiển thị giao diện không có đăng ký
            showNoSubscriptionUI();
            return;
        }
        
        const data = await response.json();
        
        // Hiển thị giao diện đăng ký
        updateSubscriptionUI(data);
        
    } catch (error) {
        hideLoading();
        console.error('Error loading subscription status:', error);
        showError('Đã xảy ra lỗi khi tải thông tin đăng ký');
        showNoSubscriptionUI();
    }
}

/**
 * Hiển thị giao diện không có đăng ký
 */
function showNoSubscriptionUI() {
    const subscriptionDetails = document.getElementById('subscriptionDetails');
    const noSubscription = document.getElementById('noSubscription');
    
    if (subscriptionDetails) {
        subscriptionDetails.style.display = 'none';
    }
    
    if (noSubscription) {
        noSubscription.style.display = 'block';
    }
}

/**
 * Cập nhật giao diện đăng ký với dữ liệu
 * @param {object} subscription - Dữ liệu đăng ký
 */
function updateSubscriptionUI(subscription) {
    const subscriptionDetails = document.getElementById('subscriptionDetails');
    const noSubscription = document.getElementById('noSubscription');
    
    if (noSubscription) {
        noSubscription.style.display = 'none';
    }
    
    if (subscriptionDetails) {
        subscriptionDetails.style.display = 'block';
        
        // Cập nhật thông tin đăng ký
        const planName = document.getElementById('subscriptionPlan');
        if (planName) {
            planName.textContent = formatPlanName(subscription.plan);
        }
        
        const status = document.getElementById('subscriptionStatus');
        if (status) {
            status.textContent = formatSubscriptionStatus(subscription.status);
            status.className = `badge ${getStatusBadgeClass(subscription.status)}`;
        }
        
        const endDate = document.getElementById('subscriptionEndDate');
        if (endDate) {
            const date = new Date(subscription.current_period_end);
            endDate.textContent = formatDateTime(date);
        }
        
        const autoRenew = document.getElementById('subscriptionAutoRenew');
        if (autoRenew) {
            autoRenew.textContent = subscription.cancel_at_period_end ? 'Không' : 'Có';
        }
        
        // Hiển thị/ẩn nút hủy dựa trên trạng thái
        const cancelButton = document.getElementById('cancelSubscriptionBtn');
        if (cancelButton) {
            cancelButton.style.display = subscription.status === 'active' && !subscription.cancel_at_period_end ? 'block' : 'none';
        }
    }
}

/**
 * Định dạng tên gói đăng ký
 * @param {string} plan - Gói đăng ký
 * @returns {string} - Tên gói đã định dạng
 */
function formatPlanName(plan) {
    const plans = {
        'pro': 'Pro',
        'enterprise': 'Enterprise'
    };
    
    return plans[plan] || 'Không xác định';
}

/**
 * Định dạng trạng thái đăng ký
 * @param {string} status - Trạng thái đăng ký
 * @returns {string} - Trạng thái đã định dạng
 */
function formatSubscriptionStatus(status) {
    const statuses = {
        'active': 'Đang hoạt động',
        'trialing': 'Đang dùng thử',
        'canceled': 'Đã hủy',
        'incomplete': 'Chưa hoàn thành',
        'incomplete_expired': 'Hết hạn',
        'past_due': 'Quá hạn thanh toán',
        'unpaid': 'Chưa thanh toán'
    };
    
    return statuses[status] || 'Không xác định';
}

/**
 * Lấy lớp badge cho trạng thái đăng ký
 * @param {string} status - Trạng thái đăng ký
 * @returns {string} - Lớp CSS
 */
function getStatusBadgeClass(status) {
    const classes = {
        'active': 'bg-success',
        'trialing': 'bg-info',
        'canceled': 'bg-secondary',
        'incomplete': 'bg-warning',
        'incomplete_expired': 'bg-danger',
        'past_due': 'bg-warning',
        'unpaid': 'bg-danger'
    };
    
    return classes[status] || 'bg-secondary';
}

/**
 * Tải lịch sử đăng ký
 */
async function loadSubscriptionHistory() {
    try {
        const response = await fetch('/api/payments/subscription-history', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            showError('Không thể tải lịch sử đăng ký');
            return;
        }
        
        const history = await response.json();
        
        // Cập nhật giao diện với dữ liệu lịch sử
        updateHistoryUI(history);
        
    } catch (error) {
        console.error('Error loading subscription history:', error);
        showError('Đã xảy ra lỗi khi tải lịch sử đăng ký');
    }
}

/**
 * Cập nhật giao diện lịch sử đăng ký
 * @param {array} history - Dữ liệu lịch sử đăng ký
 */
function updateHistoryUI(history) {
    const historyTable = document.getElementById('subscriptionHistoryTable');
    
    if (!historyTable) return;
    
    if (history.length === 0) {
        historyTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có dữ liệu lịch sử</td>
            </tr>
        `;
        return;
    }
    
    historyTable.innerHTML = history.map(item => `
        <tr>
            <td>${formatDateTime(new Date(item.start_date))}</td>
            <td>${formatDateTime(new Date(item.end_date))}</td>
            <td>${formatPlanName(item.plan)}</td>
            <td>${formatCurrency(item.amount, item.currency)}</td>
            <td><span class="badge ${getStatusBadgeClass(item.status)}">${formatSubscriptionStatus(item.status)}</span></td>
        </tr>
    `).join('');
}

/**
 * Tải danh sách hóa đơn
 */
async function loadInvoices() {
    try {
        const response = await fetch('/api/payments/invoices', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            showError('Không thể tải danh sách hóa đơn');
            return;
        }
        
        const invoices = await response.json();
        
        // Cập nhật giao diện với dữ liệu hóa đơn
        updateInvoicesUI(invoices);
        
    } catch (error) {
        console.error('Error loading invoices:', error);
        showError('Đã xảy ra lỗi khi tải danh sách hóa đơn');
    }
}

/**
 * Cập nhật giao diện danh sách hóa đơn
 * @param {array} invoices - Dữ liệu hóa đơn
 */
function updateInvoicesUI(invoices) {
    const invoicesTable = document.getElementById('invoicesTable');
    
    if (!invoicesTable) return;
    
    if (invoices.length === 0) {
        invoicesTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có hóa đơn</td>
            </tr>
        `;
        return;
    }
    
    invoicesTable.innerHTML = invoices.map(invoice => `
        <tr>
            <td>${invoice.number}</td>
            <td>${formatDateTime(new Date(invoice.created_at))}</td>
            <td>${formatCurrency(invoice.amount, invoice.currency)}</td>
            <td><span class="badge ${invoice.status === 'paid' ? 'bg-success' : 'bg-warning'}">${invoice.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span></td>
            <td>
                <a href="${invoice.pdf_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-download"></i>
                </a>
            </td>
        </tr>
    `).join('');
}

/**
 * Định dạng tiền tệ
 * @param {number} amount - Số tiền
 * @param {string} currency - Mã tiền tệ
 * @returns {string} - Chuỗi tiền tệ đã định dạng
 */
function formatCurrency(amount, currency) {
    const formatter = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: currency || 'VND',
        minimumFractionDigits: 0
    });
    
    return formatter.format(amount);
}

/**
 * Hiển thị hộp thoại xác nhận hủy đăng ký
 */
function showCancelConfirmation() {
    if (confirm('Bạn có chắc chắn muốn hủy đăng ký? Bạn vẫn có thể sử dụng dịch vụ cho đến cuối kỳ hiện tại.')) {
        cancelSubscription();
    }
}

/**
 * Hủy đăng ký hiện tại
 */
async function cancelSubscription() {
    try {
        showLoading('Đang xử lý yêu cầu hủy đăng ký...');
        
        const response = await fetch('/api/payments/cancel-subscription', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        hideLoading();
        
        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Không thể hủy đăng ký');
            return;
        }
        
        const data = await response.json();
        
        showSuccess(data.message || 'Đăng ký đã được hủy thành công');
        
        // Tải lại trạng thái đăng ký
        loadSubscriptionStatus();
        
    } catch (error) {
        hideLoading();
        console.error('Error canceling subscription:', error);
        showError('Đã xảy ra lỗi khi hủy đăng ký');
    }
}

/**
 * Hiển thị thông báo đang tải
 * @param {string} message - Thông báo hiển thị
 */
function showLoading(message) {
    const loadingEl = document.getElementById('loadingIndicator');
    
    if (loadingEl) {
        const msgEl = document.getElementById('loadingMessage');
        if (msgEl) msgEl.textContent = message || 'Đang tải...';
        loadingEl.style.display = 'flex';
    }
}

/**
 * Ẩn thông báo đang tải
 */
function hideLoading() {
    const loadingEl = document.getElementById('loadingIndicator');
    
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

/**
 * Hiển thị thông báo lỗi
 * @param {string} message - Thông báo lỗi
 */
function showError(message) {
    if (typeof ToastManager !== 'undefined' && ToastManager.showError) {
        ToastManager.showError(message);
    } else {
        alert(`Lỗi: ${message}`);
    }
}

/**
 * Hiển thị thông báo thành công
 * @param {string} message - Thông báo thành công
 */
function showSuccess(message) {
    if (typeof ToastManager !== 'undefined' && ToastManager.showSuccess) {
        ToastManager.showSuccess(message);
    } else {
        alert(message);
    }
}