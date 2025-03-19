#!/bin/bash

# Script cài đặt MikroTik Monitor cho Ubuntu
echo "=== Cài đặt MikroTik Monitor ==="

# Cập nhật biến môi trường
USERNAME=$(whoami)
INSTALL_DIR=$(pwd)

# Cài đặt các gói cần thiết
echo "Cài đặt các gói phụ thuộc..."
sudo apt update
sudo apt install -y python3-pip python3-venv python3-dev

# Tạo môi trường ảo
echo "Tạo môi trường ảo Python..."
python3 -m venv venv
source venv/bin/activate

# Cài đặt các gói Python
echo "Cài đặt các gói Python..."
pip install flask flask-sqlalchemy flask-login flask-jwt-extended flask-cors flask-socketio apscheduler librouteros gunicorn python-dotenv netifaces cryptography

# Thiết lập database
echo "Thiết lập database..."
python setup_db.py

# Tạo file service
echo "Tạo file service systemd..."
cat > mikrotik-monitor.service << EOF
[Unit]
Description=MikroTik Monitor Service
After=network.target

[Service]
User=${USERNAME}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/run.py
Restart=on-failure
Environment=PYTHONPATH=${INSTALL_DIR}
Environment=HOST=0.0.0.0
Environment=PORT=5002
Environment=FLASK_DEBUG=0
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Cài đặt service
echo "Cài đặt service..."
sudo cp mikrotik-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mikrotik-monitor
sudo systemctl start mikrotik-monitor

echo "Cài đặt hoàn tất!"
echo "Dịch vụ đã được khởi động trên cổng 5002"
echo "Bạn có thể truy cập ứng dụng tại: http://localhost:5002"
echo ""
echo "Để kiểm tra trạng thái: sudo systemctl status mikrotik-monitor"
echo "Để xem logs: sudo journalctl -u mikrotik-monitor -f"