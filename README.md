# SmartHome Dashboard - Web-Based IoT Control Center

> **Status**
> 
> Dieses Projekt ist für den Einsatz auf einem **Raspberry Pi** konzipiert und dient als zentrale Steuerzentrale für ein lokales Smart Home Ökosystem.
> 
> *Hinweis: Diese Software steuert physische Hardware (Lichter, 3D-Drucker) und greift tief in Systemprozesse ein.*

Dieses Repository enthält den Quellcode für das **"SmartHome Dashboard"**. Die Webanwendung ermöglicht die zentrale Steuerung von BLE-Lichtsystemen, die Überwachung von 3D-Druckern (Bambu Lab), Raumklima-Analyse sowie komplexe, sensorbasierte Automatisierungen über eine moderne "Glassmorphism" Benutzeroberfläche.

## Inhaltsverzeichnis
1. [Installation](#installation)
2. [Ausführung](#ausführung)
3. [Bedienung des User Interface](#bedienung-des-user-interface)
4. [Umgesetzte Features](#umgesetzte-features)
5. [Softwarestruktur & Implementierung](#softwarestruktur--implementierung)
6. [Herausforderungen & Lösungen](#herausforderungen--lösungen)

---

## Installation

### Voraussetzungen
Stellen Sie sicher, dass folgende Hardware und Software vorhanden ist:
* **Raspberry Pi** (3B+ oder 4/5 empfohlen für BLE-Stabilität)
* **Python** (Version 3.9 oder neuer)
* **BlueZ** (Bluetooth Stack für Linux)
* Ein funktionierender MQTT Broker (für Sensoren/Drucker)

### Schritte

1. **Repository klonen**
   ```bash
   git clone [https://github.com/kunzechriz/smarthome.git](https://github.com/kunzechriz/smarthome.git)
   cd smarthome_ui
