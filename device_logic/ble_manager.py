import asyncio
import threading
import random
from bleak import BleakClient

RECONNECT_INTERVAL = 5  # Sekunden
ble_lock = threading.Lock()
is_any_connection_in_progress = False
# ----------------------------------------------------------------------------------------------------------#
class BLEDeviceConnection:
    def __init__(self, mac, uuid):
        self.mac = mac
        self.uuid = uuid
        self.client = BleakClient(mac, adapter="hci0")
        self.connected = False
        self.loop = None
        self.stop_flag = False
        self.manually_disconnected = False
        self.keep_alive_task = None

        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def _run_loop(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        self.keep_alive_task = self.loop.create_task(self._keep_connection_alive())
        self.loop.run_forever()

        if not self.loop.is_closed():
            self.loop.close()

    # ----------------------------------------------------------------------------------------------------------#
    async def _keep_connection_alive(self):
        while not self.stop_flag and not self.manually_disconnected:
            if not self.client.is_connected:
                self.connected = False

                if ble_lock.acquire(blocking=False):
                    try:
                        print(f"[BLE] {self.mac}: Direkter Verbindungsversuch ohne Scan...")
                        await self.client.connect(timeout=15.0)
                        self.connected = True
                        print(f"[BLE] {self.mac} steht! Verbindung stabil.")
                    except Exception as e:
                        print(f"[BLE] {self.mac} fehlgeschlagen. Dongle evtl. überlastet.")
                    finally:
                        ble_lock.release()
                        await asyncio.sleep(5)
                else:
                    await asyncio.sleep(random.uniform(2, 5))
            else:
                self.connected = True
                await asyncio.sleep(30)  # Wenn verbunden, Ruhe geben
    # ----------------------------------------------------------------------------------------------------------#
    def send_command(self, cmd):
        if not self.connected or self.manually_disconnected:
            print(f"[BLE] {self.mac} not connected yet or manually disconnected")
            return

        try:
            asyncio.run_coroutine_threadsafe(
                self.client.write_gatt_char(self.uuid, cmd),
                self.loop
            )
        except Exception as e:
            print(f"[BLE] Error sending command to {self.mac}: {e}")

    # ----------------------------------------------------------------------------------------------------------#
    def disconnect(self):
        self.stop_flag = True
        self.manually_disconnected = True

        if self.loop and self.loop.is_running():
            if self.keep_alive_task and not self.keep_alive_task.done():
                self.loop.call_soon_threadsafe(self.keep_alive_task.cancel)

            try:
                future = asyncio.run_coroutine_threadsafe(self.client.disconnect(), self.loop)
                try:
                    future.result(timeout=0.2)
                except:
                    pass
            except Exception:
                pass

            self.loop.call_soon_threadsafe(self.loop.stop)
            self.thread.join(timeout=5)

        self.connected = False
        print(f"[BLE] Device {self.mac} disconnected cleanly")

# ----------------------------------------------------------------------------------------------------------#
class BLEManager:
    def __init__(self, uuid):
        self.uuid = uuid
        self.devices = {}

    def add_device(self, mac):
        if mac not in self.devices:
            self.devices[mac] = BLEDeviceConnection(mac, self.uuid)
        else:
            if self.devices[mac].manually_disconnected:
                self.devices[mac].manually_disconnected = False

    def remove_device(self, mac):
        if mac in self.devices:
            self.devices[mac].disconnect()
            del self.devices[mac]

    def send_to(self, mac, cmd):
        if mac in self.devices:
            self.devices[mac].send_command(cmd)

    def list_devices(self):
        return list(self.devices.keys())
# ----------------------------------------------------------------------------------------------------------#