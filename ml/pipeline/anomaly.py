"""
anomaly.py - Energy Consumption Anomaly Detection

Uses scikit-learn's IsolationForest to detect abnormal energy consumption
patterns in the aggregate mains power signal and per-appliance estimates.

IsolationForest is chosen because:
  - It is unsupervised — no labelled anomaly data required.
  - It handles high-dimensional, non-Gaussian energy data well.
  - It is computationally efficient on large time-series datasets.
  - It produces an anomaly score (not just a binary flag), which maps
    naturally to the 'confidence' field in the prediction payload.

Two detection modes:
  1. Whole-home (mains) anomaly — flags hours where total consumption
     deviates significantly from learned normal patterns.
  2. Per-appliance anomaly — flags hours where a specific appliance
     consumes unusually more or less than its learned baseline.
"""

import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from config import Config

logger = logging.getLogger(__name__)

MODEL_SAVE_PATH = Path("models/anomaly_model.pkl")

# Contamination: expected proportion of anomalies in training data.
# 0.05 = we expect roughly 5% of readings to be anomalous.
# Adjust upward if the household has highly irregular usage patterns.
CONTAMINATION = 0.05

# Minimum anomaly score magnitude to include in payloads.
# IsolationForest scores range from -0.5 (most anomalous) to +0.5 (most normal).
# We only report readings scoring below this threshold.
ANOMALY_SCORE_THRESHOLD = -0.05


