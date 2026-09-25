# FlowSense: local setup for team members

This guide sets up the whole FlowSense system on your own Windows laptop, from
nothing to a working kiosk, admin dashboard and 3D map. Follow it top to
bottom the first time; after that, section 12 is all you need day to day.

Updated 2026-09-25. It covers the system as it is on the `main` branch after
step 8b (the 3D kiosk map, kiosk search, and Map Annotation on the real model).

---

## Contents

1. [What you are setting up](#1-what-you-are-setting-up)
2. [Before you start](#2-before-you-start)
3. [Install WSL (Linux inside Windows)](#3-install-wsl-linux-inside-windows)
4. [Install Docker Desktop](#4-install-docker-desktop)
5. [Get the code](#5-get-the-code)
6. [Start FlowSense](#6-start-flowsense)
7. [Sign in to the admin dashboard](#7-sign-in-to-the-admin-dashboard)
8. [Check that everything works](#8-check-that-everything-works)
9. [Look inside the database (optional)](#9-look-inside-the-database-optional)
10. [Put rooms on the map (Map Annotation)](#10-put-rooms-on-the-map-map-annotation)
11. [Use other devices: iPad kiosk, phones, ESP32](#11-use-other-devices-ipad-kiosk-phones-esp32)
12. [Every day: start, stop, update](#12-every-day-start-stop-update)
13. [Working on the code without Docker (developers)](#13-working-on-the-code-without-docker-developers)
14. [Troubleshooting](#14-troubleshooting)
15. [Team rules](#15-team-rules)
16. [Checklist](#16-checklist)

---

## 1. What you are setting up

One laptop runs every part of FlowSense in Docker containers. Other devices
(the iPad kiosk, phones, the ESP32 sensor) connect to that laptop over the
same Wi-Fi or phone hotspot.

```
 ESP32 sensor ──Wi-Fi──► Mosquitto (MQTT) :1883 ──► mqtt-consumer ──► PostgreSQL + PostGIS
                                                                          ▲
 iPad kiosk ──Wi-Fi──► Nginx :80 ──► frontend (kiosk, dashboard) ──► Django API :8000
 Laptop browser (admin dashboard) ─┘                                      │
 Phone (scans the kiosk's QR code) ─┘                    Redis ◄── Celery (emails, scheduled jobs)
```

| Container | What it does |
|---|---|
| `db` | PostgreSQL 16 with PostGIS: all FlowSense data |
| `backend` | The Django API |
| `frontend` | The web app: kiosk, attract screen, admin dashboard, phone page |
| `nginx` | Serves everything at `http://localhost` (port 80) |
| `mosquitto` | MQTT broker the ESP32 sensors send readings to |
| `mqtt-consumer` | Reads sensor messages and saves them |
| `redis` | Queue and cache for the background jobs |
| `celery-worker`, `celery-beat` | Sign-in emails and scheduled jobs (offline checks, alerts) |
| `swagger-ui` | The API reference at `http://localhost/docs/` |

You don't install PostgreSQL, Python or Node yourself for this. Docker
brings them. (Section 13 covers running without Docker, for developers who
want to run the tests.)

---

## 2. Before you start

You need:

- **A Windows 10 (22H2) or Windows 11 laptop** with at least **8 GB of RAM**
  (16 GB is more comfortable) and **about 20 GB free** on drive C.
- **Virtualization turned on** in the BIOS. Check in Task Manager →
  Performance → CPU: *Virtualization: Enabled*. If it says Disabled, turn on
  "Intel VT-x" or "AMD-V / SVM" in the BIOS setup.
- **A GitHub account with access to the repository.**
  `Wendy-Calma/CAPSTONE-FLOWSENSE` is private: send your GitHub username to
  the repository owner, who adds you as a collaborator. Accept the invitation
  email (or the notice at https://github.com/notifications) before section 5.
- **Internet for the first setup** (Docker downloads about 2–3 GB of images
  once). After that, FlowSense runs without internet.
- About **1–2 hours** the first time, mostly downloads.

Words used in this guide:

- **PowerShell**: the Windows terminal. Right-click the Start button →
  *Terminal (Admin)* or *Windows PowerShell (Admin)* when it says "as
  administrator".
- **Ubuntu terminal**: the Linux terminal from WSL (section 3). Open
  **Ubuntu** from the Start menu. Every grey command block marked `bash` runs
  here, **not** in PowerShell.
- `<you>` means your own Linux username, and `<PC-IP>` your laptop's Wi-Fi IP
  address (section 11.1).

> **Type each command as one line.** Where a command is long it still goes on
> one line. If you ever see a `>>>` prompt, you've opened Python by accident:
> type `exit()` and press Enter, then retype the whole command on one line.

---

## 3. Install WSL (Linux inside Windows)

FlowSense runs in Linux. WSL 2 gives Windows a real Linux system.

1. Open **PowerShell as administrator** and run:

   ```powershell
   wsl --install -d Ubuntu-24.04
   ```

   Ubuntu 24.04 or newer works (the team has used 24.04 and 26.04).

2. **Restart Windows** when asked.
3. After the restart, the **Ubuntu** window opens (or open it from the Start
   menu). Wait for the install to finish, then create your Linux **username**
   and **password**. The password doesn't show while you type; that's normal.
   Remember it: `sudo` commands ask for it.
4. Back in PowerShell, check it's WSL version 2:

   ```powershell
   wsl --list --verbose
   ```

   The `VERSION` column must say `2`. If it says `1`, run
   `wsl --set-version Ubuntu-24.04 2`.
5. In the Ubuntu terminal, update Linux and install git:

   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl
   ```

**Where your Linux files are.** In File Explorer, the Linux home folder is at
`\\wsl.localhost\Ubuntu-24.04\home\<you>` (it's also under **Linux** in the
left panel). In the Ubuntu terminal, the same folder is `~`.

---

## 4. Install Docker Desktop

1. Download **Docker Desktop for Windows** from
   https://docs.docker.com/desktop/setup/install/windows-install/ and run the
   installer. Keep **"Use WSL 2 instead of Hyper-V"** ticked.
2. Restart Windows if asked, then open **Docker Desktop** and let it start
   (the whale icon in the taskbar stops animating). You can skip signing in.
3. Connect Docker to Ubuntu: Docker Desktop → **Settings (gear) → Resources →
   WSL integration** → turn on **Ubuntu-24.04** (your Ubuntu) → **Apply &
   restart**.
4. **Close and reopen** the Ubuntu terminal, then check:

   ```bash
   docker --version
   docker compose version
   docker run --rm hello-world
   ```

   The last one prints "Hello from Docker!". If Ubuntu says
   `docker: command not found`, step 3 isn't done (see section 14).

5. **If you have PostgreSQL installed on Windows** (for example from a
   database class), stop it so it doesn't block port 5432: press Win+R, type
   `services.msc`, find **postgresql-x64-…**, right-click → **Stop**, then
   double-click it → **Startup type: Manual**.

---

## 5. Get the code

Keep the project **inside Linux** (in `~`), not on drive C: it's much faster
there, and Docker expects it.

### 5.1 Let git sign in to GitHub

The repository is private, so git needs to prove who you are. The simplest
way is a **personal access token**:

1. On GitHub: your picture → **Settings → Developer settings → Personal
   access tokens → Tokens (classic) → Generate new token (classic)**.
2. Note: `FlowSense laptop`. Expiration: until the end of the semester.
   Scope: tick **`repo`**. Click **Generate token** and copy it (it's shown
   only once).
3. In the Ubuntu terminal, tell git to remember it after the first use:

   ```bash
   git config --global credential.helper store
   git config --global user.name "Your Name"
   git config --global user.email "your-github-email@example.com"
   ```

### 5.2 Clone

```bash
cd ~
git clone https://github.com/Wendy-Calma/CAPSTONE-FLOWSENSE.git
```

When git asks: **Username** = your GitHub username, **Password** = the token
from 5.1 (not your GitHub password). Then:

```bash
cd ~/CAPSTONE-FLOWSENSE/FlowSense
ls
```

You should see `backend`, `frontend`, `docs`, `docker-compose.yml` and more.
Folder names are case-sensitive in Linux: it's `FlowSense`, not `flowsense`.

### 5.3 Optional: GitHub Desktop

If you prefer GitHub Desktop for pulling and committing:

1. **File → Add local repository**.
2. In the folder picker's address bar, type
   `\\wsl.localhost\Ubuntu-24.04\home\<you>\CAPSTONE-FLOWSENSE` and press
   Enter, then **Select folder**.
3. If it says the folder "is not a Git repository" or mentions unsafe
   ownership, run this once in PowerShell (not Ubuntu), then try again:

   ```powershell
   git config --global --add safe.directory '%(prefix)///wsl.localhost/Ubuntu-24.04/home/<you>/CAPSTONE-FLOWSENSE'
   ```

---

## 6. Start FlowSense

All commands in this section run in the Ubuntu terminal, in the project
folder:

```bash
cd ~/CAPSTONE-FLOWSENSE/FlowSense
```

### 6.1 Create your settings file

```bash
cp -n .env.example .env
```

`.env` holds local settings and passwords. It's git-ignored: **never commit
it**. For your own laptop you don't need to change anything in it.

### 6.2 Build and start the containers

Docker Desktop must be running.

```bash
docker compose up -d --build
```

The first time takes 5–15 minutes (downloads and builds). Then check:

```bash
docker compose ps
```

All services should say `running` (the database also `healthy`). If one says
`exited` or keeps restarting, see section 14.

### 6.3 Create the database tables and load the EYA Building

Run these **one line at a time**, each exactly as written:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_campus
docker compose exec backend python manage.py seed_eya_routes
```

| Command | What it does | Expected output (last line) |
|---|---|---|
| `migrate` | Creates every schema, table, constraint and index | `Applying …  OK` lines, or `No migrations to apply.` |
| `seed_campus` | Loads the AUF campus, the EYA Building, its 6 floors and 92 rooms | `EYA Building seeded: …` |
| `seed_eya_routes` | Loads the first floor's starter routes (kiosk → EA-101A, EA-110, EA-111) | `EYA starter routes: 9 nodes, 8 edges.` |

All three are safe to run again at any time.

### 6.4 Create your admin account

Use your own AUF email:

```bash
docker compose exec backend python manage.py create_admin --email yourname@auf.edu.ph --name "Your Name" --role "super admin"
```

Write `--role "super admin"` exactly like that: two dashes, a space, then the
role in quotes.

> `createsuperuser` is a different thing (the Django `/admin/` back office).
> It is **not** a FlowSense dashboard login. You don't need it.

---

## 7. Sign in to the admin dashboard

1. Open **http://localhost/auth** in your browser. Use `http://localhost`
   (port 80, through Nginx). `http://localhost:3000` also works but isn't
   the normal address.
2. Enter the email from 6.4 → **Send sign-in code**.
3. Get the 6-digit code. On a team laptop, emails aren't really sent; they
   print in the logs. In the Ubuntu terminal:

   ```bash
   docker compose logs --tail=60 celery-worker backend | grep -i "code"
   ```

   Look for `Your FlowSense login code is: 123456`. (Or watch live with
   `docker compose logs -f celery-worker` and press Ctrl+C to stop
   watching.)
4. Type the code → **Verify and sign in**. You land on the dashboard.

Codes expire after 10 minutes. You get **10 tries per hour per email**; if
you're told to wait, wait, or use another admin account.

**Real emails** go through the project Gmail account. Its app password is
private: only add it if the repository owner gives it to you directly, and
only in your own `.env` (never in `.env.example`, a commit, a screenshot or
a group chat). Locally, reading the code from the logs is enough.

---

## 8. Check that everything works

| Open | You should see |
|---|---|
| http://localhost/attraction | The attract screen: the 3D EYA Building turning slowly. It stays until you tap. |
| http://localhost/kiosk | The kiosk. The map opens on the whole building. Tap it: the outside lifts away and the first floor shows. |
| On the kiosk, the list on the left | "92 Destinations · by floor". Type `computer studies`: EA-110 and EA-111 come first. |
| On the kiosk, pick **EA-110** | A blue route with moving gold arrows from "You are here" to EA-110. |
| On the kiosk, pick **EA-305** (3rd floor) | The map switches to 3F and says the room isn't on the map yet. That's expected until someone places it (section 10). |
| http://localhost/ (signed in) | The admin dashboard |
| **Map Annotation** in the sidebar | The 3D EYA model, floor buttons 1F–6F, Top down / Isometric |
| **Hardware Management** | The device registry. Opening the kiosk page registers this browser as an **Unregistered** kiosk within 30 s. |
| **Analytics** | After a few kiosk searches, the search section shows them |
| http://localhost/docs/ | The API reference (Swagger) |

The first time, the 3D model takes a few seconds to load (16.5 MB); after
that the browser caches it.

---

## 9. Look inside the database (optional)

To browse tables like in phpMyAdmin, use **HeidiSQL** (free, Windows):

1. Install it from https://www.heidisql.com/download.php.
2. **New** session:

   | Setting | Value |
   |---|---|
   | Network type | **PostgreSQL (TCP/IP)** |
   | Library | **libpq-17.dll** (or whichever `libpq` is listed) |
   | Hostname / IP | `127.0.0.1` |
   | User | `flowsense` |
   | Password | `flowsense_postgres` (from `DB_PASSWORD` in `.env`) |
   | Port | `5432` |
   | Database | `flowsense` |

3. **Open**. FlowSense data is grouped in schemas: `campus` (areas, floors,
   rooms), `navigation` (nodes, edges), `hardware` (devices, sensors,
   readings), `operations` (admins, settings), `analytics` (searches, routes,
   alerts), `assets`.

Look, but **don't edit rows by hand**: use the dashboard or the commands in
this guide, so the app's rules and audit log stay correct.

---

## 10. Put rooms on the map (Map Annotation)

Only 3 of the 92 rooms have routes after setup (the starter routes). Every
other room gets one once someone places its door and the corridors leading
to it in **Map Annotation**. The full guide is
[`docs/setup/map-annotation.md`](map-annotation.md). In short:

1. Dashboard → **Map Annotation**. Pick a floor. **Top down** is easiest.
2. **Corridor point**: click along the middle of the corridors in walking
   order. Each point connects to the previous one. Click an existing point
   to continue from it.
3. In **Rooms on this floor**, click a room, then click the corridor side of
   its door. The room gets a green tick.
4. At stairs and elevators, place a point, then use **Stairs / elevator**:
   click the point on this floor, switch floors, click the matching point.
5. Every change saves immediately ("All changes saved").
6. On the kiosk, choose the room: its route appears, across floors if
   needed ("Go to 3F").

**Important for the team:** each laptop has its **own database**. What you
annotate on your laptop stays on your laptop. Agree on **one laptop** (the
demo laptop) where the real annotation is done.

---

## 11. Use other devices: iPad kiosk, phones, ESP32

### 11.1 Same network, and your laptop's IP

- Put the laptop and every device on the **same Wi-Fi or phone hotspot**.
  Campus Wi-Fi usually blocks devices from seeing each other; a **phone
  hotspot** is the reliable choice for demos.
- The **ESP32 only works on 2.4 GHz**. On an iPhone hotspot, turn on
  **Maximize Compatibility**.
- Find the laptop's IP: in **PowerShell** run `ipconfig`. Under **Wireless
  LAN adapter Wi-Fi**, the **IPv4 Address** (for example `192.168.43.120`) is
  your `<PC-IP>`. Ignore the `vEthernet (WSL)` address.
- The IP can change when you reconnect. Check it again before each demo.

### 11.2 Let devices through Windows Firewall (once)

1. Settings → Network & internet → Wi-Fi → your network → **Network profile
   type: Private**. (Do this for the hotspot too.)
2. **PowerShell as administrator**:

   ```powershell
   New-NetFirewallRule -DisplayName "FlowSense" -Direction Inbound -Protocol TCP -LocalPort 80,1883 -Action Allow -Profile Private
   ```

   Port 80 is the website, 1883 the ESP32's MQTT. Don't open 5432 or 8000.
3. Test from the laptop first: open `http://<PC-IP>/kiosk` in the laptop's
   browser. If that works, other devices can use the same address.

### 11.3 iPad (or any tablet) as the kiosk

1. In Safari, open `http://<PC-IP>/attraction`.
2. It appears on **Hardware Management** as an **Unregistered** kiosk within
   30 seconds. The attract screen shows its ID (`kiosk-…`) in small print.
   Click **Register**, give it a name (for example *EYA Lobby Kiosk*) and
   save. It turns **Online**. Visitor sessions then count on the dashboard.
3. For a kiosk feel:
   - **Settings → Display & Brightness → Auto-Lock → Never**, and keep it
     charging.
   - **Guided Access** (Settings → Accessibility → Guided Access, set a
     passcode), then triple-click the side/Home button in Safari to lock the
     iPad to the kiosk.
   - Use a normal Safari tab, not Private (the kiosk ID is stored in Safari).
4. Signing in to the **admin dashboard from another device** (not the kiosk
   itself) over `http://<PC-IP>` needs this in `.env`, then
   `docker compose up -d`:

   ```env
   ADMIN_SESSION_COOKIE_SECURE=False
   FLOWSENSE_ADMIN_BASE_URL=http://<PC-IP>
   ```

### 11.4 Phones (QR handoff)

1. On the kiosk, pick one or more destinations → **Navigate**. The queue
   window shows a QR code.
2. Scan it with a phone on the same network. The phone opens the stop list
   (`/mobile`). The QR is valid for 15 minutes.
3. The QR contains the address the kiosk was opened with. Open the kiosk by
   `<PC-IP>`, never `localhost`, or phones can't open the link.

### 11.5 ESP32 sensor

The team's firmware is built with the **Arduino IDE**. For it to join
FlowSense:

| In the firmware | Must be |
|---|---|
| MQTT server | `<PC-IP>`, port `1883` |
| MQTT username / password | `flowsense_sensor_01` / its password (ask the backend owner; or create your own below) |
| `device_id` | A **text** ID, unique per board and never changing, e.g. `"esp32-eya-lobby-01"` (not a number like `1`) |
| Topic | `flowsense/sensors/eya/<zone>`, e.g. `flowsense/sensors/eya/lobby` |
| Publishing | **Every 30 s or faster**, in `loop()` on a timer, not only once after connecting. Otherwise the sensor shows Offline after 90 s. |
| Payload | JSON with `device_id`, `device_type: "sensor"`, `mac_address` (the ESP32's own), and optionally `signal_count`, `estimated_density` (0–1), `battery_level`, `signal_strength` |
| Wi-Fi and passwords | In a `secrets.h` that is **not** committed or shared |

Never send visitors' Bluetooth addresses: only the **count** of nearby
devices.

To add your own MQTT login for a board:

```bash
docker compose exec mosquitto mosquitto_passwd -b /mosquitto/config/passwd esp32_eya_lobby_01 'a-long-password'
docker compose restart mosquitto
```

Don't commit `backend/mosquitto/config/passwd` after adding logins.

To watch it connect and send:

```bash
docker compose logs -f mosquitto mqtt-consumer
```

Look for `New client connected … u'esp32_…'`, then
`Auto-discovered new hardware: esp32-eya-lobby-01`. The board appears on
**Hardware Management** as **Unregistered**: click **Register**, set the
sampling interval (seconds, matching the firmware), and optionally a
building and floor. From then on its readings are saved and it shows
**Online**.

No ESP32 at hand? Pretend to be one (install the client once with
`sudo apt install -y mosquitto-clients`):

```bash
mosquitto_pub -h 127.0.0.1 -u flowsense_backend -P backend -t flowsense/sensors/eya/lobby -m '{"device_id":"esp32-test-01","device_type":"sensor","mac_address":"24:6F:28:AA:BB:01","signal_count":12,"estimated_density":0.4}'
```

---

## 12. Every day: start, stop, update

**Start** (open Docker Desktop first):

```bash
cd ~/CAPSTONE-FLOWSENSE/FlowSense
docker compose up -d
```

**Stop** (keeps all data):

```bash
docker compose stop
```

**After a power cut or restart:** nothing is lost. Open Docker Desktop, then
`docker compose up -d`.

**Get the latest code** (after a pull request is merged into `main`):

```bash
cd ~/CAPSTONE-FLOWSENSE
git switch main
git pull
cd FlowSense
docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_campus
docker compose exec backend python manage.py seed_eya_routes
```

Then hard-refresh the browser (**Ctrl+Shift+R**).

**Look at logs** when something misbehaves:

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs -f frontend
```

> **Never run `docker compose down -v`.** The `-v` deletes the database
> volume: all data, admins and annotation, gone. `docker compose down`
> (without `-v`) is safe but usually unnecessary; use `stop`.

---

## 13. Working on the code without Docker (developers)

Docker is enough to run and demo FlowSense. If you change backend or
frontend code and want to run the tests, install the tools in Ubuntu too.

### 13.1 Frontend (Node 22)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
cd ~/CAPSTONE-FLOWSENSE/FlowSense/frontend
npm ci
npm run check        # TypeScript: no errors
npm test             # unit tests: 71 passed
npm run models:check # OK EYA.glb (16.5 MB) and the Draco decoder
```

Use `npm ci` (exact versions from `package-lock.json`). Only use
`npm install <package>` when you mean to add a package, and commit the
updated `package-lock.json`. The project uses **npm**, not pnpm or yarn.

With Docker running, the frontend container already picks up your edits
(hot reload). You only need Node for the checks and tests.

### 13.2 Backend tests (Python + PostgreSQL in Ubuntu)

The backend tests need a PostGIS database the test runner can create.
With Docker running, the `db` container works for this:

```bash
sudo apt install -y python3-venv python3-dev gdal-bin libgdal-dev
cd ~/CAPSTONE-FLOWSENSE/FlowSense/backend/django
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
POSTGRES_USER=flowsense POSTGRES_PASSWORD=flowsense_postgres POSTGRES_HOST=127.0.0.1 python manage.py test --noinput
```

Expected: `Ran 113 tests … OK`. (Or simply run them in the container:
`docker compose exec backend python manage.py test --noinput`.)

### 13.3 Where things are

| Path | What |
|---|---|
| `backend/django/apps/` | Django apps: `map`, `navigation`, `search`, `annotation`, `hardware`, `analytics`, `authentication`, `fs_sessions`, `assets` |
| `frontend/client/src/pages/` | Screens: `experience/` (kiosk, attract, phone, sign-in), `workspaces/` (dashboard pages) |
| `frontend/client/src/components/map/` | The 3D map (model, camera, routes, annotation canvas) |
| `frontend/client/public/models/EYA.glb` | The compressed kiosk model |
| `docs/openapi/flowsense-openapi.yaml` | The API contract |
| `docs/changes/`, `docs/qa/` | A change record and a test report for every step; `qa/qa-tracker.md` lists every finding |
| `docs/setup/` | This guide, the models guide, the Map Annotation guide |

---

## 14. Troubleshooting

### Setup

| Problem | Fix |
|---|---|
| `docker: command not found` in Ubuntu | Docker Desktop → Settings → Resources → **WSL integration** → turn on your Ubuntu → Apply & restart, then reopen the Ubuntu terminal. Docker Desktop must be running. |
| `cd: no such file or directory` | Names are case-sensitive: `cd ~/CAPSTONE-FLOWSENSE/FlowSense` |
| `>>>` appears after a `docker compose exec …` command | The command was split. Type `exit()`, then retype it on **one line**. |
| `SyntaxError` after typing `manage.py …` | Same as above: you were inside Python. |
| `git clone` asks for a password and fails | Use your **token** (5.1) as the password, and make sure you accepted the collaborator invite. |
| `unrecognized arguments` from `create_admin` | Write `--role "super admin"` with two dashes and quotes. |

### Containers and database

| Problem | Fix |
|---|---|
| `db` won't start, or "port 5432 is already allocated" | Windows PostgreSQL is running: stop it in `services.msc` (4.5). |
| "port 80 is already allocated" | Another web server (IIS, Skype, XAMPP) uses port 80. Stop it, or use `http://localhost:3000` meanwhile. |
| A container keeps restarting | `docker compose logs --tail=100 <name>` shows why. Often the database wasn't ready yet: `docker compose restart backend`. |
| Errors mentioning a missing table or column after a pull | `docker compose exec backend python manage.py migrate` |
| The page looks old after a pull | `docker compose up -d --build`, then Ctrl+Shift+R in the browser |
| Docker Desktop is very slow / uses all memory | Close other apps; in Docker Desktop → Settings → Resources, lower the memory only if you have 16 GB or more. |

### Sign-in

| Problem | Fix |
|---|---|
| "We couldn't reach the sign-in service" | Open `http://localhost/auth` (not a file or another port). Check `docker compose ps` shows `backend` running. |
| No code in the logs | `docker compose logs --tail=100 celery-worker` (emails are sent by the worker). Is `celery-worker` running? |
| Code accepted, but you're sent back to sign-in | You're on `http://<PC-IP>`: set `ADMIN_SESSION_COOKIE_SECURE=False` in `.env` (11.3) and `docker compose up -d`. |
| "Too many attempts" | The sign-in rate limit: wait (10 codes per hour per email). |

### Kiosk and map

| Problem | Fix |
|---|---|
| The map says it isn't available | `npm run models:check` (13.1), or check `frontend/client/public/models/EYA.glb` exists (it comes with the repo). |
| A room has no route ("isn't on the map yet") | Expected until its door and corridors are placed in Map Annotation (section 10). |
| EA-101A/EA-110/EA-111 have no route | Run `seed_eya_routes` (6.3). |
| "No walkway on the map reaches this room yet" | The door is placed but not connected to the corridors: connect it in Map Annotation. |
| The kiosk list shows only 3 destinations | The frontend isn't talking to the API. Use `http://localhost/kiosk`, and check `backend` is running. |
| The 3D map is slow | Close other tabs/apps. The map only redraws while something moves; laptops without a graphics card are slower. |

### Other devices

| Problem | Fix |
|---|---|
| The iPad or phone can't open `http://<PC-IP>/…` | Same Wi-Fi/hotspot? Network set to **Private**, firewall rule added (11.2)? Test the address on the laptop first. |
| The QR opens `localhost` on the phone | Open the kiosk by `http://<PC-IP>/…`, not `localhost`. |
| The ESP32 doesn't connect | 2.4 GHz network? Server IP = current `<PC-IP>`? Port 1883 allowed (11.2)? `docker compose logs -f mosquitto` shows `not authorised` for a wrong login. |
| The sensor connects but nothing is saved | Register it on Hardware Management first. After a building is set, the topic must say `eya`. |
| The sensor shows Offline | It must publish at least every 30 s (11.5). |

---

## 15. Team rules

- **Never commit** `.env`, passwords, the Gmail app password, `secrets.h`, or
  sensor logins. `.env.example` is public: it only holds placeholders.
- Work on a **branch**, open a **pull request** into `main`; the repository
  owner merges.
- Don't push to `coderCake10/FlowSense` (read-only for this project).
- Keep new tools and libraries inside the agreed tech stack. If something
  new seems needed, ask the team first.
- The 3D models: the team's `.blend` files stay on the shared Drive; only the
  compressed kiosk `.glb` goes in git (see
  [`building-models.md`](building-models.md)).
- Annotate on the demo laptop only, so the real map data lives in one place.

---

## 16. Checklist

Setup:
- [ ] WSL 2 with Ubuntu; `wsl --list --verbose` shows version 2
- [ ] Docker Desktop running; `docker run --rm hello-world` works in Ubuntu
- [ ] Repository cloned into `~/CAPSTONE-FLOWSENSE`
- [ ] `.env` created from `.env.example`
- [ ] `docker compose up -d --build`; `docker compose ps` all running
- [ ] `migrate`, `seed_campus`, `seed_eya_routes`, `create_admin` succeeded

Working:
- [ ] Signed in at `http://localhost/auth` with the code from the logs
- [ ] Kiosk lists 92 destinations; EA-110 shows a route with moving arrows
- [ ] Attract screen shows the 3D building and waits for a tap
- [ ] Map Annotation shows the 3D model with floors 1F–6F

Devices (demo laptop):
- [ ] Firewall rule for ports 80 and 1883; network set to Private
- [ ] iPad opens `http://<PC-IP>/attraction` and is registered on Hardware Management
- [ ] A phone scans the kiosk QR and opens the stop list
- [ ] ESP32 (or `mosquitto_pub` test) discovered, registered, and Online
