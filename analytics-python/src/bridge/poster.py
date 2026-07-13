"""
poster.py - REST Bridge: Python Analytics → Node.js/Express Backend

Handles all outbound HTTP communication from the Python analytics pipeline
to the Node.js /api/ml/predictions endpoint.

Responsibilities:
  - Authenticate every request using the shared ML_API_KEY secret
    (sent as the 'x-ml-api-key' header, verified by requireMlApiKey
    middleware on the Node side).
  - Post individual prediction payloads with retry logic and
    exponential backoff to handle transient network failures.
  - Batch-post lists of payloads (output of disaggregator,
    forecaster, and anomaly detector) efficiently.
  - Provide structured logging for every POST attempt and outcome
    so the scheduler can surface failures cleanly.
"""

import logging
import time
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from requests.exceptions import RequestException
from urllib3.util.retry import Retry

from config import Config

logger = logging.getLogger(__name__)

# Maximum number of retry attempts per individual payload POST
MAX_RETRIES = 3

# Base delay in seconds for exponential backoff between retries
BACKOFF_BASE_SECONDS = 2

# Request timeout in seconds (connect timeout, read timeout)
REQUEST_TIMEOUT = (5, 15)


def _build_session() -> requests.Session:
    """
    Build a requests Session with:
      - Shared auth headers applied to every request.
      - urllib3-level retry for connection errors and 5xx responses.
      - A single reusable TCP connection pool (more efficient than
        creating a new connection per POST).
    """
    session = requests.Session()

    session.headers.update({
        "Content-Type": "application/json",
        "x-ml-api-key": Config.ML_API_KEY,
    })

    # urllib3 retry handles low-level retries (connection refused, 503, etc.)
    # Our own retry loop in post_payload() handles application-level failures.
    retry_strategy = Retry(
        total=2,
        backoff_factor=1,
        status_forcelist=[502, 503, 504],
        allowed_methods=["POST"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    return session


# Module-level session — reused across all calls in a scheduler run
_session: Optional[requests.Session] = None


def _get_session() -> requests.Session:
    """Return the module-level session, creating it if needed."""
    global _session
    if _session is None:
        _session = _build_session()
    return _session


def reset_session() -> None:
    """
    Force a new session to be created on the next call.
    Call this if ML_API_KEY changes at runtime or after connection errors.
    """
    global _session
    _session = None


# ---------------------------------------------------------------------------
# Core Posting Logic
# ---------------------------------------------------------------------------

def post_payload(payload: dict, attempt: int = 1) -> bool:
    """
    POST a single prediction payload to the Node.js ML webhook endpoint.

    Implements exponential backoff retry for application-level failures
    (non-2xx responses that aren't caught by the urllib3 retry layer).

    Args:
        payload: Prediction dict matching the Node mlPredictionSchema:
                 {userId, type, predictedValue, confidence, targetDate,
                  device?, anomalyDetails?}
        attempt: Current attempt number (used internally for recursion).

    Returns:
        True if the POST succeeded (2xx response), False otherwise.
    """
    session = _get_session()

    try:
        response = session.post(
            Config.NODE_API_URL,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )

        if response.status_code in (200, 201):
            logger.debug(
                f"POST success [{response.status_code}]: "
                f"type={payload.get('type')} value={payload.get('predictedValue')}"
            )
            return True

        # 400 Bad Request — payload schema mismatch, no point retrying
        if response.status_code == 400:
            logger.error(
                f"POST rejected [400]: {response.text[:200]} | payload={payload}"
            )
            return False

        # 401 Unauthorized — API key mismatch
        if response.status_code == 401:
            logger.error(
                "POST rejected [401]: ML_API_KEY does not match the Node server. "
                "Check both .env files have the same ML_API_KEY value."
            )
            return False

        # Other non-2xx — retry with backoff
        if attempt < MAX_RETRIES:
            wait = BACKOFF_BASE_SECONDS ** attempt
            logger.warning(
                f"POST failed [{response.status_code}], retrying in {wait}s "
                f"(attempt {attempt}/{MAX_RETRIES})"
            )
            time.sleep(wait)
            return post_payload(payload, attempt + 1)

        logger.error(
            f"POST failed [{response.status_code}] after {MAX_RETRIES} attempts: "
            f"{response.text[:200]}"
        )
        return False

    except RequestException as exc:
        if attempt < MAX_RETRIES:
            wait = BACKOFF_BASE_SECONDS ** attempt
            logger.warning(
                f"POST connection error: {exc}. Retrying in {wait}s "
                f"(attempt {attempt}/{MAX_RETRIES})"
            )
            time.sleep(wait)
            return post_payload(payload, attempt + 1)

        logger.error(f"POST failed after {MAX_RETRIES} attempts: {exc}")
        return False


def post_payloads(payloads: list[dict]) -> dict[str, int]:
    """
    Batch-post a list of prediction payloads to the Node.js backend.

    Posts each payload sequentially with a small inter-request delay to
    avoid overwhelming the Node server's MongoDB write queue during a
    large pipeline run.

    Args:
        payloads: List of prediction dicts from disaggregator,
                  forecaster, or anomaly detector.

    Returns:
        Summary dict: {"total": n, "succeeded": n, "failed": n}
    """
    if not payloads:
        logger.info("No payloads to post")
        return {"total": 0, "succeeded": 0, "failed": 0}

    logger.info(f"Posting {len(payloads)} prediction payload(s) to {Config.NODE_API_URL}")

    succeeded = 0
    failed = 0

    for i, payload in enumerate(payloads):
        success = post_payload(payload)

        if success:
            succeeded += 1
        else:
            failed += 1

        # Small delay between requests to avoid hammering the Node server.
        # Skip delay after the last payload.
        if i < len(payloads) - 1:
            time.sleep(0.1)

    summary = {"total": len(payloads), "succeeded": succeeded, "failed": failed}
    logger.info(
        f"Batch POST complete: {succeeded}/{len(payloads)} succeeded, "
        f"{failed} failed"
    )
    return summary


def post_pipeline_results(
    disaggregation_payloads: list[dict],
    forecast_payloads: list[dict],
    anomaly_payloads: list[dict],
) -> dict[str, dict]:
    """
    Post the combined output of all three pipeline modules in a single
    call. Each module's payloads are posted as a separate batch so
    failures in one group don't block the others.

    Args:
        disaggregation_payloads: Output of EnergyDisaggregator.to_prediction_payloads()
        forecast_payloads:       Output of ConsumptionForecaster.to_prediction_payloads()
        anomaly_payloads:        Output of AnomalyDetector.to_prediction_payloads()

    Returns:
        Dict with per-module POST summaries:
        {
            "disaggregation": {"total": n, "succeeded": n, "failed": n},
            "forecast":       {"total": n, "succeeded": n, "failed": n},
            "anomaly":        {"total": n, "succeeded": n, "failed": n},
        }
    """
    logger.info("=== Starting pipeline results POST ===")

    results = {}

    logger.info("--- Posting disaggregation results ---")
    results["disaggregation"] = post_payloads(disaggregation_payloads)

    logger.info("--- Posting forecast results ---")
    results["forecast"] = post_payloads(forecast_payloads)

    logger.info("--- Posting anomaly detection results ---")
    results["anomaly"] = post_payloads(anomaly_payloads)

    total = sum(r["total"] for r in results.values())
    total_succeeded = sum(r["succeeded"] for r in results.values())
    total_failed = sum(r["failed"] for r in results.values())

    logger.info(
        f"=== Pipeline POST complete: "
        f"{total_succeeded}/{total} succeeded, {total_failed} failed ==="
    )

    return results


def check_node_health() -> bool:
    """
    Ping the Node.js server's health endpoint before a pipeline run
    to fail fast if the backend is unreachable.

    Expects GET /health to return 200. If your Node server does not
    expose a health endpoint, this will return False and the scheduler
    will skip the pipeline run rather than accumulate failed POSTs.

    Returns:
        True if the Node server is reachable and healthy.
    """
    health_url = Config.NODE_API_URL.replace("/api/ml/predictions", "/health")

    try:
        response = requests.get(health_url, timeout=(3, 5))
        if response.status_code == 200:
            logger.info(f"Node.js health check passed: {health_url}")
            return True

        logger.warning(f"Node.js health check returned [{response.status_code}]: {health_url}")
        return False

    except RequestException as exc:
        logger.warning(f"Node.js health check failed: {exc}")
        return False


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    healthy = check_node_health()
    print(f"\nNode.js server healthy: {healthy}")

    if healthy:
        # Post a single test payload
        test_payload = {
            "userId": "000000000000000000000001",
            "type": "consumption",
            "predictedValue": 1.23,
            "confidence": 0.85,
            "targetDate": "2013-05-01T00:00:00.000Z",
        }

        success = post_payload(test_payload)
        print(f"Single payload POST: {'succeeded' if success else 'failed'}")

        # Post a small batch
        batch = [
            {
                "userId": "000000000000000000000001",
                "type": "consumption",
                "predictedValue": round(i * 0.1, 2),
                "confidence": 0.75,
                "targetDate": "2013-05-01T00:00:00.000Z",
            }
            for i in range(1, 4)
        ]

        summary = post_payloads(batch)
        print(f"Batch POST summary: {summary}")
    else:
        print("Skipping POST test — Node.js server not reachable")