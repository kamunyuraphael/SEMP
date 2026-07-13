"""
scheduler.py - HEMS Analytics Pipeline Orchestrator

Wires the full analytics pipeline together and runs it on a
configurable cron interval using APScheduler.

Pipeline execution order per scheduled run:
  1. Health check     — verify Node.js backend is reachable
  2. Data ingestion   — load recent UK-DALE data via UKDALELoader
  3. Disaggregation   — estimate per-appliance power via CO model
  4. Forecasting      — predict tomorrow's kWh via GradientBoosting
  5. Anomaly detect   — flag unusual consumption via IsolationForest
  6. POST results     — send all payloads to Node.js /api/ml/predictions

Models are trained once on startup (or loaded from disk if already
trained) and reused across scheduled runs. A full model retrain is
triggered automatically every 7 days to keep baselines fresh.
"""

import logging
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

from config import Config
from ingestion.loader import UKDALELoader
from pipeline.disaggregator import EnergyDisaggregator
from pipeline.forecaster import ConsumptionForecaster
from pipeline.anomaly import AnomalyDetector
from bridge.poster import post_pipeline_results, check_node_health, reset_session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# How many days of historical data to feed into each pipeline run.
# More days = better rolling/lag features but slower ingestion.
INFERENCE_WINDOW_DAYS = 2

# Training window length in days
TRAIN_WINDOW_DAYS = 30

# How often (in days) to trigger a full model retrain
RETRAIN_EVERY_DAYS = 7

# UK-DALE training start date — April 2013 is clean and well-documented
TRAIN_START = "2013-04-01"

# Placeholder user ID — now sourced from Config.DEFAULT_USER_ID (set via
# .env). Falls back to a dummy ObjectId only if Config somehow doesn't
# define it at all.
DEFAULT_USER_ID = getattr(Config, "DEFAULT_USER_ID", "000000000000000000000001")

# ---------------------------------------------------------------------------
# Module-level pipeline state
# ---------------------------------------------------------------------------

_disaggregator: EnergyDisaggregator | None = None
_forecaster: ConsumptionForecaster | None = None
_detector: AnomalyDetector | None = None
_last_trained: datetime | None = None


# ---------------------------------------------------------------------------
# Model Initialisation
# ---------------------------------------------------------------------------

def _initialise_models(force_retrain: bool = False) -> bool:
    """
    Load models from disk if available, otherwise train from scratch.

    Args:
        force_retrain: If True, retrain all models regardless of saved state.

    Returns:
        True if models are ready, False if initialisation failed.
    """
    global _disaggregator, _forecaster, _detector, _last_trained

    _disaggregator = EnergyDisaggregator()
    _forecaster = ConsumptionForecaster()
    _detector = AnomalyDetector()

    # Attempt to load saved models first
    if not force_retrain:
        try:
            _disaggregator.load_model()
            _forecaster.load_models()
            _detector.load_model()
            logger.info("All models loaded from disk — skipping training")
            _last_trained = datetime.now()
            return True
        except FileNotFoundError:
            logger.info("No saved models found — running initial training")

    # Train from scratch
    return _train_models()


def _train_models() -> bool:
    """
    Run a full training cycle across all three pipeline models
    using TRAIN_WINDOW_DAYS days of UK-DALE data starting from TRAIN_START.

    Returns:
        True if training succeeded, False on error.
    """
    global _last_trained

    train_end = (
        datetime.strptime(TRAIN_START, "%Y-%m-%d")
        + timedelta(days=TRAIN_WINDOW_DAYS)
    ).strftime("%Y-%m-%d")

    logger.info(f"Training all models on {TRAIN_START} → {train_end}")

    loader = None
    try:
        loader = UKDALELoader()
        loader.load()
        loader.set_window(start=TRAIN_START, end=train_end)

        # Resolve available appliances, then read their real ground-truth
        # power for the training window (see disaggregator.py — this used
        # to be a fabricated approximation; now it reads the real data)
        _disaggregator.train(loader, train_start=TRAIN_START, train_end=train_end)

        power_df = _disaggregator.disaggregate(
            loader,
            test_start=TRAIN_START,
            test_end=train_end,
        )

        mains = loader.get_mains_power()
        power_df["mains_watts"] = mains.reindex(power_df.index, method="nearest")

        # Forecaster and anomaly detector train on the disaggregated output
        _forecaster.train(power_df)
        _detector.train(power_df)

        _last_trained = datetime.now()
        logger.info(f"Full model training complete at {_last_trained.isoformat()}")
        return True

    except Exception as exc:
        logger.error(f"Model training failed: {exc}\n{traceback.format_exc()}")
        return False

    finally:
        # Always release the HDF5 handle, whether training succeeded, failed,
        # or raised mid-way. Previously loader.close() only ran on the happy
        # path, so any exception between load() and close() leaked the file
        # handle — causing every subsequent run to fail opening the same
        # dataset ("unable to lock file" / already-open conflicts).
        if loader is not None:
            try:
                loader.close()
            except Exception as close_exc:
                logger.warning(f"Failed to close UK-DALE dataset handle cleanly: {close_exc}")


