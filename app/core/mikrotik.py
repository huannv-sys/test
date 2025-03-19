"""
Quản lý kết nối và tương tác với thiết bị MikroTik
"""

import os
import time
import logging
from datetime import datetime

from librouteros import connect as routeros_connect
from librouteros.exceptions import ConnectionError, LoginError, FatalError

from mik.app.utils.security import decrypt_device_password

logger = logging.getLogger('mikrotik_monitor.core')

def connect_to_device(ip_address, username, password, port=8728, use_ssl=True, timeout=None):
    """Connect to MikroTik device via API
    
    Args:
        ip_address (str): Device IP address
        username (str): API username
        password (str): API password (may be encrypted)
        port (int): API port number
        use_ssl (bool): Whether to use SSL for connection
        timeout (int, optional): Connection timeout in seconds. Default from config.
        
    Returns:
        API connection object or None if connection failed
    """
    # Giải mã mật khẩu nếu cần
    try:
        if password.startswith('enc:'):
            password = decrypt_device_password(password)
    except Exception as e:
        logger.error(f"Error decrypting password: {e}")
        return None
    
    # Timeout mặc định
    if timeout is None:
        from flask import current_app
        timeout = current_app.config.get('MIKROTIK_CONNECTION_TIMEOUT', 10)
    
    try:
        logger.debug(f"Connecting to MikroTik device at {ip_address}:{port} (SSL: {use_ssl})")
        
        # Thiết lập tham số kết nối
        params = {
            'host': ip_address,
            'username': username,
            'password': password,
            'port': port,
            'timeout': timeout
        }
        
        if use_ssl:
            params['ssl_wrapper'] = True  # Sử dụng SSL
            params['ssl_verify'] = False  # Không xác thực cert để tương thích tốt hơn
        
        # Kết nối đến thiết bị
        api = routeros_connect(**params)
        logger.info(f"Successfully connected to MikroTik device at {ip_address}")
        return api
        
    except ConnectionError as e:
        logger.error(f"Connection error to MikroTik device at {ip_address}: {e}")
    except LoginError as e:
        logger.error(f"Login error to MikroTik device at {ip_address}: {e}")
    except FatalError as e:
        logger.error(f"Fatal error connecting to MikroTik device at {ip_address}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error connecting to MikroTik device at {ip_address}: {e}")
    
    return None

