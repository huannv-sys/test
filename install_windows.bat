@echo off
echo === Cai dat MikroTik Monitor ===

REM Kiem tra quyen admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Hay chay script nay voi quyen Administrator!
    pause
    exit /b 1
)

REM Kiem tra Python
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Python chua duoc cai dat. Hay cai dat Python 3.10+ tu python.org!
    pause
    exit /b 1
)

REM Tao moi truong ao Python
echo Tao moi truong ao Python...
python -m venv venv

REM Kich hoat moi truong ao
echo Kich hoat moi truong ao...
call venv\Scripts\activate

REM Cai dat cac goi Python
echo Cai dat cac goi Python...
pip install flask flask-sqlalchemy flask-login flask-jwt-extended flask-cors flask-socketio apscheduler gunicorn python-dotenv cryptography

REM Thiet lap database
echo Thiet lap database...
python setup_db.py

REM Tao file bat de khoi dong
echo Tao file khoi dong...
(
echo @echo off
echo call venv\Scripts\activate
echo python run.py
) > start_mikrotik_monitor.bat

REM Tao shortcut tren desktop
echo Tao shortcut tren desktop...
powershell "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\MikroTik Monitor.lnk'); $Shortcut.TargetPath = '%~dp0start_mikrotik_monitor.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Save()"

echo Cai dat hoan tat!
echo Ban co the khoi dong ung dung bang cach chay file "start_mikrotik_monitor.bat"
echo hoac su dung shortcut da tao tren Desktop.
echo.
echo Sau khi khoi dong, ban co the truy cap ung dung tai: http://localhost:5002
echo.
echo Thong tin dang nhap mac dinh:
echo Username: admin
echo Password: mikrotik_monitor_admin

pause