class AnomalyDetector:
    """
    Trains IsolationForest on historical energy data and detects
    anomalous consumption patterns in new readings.
    """

    def __init__(self, model_path: Optional[str] = None, contamination: float = CONTAMINATION):
        self.model_path = Path(model_path) if model_path else MODEL_SAVE_PATH
        self.contamination = contamination

        # Separate models for mains and per-appliance detection
        self.mains_model: Optional[Pipeline] = None
        self.appliance_models: dict[str, Pipeline] = {}
        self._trained = False

    # ------------------------------------------------------------------
    # Feature Engineering
    # ------------------------------------------------------------------

    def _build_mains_features(self, power_df: pd.DataFrame) -> pd.DataFrame:
        """
        Build an hourly feature matrix from the mains power signal
        for whole-home anomaly detection.

        Features:
          - mean_watts_1h      hourly mean consumption
          - std_watts_1h       hourly std (captures spiky usage)
          - max_watts_1h       hourly peak
          - hour_of_day        (0–23)
          - day_of_week        (0=Monday … 6=Sunday)
          - is_weekend         binary
          - rolling_mean_24h   24-hour rolling mean (context window)
        """
        if "mains_watts" in power_df.columns:
            mains = power_df["mains_watts"]
        else:
            mains = power_df.sum(axis=1)

        hourly = pd.DataFrame({
            "mean_watts_1h": mains.resample("1h").mean(),
            "std_watts_1h":  mains.resample("1h").std().fillna(0),
            "max_watts_1h":  mains.resample("1h").max(),
        })

        hourly["hour_of_day"]  = hourly.index.hour
        hourly["day_of_week"]  = hourly.index.dayofweek
        hourly["is_weekend"]   = (hourly.index.dayofweek >= 5).astype(int)

        steps_24h = 86400 // Config.SAMPLE_PERIOD
        hourly["rolling_mean_24h"] = (
            mains.rolling(steps_24h, min_periods=1).mean()
            .resample("1h").mean()
        )

        return hourly.dropna()

    def _build_appliance_features(
        self, power_df: pd.DataFrame, appliance: str
    ) -> pd.DataFrame:
        """
        Build an hourly feature matrix for a single appliance channel.

        Features:
          - mean_watts_1h      hourly mean
          - is_on_ratio        fraction of 6s timesteps where watts > 5
          - hour_of_day
          - day_of_week
          - is_weekend
        """
        watts = power_df[appliance]

        hourly = pd.DataFrame({
            "mean_watts_1h": watts.resample("1h").mean(),
            "is_on_ratio":   (watts > 5).resample("1h").mean(),
        })

        hourly["hour_of_day"] = hourly.index.hour
        hourly["day_of_week"] = hourly.index.dayofweek
        hourly["is_weekend"]  = (hourly.index.dayofweek >= 5).astype(int)

        return hourly.dropna()

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, power_df: pd.DataFrame) -> None:
        """
        Train IsolationForest models on historical power data.

        Args:
            power_df: DataFrame from disaggregator.disaggregate() with
                      optional 'mains_watts' column. At minimum a few
                      days of data is needed for meaningful baselines;
                      a full month is recommended.
        """
        logger.info("Training anomaly detector on mains signal")
        mains_features = self._build_mains_features(power_df)

        self.mains_model = Pipeline([
            ("scaler", StandardScaler()),
            ("iso_forest", IsolationForest(
                n_estimators=100,
                contamination=self.contamination,
                random_state=42,
                n_jobs=-1,
            )),
        ])
        self.mains_model.fit(mains_features)
        logger.info(f"Mains anomaly model trained on {len(mains_features)} hourly samples")

        # Train per-appliance models
        appliance_cols = [c for c in power_df.columns if c != "mains_watts"]
        for appliance in appliance_cols:
            features = self._build_appliance_features(power_df, appliance)

            if len(features) < 24:
                logger.warning(f"Skipping '{appliance}': insufficient data ({len(features)} samples)")
                continue

            model = Pipeline([
                ("scaler", StandardScaler()),
                ("iso_forest", IsolationForest(
                    n_estimators=100,
                    contamination=self.contamination,
                    random_state=42,
                    n_jobs=-1,
                )),
            ])
            model.fit(features)
            self.appliance_models[appliance] = model
            logger.info(f"  Trained anomaly model for: {appliance}")

        self._trained = True
        logger.info(f"Anomaly detection training complete: {len(self.appliance_models)} appliance models")
        self.save_model()

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

    def detect_mains_anomalies(self, power_df: pd.DataFrame) -> pd.DataFrame:
        """
        Detect anomalous hours in the aggregate mains signal.

        Args:
            power_df: Recent power DataFrame (at least 24h recommended).

        Returns:
            DataFrame of anomalous hourly windows with columns:
              - timestamp
              - mean_watts
              - anomaly_score   (negative = more anomalous)
              - severity        ('low', 'medium', 'high')
        """
        if self.mains_model is None:
            raise RuntimeError("Call train() or load_model() first.")

        features = self._build_mains_features(power_df)
        scores = self.mains_model.decision_function(features)
        predictions = self.mains_model.predict(features)

        results = features.copy()
        results["anomaly_score"] = scores
        results["is_anomaly"] = predictions == -1

        anomalies = results[results["is_anomaly"] & (results["anomaly_score"] < ANOMALY_SCORE_THRESHOLD)].copy()
        anomalies["severity"] = anomalies["anomaly_score"].apply(self._score_to_severity)

        logger.info(f"Mains anomaly detection: {len(anomalies)} anomalous hours found")
        return anomalies[["mean_watts_1h", "anomaly_score", "severity"]]

    def detect_appliance_anomalies(self, power_df: pd.DataFrame) -> dict[str, pd.DataFrame]:
        """
        Detect anomalous hours for each appliance channel.

        Args:
            power_df: Recent power DataFrame.

        Returns:
            Dict mapping appliance label → DataFrame of anomalous hourly windows.
        """
        if not self._trained:
            raise RuntimeError("Call train() or load_model() first.")

        results = {}
        appliance_cols = [c for c in power_df.columns if c != "mains_watts"]

        for appliance in appliance_cols:
            if appliance not in self.appliance_models:
                continue

            features = self._build_appliance_features(power_df, appliance)
            scores = self.appliance_models[appliance].decision_function(features)
            predictions = self.appliance_models[appliance].predict(features)

            anomaly_mask = (predictions == -1) & (scores < ANOMALY_SCORE_THRESHOLD)
            if not anomaly_mask.any():
                continue

            anomalies = features[anomaly_mask].copy()
            anomalies["anomaly_score"] = scores[anomaly_mask]
            anomalies["severity"] = anomalies["anomaly_score"].apply(self._score_to_severity)

            results[appliance] = anomalies[["mean_watts_1h", "is_on_ratio", "anomaly_score", "severity"]]
            logger.info(f"  {appliance}: {len(anomalies)} anomalous hours")

        return results

    # ------------------------------------------------------------------
    # Payload Generation
    # ------------------------------------------------------------------

    def to_prediction_payloads(
        self,
        power_df: pd.DataFrame,
        user_id: str,
        target_date: str,
        device_map: Optional[dict[str, str]] = None,
    ) -> list[dict]:
        """
        Run full anomaly detection and convert results into Node.js
        API payload dicts (type='anomaly').

        Args:
            power_df:    Recent power DataFrame.
            user_id:     MongoDB ObjectId string.
            target_date: ISO date string the detection window applies to.
            device_map:  Optional appliance label → MongoDB device _id.

        Returns:
            List of anomaly prediction payload dicts.
        """
        payloads = []

        # Whole-home anomalies
        try:
            mains_anomalies = self.detect_mains_anomalies(power_df)
            for timestamp, row in mains_anomalies.iterrows():
                confidence = self._score_to_confidence(row["anomaly_score"])
                details = (
                    f"Unusual whole-home consumption detected at {timestamp.strftime('%H:%M')}: "
                    f"{row['mean_watts_1h']:.0f}W average "
                    f"(severity: {row['severity']})"
                )
                payloads.append({
                    "userId": user_id,
                    "type": "anomaly",
                    "predictedValue": round(float(row["mean_watts_1h"]) / 1000, 4),
                    "confidence": confidence,
                    "targetDate": target_date,
                    "anomalyDetails": details,
                })
        except Exception as exc:
            logger.error(f"Mains anomaly detection failed: {exc}")

        # Per-appliance anomalies
        try:
            appliance_anomalies = self.detect_appliance_anomalies(power_df)
            for appliance, anomaly_df in appliance_anomalies.items():
                for timestamp, row in anomaly_df.iterrows():
                    confidence = self._score_to_confidence(row["anomaly_score"])
                    details = (
                        f"Abnormal '{appliance}' usage at {timestamp.strftime('%H:%M')}: "
                        f"{row['mean_watts_1h']:.0f}W average, "
                        f"on {row['is_on_ratio']*100:.0f}% of the hour "
                        f"(severity: {row['severity']})"
                    )
                    payload: dict = {
                        "userId": user_id,
                        "type": "anomaly",
                        "predictedValue": round(float(row["mean_watts_1h"]) / 1000, 4),
                        "confidence": confidence,
                        "targetDate": target_date,
                        "anomalyDetails": details,
                    }
                    if device_map and appliance in device_map:
                        payload["device"] = device_map[appliance]

                    payloads.append(payload)
        except Exception as exc:
            logger.error(f"Appliance anomaly detection failed: {exc}")

        logger.info(f"Generated {len(payloads)} anomaly prediction payloads")
        return payloads

    # ------------------------------------------------------------------
    # Model Persistence
    # ------------------------------------------------------------------

    def save_model(self) -> None:
        """Pickle the trained anomaly models to disk."""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump({
                "mains_model": self.mains_model,
                "appliance_models": self.appliance_models,
            }, f)
        logger.info(f"Anomaly models saved to {self.model_path}")

    def load_model(self) -> None:
        """Load previously trained anomaly models from disk."""
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"No saved model at {self.model_path}. Run train() first."
            )
        with open(self.model_path, "rb") as f:
            data = pickle.load(f)
        self.mains_model = data["mains_model"]
        self.appliance_models = data["appliance_models"]
        self._trained = True
        logger.info(f"Anomaly models loaded: mains + {len(self.appliance_models)} appliance models")

    # ------------------------------------------------------------------
    # Internal Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _score_to_severity(score: float) -> str:
        """
        Map an IsolationForest decision score to a human-readable severity.

        IsolationForest scores:
          ~0.0  → borderline
          -0.1  → mild anomaly
          -0.2  → moderate anomaly
          -0.3+ → severe anomaly
        """
        if score > -0.1:
            return "low"
        elif score > -0.2:
            return "medium"
        else:
            return "high"

    @staticmethod
    def _score_to_confidence(score: float) -> float:
        """
        Convert a negative anomaly score to a [0.5, 0.99] confidence value.
        More negative score = more confident the reading is anomalous.
        """
        # Normalise score from [-0.5, 0] to [0.5, 0.99]
        normalised = np.clip(abs(score) / 0.5, 0.0, 1.0)
        return round(float(0.5 + normalised * 0.49), 3)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from ingestion.loader import UKDALELoader
    from pipeline.disaggregator import EnergyDisaggregator

    loader = UKDALELoader()
    loader.load()
    loader.set_window(start="2013-04-01", end="2013-04-30")

    disaggregator = EnergyDisaggregator()
    disaggregator.load_model()

    power_df = disaggregator.disaggregate(
        loader,
        test_start="2013-04-01",
        test_end="2013-04-30",
    )

    mains = loader.get_mains_power()
    power_df["mains_watts"] = mains.reindex(power_df.index, method="nearest")
    loader.close()

    # Train on April, detect on a single test day
    detector = AnomalyDetector()
    detector.train(power_df)

    test_loader = UKDALELoader()
    test_loader.load()
    test_loader.set_window(start="2013-05-01", end="2013-05-02")

    test_disaggregator = EnergyDisaggregator()
    test_disaggregator.load_model()
    test_power = test_disaggregator.disaggregate(
        test_loader,
        test_start="2013-05-01",
        test_end="2013-05-02",
    )
    test_mains = test_loader.get_mains_power()
    test_power["mains_watts"] = test_mains.reindex(test_power.index, method="nearest")
    test_loader.close()

    payloads = detector.to_prediction_payloads(
        power_df=test_power,
        user_id="000000000000000000000001",
        target_date="2013-05-01",
    )

    print(f"\nGenerated {len(payloads)} anomaly payloads")
    for p in payloads[:3]:
        print(p)