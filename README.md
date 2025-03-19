# MikroTik Monitor

Ứng dụng giám sát thiết bị MikroTik qua API

## Tính năng

- Kiểm tra kết nối tới thiết bị MikroTik
- Đăng nhập vào thiết bị và xem thông tin hệ thống
- Quản lý danh sách thiết bị
- Giám sát tài nguyên thiết bị (CPU, bộ nhớ, disk)
- Thu thập dữ liệu metrics định kỳ
- Hiển thị thông tin giao diện mạng
- Giám sát VPN và kết nối
- Tạo QR code cho thiết bị
- Hiển thị topology mạng

## Cài đặt

### Yêu cầu hệ thống

- **Ubuntu/Debian**:
  - Python 3.10+
  - SQLite3
  - Quyền sudo để cài đặt service

- **Windows**:
  - Python 3.10+
  - Quyền Administrator để cài đặt service (tùy chọn)

### Các bước cài đặt trên Ubuntu

1. Giải nén gói cài đặt:
   ```
   tar -zxvf mikrotik_monitor.tar.gz
   cd mikrotik_final
   ```

2. Chạy script cài đặt:
   ```
   chmod +x install_ubuntu.sh
   ./install_ubuntu.sh
   ```

### Các bước cài đặt trên Windows

1. Giải nén gói cài đặt

2. Chạy script cài đặt với quyền Administrator:
   ```
   install_windows.bat
   ```

## Sử dụng

Sau khi cài đặt, bạn có thể truy cập ứng dụng qua trình duyệt tại:
http://localhost:5002

### Thông tin đăng nhập mặc định

- **Username**: admin
- **Password**: mikrotik_monitor_admin

### Quản lý thiết bị

1. Truy cập vào tab "Quản lý thiết bị"
2. Nhấn "Thêm thiết bị" để thêm thiết bị MikroTik mới
3. Nhập thông tin: Tên, IP, cổng API, tên đăng nhập và mật khẩu

### Giám sát

1. Truy cập vào tab "Giám sát"
2. Chọn thiết bị từ danh sách để xem thông tin giám sát
3. Xem các metrics: CPU, Memory, Disk, và thông tin giao diện

### Khắc phục sự cố

#### Ubuntu:
Kiểm tra logs của ứng dụng:
```
sudo journalctl -u mikrotik-monitor -f
```

#### Windows:
Kiểm tra file log trong thư mục cài đặt:
```
type app.log
```

## Các lệnh quản lý (Ubuntu)

- Khởi động dịch vụ: `sudo systemctl start mikrotik-monitor`
- Dừng dịch vụ: `sudo systemctl stop mikrotik-monitor`
- Khởi động lại: `sudo systemctl restart mikrotik-monitor`
- Kiểm tra trạng thái: `sudo systemctl status mikrotik-monitor`

## Cấu hình nâng cao

Bạn có thể chỉnh sửa file `.env` để thay đổi cấu hình:
```
HOST=0.0.0.0
PORT=5002
FLASK_DEBUG=0
MONITORING_INTERVAL=300
```

## Thu thập metrics tự động

Ứng dụng tự động thu thập metrics từ các thiết bị đã cấu hình mỗi 5 phút. Dữ liệu này được lưu vào database để phân tích sau này.