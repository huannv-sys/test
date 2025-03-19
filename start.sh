#!/bin/bash

# Script để khởi động nhanh MikroTik Monitor

# Kiểm tra môi trường ảo
if [ ! -d "venv" ]; then
    echo "Môi trường ảo không tồn tại. Hãy chạy install_ubuntu.sh trước!"
    exit 1
fi

# Kích hoạt môi trường ảo
source venv/bin/activate

# Khởi động ứng dụng
echo "Khởi động MikroTik Monitor..."
python run.py

# Bắt lỗi nếu có
if [ $? -ne 0 ]; then
    echo "Lỗi khi khởi động ứng dụng!"
    exit 1
fi