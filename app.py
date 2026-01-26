from flask import Flask, render_template, jsonify
import asyncio
import threading

from backend.automation_controls import automation_blueprint
#import os

from backend.led import led_backend, set_ble_loop
from backend.nfc_reader import nfc_blueprint
from backend.printer import printer_backend, start_printer_service
from backend.cloud import cloud_backend
from backend.read_system_stats import system_stats_blueprint
from backend.btc_chart import btc_backend_blueprint
from backend.mqtt_sensors import sensors_blueprint
#-----------------------------------------Initialize------------------------------------------------------#
app = Flask(__name__)
#os.system("sudo hciconfig hci0 up")
@app.route("/")
def index():
    return render_template("index.html")

def start_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()


loop = asyncio.new_event_loop()
threading.Thread(target=start_loop, args=(loop,), daemon=True).start()

#-----------------------------------------Logging------------------------------------------------------#
# --- LOGGING SETUP ---
import sys
import re
from collections import deque
from datetime import datetime

log_buffer = deque(maxlen=50)
ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

original_stdout = sys.stdout
original_stderr = sys.stderr


def add_to_web_log(message):
    if not message.strip(): return
    if any(x in message for x in ["GET /", "POST /", "HTTP/1.1", "static/", "/api/"]):
        return

    time_str = datetime.now().strftime('%H:%M:%S')
    clean_msg = ansi_escape.sub('', message.strip())

    log_buffer.append(f"{time_str} - {clean_msg}")


class WebStreamWrapper:
    def __init__(self, stream):
        self.stream = stream

    def write(self, message):
        self.stream.write(message)
        self.stream.flush()

        try:
            add_to_web_log(message)
        except Exception:
            pass

    def flush(self):
        self.stream.flush()


# --- WICHTIGE ÄNDERUNG: Wir biegen BEIDE Kanäle um ---
sys.stdout = WebStreamWrapper(original_stdout)
sys.stderr = WebStreamWrapper(original_stderr)
#------------------------------Initialize external Backend Files------------------------------------------#
try:
    start_printer_service()
    print("System: Drucker-Service erfolgreich angestoßen.")
except Exception as e:
    print(f"System: FEHLER beim Drucker-Start: {e}")
set_ble_loop(loop)
app.register_blueprint(led_backend)
app.register_blueprint(printer_backend)
app.register_blueprint(cloud_backend)
app.register_blueprint(sensors_blueprint)
app.register_blueprint(automation_blueprint)
app.register_blueprint(nfc_blueprint)
@app.route('/api/logs')
def get_logs():
    return jsonify(list(log_buffer))

app.register_blueprint(system_stats_blueprint)

app.register_blueprint(btc_backend_blueprint)
#---------------------------------------------------------------------------------------------------------#
if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(host="0.0.0.0", port=5001, threaded=True)