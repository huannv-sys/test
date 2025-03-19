"""
Các tiện ích xử lý dữ liệu chuỗi thời gian
"""

import logging
import statistics
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger('mikrotik_monitor.time_series')

def get_time_series_data(device_id, metric, start_time, end_time):
    """Get time series data for a device metric"""
    from mik.app.database.crud import get_metrics_for_device
    
    metrics = get_metrics_for_device(
        device_id=device_id,
        metric_type=metric.split('_')[0] if '_' in metric else None,
        metric_name=metric.split('_')[1] if '_' in metric else metric,
        start_time=start_time,
        end_time=end_time
    )
    
    return metrics

def calculate_statistics(data_points):
    """Calculate statistics for a set of data points"""
    if not data_points:
        return {
            'min': None,
            'max': None,
            'avg': None,
            'median': None,
            'count': 0
        }
    
    values = [point.get('value', 0) for point in data_points if point.get('value') is not None]
    
    if not values:
        return {
            'min': None,
            'max': None,
            'avg': None,
            'median': None,
            'count': 0
        }
    
    return {
        'min': min(values),
        'max': max(values),
        'avg': sum(values) / len(values),
        'median': statistics.median(values) if len(values) > 0 else None,
        'count': len(values)
    }

def resample_time_series(data_points, interval_minutes=5):
    """Resample time series data to a specified interval"""
    if not data_points:
        return []
    
    # Convert to list if it's not already
    if not isinstance(data_points, list):
        data_points = list(data_points)
    
    # Parse timestamps
    for point in data_points:
        if isinstance(point.get('timestamp'), str):
            try:
                point['timestamp'] = datetime.fromisoformat(point['timestamp'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                logger.warning(f"Failed to parse timestamp: {point.get('timestamp')}")
                point['timestamp'] = datetime.utcnow()
    
    # Sort by timestamp
    data_points.sort(key=lambda x: x.get('timestamp', datetime.utcnow()))
    
    # Find min and max time
    min_time = data_points[0].get('timestamp', datetime.utcnow())
    max_time = data_points[-1].get('timestamp', datetime.utcnow())
    
    # Create time interval bins
    interval = timedelta(minutes=interval_minutes)
    bins = {}
    
    # Create bins
    current_time = min_time
    while current_time <= max_time:
        bins[current_time] = []
        current_time += interval
    
    # Assign data points to bins
    for point in data_points:
        timestamp = point.get('timestamp', datetime.utcnow())
        bin_time = min_time + (((timestamp - min_time).total_seconds() // interval.total_seconds()) * interval)
        if bin_time in bins:
            bins[bin_time].append(point)
    
    # Calculate averages for each bin
    result = []
    for bin_time, points in sorted(bins.items()):
        if points:
            # Calculate average value
            total = sum(p.get('value', 0) for p in points)
            avg_value = total / len(points)
            
            # Use properties from first point
            first_point = points[0].copy()
            first_point['value'] = avg_value
            first_point['timestamp'] = bin_time.isoformat()
            first_point['count'] = len(points)
            
            result.append(first_point)
        else:
            # Create empty point for continuity
            result.append({
                'timestamp': bin_time.isoformat(),
                'value': None,
                'count': 0
            })
    
    return result

def detect_anomalies(data_points, z_score_threshold=3.0):
    """Detect anomalies in time series data using Z-score"""
    if not data_points or len(data_points) < 3:
        return []
    
    # Extract values
    values = [point.get('value', 0) for point in data_points if point.get('value') is not None]
    
    if not values or len(values) < 3:
        return []
    
    # Calculate statistics
    mean = sum(values) / len(values)
    stdev = statistics.stdev(values) if len(values) > 1 else 0
    
    # Avoid division by zero
    if stdev == 0:
        return []
    
    # Find anomalies
    anomalies = []
    for i, point in enumerate(data_points):
        value = point.get('value')
        if value is not None:
            z_score = abs((value - mean) / stdev)
            if z_score > z_score_threshold:
                anomaly = point.copy()
                anomaly['z_score'] = z_score
                anomaly['is_anomaly'] = True
                anomalies.append(anomaly)
    
    return anomalies

def forecast_simple(data_points, periods=5):
    """Simple forecasting based on moving average"""
    if not data_points or len(data_points) < 3:
        return []
    
    # Extract values
    values = [point.get('value', 0) for point in data_points if point.get('value') is not None]
    
    if not values or len(values) < 3:
        return []
    
    # Calculate moving average
    window_size = min(len(values) // 3, 5)
    window_size = max(window_size, 2)
    
    # Get trend direction
    avg_first_half = sum(values[:len(values)//2]) / (len(values)//2)
    avg_second_half = sum(values[len(values)//2:]) / (len(values) - len(values)//2)
    trend = avg_second_half - avg_first_half
    
    # Get last few values for recent trend
    last_values = values[-window_size:]
    recent_avg = sum(last_values) / len(last_values)
    
    # Generate forecasted values
    forecasts = []
    last_timestamp = datetime.fromisoformat(data_points[-1].get('timestamp').replace('Z', '+00:00')) if isinstance(data_points[-1].get('timestamp'), str) else data_points[-1].get('timestamp', datetime.utcnow())
    
    interval = last_timestamp - (datetime.fromisoformat(data_points[-2].get('timestamp').replace('Z', '+00:00')) if isinstance(data_points[-2].get('timestamp'), str) else data_points[-2].get('timestamp', datetime.utcnow()))
    
    for i in range(1, periods + 1):
        next_timestamp = last_timestamp + (interval * i)
        next_value = recent_avg + (trend * i) / 2
        
        forecasts.append({
            'timestamp': next_timestamp.isoformat(),
            'value': next_value,
            'is_forecast': True
        })
    
    return forecasts