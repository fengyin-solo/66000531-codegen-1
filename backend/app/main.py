import asyncio, math, random, time, json, threading
from typing import Optional
from collections import defaultdict, deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

app = FastAPI(title="Digital Twin Factory Monitor")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DEVICE_TYPES = ["CNC", "RobotArm", "Conveyor", "AGV", "InjectionMolding", "QCStation"]
STATUSES = ["RUNNING", "IDLE", "FAULT", "OFFLINE"]
ACTIVE_CLIENTS: list[WebSocket] = []
SIMULATOR_RUNNING = True
MAIN_LOOP: Optional[asyncio.AbstractEventLoop] = None

# 班次按本地时间划分: 早班 00:00-08:00 / 中班 08:00-16:00 / 晚班 16:00-24:00
SHIFTS = [
    {"id": "morning", "name": "早班", "start_hour": 0, "end_hour": 8},
    {"id": "middle", "name": "中班", "start_hour": 8, "end_hour": 16},
    {"id": "night", "name": "晚班", "start_hour": 16, "end_hour": 24},
]

class DeviceState:
    def __init__(self, did: int, dtype: str, x: float, y: float, z: float):
        self.id = did
        self.type = dtype
        self.status = "RUNNING"
        self.position = [x, y, z]
        self.temperature = random.uniform(35, 45)
        self.vibration = random.uniform(0.1, 1.5)
        self.pressure = random.uniform(0.8, 1.2)
        self.production_count = 0
        self.fault_count = 0
        self.uptime = 0.0
        self.cycle_time = random.uniform(2, 8)
        self.quality_rate = random.uniform(0.95, 0.995)

    def to_dict(self):
        return {
            "id": self.id, "type": self.type, "status": self.status,
            "position": self.position, "temperature": round(self.temperature, 2),
            "vibration": round(self.vibration, 3), "pressure": round(self.pressure, 2),
            "production_count": self.production_count, "fault_count": self.fault_count,
            "uptime": round(self.uptime, 2), "quality_rate": round(self.quality_rate, 3)
        }

devices = {i: DeviceState(i, random.choice(DEVICE_TYPES),
                          random.uniform(-5, 5), 0.5, random.uniform(-5, 5)) for i in range(1, 13)}

production_log = []
anomaly_log = []

# ---- 班次运行态 ----
def today_str(now=None):
    return time.strftime("%Y-%m-%d", time.localtime(now or time.time()))

def current_shift_id(now=None):
    now = now or time.time()
    hour = time.localtime(now).tm_hour
    for s in SHIFTS:
        if s["start_hour"] <= hour < s["end_hour"]:
            return s["id"]
    return SHIFTS[-1]["id"]

def new_shift_records():
    return {s["id"]: {"id": s["id"], "name": s["name"],
                      "production": 0, "running_seconds": 0} for s in SHIFTS}

shift_date = today_str()
shift_records = new_shift_records()
line_status = "IDLE"
last_production_total = sum(d.production_count for d in devices.values())
running_streak_start: dict[str, float] = {}  # shift_id -> 本段连续运行起始时间戳

class AnomalyRules:
    def __init__(self):
        self.rules = [
            {"name": "高温告警", "field": "temperature", "threshold": 48, "op": "gt"},
            {"name": "振动超标", "field": "vibration", "threshold": 2.0, "op": "gt"},
            {"name": "压力异常", "field": "pressure", "threshold": 1.5, "op": "gt"},
        ]
        self.windows = defaultdict(lambda: deque(maxlen=10))

    def check(self, dev: DeviceState):
        triggers = []
        for rule in self.rules:
            val = getattr(dev, rule["field"])
            if (rule["op"] == "gt" and val > rule["threshold"]) or (rule["op"] == "lt" and val < rule["threshold"]):
                triggers.append({"device_id": dev.id, "rule": rule["name"],
                                 "value": round(val, 3), "threshold": rule["threshold"]})

        # sliding window trend
        key = f"{dev.id}_temp"
        self.windows[key].append(dev.temperature)
        if len(self.windows[key]) >= 8:
            vals = list(self.windows[key])
            if np.mean(vals[-4:]) - np.mean(vals[:4]) > 3:
                triggers.append({"device_id": dev.id, "rule": "温度趋势上升", "value": round(np.mean(vals[-4:]), 2), "threshold": ">3°C/周期"})

        if triggers:
            anomaly_log.append({"timestamp": time.time(), "triggers": triggers, "device_type": dev.type})
        return triggers

rules_engine = AnomalyRules()

