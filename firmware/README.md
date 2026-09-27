# FlowSense ESP32 crowd sensor

`flowsense_sensor/` is the board's Arduino sketch. It counts nearby Bluetooth
devices and sends the count to FlowSense every 10 seconds over MQTT. Only the
count is sent, never the devices' addresses.

It replaces the handover sketch, which sent one fixed reading (density 0.85)
right after connecting and then nothing more, with a numeric `device_id` on a
`test` topic.

## 1. Set up the Arduino IDE (once)

1. Install Arduino IDE 2 (arduino.cc/en/software).
2. **File → Preferences → Additional boards manager URLs**:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. **Tools → Board → Boards Manager**: install **esp32 by Espressif Systems**.
4. **Sketch → Include Library → Manage Libraries**: install **PubSubClient**
   (Nick O'Leary) and **ArduinoJson** (Benoit Blanchon).

## 2. Configure

1. Copy `flowsense_sensor/secrets.example.h` to `flowsense_sensor/secrets.h`
   and fill in:
   - `WIFI_SSID` and `WIFI_PASSWORD`: a **2.4 GHz** network, the same one the
     laptop running FlowSense is on (a phone hotspot is the easiest).
   - `MQTT_SERVER`: the laptop's IP (PowerShell `ipconfig` → Wi-Fi →
     IPv4 Address).
   - `MQTT_USER` / `MQTT_PASSWORD`: the board's broker login
     (`flowsense_sensor_01`, whose password is in the team's handover; or a
     login you add, team setup guide 11.5).
   `secrets.h` is ignored by git.
2. In `flowsense_sensor.ino`, for each board: `DEVICE_ID` (unique text) and
   `TOPIC` (`flowsense/sensors/eya/<zone>`).

## 3. Upload

1. Plug the board in with a USB **data** cable. **Tools → Board → esp32 →
   ESP32 Dev Module**; **Tools → Port**: its COM port (none? install the
   CP210x or CH340 USB driver).
2. **Tools → Partition Scheme → Huge APP (3MB No OTA/1MB SPIFFS)**: Wi-Fi and
   Bluetooth together don't fit the default.
3. **Upload** (→). If it stalls at `Connecting...`, hold the board's **BOOT**
   button until it starts writing.
4. **Tools → Serial Monitor**, 115200 baud. You should see:

   ```
   Wi-Fi: connected, IP 192.168.x.x, MAC 24:6F:28:...
   MQTT: connecting to 192.168.x.x:1883 as flowsense_sensor_01 ... connected
   Sent flowsense/sensors/eya/lobby {"device_id":"esp32-eya-lobby-01",...}
   ```

## 4. Register it in FlowSense

1. On the laptop: `docker compose up -d`, then watch
   `docker compose logs -f mosquitto mqtt-consumer`: look for
   `Auto-discovered new hardware: esp32-eya-lobby-01`.
2. Dashboard → **Hardware Management**: the board is **Unregistered**. Click
   **Register**, sampling interval **10** seconds, building **EYA Building**,
   floor, and its map point if you like. It turns **Online**.
3. **Analytics**: crowd density, busiest locations and sensor reliability
   fill in from its readings.

## Troubleshooting (Serial Monitor)

| You see | Meaning |
|---|---|
| Dots, then `Wi-Fi: not connected yet` | Wrong Wi-Fi name or password, or a 5 GHz network |
| `MQTT ... failed (state -2)` | Can't reach the laptop: wrong IP, not the same network, or Windows Firewall port 1883 closed (team setup guide 11.2) |
| `MQTT ... failed (state 5)` | Wrong MQTT username or password |
| `Sent` lines, but nothing on the Hardware page | The consumer isn't running (`docker compose ps`), or the topic's building isn't the one the board is registered to |
| Online, then Offline | Readings stopped for 90 s: power, Wi-Fi range, or the laptop's IP changed |

## Calibrating

`signal_count` is the number of Bluetooth devices nearer than `RSSI_NEAR`
(-80 dBm). Phones change their Bluetooth addresses now and then, and
watches, earbuds and laptops count too, so it isn't a head count. At a busy
time, compare it with the people actually there and set `CAPACITY` (the
count that means "full", density 1.0) and `RSSI_NEAR` (raise it to count a
smaller area).
