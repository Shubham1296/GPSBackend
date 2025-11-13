import asyncio
import websockets
import json
from PIL import Image, ImageTk
import io
import tkinter as tk

class FrameViewer:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("LiveStreamGPS - Viewer")
        self.root.geometry("420x550")
        self.root.configure(bg="black")

        # Label for video
        self.video_label = tk.Label(self.root, bg="black")
        self.video_label.pack(pady=10)

        # Text area for metadata
        self.info = tk.Label(
            self.root,
            text="Waiting for data...",
            fg="white",
            bg="black",
            font=("Menlo", 12),
            justify="left"
        )
        self.info.pack(pady=10)

        self.frame_count = 0

    def update_frame(self, jpeg_data, metadata):
        self.frame_count += 1

        # Decode JPEG
        img = Image.open(io.BytesIO(jpeg_data))
        img = img.resize((360, 270))
        img_tk = ImageTk.PhotoImage(img)

        # Update preview
        self.video_label.configure(image=img_tk)
        self.video_label.image = img_tk  # keep a reference

        # Update metadata
        text = (
            f"Timestamp: {metadata['timestamp']}\n"
            f"Latitude:  {metadata['lat']}\n"
            f"Longitude: {metadata['lon']}\n"
            f"Frames received: {self.frame_count}\n"
        )

        self.info.configure(text=text)

    def start(self):
        self.root.mainloop()


viewer = FrameViewer()


async def listen():
    uri = "ws://0.0.0.0:8000/ws"
    print("Viewer connecting to:", uri)

    async with websockets.connect(uri) as websocket:
        print("Viewer connected.")

        while True:
            msg = await websocket.recv()

            try:
                data = json.loads(msg)

                jpeg_data = io.BytesIO()
                jpeg_bytes = data["frame"].encode()
                jpeg_data = io.BytesIO(base64.b64decode(jpeg_bytes))

                metadata = {
                    "timestamp": data["timestamp"],
                    "lat": data["lat"],
                    "lon": data["lon"]
                }

                viewer.update_frame(jpeg_data.getvalue(), metadata)

            except Exception as e:
                print("Error:", e)


async def main():
    # Run Tkinter + WebSocket together
    loop = asyncio.get_event_loop()
    loop.create_task(listen())
    viewer.start()


if __name__ == "__main__":
    asyncio.run(main())
