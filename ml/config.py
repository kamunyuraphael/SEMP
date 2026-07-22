"""
config.py - Central configuration for the HEMS analytics service.

Reads from environment variables (via .env) so paths, credentials, and
tuning parameters never need to be hardcoded in the pipeline modules.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # --- UK-DALE dataset ---
    UKDALE_PATH = os.getenv("UKDALE_PATH", "data/ukdale.h5")
    BUILDING_ID = int(os.getenv("BUILDING_ID", "1"))

    # NILMTK resample period in seconds.
    # UK-DALE mains = 1 Hz, appliance submeters = 1/6 Hz (every 6s),
    # so 6s is the natural common resolution for aligning both.
    SAMPLE_PERIOD = int(os.getenv("SAMPLE_PERIOD", "6"))

    # --- Node.js / Express bridge ---
    NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:5000/api/ml/predictions")
    ML_API_KEY = os.getenv("ML_API_KEY", "")

    # --- Scheduler ---
    SCHEDULE_INTERVAL_MINUTES = int(os.getenv("SCHEDULE_INTERVAL_MINUTES", "15"))

    # Placeholder MongoDB ObjectId used to tag predictions until real
    # per-user device/auth wiring exists on the Python side. Set this in
    # .env to your actual test user's _id, or predictions will be posted
    # under this fixed ID and never show up in that user's dashboard.
    DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "000000000000000000000001")