"""
app.py - HEMS Python Analytics Service Entry Point

Exposes a lightweight Flask HTTP API alongside the APScheduler
background pipeline. This allows the Node.js backend to:
  - Check the Python service health
  - Trigger a pipeline run on demand
  - Query model training status
  - Trigger a model retrain manually

The scheduler runs in a background thread so Flask can serve
requests concurrently with scheduled pipeline executions.

Endpoints:
  GET  /health              — liveness check
  GET  /status              — pipeline and model status
  POST /run                 — trigger an immediate pipeline run
  POST /retrain             — force a full model retrain
  GET  /appliances          — list Building 1 appliances from UK-DALE
"""

import os
import sys

src_path = os.path.join(os.path.dirname(__file__), "src")
if src_path not in sys.path:
    sys.path.append(src_path)
    
import logging
import traceback
from datetime import datetime
from threading import Thread

from flask import Flask, jsonify, request

from config import Config
from ingestion.loader import UKDALELoader
import scheduler as pipeline
from scheduler import start_scheduler, run_pipeline, _train_models, TRAIN_START, TRAIN_WINDOW_DAYS


# ---------------------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Auth Guard
# ---------------------------------------------------------------------------

def _verify_api_key() -> bool:
    """
    Verify the incoming request carries the correct ML_API_KEY header.
    Reuses the same key as the Node.js bridge so a single secret covers
    both directions of inter-service communication.
    """
    incoming_key = request.headers.get("x-ml-api-key", "")
    return incoming_key == Config.ML_API_KEY


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    """
    Liveness check — returns 200 if the Flask service is running.
    Called by poster.py's check_node_health() mirror on the Python side,
    and also useful for Docker/K8s health probes.
    """
    return jsonify({
        "status": "ok",
        "service": "hems-analytics",
        "timestamp": datetime.now().isoformat(),
    }), 200


@app.get("/status")
def status():
    """
    Return the current state of the pipeline and all three models.
    Useful for the Node server to surface diagnostics to the frontend.
    """
    if not _verify_api_key():
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "service": "hems-analytics",
        "timestamp": datetime.now().isoformat(),
        "scheduler": {
            "interval_minutes": Config.SCHEDULE_INTERVAL_MINUTES,
            "building_id": Config.BUILDING_ID,
            "sample_period_seconds": Config.SAMPLE_PERIOD,
        },
        "models": {
            "disaggregator": {
                "trained": pipeline._disaggregator is not None and pipeline._disaggregator._trained,
                "algorithm": "Combinatorial Optimisation (NILMTK CO)",
            },
            "forecaster": {
                "trained": pipeline._forecaster is not None and pipeline._forecaster._trained,
                "algorithm": "GradientBoostingRegressor (scikit-learn)",
                "appliance_count": len(pipeline._forecaster.models) if pipeline._forecaster else 0,
            },
            "anomaly_detector": {
                "trained": pipeline._detector is not None and pipeline._detector._trained,
                "algorithm": "IsolationForest (scikit-learn)",
                "appliance_count": len(pipeline._detector.appliance_models) if pipeline._detector else 0,
            },
        },
        "last_trained": pipeline._last_trained.isoformat() if pipeline._last_trained else None,
    }), 200


@app.post("/run")
def trigger_run():
    """
    Trigger an immediate pipeline run outside the scheduled interval.

    The run executes in a background thread so the HTTP response returns
    immediately rather than blocking until the full pipeline completes
    (which can take several minutes for large windows).

    Secured with ML_API_KEY so only the Node.js backend can trigger runs.
    """
    if not _verify_api_key():
        return jsonify({"error": "Unauthorized"}), 401

    if pipeline._disaggregator is None or not pipeline._disaggregator._trained:
        return jsonify({
            "error": "Models not initialised. Wait for startup training to complete or POST /retrain."
        }), 503

    thread = Thread(target=run_pipeline, daemon=True, name="on-demand-pipeline")
    thread.start()

    return jsonify({
        "message": "Pipeline run triggered",
        "timestamp": datetime.now().isoformat(),
    }), 202


@app.post("/retrain")
def trigger_retrain():
    """
    Force a full model retrain regardless of the scheduled retrain interval.

    Useful after:
      - Adding new appliances / devices in the frontend
      - Adjusting TRAIN_WINDOW_DAYS or CONTAMINATION thresholds
      - Suspecting model drift after seasonal usage changes

    Runs in a background thread — returns 202 immediately.
    Secured with ML_API_KEY.
    """
    if not _verify_api_key():
        return jsonify({"error": "Unauthorized"}), 401

    if pipeline._disaggregator is None:
        return jsonify({
            "error": "Models not initialised yet — wait for startup training to complete before retraining."
        }), 503

    def _retrain_task():
        logger.info("On-demand retrain triggered via /retrain endpoint")
        success = _train_models()
        if success:
            logger.info("On-demand retrain completed successfully")
        else:
            logger.error("On-demand retrain failed — check logs for details")

    thread = Thread(target=_retrain_task, daemon=True, name="on-demand-retrain")
    thread.start()

    return jsonify({
        "message": "Model retrain triggered",
        "train_start": TRAIN_START,
        "train_window_days": TRAIN_WINDOW_DAYS,
        "timestamp": datetime.now().isoformat(),
    }), 202


@app.get("/appliances")
def list_appliances():
    """
    Return the list of submetered appliances available in UK-DALE Building 1.

    Useful for the Node/frontend device registration flow — the user can
    map their registered devices to UK-DALE appliance labels so the
    disaggregator can attach MongoDB device IDs to prediction payloads.

    Does not require auth — appliance labels are not sensitive data.
    """
    loader = None
    try:
        loader = UKDALELoader()
        loader.load()
        appliances = loader.list_appliances()

        return jsonify({
            "building_id": Config.BUILDING_ID,
            "appliance_count": len(appliances),
            "appliances": appliances,
        }), 200

    except Exception as exc:
        logger.error(f"/appliances failed: {exc}\n{traceback.format_exc()}")
        return jsonify({"error": str(exc)}), 500

    finally:
        if loader is not None:
            try:
                loader.close()
            except Exception as close_exc:
                logger.warning(f"Failed to close UK-DALE dataset handle cleanly: {close_exc}")


# ---------------------------------------------------------------------------
# Error Handlers
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(exc):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def method_not_allowed(exc):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(exc):
    logger.error(f"Unhandled server error: {exc}\n{traceback.format_exc()}")
    return jsonify({"error": "Internal server error"}), 500


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def _start_scheduler_thread() -> None:
    """
    Run the APScheduler in a background daemon thread so Flask's
    development server (or a production WSGI server) can handle
    HTTP requests concurrently with scheduled pipeline runs.
    """
    thread = Thread(
        target=start_scheduler,
        daemon=True,
        name="pipeline-scheduler",
    )
    thread.start()
    logger.info("Pipeline scheduler started in background thread")


if __name__ == "__main__":
    logger.info("Starting HEMS Python Analytics Service")
    logger.info(f"  Building:          UK-DALE Building {Config.BUILDING_ID}")
    logger.info(f"  Sample period:     {Config.SAMPLE_PERIOD}s")
    logger.info(f"  Schedule interval: {Config.SCHEDULE_INTERVAL_MINUTES} minutes")
    logger.info(f"  Node API URL:      {Config.NODE_API_URL}")

    # Start the scheduler in a background thread
    _start_scheduler_thread()

    # Start Flask — debug=False in production
    app.run(
        host="0.0.0.0",
        port=8000,
        debug=False,
        use_reloader=False,  # must be False when running threads at startup
    )