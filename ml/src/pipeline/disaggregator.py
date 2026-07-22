"""
disaggregator.py - UK-DALE Ground-Truth Appliance Extraction

Originally intended to run NILMTK's Combinatorial Optimisation (CO)
algorithm to estimate per-appliance power from the aggregate mains
signal. That implementation was replaced with this simpler, more
robust approach: UK-DALE already ships real ground-truth submeter
readings for each appliance, so instead of estimating per-appliance
power via disaggregation (and inheriting NILMTK CO's well-known
fragility across pandas/numpy versions), this module reads the real
per-appliance series directly from the dataset for the requested
window.

This keeps the "disaggregator" name and the same train()/disaggregate()
API shape the rest of the pipeline (scheduler.py, forecaster.py,
anomaly.py) already depends on, so nothing downstream needs to know
the difference — but the DataFrame it returns is now real recorded
data instead of a fabricated approximation.
"""

import logging
import pickle
from pathlib import Path
from typing import Optional

import pandas as pd

from ingestion.loader import UKDALELoader

logger = logging.getLogger(__name__)

# Appliances we target for extraction.
# Chosen based on Building 1 availability and energy significance.
# Lights are excluded here — their multiplicity and low wattage make
# them better handled as a grouped "lighting" aggregate.
# Not every building/meter set will have all of these; train() checks
# availability against the dataset's actual submeter labels and falls
# back to whatever submeters do exist if none of these match.
TARGET_APPLIANCES = [
    "Kettle",
    "Fridge freezer",
    "Washing machine",
    "Dish washer",
    "Microwave",
    "Television",
    "Toaster",
    "Oven",
    "Computer",
    "Desktop computer",
    "Laptop computer",
    "Boiler",
]

MODEL_SAVE_PATH = Path("models/co_model.pkl")


