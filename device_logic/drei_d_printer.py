import ssl
import paho.mqtt.client as mqtt
import json

# ----------------------------------------------------------------------------------------------------------#
class BambuPrinter:
    def __init__(self, ip, serial, access_code):
        self.ip = ip
        self.serial = serial
        self.access_code = access_code
        self.data = {
            "bed_temp": 0,
            "nozzle_temp": 0,
            "status": "Offline",
            "progress": 0
        }

        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self._setup_mqtt()

    # ----------------------------------------------------------------------------------------------------------#
    def _setup_mqtt(self):
        self.client.tls_set(cert_reqs=ssl.CERT_NONE)
        self.client.tls_insecure_set(True)

        # Authentifizierung: User ist immer 'bblp'
        self.client.username_pw_set("bblp", self.access_code)

        # Callbacks registrieren
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

    # ----------------------------------------------------------------------------------------------------------#
    def _on_connect(self, client, userdata, flags, rc, properties=None):
        print(f"[Printer] Verbunden. Sende pushall...")
        topic_report = f"device/{self.serial}/report"
        self.client.subscribe(topic_report)

        # Sofort alle Daten anfordern
        push_payload = {"pushing": {"sequence_id": "0", "command": "pushall"}}
        self.send_command(push_payload)

    # ----------------------------------------------------------------------------------------------------------#
    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload)

            data = payload.get("print") or payload
            #print(f"DEBUG PAYLOAD: {payload}")
            if data:
                if "bed_temper" in data:
                    self.data["bed_temp"] = data["bed_temper"]
                if "nozzle_temper" in data:
                    self.data["nozzle_temp"] = data["nozzle_temper"]
                if "mc_percent" in data:
                    self.data["progress"] = data["mc_percent"]
                if "mc_remaining_time" in data:
                    self.data["remaining_time"] = data["mc_remaining_time"]

                # Status abfangen
                if "gcode_state" in data:
                    self.data["status"] = data["gcode_state"]

                # Lichtstatus abfangen
                if "chamber_light" in data:
                    self.data["light"] = data["chamber_light"]

        except Exception as e:
            print(f"[Printer] Fehler beim Parsen: {e}")
    # ----------------------------------------------------------------------------------------------------------#
    def start(self):
        """Startet die Verbindung zum Drucker."""
        try:
            self.client.connect(self.ip, 8883, 60)
            self.client.loop_start()
            print(f"[Printer] MQTT Listener für {self.ip} gestartet.")
        except Exception as e:
            print(f"[Printer] Verbindungsfehler: {e}")

    # ----------------------------------------------------------------------------------------------------------#
    def send_command(self, payload):
        """Sendet ein beliebiges Kommando-Objekt an den Drucker."""
        if self.client.is_connected():
            topic = f"device/{self.serial}/request"
            self.client.publish(topic, json.dumps(payload))
            return True
        return False

    # ----------------------------------------------------------------------------------------------------------#
    def disconnect(self):
        """Trennt die Verbindung zum MQTT Broker sauber."""
        if self.client:
            self.client.loop_stop()  # Stoppt den Hintergrund-Thread
            self.client.disconnect()  # Trennt die Netzwerkverbindung
            self.data["status"] = "Offline"
            print(f"[Printer] Verbindung zu {self.ip} getrennt.")
            return True
        return False


