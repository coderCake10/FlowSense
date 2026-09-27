/*
 * FlowSense crowd sensor (ESP32).
 *
 * Every REPORT_SECONDS it scans for nearby Bluetooth devices for
 * SCAN_SECONDS, counts the ones close enough (RSSI_NEAR), and sends the
 * count to FlowSense over MQTT:
 *
 *   topic   flowsense/sensors/<building>/<zone>      e.g. flowsense/sensors/eya/lobby
 *   payload {"device_id":"esp32-eya-lobby-01","device_type":"sensor",
 *            "mac_address":"<this board's MAC>","signal_count":12,
 *            "estimated_density":0.3,"signal_strength":-58}
 *
 * Only the COUNT of nearby devices is sent, never their addresses.
 *
 * Settings for your board are below; Wi-Fi and MQTT logins go in secrets.h
 * (copy secrets.example.h). Arduino IDE: board "ESP32 Dev Module",
 * Tools -> Partition Scheme -> "Huge APP (3MB No OTA/1MB SPIFFS)" (Wi-Fi and
 * Bluetooth together don't fit the default), Serial Monitor at 115200 baud.
 * Libraries: PubSubClient (Nick O'Leary), ArduinoJson (Benoit Blanchon).
 * See firmware/README.md.
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#include "secrets.h"

// ---- This board -----------------------------------------------------------
// A text ID, unique per board, that never changes (FlowSense lists the board
// by it). One board per zone.
const char* DEVICE_ID = "esp32-eya-lobby-01";
// Where it is: flowsense/sensors/<building code>/<zone>. The building code
// must be the one it's assigned to on the Hardware page (eya).
const char* TOPIC = "flowsense/sensors/eya/lobby";

// ---- Timing ---------------------------------------------------------------
// Register the board with this sampling interval on the Hardware page.
// FlowSense marks a board Offline after 90 s without a reading.
const uint32_t REPORT_SECONDS = 10;
const uint32_t SCAN_SECONDS = 5;

// ---- Counting -------------------------------------------------------------
// Devices weaker than this (dBm) are too far away to count: raise it
// (e.g. -70) to count a smaller area, lower it (-90) for a larger one.
const int RSSI_NEAR = -80;
// How many devices mean "full" here (density 1.0). Calibrate on site:
// compare signal_count with the people actually there at a busy time.
const int CAPACITY = 40;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
BLEScan* scanner = nullptr;
int nearbyCount = 0;
uint32_t lastReport = 0;

// Counts each device once per scan (duplicates are filtered by the scan).
class NearbyCounter : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice device) override {
    if (device.getRSSI() >= RSSI_NEAR) nearbyCount++;
  }
};

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Wi-Fi: connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - started > 20000) {
      // Wrong name or password, or a 5 GHz-only network: try again later.
      Serial.println("\nWi-Fi: not connected yet (check secrets.h, 2.4 GHz)");
      return;
    }
  }
  Serial.printf("\nWi-Fi: connected, IP %s, MAC %s\n",
                WiFi.localIP().toString().c_str(), WiFi.macAddress().c_str());
}

void connectMqtt() {
  if (mqtt.connected() || WiFi.status() != WL_CONNECTED) return;
  Serial.printf("MQTT: connecting to %s:%d as %s ... ", MQTT_SERVER, MQTT_PORT, MQTT_USER);
  if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD)) {
    Serial.println("connected");
  } else {
    // -2: can't reach the laptop (IP, firewall port 1883, same network?)
    //  5: wrong MQTT username or password
    Serial.printf("failed (state %d), retrying\n", mqtt.state());
  }
}

int countNearby() {
  nearbyCount = 0;
  scanner->start(SCAN_SECONDS, false);  // blocks for SCAN_SECONDS
  scanner->clearResults();              // free the scan's memory
  return nearbyCount;
}

void report() {
  int count = countNearby();
  float density = min(1.0f, (float)count / CAPACITY);

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["device_type"] = "sensor";
  doc["mac_address"] = WiFi.macAddress();
  doc["signal_count"] = count;
  doc["estimated_density"] = round(density * 1000) / 1000.0;
  doc["signal_strength"] = WiFi.RSSI();  // the board's own Wi-Fi signal

  char payload[256];
  serializeJson(doc, payload);
  bool sent = mqtt.publish(TOPIC, payload);
  Serial.printf("%s %s %s\n", sent ? "Sent" : "NOT sent", TOPIC, payload);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nFlowSense sensor starting");

  BLEDevice::init("");
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new NearbyCounter());
  scanner->setActiveScan(false);  // listen only; don't query phones
  scanner->setInterval(100);
  scanner->setWindow(99);

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setBufferSize(512);
  connectWiFi();
}

void loop() {
  connectWiFi();
  connectMqtt();
  mqtt.loop();

  if (mqtt.connected() && millis() - lastReport >= REPORT_SECONDS * 1000UL) {
    lastReport = millis();
    report();
  }
  delay(100);
}