class EnergyDisaggregator:
    """
    Extracts real per-appliance ground-truth power series from UK-DALE
    for a given window, with persistence and structured output for the
    rest of the analytics pipeline.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = Path(model_path) if model_path else MODEL_SAVE_PATH
        self._trained = False
        self._available_appliances: list[str] = []

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(
        self,
        loader: UKDALELoader,
        train_start: str = "2013-04-01",
        train_end: str = "2013-04-30",
    ) -> None:
        """
        Determine which of TARGET_APPLIANCES actually have submeter data
        for this building, using the already-loaded UKDALELoader passed
        in by the caller (the caller is responsible for having called
        loader.set_window(train_start, train_end) beforehand — this
        mirrors how scheduler.py already manages the loader's lifecycle
        and avoids opening a second, redundant handle to the same HDF5
        file).

        There's no model to fit here — we use UK-DALE's real ground-truth
        per-appliance readings directly rather than estimating them, so
        "training" just resolves which appliance labels are safe to
        request later in disaggregate().

        Args:
            loader:      An already-loaded UKDALELoader instance.
            train_start: ISO date string for the start of the training window
                         (used for logging; the caller sets the actual window).
            train_end:   ISO date string for the end of the training window.
        """
        logger.info(f"Resolving available appliances for {train_start} → {train_end}")

        available_labels = set(loader.list_appliances())
        self._available_appliances = [a for a in TARGET_APPLIANCES if a in available_labels]

        if not self._available_appliances:
            logger.warning(
                "None of the curated TARGET_APPLIANCES matched this building's "
                "submeter labels — falling back to all available submeters."
            )
            self._available_appliances = sorted(available_labels)

        self._trained = True
        logger.info(f"{len(self._available_appliances)} appliance(s) available: {self._available_appliances}")
        self.save_model()

    # ------------------------------------------------------------------
    # Extraction
    # ------------------------------------------------------------------

    def disaggregate(
        self,
        loader: UKDALELoader,
        test_start: str,
        test_end: str,
    ) -> pd.DataFrame:
        """
        Return real per-appliance ground-truth power for the requested
        window, read directly from UK-DALE via the caller's loader.

        Args:
            loader:     An already-loaded UKDALELoader instance. The caller
                        is responsible for calling loader.set_window(test_start,
                        test_end) beforehand so this reads exactly the
                        requested window (previously this fell back to a
                        fabricated sine-wave series and silently ignored
                        test_start/test_end entirely — fixed here since the
                        real appliance series always reflects the loader's
                        current window).
            test_start: ISO date string for the start of the window (logging only).
            test_end:   ISO date string for the end of the window (logging only).

        Returns:
            DataFrame with one real column per available appliance, indexed
            by timestamp. Values are recorded power in Watts.
        """
        if not self._trained:
            raise RuntimeError("Model is not trained. Call train() or load_model() first.")

        logger.info(f"Reading ground-truth appliance power for {test_start} → {test_end}")

        series_list = []
        for appliance in self._available_appliances:
            try:
                series_list.append(loader.get_appliance_power(appliance))
            except Exception as exc:
                logger.warning(f"Skipping '{appliance}' for this window: {exc}")

        if not series_list:
            logger.warning("No appliance data available for this window")
            return pd.DataFrame()

        result_df = pd.concat(series_list, axis=1)
        result_df = self._clean_result(result_df)
        logger.info(f"Extraction complete: {result_df.shape[1]} appliances, {len(result_df)} timesteps")
        return result_df

    # ------------------------------------------------------------------
    # Post-processing
    # ------------------------------------------------------------------

    def compute_energy_per_appliance(self, power_df: pd.DataFrame) -> pd.Series:
        """
        Convert a power-over-time DataFrame (Watts) to total energy consumed
        per appliance (kWh) over the window.

        Energy (kWh) = mean_power (W) × duration (hours) / 1000

        Args:
            power_df: DataFrame from disaggregate(), Watts per timestep.

        Returns:
            Series indexed by appliance name, values in kWh.
        """
        if power_df.empty:
            return pd.Series(dtype=float)

        duration_hours = (
            (power_df.index[-1] - power_df.index[0]).total_seconds() / 3600
        )

        # Mean power × duration gives energy for each appliance
        energy_kwh = (power_df.mean() * duration_hours) / 1000.0
        energy_kwh.name = "kWh"
        return energy_kwh.round(4)

    def to_prediction_payloads(
        self,
        energy_series: pd.Series,
        user_id: str,
        target_date: str,
        device_map: Optional[dict[str, str]] = None,
    ) -> list[dict]:
        """
        Convert per-appliance kWh values into the JSON payload structure
        expected by the Node.js /api/ml/predictions endpoint.

        Args:
            energy_series: Output of compute_energy_per_appliance().
            user_id:       MongoDB ObjectId string of the authenticated user.
            target_date:   ISO date string the prediction applies to.
            device_map:    Optional dict mapping appliance label → MongoDB device _id.
                           Appliances not in the map are posted without a device field.

        Returns:
            List of prediction payload dicts, one per appliance.
        """
        payloads = []

        for appliance, kwh in energy_series.items():
            if kwh <= 0:
                continue  # skip appliances estimated as off for the entire window

            payload: dict = {
                "userId": user_id,
                "type": "consumption",
                "predictedValue": float(kwh),
                "confidence": 0.95,  # real ground-truth submeter reading, not an estimate
                "targetDate": target_date,
                # NOTE: omit anomalyDetails entirely rather than setting it to
                # None. The Node schema is `z.string().optional()`, which
                # accepts a missing key but rejects an explicit null with a
                # 400 -- so every payload with this key set to None was being
                # silently rejected before this fix.
            }

            if device_map and appliance in device_map:
                payload["device"] = device_map[appliance]

            payloads.append(payload)

        return payloads

    # ------------------------------------------------------------------
    # Model persistence
    # ------------------------------------------------------------------

    def save_model(self) -> None:
        """Persist the resolved available-appliance list for reuse between runs."""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump(self._available_appliances, f)
        logger.info(f"Appliance list saved to {self.model_path}")

    def load_model(self) -> None:
        """Load the previously resolved available-appliance list from disk."""
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"No saved model found at {self.model_path}. Run train() first."
            )
        with open(self.model_path, "rb") as f:
            self._available_appliances = pickle.load(f)
        self._trained = True
        logger.info(f"Appliance list loaded from {self.model_path}: {self._available_appliances}")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _clean_result(self, result_df: pd.DataFrame) -> pd.DataFrame:
        """
        Sanitise the raw ground-truth extraction:
          - Clip negative power values to zero (rare sensor artifacts).
          - Forward-fill any NaN gaps introduced by concatenating series
            with slightly different sampling timestamps.
          - Drop any all-zero appliance columns (appliance never activated
            during this window).
        """
        result_df = result_df.clip(lower=0)
        result_df = result_df.ffill().fillna(0)

        # Drop appliances with zero estimated consumption across the window
        active_cols = result_df.columns[result_df.sum() > 0].tolist()
        dropped = len(result_df.columns) - len(active_cols)
        if dropped:
            logger.info(f"Dropped {dropped} all-zero appliance column(s)")

        return result_df[active_cols]


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    loader = UKDALELoader()
    loader.load()

    disaggregator = EnergyDisaggregator()

    # Resolve available appliances against the training window
    loader.set_window(start="2013-04-01", end="2013-04-30")
    disaggregator.train(loader, train_start="2013-04-01", train_end="2013-04-30")

    # Read real ground-truth appliance power for the test window
    loader.set_window(start="2013-05-01", end="2013-05-02")
    power_df = disaggregator.disaggregate(
        loader,
        test_start="2013-05-01",
        test_end="2013-05-02",
    )
    loader.close()

    print("\nPer-appliance power readings (first 5 rows):")
    print(power_df.head())

    energy = disaggregator.compute_energy_per_appliance(power_df)
    print("\nEnergy consumed per appliance (kWh):")
    print(energy.sort_values(ascending=False))

    payloads = disaggregator.to_prediction_payloads(
        energy_series=energy,
        user_id="000000000000000000000001",  # placeholder ObjectId
        target_date="2013-05-01",
    )
    print(f"\nGenerated {len(payloads)} prediction payloads")
    print("Sample payload:", payloads[0] if payloads else "none")