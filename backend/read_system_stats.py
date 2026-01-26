import psutil
import shutil
import os
from flask import Blueprint, jsonify

system_stats_blueprint = Blueprint('system_stats', __name__)

# ----------------------------------------------------------------------------------------------------------#
@system_stats_blueprint.route('/api/system/health')
def get_system_health():
    # CPU Temperatur (Funktioniert auf dem Raspi)
    temp = 0
    try:
        if os.path.exists("/sys/class/thermal/thermal_zone0/temp"):
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                temp = int(f.read()) / 1000  # Umrechnung in °C
    except:
        temp = 0  # Fallback für PC-Development

    # RAM Auslastung
    ram = psutil.virtual_memory()

    # Festplattenplatz (Root-Verzeichnis)
    total, used, free = shutil.disk_usage("/")

    return jsonify({
        "cpu_temp": round(temp, 1),
        "cpu_usage": psutil.cpu_percent(interval=None),
        "ram_usage": ram.percent,
        "disk_free": round(free / (2 ** 30), 1)  # In GB
    })
# ----------------------------------------------------------------------------------------------------------#