def get_device_metrics(device):
    """Get current device metrics
    
    Args:
        device: Device object with connection parameters
        
    Returns:
        Dictionary with device metrics or offline status
    """
    try:
        # Kết nối đến thiết bị
        api = connect_to_device(
            device.ip_address, 
            device.username, 
            device.password_hash, 
            device.api_port, 
            device.use_ssl
        )
        
        if not api:
            return {'status': 'offline'}
        
        # Lấy thông tin hệ thống
        system_resource = next(api.path('/system/resource').select())
        
        # Lấy thông tin CPU
        cpu_load = system_resource.get('cpu-load', 0)
        
        # Lấy thông tin bộ nhớ
        total_memory = int(system_resource.get('total-memory', 0))
        free_memory = int(system_resource.get('free-memory', 0))
        memory_usage = 0
        
        if total_memory > 0:
            memory_usage = 100 - (free_memory / total_memory * 100)
        
        # Lấy thông tin ổ đĩa
        total_hdd = int(system_resource.get('total-hdd-space', 0))
        free_hdd = int(system_resource.get('free-hdd-space', 0))
        disk_usage = 0
        
        if total_hdd > 0:
            disk_usage = 100 - (free_hdd / total_hdd * 100)
        
        # Lấy thông tin uptime
        uptime_seconds = system_resource.get('uptime', '0s')
        
        # Đóng kết nối
        api.close()
        
        # Trả về dữ liệu
        return {
            'status': 'online',
            'cpu': {
                'load': cpu_load,
                'cores': system_resource.get('cpu-count', 1)
            },
            'memory': {
                'total': total_memory,
                'free': free_memory,
                'usage': memory_usage
            },
            'disk': {
                'total': total_hdd,
                'free': free_hdd,
                'usage': disk_usage
            },
            'system': {
                'version': system_resource.get('version', 'Unknown'),
                'architecture': system_resource.get('architecture-name', 'Unknown'),
                'uptime': format_uptime(uptime_seconds),
                'board': system_resource.get('board-name', 'Unknown'),
                'model': device.model or 'Unknown'
            },
            'timestamp': datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting metrics from device {device.name} ({device.ip_address}): {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

def get_device_clients(device):
    """Get clients connected to device

    Args:
        device: Device object with connection parameters
        
    Returns:
        Dictionary with client information or offline status
    """
    try:
        # Kết nối đến thiết bị
        api = connect_to_device(
            device.ip_address, 
            device.username, 
            device.password_hash, 
            device.api_port, 
            device.use_ssl
        )
        
        if not api:
            return {'status': 'offline'}
        
        # Thu thập thông tin client từ nhiều nguồn
        clients = {
            'wireless': _get_wireless_clients(api),
            'dhcp': _get_dhcp_clients(api),
            'capsman': _get_capsman_clients(api)
        }
        
        # Đóng kết nối
        api.close()
        
        total_clients = sum(len(client_list) for client_list in clients.values())
        
        # Trả về dữ liệu
        return {
            'status': 'online',
            'clients': clients,
            'total': total_clients,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting clients from device {device.name} ({device.ip_address}): {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

def _get_wireless_clients(api):
    """Get wireless clients from device
    
    Args:
        api: Active API connection
        
    Returns:
        List of wireless clients
    """
    try:
        # Kiểm tra nếu có wireless interface
        wireless_path = api.path('/interface/wireless/registration-table')
        clients = []
        
        for client in wireless_path.select():
            clients.append({
                'mac': client.get('mac-address', ''),
                'interface': client.get('interface', ''),
                'signal': client.get('signal-strength', ''),
                'uptime': client.get('uptime', ''),
                'tx_rate': client.get('tx-rate', ''),
                'rx_rate': client.get('rx-rate', '')
            })
        
        return clients
    except Exception as e:
        logger.debug(f"Error getting wireless clients: {e}")
        return []

def _get_dhcp_clients(api):
    """Get DHCP clients from device
    
    Args:
        api: Active API connection
        
    Returns:
        List of DHCP clients
    """
    try:
        # Lấy danh sách client DHCP
        dhcp_path = api.path('/ip/dhcp-server/lease')
        clients = []
        
        for client in dhcp_path.select():
            clients.append({
                'mac': client.get('mac-address', ''),
                'address': client.get('address', ''),
                'hostname': client.get('host-name', ''),
                'status': client.get('status', ''),
                'expires_after': client.get('expires-after', '')
            })
        
        return clients
    except Exception as e:
        logger.debug(f"Error getting DHCP clients: {e}")
        return []

def _get_capsman_clients(api):
    """Get CAPsMAN clients from device
    
    Args:
        api: Active API connection
        
    Returns:
        List of CAPsMAN clients
    """
    try:
        # Kiểm tra nếu có CAPsMAN
        capsman_path = api.path('/caps-man/registration-table')
        clients = []
        
        for client in capsman_path.select():
            clients.append({
                'mac': client.get('mac-address', ''),
                'interface': client.get('interface', ''),
                'ssid': client.get('ssid', ''),
                'signal': client.get('signal-strength', ''),
                'uptime': client.get('uptime', ''),
                'tx_rate': client.get('tx-rate', ''),
                'rx_rate': client.get('rx-rate', '')
            })
        
        return clients
    except Exception as e:
        logger.debug(f"Error getting CAPsMAN clients: {e}")
        return []

def get_interface_traffic(device, interface_name=None, include_types=None):
    """Get interface traffic for a device
    
    Args:
        device: Device object with connection parameters
        interface_name (str, optional): Specific interface to query
        include_types (list, optional): Interface types to include (default: ['ether', 'wlan', 'bridge'])
        
    Returns:
        Dictionary with interface traffic data or offline status
    """
    if include_types is None:
        include_types = ['ether', 'wlan', 'bridge']
    
    try:
        # Kết nối đến thiết bị
        api = connect_to_device(
            device.ip_address, 
            device.username, 
            device.password_hash, 
            device.api_port, 
            device.use_ssl
        )
        
        if not api:
            return {'status': 'offline'}
        
        # Lấy thông tin interface
        interfaces_path = api.path('/interface')
        
        # Xây dựng query cho interface cụ thể hoặc tất cả
        query = {}
        if interface_name:
            query['name'] = interface_name
        
        interfaces = interfaces_path.select(**query)
        
        # Lưu thông tin interface
        interface_data = []
        
        for interface in interfaces:
            # Kiểm tra loại interface có nằm trong danh sách được lọc không
            iface_type = interface.get('type', '')
            if iface_type not in include_types and include_types:
                continue
            
            # Lấy dữ liệu traffic
            traffic_data = {
                'name': interface.get('name', ''),
                'type': iface_type,
                'rx_byte': int(interface.get('rx-byte', 0)),
                'tx_byte': int(interface.get('tx-byte', 0)),
                'rx_packet': int(interface.get('rx-packet', 0)),
                'tx_packet': int(interface.get('tx-packet', 0)),
                'enabled': interface.get('disabled', 'true') == 'false',  # 'disabled' property is inverted
                'running': interface.get('running', 'false') == 'true',
                'comment': interface.get('comment', '')
            }
            
            # Tính toán tốc độ (bps)
            if 'actual-mtu' in interface:
                traffic_data['mtu'] = int(interface.get('actual-mtu', 0))
            
            interface_data.append(traffic_data)
        
        # Đóng kết nối
        api.close()
        
        # Trả về dữ liệu
        return {
            'status': 'online',
            'interfaces': interface_data,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting interface traffic from device {device.name} ({device.ip_address}): {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

def send_command_to_device(device, command):
    """Send a CLI command to device and return result
    
    Args:
        device: Device object with connection parameters
        command: MikroTik CLI command to execute
        
    Returns:
        Dictionary with command result or error message
    """
    try:
        # Kết nối đến thiết bị
        api = connect_to_device(
            device.ip_address, 
            device.username, 
            device.password_hash, 
            device.api_port, 
            device.use_ssl
        )
        
        if not api:
            return {
                'status': 'offline',
                'error': 'Could not connect to device'
            }
        
        # Parse command và path
        parts = command.strip().split()
        if not parts:
            return {'status': 'error', 'error': 'Empty command'}
        
        # Xây dựng path dựa trên command
        path = '/'.join(parts[:-1]) if len(parts) > 1 else '/'
        cmd = parts[-1] if parts else ''
        
        # Thực hiện command
        result = list(api.path(path).select())
        
        # Đóng kết nối
        api.close()
        
        # Trả về kết quả
        return {
            'status': 'success',
            'command': command,
            'result': result,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error sending command to device {device.name} ({device.ip_address}): {e}")
        return {
            'status': 'error',
            'error': str(e),
            'command': command
        }

def backup_config(device, max_retries=2):
    """Backup device configuration
    
    Args:
        device: Device object with connection parameters
        max_retries (int, optional): Maximum number of retry attempts if backup fails
        
    Returns:
        Dictionary with backup info or None if backup failed
    """
    attempts = 0
    
    while attempts <= max_retries:
        try:
            # Kết nối đến thiết bị
            api = connect_to_device(
                device.ip_address, 
                device.username, 
                device.password_hash, 
                device.api_port, 
                device.use_ssl
            )
            
            if not api:
                attempts += 1
                if attempts <= max_retries:
                    logger.warning(f"Retry {attempts}/{max_retries} connecting to device for backup")
                    time.sleep(2)  # Wait before retry
                    continue
                return {
                    'status': 'offline',
                    'error': 'Could not connect to device'
                }
            
            # Generate backup name with timestamp
            backup_name = f"backup_{device.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Create backup
            backup_path = api.path('/system/backup')
            backup_path.call('save', {'name': backup_name})
            
            # Wait for backup to complete
            time.sleep(2)
            
            # Get backup file details
            files_path = api.path('/file')
            backup_files = list(files_path.select(name=backup_name + '.backup'))
            
            if not backup_files:
                raise Exception("Backup file not found after creation")
            
            backup_file = backup_files[0]
            
            # Đóng kết nối
            api.close()
            
            # Trả về thông tin backup
            return {
                'status': 'success',
                'filename': backup_file.get('name', ''),
                'size': backup_file.get('size', 0),
                'created': datetime.utcnow().isoformat(),
                'device_id': device.id,
                'device_name': device.name
            }
        
        except Exception as e:
            logger.error(f"Error creating backup for device {device.name} ({device.ip_address}): {e}")
            attempts += 1
            
            if attempts <= max_retries:
                logger.warning(f"Retry {attempts}/{max_retries} for backup")
                time.sleep(2)  # Wait before retry
            else:
                return {
                    'status': 'error',
                    'error': str(e)
                }

def restore_config(device, backup_file_name, max_retries=2):
    """Restore device configuration from backup
    
    Args:
        device: Device object with connection parameters
        backup_file_name: Name of the backup file to restore
        max_retries (int, optional): Maximum number of retry attempts if restore fails
        
    Returns:
        Dictionary with restore status info
    """
    attempts = 0
    
    while attempts <= max_retries:
        try:
            # Kết nối đến thiết bị
            api = connect_to_device(
                device.ip_address, 
                device.username, 
                device.password_hash, 
                device.api_port, 
                device.use_ssl
            )
            
            if not api:
                attempts += 1
                if attempts <= max_retries:
                    logger.warning(f"Retry {attempts}/{max_retries} connecting to device for restore")
                    time.sleep(2)  # Wait before retry
                    continue
                return {
                    'status': 'offline',
                    'error': 'Could not connect to device'
                }
            
            # Validate backup file exists
            files_path = api.path('/file')
            backup_files = list(files_path.select(name=backup_file_name))
            
            if not backup_files:
                raise Exception(f"Backup file '{backup_file_name}' not found on device")
            
            # Restore from backup
            backup_path = api.path('/system/backup')
            backup_path.call('load', {'name': backup_file_name.replace('.backup', '')})
            
            # Allow some time for restore
            time.sleep(3)
            
            # Đóng kết nối (có thể mất kết nối do restore)
            try:
                api.close()
            except:
                pass
            
            # Trả về thông tin restore
            return {
                'status': 'success',
                'filename': backup_file_name,
                'restored_at': datetime.utcnow().isoformat(),
                'device_id': device.id,
                'device_name': device.name,
                'message': 'Configuration restored. Device may reboot.'
            }
        
        except Exception as e:
            logger.error(f"Error restoring backup for device {device.name} ({device.ip_address}): {e}")
            attempts += 1
            
            if attempts <= max_retries:
                logger.warning(f"Retry {attempts}/{max_retries} for restore")
                time.sleep(2)  # Wait before retry
            else:
                return {
                    'status': 'error',
                    'error': str(e)
                }

def calculate_percentage(used, total):
    """Calculate percentage with error handling"""
    try:
        if total == 0:
            return 0
        return (used / total) * 100
    except Exception:
        return 0

def format_uptime(seconds):
    """Format uptime in seconds to a readable string"""
    try:
        # Convert string like "1d2h15m3s" to seconds
        if isinstance(seconds, str):
            total_seconds = 0
            num = ""
            for char in seconds:
                if char.isdigit():
                    num += char
                elif char == 'd' and num:
                    total_seconds += int(num) * 86400
                    num = ""
                elif char == 'h' and num:
                    total_seconds += int(num) * 3600
                    num = ""
                elif char == 'm' and num:
                    total_seconds += int(num) * 60
                    num = ""
                elif char == 's' and num:
                    total_seconds += int(num)
                    num = ""
            seconds = total_seconds
        
        # Convert seconds to readable format
        days, remainder = divmod(int(seconds), 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"
    except Exception:
        return "Unknown"