def tick(now=None):
    """推进一个仿真周期(约1秒)，并更新当班的产线运行态与产量。"""
    global shift_date, shift_records, line_status, last_production_total, running_streak_start
    now = now or time.time()

    # 跨天重置各班次统计
    today = today_str(now)
    if today != shift_date:
        shift_date = today
        shift_records = new_shift_records()
        running_streak_start = {}

    for dev in devices.values():
        drift = 0.1 * math.sin(now * 0.5 + dev.id)
        noise = random.gauss(0, 0.3)
        dev.temperature = max(25, min(65, dev.temperature + drift + noise))

        v_drift = 0.02 * math.sin(now * 0.3 + dev.id * 0.7)
        dev.vibration = max(0, min(3, dev.vibration + v_drift + random.gauss(0, 0.05)))

        dev.pressure = max(0.5, min(2, dev.pressure + random.gauss(0, 0.02)))

        if random.random() < 0.015:
            dev.status = "FAULT"
            dev.fault_count += 1
        elif random.random() < 0.03 and dev.status == "FAULT":
            dev.status = "RUNNING"

        if dev.status == "RUNNING":
            if random.random() < 0.4:
                dev.production_count += 1
            dev.uptime += 1

        triggers = rules_engine.check(dev)
        if triggers and dev.status != "FAULT" and random.random() < 0.3:
            dev.status = "FAULT"

    total = sum(d.production_count for d in devices.values())
    delta = total - last_production_total
    last_production_total = total

    statuses = {d.status for d in devices.values()}
    if "RUNNING" in statuses:
        line_status = "RUNNING"
    elif "FAULT" in statuses:
        line_status = "FAULT"
    elif all(s == "OFFLINE" for s in statuses):
        line_status = "OFFLINE"
    else:
        line_status = "IDLE"

    sid = current_shift_id(now)
    # 产量按设备计数差值入账到当班；差值为权威值，重连/重复订阅都不会重复累加
    if delta > 0:
        shift_records[sid]["production"] += delta

    # 连续运行时长：按班次记录当前一段不间断 RUNNING 的起点
    if line_status == "RUNNING":
        if sid not in running_streak_start:
            running_streak_start[sid] = now
        shift_records[sid]["running_seconds"] = int(max(0, now - running_streak_start[sid]))
        # 跨班时本段运行在上一班结束、在当班从头计时
        for old_sid in list(running_streak_start.keys()):
            if old_sid != sid:
                del running_streak_start[old_sid]
    else:
        # 停止运行后时长冻结在上一段；故障恢复后重新从 0 计
        running_streak_start.pop(sid, None)

    production_log.append({"timestamp": now, "count": total})

    payload = {
        "devices": [d.to_dict() for d in devices.values()],
        "production": shift_records[sid]["production"],
        "line_status": line_status,
        "current_shift": sid,
        "shift_date": today,
        "shifts": [shift_records[s["id"]] for s in SHIFTS],
        "anomalies": anomaly_log[-5:] if anomaly_log else [],
        "oee": calculate_oee()
    }
    return json.dumps(payload)


def simulate():
    while SIMULATOR_RUNNING:
        try:
            msg = tick()
        except Exception:
            time.sleep(1)
            continue

        dead = []
        for ws in ACTIVE_CLIENTS:
            try:
                assert MAIN_LOOP is not None
                asyncio.run_coroutine_threadsafe(ws.send_text(msg), MAIN_LOOP)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in ACTIVE_CLIENTS:
                ACTIVE_CLIENTS.remove(ws)

        time.sleep(1)


def calculate_oee():
    oee_list = []
    for dev in devices.values():
        if dev.uptime == 0:
            continue
        availability = min(1.0, dev.uptime / max(1, dev.uptime + dev.fault_count))
        performance = min(1.0, dev.production_count / max(1, dev.uptime / 2))
        quality = dev.quality_rate
        oee = round(availability * performance * quality * 100, 1)
        oee_list.append({"id": dev.id, "type": dev.type, "oee": oee,
                         "availability": round(availability * 100, 1),
                         "performance": round(performance * 100, 1),
                         "quality": round(quality * 100, 1)})
    return oee_list


class OEEAnalysis(BaseModel):
    availability: float
    performance: float
    quality: float


@app.on_event("startup")
async def startup():
    global MAIN_LOOP
    MAIN_LOOP = asyncio.get_event_loop()
    t = threading.Thread(target=simulate, daemon=True)
    t.start()


@app.get("/api/devices")
def get_devices():
    return {"devices": [d.to_dict() for d in devices.values()], "anomalies": anomaly_log[-10:]}


@app.get("/api/oee")
def get_oee():
    return {"oee": calculate_oee()}


@app.get("/api/production")
def get_production():
    return {"log": production_log[-60:]}


@app.get("/api/line")
def get_line():
    return {
        "date": shift_date,
        "current_shift": current_shift_id(),
        "line_status": line_status,
        "shifts": [shift_records[s["id"]] for s in SHIFTS],
    }


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    ACTIVE_CLIENTS.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in ACTIVE_CLIENTS:
            ACTIVE_CLIENTS.remove(websocket)


@app.on_event("shutdown")
async def shutdown():
    global SIMULATOR_RUNNING
    SIMULATOR_RUNNING = False