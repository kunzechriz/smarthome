from abc import ABC, abstractmethod
import logging
import time
import random

# ============================================================
# Hardware Detection & Conditional Imports
# ============================================================
try:
    import board
    import busio
    from digitalio import DigitalInOut
    from adafruit_pn532.spi import PN532_SPI
    IS_RPI = True
except ImportError:
    IS_RPI = False
    PN532_SPI = object
    logger = logging.getLogger("nfc")
    logger.warning("Hardware-Bibliotheken nicht gefunden. Starte im SIMULATIONS-MODUS (PC).")

# ============================================================
# Logging & Constants
# ============================================================
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("nfc")

DEFAULT_KEY_A = bytes([0xFF] * 6)
BLOCK_COUNT = 64
BLOCK_SIZE = 16

# ============================================================
# Helper functions
# ============================================================
def is_sector_trailer(block: int) -> bool:
    return (block + 1) % 4 == 0

def is_safe_data_block(block: int) -> bool:
    return block != 0 and not is_sector_trailer(block)

# ============================================================
# Interface
# ============================================================
class NFCReaderInterface(ABC):
    @abstractmethod
    def wait_for_card(self, timeout: float | None = None) -> bytes:
        pass
    @abstractmethod
    def read_block(self, uid: bytes, block: int) -> bytes | None:
        pass
    @abstractmethod
    def read_all_blocks(self, uid: bytes) -> dict[int, bytes]:
        pass
    @abstractmethod
    def write_block(self, uid: bytes, block: int, data: bytes) -> bool:
        pass

# ============================================================
# Implementation
# ============================================================
class NFCReader(NFCReaderInterface):

    def __init__(self):
        if IS_RPI:
            self._pn532 = self._configure_pn532()
        else:
            logger.info("NFCReader initialisiert (Simulation)")

    # ----------------------------------------------------------------------------------------------------------#
    def _configure_pn532(self) -> PN532_SPI:
        logger.info("Initializing PN532 (SPI)...")
        spi = busio.SPI(board.SCK, board.MOSI, board.MISO)
        cs = DigitalInOut(board.D8)
        pn532 = PN532_SPI(spi, cs, debug=False)
        ic, ver, rev, support = pn532.firmware_version
        logger.info("PN532 firmware %d.%d", ver, rev)
        pn532.SAM_configuration()
        return pn532

    # ----------------------------------------------------------------------------------------------------------#
    def wait_for_card(self, timeout: float | None = None) -> bytes:
        logger.info("Waiting for NFC card...")
        
        if not IS_RPI:
            # Simulation am PC: Warte kurz und gib eine Test-UID zurück
            time.sleep(1.5)
            # Eine statische Test-UID (z.B. deine Admin-UID)
            test_uid = bytes.fromhex("BE590000937D") 
            logger.info("SIMULATION: Card detected UID=%s", test_uid.hex())
            return test_uid

        start = time.time()
        while True:
            uid = self._pn532.read_passive_target(timeout=0.5)
            if uid:
                logger.info("Card detected UID=%s", uid.hex())
                return bytes(uid)
            if timeout and (time.time() - start) > timeout:
                raise TimeoutError("No NFC card detected")

    # ----------------------------------------------------------------------------------------------------------#
    def _authenticate(self, uid: bytes, block: int) -> bool:
        if not IS_RPI: return True
        return self._pn532.mifare_classic_authenticate_block(uid, block, 0x60, key=DEFAULT_KEY_A)

    # ----------------------------------------------------------------------------------------------------------#
    def read_block(self, uid: bytes, block: int) -> bytes | None:
        if not is_safe_data_block(block): return None
        if not self._authenticate(uid, block): return None
        
        if not IS_RPI: return bytes([0x44] * 16) # Dummy Daten
        return self._pn532.mifare_classic_read_block(block)

    # ----------------------------------------------------------------------------------------------------------#
    def read_all_blocks(self, uid: bytes) -> dict[int, bytes]:
        data = {}
        for block in range(BLOCK_COUNT):
            if not is_safe_data_block(block): continue
            block_data = self.read_block(uid, block)
            if block_data: data[block] = block_data
        return data

    # ----------------------------------------------------------------------------------------------------------#
    def write_block(self, uid: bytes, block: int, data: bytes) -> bool:
        if not is_safe_data_block(block): return False
        if len(data) != BLOCK_SIZE: raise ValueError("Requires 16 bytes")
        if not self._authenticate(uid, block): return False

        if not IS_RPI: 
            logger.info("SIMULATION: Wrote block %d", block)
            return True
        return self._pn532.mifare_classic_write_block(block, data)