def _should_retrain() -> bool:
    """Return True if RETRAIN_EVERY_DAYS have passed since last training."""
    if _last_trained is None:
        return True
    return (datetime.now() - _last_trained).days >= RETRAIN_EVERY_DAYS


# ---------------------------------------------------------------------------
# Pipeline Run
# ---------------------------------------------------------------------------

def run_pipeline() -> None:
    """
    Execute one full analytics pipeline run:
      1. Health check Node.js backend
      2. Optionally retrain models
      3. Load recent ingestion window
      4. Disaggregate → Forecast → Detect anomalies
      5. POST all payloads to Node.js

    This function is called by APScheduler on each interval tick.
    All exceptions are caught and logged so a single failed run
    does not stop the scheduler.
    """
    run_start = datetime.now()
    logger.info(f"=== Pipeline run started at {run_start.isoformat()} ===")

    # Step 1: Health check
    if not check_node_health():
        logger.warning("Node.js backend unreachable — skipping pipeline run")
        return

    # Step 2: Retrain if due
    if _should_retrain():
        logger.info("Scheduled retrain triggered")
        if not _train_models():
            logger.error("Retrain failed — proceeding with existing models")

    # Step 3: Load recent ingestion window
    # UK-DALE is a historical dataset, so the ingestion window is fixed to
    # a real range within it rather than derived from datetime.now(). The
    # index gets shifted to look like "today" further down, after
    # ingestion (see the shift block below). In production with live
    # sensor data, this window would instead be computed directly from
    # datetime.now() - timedelta(days=INFERENCE_WINDOW_DAYS).
    ukdale_window_end = "2013-05-03"
    ukdale_window_start = "2013-05-01"
    target_date = datetime.now().strftime("%Y-%m-%d")

    logger.info(f"Ingestion window: {ukdale_window_start} → {ukdale_window_end}")

    loader = None
    try:
        loader = UKDALELoader()
        loader.load()
        loader.set_window(start=ukdale_window_start, end=ukdale_window_end)

        # Read real ground-truth appliance power for the ingestion window
        power_df = _disaggregator.disaggregate(
            loader,
            test_start=ukdale_window_start,
            test_end=ukdale_window_end,
        )

        mains = loader.get_mains_power()
        power_df["mains_watts"] = mains.reindex(power_df.index, method="nearest")
        if not power_df.empty:
            # Shift the 2013 window so it lands on today, preserving
            # time-of-day. Anchored on the window's END (not start) —
            # anchoring on the start would push the window's end into
            # the future (e.g. today + 2 days) instead of ending at
            # today, which is backwards for "recent power history."
            base_date = pd.to_datetime(ukdale_window_end)
            days_delta = (pd.Timestamp(datetime.now().date()) - base_date).days
            power_df.index = power_df.index + pd.Timedelta(days=days_delta, unit='D')

    except Exception as exc:
        logger.error(f"Data ingestion failed: {exc}\n{traceback.format_exc()}")
        return

    finally:
        # Same leak-prevention as _train_models() — always release the HDF5
        # handle so a failed run doesn't block every run after it.
        if loader is not None:
            try:
                loader.close()
            except Exception as close_exc:
                logger.warning(f"Failed to close UK-DALE dataset handle cleanly: {close_exc}")

    # Step 4a: Disaggregation payloads
    try:
        energy_series = _disaggregator.compute_energy_per_appliance(power_df)
        disaggregation_payloads = _disaggregator.to_prediction_payloads(
            energy_series=energy_series,
            user_id=DEFAULT_USER_ID,
            target_date=target_date,
        )
        logger.info(f"Disaggregation: {len(disaggregation_payloads)} payloads")
    except Exception as exc:
        logger.error(f"Disaggregation payload generation failed: {exc}")
        disaggregation_payloads = []

    # Step 4b: Forecast payloads
    try:
        recent_power = power_df.tail(14400)  # last 24h of data
        forecast_df = _forecaster.forecast(
            recent_power_df=recent_power,
            target_date=target_date,
        )
        daily_kwh = _forecaster.compute_daily_totals(forecast_df)
        forecast_payloads = _forecaster.to_prediction_payloads(
            daily_kwh=daily_kwh,
            user_id=DEFAULT_USER_ID,
            target_date=target_date,
        )
        logger.info(f"Forecast: {len(forecast_payloads)} payloads")
    except Exception as exc:
        logger.error(f"Forecast payload generation failed: {exc}")
        forecast_payloads = []

    # Step 4c: Anomaly detection payloads
    try:
        anomaly_payloads = _detector.to_prediction_payloads(
            power_df=power_df,
            user_id=DEFAULT_USER_ID,
            target_date=target_date,
        )
        logger.info(f"Anomaly detection: {len(anomaly_payloads)} payloads")
    except Exception as exc:
        logger.error(f"Anomaly payload generation failed: {exc}")
        anomaly_payloads = []

    # Step 5: POST all results to Node.js
    try:
        summary = post_pipeline_results(
            disaggregation_payloads=disaggregation_payloads,
            forecast_payloads=forecast_payloads,
            anomaly_payloads=anomaly_payloads,
        )
    except Exception as exc:
        logger.error(f"POST pipeline results failed: {exc}")
        summary = {}

    run_duration = (datetime.now() - run_start).total_seconds()
    logger.info(
        f"=== Pipeline run complete in {run_duration:.1f}s | "
        f"Summary: {summary} ==="
    )


