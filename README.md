# GPSBackend

This repository contains the backend services for a GPS tracking and live-streaming application.

## Folder Structure

- `receiver/`: Contains the core application logic.
  - `backend/`: FastAPI application for handling GPS data and video frames.
    - `Dockerfile`: Dockerfile for the backend service.
    - `server.py`: Main FastAPI application.
    - `viewer.py`: (Optional) A local viewer for the live stream.
    - `requirements.txt`: Python dependencies.
    - `database.py`: Database connection and session management.
    - `models.py`: SQLAlchemy models for the database.
    - `storage/`:
      - `frames/`: Directory to store video frames.
  - `db/`: PostgreSQL database setup.
    - `init.sql`: SQL script for database initialization.
  - `docker-compose.yml`: Defines the multi-container Docker application.

## Setup and Running

### Prerequisites

- Docker and Docker Compose

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Shubham1296/GPSBackend.git
    cd GPSBackend
    ```

2.  **Build and run the Docker containers:**
    ```bash
    docker-compose up --build
    ```

    This will:
    - Build the `backend` service using the `Dockerfile`.
    - Start a PostgreSQL database service.
    - Run the FastAPI application.

3.  **Access the application:**
    - The FastAPI application will be accessible at `http://localhost:8000`.
    - The live viewer (if `viewer.py` is used) can be accessed by navigating to `http://localhost:8000` in your web browser.

## Development

### Backend

The backend is a FastAPI application.

- **Dependencies**: Listed in `receiver/backend/requirements.txt`.
- **Database**: PostgreSQL, managed via `receiver/db/init.sql` and `receiver/backend/database.py`, `receiver/backend/models.py`.

### Database Initialization

The `receiver/db/init.sql` script is executed when the PostgreSQL container starts for the first time. You can define your table schemas and initial data in this file.

## Contributing

Feel free to contribute to this project by submitting issues or pull requests.
