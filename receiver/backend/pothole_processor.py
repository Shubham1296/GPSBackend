# pothole_processor.py
import aiohttp
import asyncio
import datetime
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from models import Frame

LOG_DIR = "/app/logs"
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = f"{LOG_DIR}/processor.log"

# Updated API URL with new endpoint
POTHOLE_API_URL = "http://172.174.136.7:8001/predict_severity"

async def log(msg: str):
    timestamp = datetime.datetime.utcnow().isoformat()
    line = f"[{timestamp}] {msg}\n"
    print(line.strip())
    async with asyncio.Lock():
        with open(LOG_FILE, "a") as f:
            f.write(line)


async def process_frame(frame_id: str, file_path: str, db_factory):
    await log(f"📥 Frame received for processing: {frame_id}")

    # --- CALL POTHOLE API ---
    try:
        await log(f"➡️ Sending to pothole API: {frame_id}")

        async with aiohttp.ClientSession() as session:
            with open(file_path, "rb") as img:
                form = aiohttp.FormData()
                form.add_field("file", img, filename=os.path.basename(file_path))

                async with session.post(POTHOLE_API_URL, data=form) as resp:
                    # Check response status
                    if resp.status != 200:
                        error_text = await resp.text()
                        await log(f"❌ API error {resp.status} for {frame_id}: {error_text}")
                        return

                    # Try to parse JSON response
                    content_type = resp.content_type
                    if 'application/json' not in content_type:
                        error_text = await resp.text()
                        await log(f"❌ API returned non-JSON response for {frame_id} (content-type: {content_type}): {error_text}")
                        return

                    api_result = await resp.json()

        await log(f"⬅️ API response for {frame_id}: {api_result}")

        # Parse new API response format
        pothole_detected = isinstance(api_result, list) and len(api_result) > 0

        # Extract porthole_area_percentage from first detection
        porthole_area_percentage = 0.0
        if pothole_detected and len(api_result) > 0:
            first_detection = api_result[0]
            porthole_area_percentage = first_detection.get("porthole_area_percentage", 0.0)
            await log(f"📊 Pothole area percentage: {porthole_area_percentage}%")

    except Exception as e:
        await log(f"❌ Error calling pothole API for {frame_id}: {e}")
        return

    # --- UPDATE DATABASE ---
    try:
        async for db in db_factory():
            stmt = (
                update(Frame)
                .where(Frame.id == frame_id)
                .values(
                    is_pothole=pothole_detected,
                    porthole_area_percentage=porthole_area_percentage
                )
            )
            await db.execute(stmt)
            await db.commit()

        if pothole_detected:
            await log(f"🚨 Pothole detected! Area: {porthole_area_percentage}% - DB updated for {frame_id}")
        else:
            await log(f"✅ No pothole detected for {frame_id}")

    except Exception as e:
        await log(f"❌ DB update failed for {frame_id}: {e}")
