# server.py
import os
import uuid
import json
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pothole_processor import process_frame
import asyncio
import base64
from fastapi import Depends
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, init_db
from models import Frame

# auth router
from auth import router as auth_router
from jose import jwt, JWTError

app = FastAPI(title="LiveStreamGPS Receiver")

# allow connections (dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# storage dir
STORAGE_DIR = os.getenv("STORAGE_DIR", "/app/storage/frames")
os.makedirs(STORAGE_DIR, exist_ok=True)

# latest metadata for viewer
latest_meta = {
    "timestamp": None,
    "lat": None,
    "lon": None,
    "accuracy": None,
    "frame_b64": None,   # base64 image for viewer
    "file_path": None,
    "id": None
}

# JWT config (keep same SECRET_KEY as auth.py)
SECRET_KEY = "1e6f2130f17354bdf1c9ff2b07dfe5f05d8cb9d9840676b7033a665369717639"  # <-- Replace for production (use env var)
ALGORITHM = "HS256"

# include auth routes (register/login)
app.include_router(auth_router)


# create tables at startup
@app.on_event("startup")
async def on_startup():
    await init_db()
    print("✅ DB initialized")

    # Run migrations automatically
    try:
        from migrate_add_pothole_area import run_migration
        from database import engine
        await run_migration(engine)
    except Exception as e:
        print(f"⚠️  Migration warning: {e}")


# Simple viewer page (single page that polls /frame json)
@app.get("/", response_class=HTMLResponse)
def viewer_page():
    return """
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>LiveStreamGPS Viewer</title>
<style>
  body{background:#0b0b0b;color:#fff;font-family:monospace;text-align:center}
  #img{max-width:80vw;border-radius:8px;margin-top:12px}
  #meta{margin-top:12px}
  pre{white-space:pre-wrap; text-align:left; max-width:80vw; margin:auto}
</style>
</head>
<body>
<h2>iPhone Live Feed</h2>
<img id="img" />
<pre id="meta">No frame yet</pre>
<script>
async function update(){
  try {
    const r = await fetch('/frame');
    const j = await r.json();
    if(j.frame_b64){
      document.getElementById('img').src = "data:image/jpeg;base64," + j.frame_b64;
      document.getElementById('meta').innerText =
        "Timestamp: " + j.timestamp + "\\n" +
        "Latitude:  " + j.lat + "\\n" +
        "Longitude: " + j.lon + "\\n" +
        "Accuracy: " + j.accuracy + "\\n" +
        "File: " + j.file_path + "\\n" +
        "ID: " + j.id;
    }
  } catch (e) {
    console.warn("viewer update error", e);
  }
}
setInterval(update, 500);
update();
</script>
</body>
</html>
"""


@app.get("/frame")
def get_frame():
    # Return JSON describing last frame. frame_b64 is included.
    return JSONResponse(latest_meta)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    """
    Accepts TEXT frames only. Each frame is a JSON string with at least:
      { "timestamp": "...", "lat": 12.34, "lon": 56.78, "image": "<base64 jpeg>" }
    The server will decode base64, write JPEG file, and insert DB record.
    """
    # Validate token from query params before accepting
    token = ws.query_params.get("token")
    if not token:
        # Close immediately: client did not provide token
        try:
            await ws.close(code=1008)  # policy violation
        except Exception:
            pass
        print("🔒 WS connection rejected (no token)")
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        if not user_email:
            raise JWTError("missing subject")
    except JWTError as e:
        print("🔒 WS token invalid:", e)
        try:
            await ws.close(code=1008)
        except Exception:
            pass
        return

    # token ok — accept now
    await ws.accept()
    print(f"📲 Authenticated iPhone connected: {user_email}")
    try:
        while True:
            msg = await ws.receive_text()  # expect text frames only
            # msg is JSON string
            try:
                data = json.loads(msg)
            except Exception as e:
                print("⚠️ invalid json frame:", e)
                continue

            # Validate & extract required fields
            img_b64 = data.get("image") or data.get("frame")  # accept both keys
            if not img_b64:
                print("⚠️ missing 'image' in frame")
                continue

            # decode base64 safely
            try:
                img_bytes = base64.b64decode(img_b64)
            except Exception as e:
                print("⚠️ base64 decode failed:", e)
                continue

            # metadata
            lat = data.get("lat")
            lon = data.get("lon")
            acc = data.get("accuracy")
            ts = data.get("timestamp") or datetime.utcnow().isoformat()

            # save file
            frame_id = uuid.uuid4()
            filename = f"{frame_id}.jpg"
            filepath = os.path.join(STORAGE_DIR, filename)
            try:
                with open(filepath, "wb") as f:
                    f.write(img_bytes)
            except Exception as e:
                print("❌ failed to write jpg:", e)
                continue

            # update latest_meta for viewer (store b64 so viewer can display immediately)
            latest_meta.update({
                "timestamp": ts,
                "lat": lat,
                "lon": lon,
                "accuracy": acc,
                "frame_b64": img_b64,
                "file_path": filepath,
                "id": str(frame_id)
            })

            # persist to DB
            try:
                async for db in get_db():
                    stmt = Frame.__table__.insert().values(
                        id=frame_id,
                        timestamp=datetime.fromisoformat(ts) if isinstance(ts, str) else datetime.utcnow(),
                        lat=lat,
                        lon=lon,
                        file_path=filepath,
                        is_pothole=False
                    )
                    await db.execute(stmt)
                    await db.commit()
                    break

                # 🚀 Start BACKGROUND TASK for pothole detection
                asyncio.create_task(
                    process_frame(
                        frame_id=str(frame_id),
                        file_path=filepath,
                        db_factory=get_db
                    )
                )

            except Exception as e:
                print("❌ DB insert failed:", e)


    except WebSocketDisconnect:
        print("🔌 iPhone disconnected")
    except Exception as e:
        print("❌ unexpected ws error:", e)
    finally:
        print("🔌 Connection closed")


@app.get("/route")
async def route(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Frame))
    frames = result.scalars().all()

    data = [
        {
            "lat": f.lat,
            "lon": f.lon,
            "timestamp": f.timestamp.isoformat(),
            "is_pothole": f.is_pothole,
            "porthole_area_percentage": f.porthole_area_percentage if hasattr(f, 'porthole_area_percentage') else 0.0,
            "file_path": f"/storage/frames/{os.path.basename(f.file_path)}"
        }
        for f in frames if f.lat and f.lon
    ]

    return {"points": data}


@app.patch("/pothole/{lat}/{lon}")
async def update_pothole(lat: float, lon: float, db: AsyncSession = Depends(get_db)):
    """
    Sets is_pothole to False for all frames matching the given coordinates.
    This effectively "deletes" or marks all potholes at this location as not potholes.
    """
    # Find all frames with matching coordinates
    stmt = select(Frame).where(Frame.lat == lat, Frame.lon == lon, Frame.is_pothole == True)
    result = await db.execute(stmt)
    frames = result.scalars().all()

    if not frames:
        raise HTTPException(status_code=404, detail="Pothole not found")

    # Update is_pothole to False for all matching frames
    for frame in frames:
        frame.is_pothole = False
    
    await db.commit()

    return {"success": True, "message": f"Marked {len(frames)} pothole(s) as resolved"}
