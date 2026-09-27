// Copy this file to secrets.h (same folder) and fill it in.
// secrets.h is ignored by git: never commit or share it.
#pragma once

// Wi-Fi: 2.4 GHz only (on an iPhone hotspot, turn on Maximize Compatibility).
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// The laptop running FlowSense (PowerShell: ipconfig -> Wi-Fi -> IPv4 Address).
// It can change when you reconnect: check it before each demo.
#define MQTT_SERVER "192.168.1.10"
#define MQTT_PORT 1883

// The board's login on FlowSense's Mosquitto broker.
#define MQTT_USER "flowsense_sensor_01"
#define MQTT_PASSWORD "your-mqtt-password"
