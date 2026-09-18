"""
forecaster.py - Consumption & Bill Forecasting Pipeline

Takes per-appliance power data (output of disaggregator.py) and trains a
scikit-learn regression model to predict future energy consumption (kWh)
per appliance and whole-home bill cost.

Pipeline:
  1. Feature engineering  — extract time-based and rolling statistical
                            features from the historical power DataFrame.
  2. Model training       — GradientBoostingRegressor per appliance,
                            trained on the engineered feature matrix.
  3. Inference            — predict kWh for a future target date.
  4. Bill estimation      — multiply predicted kWh by the UK unit rate
                            to produce a cost prediction payload.
  5. Confidence scoring   — derived from the model's cross-validated R²
                            score, clipped to [0.5, 0.99] for the API.

GradientBoosting is chosen over LinearRegression because energy consumption
has non-linear relationships with time-of-day, day-of-week, and recent
usage history that tree-based ensembles capture well.
"""

import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from config import Config

logger = logging.getLogger(__name__)

# UK electricity unit rate (pence per kWh) as of 2024 Ofgem price cap.
# Used for bill prediction payloads.
UK_UNIT_RATE_PENCE_PER_KWH = 24.5
PENCE_TO_KES = 0.17  # approximate conversion for display purposes
KPLC_UNIT_RATE_KSH_PER_KWH = 25.00  # effective mid-tier domestic rate

MODEL_SAVE_PATH = Path("models/forecaster_models.pkl")