# ---------------------------------------------------------------------------
# Scheduler Event Listeners
# ---------------------------------------------------------------------------

def _on_job_executed(event) -> None:
    logger.info(f"Scheduled job executed successfully: {event.job_id}")


def _on_job_error(event) -> None:
    logger.error(
        f"Scheduled job raised an exception: {event.job_id}\n"
        f"{event.exception}\n{event.traceback}"
    )


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

def start_scheduler() -> None:
    """
    Initialise models and start the APScheduler blocking scheduler.
    Runs run_pipeline() immediately on startup then on every interval.
    """
    logger.info("Initialising HEMS analytics pipeline scheduler")

    # Initialise / load models before the first run
    if not _initialise_models():
        logger.error("Model initialisation failed — scheduler will not start")
        return

    scheduler = BlockingScheduler(timezone="Africa/Nairobi")

    scheduler.add_listener(_on_job_executed, EVENT_JOB_EXECUTED)
    scheduler.add_listener(_on_job_error, EVENT_JOB_ERROR)

    scheduler.add_job(
        func=run_pipeline,
        trigger=IntervalTrigger(minutes=Config.SCHEDULE_INTERVAL_MINUTES),
        id="semp_pipeline",
        name="SEMP Analytics Pipeline",
        replace_existing=True,
        max_instances=1,        # prevent overlapping runs
        misfire_grace_time=60,  # allow up to 60s late start before skipping
    )

    logger.info(
        f"Scheduler started — pipeline runs every "
        f"{Config.SCHEDULE_INTERVAL_MINUTES} minute(s). "
        f"Press Ctrl+C to stop."
    )

    # Fire one run immediately on startup rather than waiting for first interval
    run_pipeline()

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped by user")
        scheduler.shutdown(wait=False)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    start_scheduler()