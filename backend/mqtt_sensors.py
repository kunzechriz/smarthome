import paho.mqtt.client as mqtt
from flask import Blueprint, jsonify
import time

sensors_blueprint = Blueprint('sensors', __name__)

# --- SPEICHER ---
light_storage = {
    "value": 0.0,
    "unit": "lux",
    "last_update": 0
}

moisture_storage = {
    "raw": 4095,
    "percent": 0,
    "status": "dry",
    "last_update": 0
}

# NEU: Temperatur Speicher
temp_storage = {
    "value": 0.0,
    "unit": "°C",
    "last_update": 0
}

# ==============================================================================
# [KONFIGURATION]
# ==============================================================================

### debugging purposes only ###
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_USER = ""
MQTT_PASSWORD = ""

MQTT_TOPIC_LIGHT = "iot/lux"
MQTT_TOPIC_MOISTURE = "iot/soil"
MQTT_TOPIC_TEMP = "iot/temp"
###############################

# --- LOGIK LICHT ---
def handle_light_message(payload):
    try:
        val = float(payload)
        light_storage["value"] = round(val, 1)
        light_storage["last_update"] = time.time()
    except ValueError:
        print("[Sensor] Fehlerhafte Licht-Daten")

# --- LOGIK TEMPERATUR (NEU) ---
def handle_temp_message(payload):
    try:
        val = float(payload)
        temp_storage["value"] = round(val, 1) # 1 Nachkommastelle
        temp_storage["last_update"] = time.time()
    except ValueError:
        print("[Sensor] Fehlerhafte Temp-Daten")

# --- LOGIK PFLANZE ---
def handle_moisture_message(payload):
    try:
        val = float(payload)
        pct = int(val)
        pct = max(0, min(100, pct))

        moisture_storage["raw"] = pct
        moisture_storage["percent"] = pct
        moisture_storage["last_update"] = time.time()

        if pct < 20:
            moisture_storage["status"] = "critical"
        elif pct < 40:
            moisture_storage["status"] = "warning"
        else:
            moisture_storage["status"] = "ok"

    except ValueError:
        print("[Sensor] Fehlerhafte Feuchtigkeits-Daten")

# --- MQTT CALLBACKS ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        topics = [
            (MQTT_TOPIC_LIGHT, 0),
            (MQTT_TOPIC_MOISTURE, 0),
            (MQTT_TOPIC_TEMP, 0)
        ]
        client.subscribe(topics)
    else:
        print(f"[Sensors] Verbindung fehlgeschlagen! Code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        topic = msg.topic

        if topic == MQTT_TOPIC_LIGHT:
            handle_light_message(payload)
        elif topic == MQTT_TOPIC_MOISTURE:
            handle_moisture_message(payload)
        elif topic == MQTT_TOPIC_TEMP:
            handle_temp_message(payload)

    except Exception as e:
        print(f"[MQTT Fehler] {e}")

# --- MQTT START ---
try:
    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    if MQTT_USER and MQTT_PASSWORD:
        mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

    print(f"[Sensors] Verbinde zu {MQTT_BROKER}...")
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()

except Exception as e:
    print(f"[WARN] Sensor-MQTT konnte nicht starten: {e}")


# --- API ROUTEN ---

@sensors_blueprint.route('/api/sensor/moisture')
def get_moisture_data():
    if (time.time() - moisture_storage["last_update"]) > 120: ###120 sekunden
        return jsonify({"error": "Sensor offline", "status": "offline"}), 503
    return jsonify(moisture_storage)

@sensors_blueprint.route('/api/sensor/light')
def get_light_data():
    if (time.time() - light_storage["last_update"]) > 60: ###60 sekunden
        return jsonify({"error": "Sensor offline"}), 503
    return jsonify(light_storage)

@sensors_blueprint.route('/api/sensor/temp')
def get_temp_data():
    if (time.time() - temp_storage["last_update"]) > 120:
        return jsonify({"error": "Sensor offline"}), 503
    return jsonify(temp_storage)