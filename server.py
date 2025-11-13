import base64
import json
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
import uvicorn
import os
import sys

# Check if port 8000 is already in use
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
if s.connect_ex(("0.0.0.0", 8000)) == 0:
    print("ERROR: Port 8000 already in use. Close the old server!")
    sys.exit(1)
s.close()


latest_metadata = {"frame": None}
frame_count = 0

app = FastAPI()


#---------------------------------------------------
#  HTML Viewer
#---------------------------------------------------
@app.get("/", response_class=HTMLResponse)
def viewer_page():
    return """
    <html>
    <head>
    <title>LiveStreamGPS Viewer</title>
    <style>
        body { background: #111; color: white; font-family: monospace; text-align: center; }
        #img { border-radius: 10px; margin-top: 20px; }
        #meta { margin-top: 20px; }
    </style>
    </head>
    <body>
        <h2>iPhone Live Feed</h2>
        <img id="img" width="360" />
        <pre id="meta"></pre>

        <script>
            async function update() {
                const res = await fetch("/frame");
                const data = await res.json();

                if (data.frame) {
                    document.getElementById("img").src = "data:image/jpg;base64," + data.frame;
                    document.getElementById("meta").innerText =
                        "Timestamp: " + data.timestamp + "\\n" +
                        "Latitude:  " + data.lat + "\\n" +
                        "Longitude: " + data.lon + "\\n" +
                        "Frames Received: " + data.count;
                }
            }

            setInterval(update, 300);
        </script>
    </body>
    </html>
    """


@app.get("/frame")
def get_frame():
    return latest_metadata


#---------------------------------------------------
#  WebSocket endpoint for iPhone
#---------------------------------------------------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    global latest_metadata, frame_count

    await ws.accept()
    print("iPhone connected")

    while True:
        msg = await ws.receive()

        if "text" in msg:
            raw = msg["text"]
        elif "bytes" in msg:
            raw = msg["bytes"].decode()
        else:
            continue

        data = json.loads(raw)
        frame_count += 1

        latest_metadata = {
            "timestamp": data["timestamp"],
            "lat": data["lat"],
            "lon": data["lon"],
            "frame": data["frame"],
            "count": frame_count
        }

        print(f"Frame {frame_count} received")



#---------------------------------------------------
#  Start server
#---------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
e