class ConsumptionForecaster:
    """
    Trains per-appliance GradientBoosting regressors on historical
    disaggregated power data and generates consumption + bill forecasts.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = Path(model_path) if model_path else MODEL_SAVE_PATH
        # One Pipeline (scaler + regressor) per appliance label
        self.models: dict[str, Pipeline] = {}
        # Cross-validated R² score per appliance — used for confidence
        self.scores: dict[str, float] = {}
        self._trained = False

    # ------------------------------------------------------------------
    # Feature Engineering
    # ------------------------------------------------------------------

    def _build_features(self, power_df: pd.DataFrame) -> pd.DataFrame:
        """
        Engineer a feature matrix from the raw per-appliance power DataFrame.

        Features per row (timestep):
          - hour_of_day        (0–23)
          - day_of_week        (0=Monday … 6=Sunday)
          - is_weekend         (binary)
          - month              (1–12)
          - rolling_mean_1h    rolling 1-hour mean of mains power
          - rolling_std_1h     rolling 1-hour std of mains power
          - rolling_mean_24h   rolling 24-hour mean of mains power
          - lag_1              mains power 1 timestep ago (6s lag)
          - lag_10             mains power 10 timesteps ago (60s lag)
          - lag_600            mains power 600 timesteps ago (1-hour lag)

        Args:
            power_df: DataFrame from disaggregator, Watts per timestep.
                      Expected to contain a 'mains_watts' column.

        Returns:
            Feature DataFrame aligned to power_df's index.
        """
        df = pd.DataFrame(index=power_df.index)

        df["hour_of_day"] = power_df.index.hour
        df["day_of_week"] = power_df.index.dayofweek
        df["is_weekend"] = (power_df.index.dayofweek >= 5).astype(int)
        df["month"] = power_df.index.month

        # Use mains_watts as the aggregate signal for rolling features
        # Fall back to the sum of all columns if mains_watts not present
        if "mains_watts" in power_df.columns:
            agg = power_df["mains_watts"]
        else:
            agg = power_df.sum(axis=1)

        # Rolling window sizes in number of 6s timesteps
        steps_1h = 3600 // Config.SAMPLE_PERIOD    # 600 steps
        steps_24h = 86400 // Config.SAMPLE_PERIOD  # 14400 steps

        df["rolling_mean_1h"] = agg.rolling(steps_1h, min_periods=1).mean()
        df["rolling_std_1h"] = agg.rolling(steps_1h, min_periods=1).std().fillna(0)
        df["rolling_mean_24h"] = agg.rolling(steps_24h, min_periods=1).mean()

        df["lag_1"] = agg.shift(1).bfill()
        df["lag_10"] = agg.shift(10).bfill()
        df["lag_600"] = agg.shift(steps_1h).bfill()

        return df

    def _build_hourly_target(
        self, power_df: pd.DataFrame, appliance: str
    ) -> pd.Series:
        """
        Resample the per-appliance power series to hourly kWh values.
        These are the regression targets (one value per hour).

        kWh per hour = mean_watts_in_hour × 1h / 1000
        """
        watts = power_df[appliance]
        kwh_hourly = watts.resample("1h").mean() / 1000.0
        return kwh_hourly.fillna(0)

    def _align_to_hourly(self, features: pd.DataFrame) -> pd.DataFrame:
        """Downsample the feature matrix to hourly resolution by taking the mean."""
        return features.resample("1h").mean().fillna(0)

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, power_df: pd.DataFrame) -> None:
        """
        Train one GradientBoostingRegressor per appliance column in power_df.

        Args:
            power_df: DataFrame from disaggregator.disaggregate(), containing
                      per-appliance Watts columns plus optionally 'mains_watts'.
        """
        logger.info(f"Building feature matrix from {len(power_df)} timesteps")
        features_6s = self._build_features(power_df)
        features_hourly = self._align_to_hourly(features_6s)

        appliance_cols = [c for c in power_df.columns if c != "mains_watts"]

        for appliance in appliance_cols:
            logger.info(f"Training forecaster for: {appliance}")

            target = self._build_hourly_target(power_df, appliance)

            # Align features and target on the shared hourly index
            X, y = features_hourly.align(target, join="inner", axis=0)

            if len(X) < 24:
                logger.warning(f"Skipping '{appliance}': insufficient data ({len(X)} hourly samples)")
                continue

            model_pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("regressor", GradientBoostingRegressor(
                    n_estimators=100,
                    learning_rate=0.1,
                    max_depth=4,
                    min_samples_split=5,
                    random_state=42,
                )),
            ])

            # 3-fold CV to get a confidence proxy; not used to select the model
            cv_scores = cross_val_score(
                model_pipeline, X, y,
                cv=3, scoring="r2", n_jobs=-1,
            )
            r2 = float(np.clip(np.mean(cv_scores), 0.0, 1.0))
            self.scores[appliance] = r2

            # Fit on the full training data after CV
            model_pipeline.fit(X, y)
            self.models[appliance] = model_pipeline

            logger.info(f"  {appliance}: R²={r2:.3f} over {len(X)} hourly samples")

        self._trained = True
        logger.info(f"Training complete: {len(self.models)} appliance models")
        self.save_models()

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def forecast(
        self,
        recent_power_df: pd.DataFrame,
        target_date: str,
    ) -> pd.DataFrame:
        """
        Predict hourly kWh consumption for each appliance on a future date.

        Strategy: the calendar features (hour_of_day, day_of_week,
        is_weekend, month) are known exactly for every hour of the target
        date, so those vary normally across the 24 forecast rows. The
        rolling/lag features (rolling_mean_1h, rolling_std_1h,
        rolling_mean_24h, lag_1, lag_10, lag_600) describe recent
        history we don't have yet for a future date, so they're frozen
        at their last known real value from recent_power_df and applied
        uniformly across all 24 forecast hours.

        (An earlier version tried to extend recent_power_df with 24
        zero-filled hourly rows and recompute rolling/lag features over
        the combined frame. That mixed two different samplings in one
        series — 6-second real data followed by hourly-spaced zeros —
        and the rolling/lag windows here are row-count based
        (`steps_1h`/`steps_24h`), so once the window crossed into the
        sparse zero-filled section a "600-row" window silently stopped
        meaning "1 hour". The later hours of every forecast ended up
        biased toward zero as the synthetic padding took over the
        context features. Freezing the context instead avoids that
        entirely.)

        Args:
            recent_power_df: Recent historical power data (at least 24h
                             recommended) used to seed rolling features.
            target_date:     ISO date string, e.g. '2013-05-01'.

        Returns:
            DataFrame indexed by hour (0–23), columns are appliance labels,
            values are predicted kWh per hour.
        """
        if not self._trained:
            raise RuntimeError("Call train() or load_models() first.")

        logger.info(f"Forecasting consumption for {target_date}")

        # Real 6s-granularity features from actual recent history — take
        # the last row as the current rolling/lag context.
        context_row = self._build_features(recent_power_df).iloc[-1]
        context_cols = ["rolling_mean_1h", "rolling_std_1h", "rolling_mean_24h",
                        "lag_1", "lag_10", "lag_600"]

        target_index = pd.date_range(
            start=target_date,
            periods=24,
            freq="1h",
            tz=recent_power_df.index.tz,
        )

        target_features = pd.DataFrame(index=target_index, columns=context_row.index, dtype=float)
        target_features["hour_of_day"] = target_features.index.hour
        target_features["day_of_week"] = target_features.index.dayofweek
        target_features["is_weekend"] = (target_features.index.dayofweek >= 5).astype(int)
        target_features["month"] = target_features.index.month
        for col in context_cols:
            target_features[col] = context_row[col]

        results = {}
        for appliance, model in self.models.items():
            try:
                predicted = model.predict(target_features)
                # Clip negatives — energy can't be negative
                results[appliance] = np.clip(predicted, 0, None)
            except Exception as exc:
                logger.warning(f"Forecast failed for '{appliance}': {exc}")

        forecast_df = pd.DataFrame(results, index=range(len(target_features)))
        logger.info(f"Forecast complete: {forecast_df.shape[1]} appliances × 24 hours")
        return forecast_df

    def compute_daily_totals(self, forecast_df: pd.DataFrame) -> pd.Series:
        """
        Sum the hourly kWh forecast into a single daily total per appliance.

        Returns:
            Series indexed by appliance, values in kWh.
        """
        return forecast_df.sum().round(4)

    def estimate_bill(self, daily_kwh: pd.Series) -> float:
        """
        Estimate the electricity bill cost for a day's predicted consumption.

        Args:
            daily_kwh: Output of compute_daily_totals().

        Returns:
            Estimated daily cost in KES (Kenyan Shilling).
        """
        total_kwh = daily_kwh.sum()
        cost_ksh = total_kwh * KPLC_UNIT_RATE_KSH_PER_KWH
        return round(cost_ksh, 2)

    def confidence_for(self, appliance: str) -> float:
        """
        Return the confidence score for a given appliance's model,
        derived from cross-validated R² during training.
        Clipped to [0.5, 0.99] for the API payload.
        """
        raw_r2 = self.scores.get(appliance, 0.5)
        return float(np.clip(raw_r2, 0.5, 0.99))

    def to_prediction_payloads(
        self,
        daily_kwh: pd.Series,
        user_id: str,
        target_date: str,
        device_map: Optional[dict[str, str]] = None,
    ) -> list[dict]:
        """
        Build the list of prediction payload dicts for the Node.js API,
        covering both 'consumption' and 'bill' prediction types.

        Args:
            daily_kwh:   Output of compute_daily_totals().
            user_id:     MongoDB ObjectId string.
            target_date: ISO date string the forecast applies to.
            device_map:  Optional appliance label → MongoDB device _id mapping.

        Returns:
            List of payload dicts ready for POST to /api/ml/predictions.
        """
        payloads = []

        # Per-appliance consumption predictions
        for appliance, kwh in daily_kwh.items():
            if kwh <= 0:
                continue

            payload: dict = {
                "userId": user_id,
                "type": "consumption",
                "predictedValue": float(kwh),
                "confidence": self.confidence_for(str(appliance)),
                "targetDate": target_date,
            }

            if device_map and appliance in device_map:
                payload["device"] = device_map[str(appliance)]

            payloads.append(payload)

        # Single whole-home bill prediction
        bill_pence = self.estimate_bill(daily_kwh)
        payloads.append({
            "userId": user_id,
            "type": "bill",
            "predictedValue": float(self.estimate_bill(daily_kwh)),  # KSH
            "confidence": float(np.mean(list(self.scores.values())) if self.scores else 0.6), # average confidence across appliances
            "targetDate": target_date,
        })

        return payloads

    # ------------------------------------------------------------------
    # Model persistence
    # ------------------------------------------------------------------

    def save_models(self) -> None:
        """Pickle all trained appliance models and scores to disk."""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump({"models": self.models, "scores": self.scores}, f)
        logger.info(f"Forecaster models saved to {self.model_path}")

    def load_models(self) -> None:
        """Load previously trained models from disk."""
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"No saved models at {self.model_path}. Run train() first."
            )
        with open(self.model_path, "rb") as f:
            data = pickle.load(f)
        self.models = data["models"]
        self.scores = data["scores"]
        self._trained = True
        logger.info(f"Loaded {len(self.models)} forecaster models from {self.model_path}")


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from ingestion.loader import UKDALELoader
    from pipeline.disaggregator import EnergyDisaggregator

    # Load and extract a training window
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

    # Also include mains for rolling features
    mains = loader.get_mains_power()
    power_df["mains_watts"] = mains.reindex(power_df.index, method="nearest")
    loader.close()

    # Train the forecaster
    forecaster = ConsumptionForecaster()
    forecaster.train(power_df)

    # Forecast the next day
    recent = power_df.tail(14400)  # last 24h of training data
    forecast_df = forecaster.forecast(recent, target_date="2013-05-01")

    daily = forecaster.compute_daily_totals(forecast_df)
    print("\nForecasted daily kWh per appliance:")
    print(daily.sort_values(ascending=False))

    bill = forecaster.estimate_bill(daily)
    print(f"\nEstimated daily bill: KSh {bill:.2f}")

    payloads = forecaster.to_prediction_payloads(
        daily_kwh=daily,
        user_id="000000000000000000000001",
        target_date="2013-05-01",
    )
    print(f"\nGenerated {len(payloads)} prediction payloads")
    for p in payloads[:3]:
        print(p)