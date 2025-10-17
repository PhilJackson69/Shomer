"""Confidence score normalization and calibration."""

import numpy as np
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os


@dataclass
class ConfidenceCalibration:
    """Represents confidence calibration parameters."""
    model_name: str
    calibration_type: str  # 'platt', 'isotonic', 'temperature'
    parameters: Dict[str, Any]
    training_samples: int
    accuracy: float
    created_at: datetime


class ConfidenceNormalizer:
    """Normalizes and calibrates confidence scores for better reliability."""
    
    def __init__(self, calibration_file: Optional[str] = None):
        """Initialize confidence normalizer."""
        self.calibration_file = calibration_file or "confidence_calibration.json"
        self.calibrations: Dict[str, ConfidenceCalibration] = {}
        self._load_calibrations()
    
    def normalize_confidence(
        self, 
        raw_confidence: float, 
        model_type: str = "default",
        context: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Normalize confidence score based on calibration.
        
        Args:
            raw_confidence: Raw confidence score (0-1)
            model_type: Type of model that generated the confidence
            context: Additional context for normalization
            
        Returns:
            Normalized confidence score (0-1)
        """
        # Ensure confidence is within bounds
        raw_confidence = max(0.0, min(1.0, raw_confidence))
        
        # Apply calibration if available
        if model_type in self.calibrations:
            calibrated = self._apply_calibration(raw_confidence, model_type)
        else:
            calibrated = raw_confidence
        
        # Apply context-based adjustments
        if context:
            calibrated = self._apply_context_adjustments(calibrated, context)
        
        # Apply final normalization
        return self._final_normalization(calibrated)
    
    def _apply_calibration(self, confidence: float, model_type: str) -> float:
        """Apply model-specific calibration."""
        calibration = self.calibrations[model_type]
        
        if calibration.calibration_type == "platt":
            return self._platt_scaling(confidence, calibration.parameters)
        elif calibration.calibration_type == "temperature":
            return self._temperature_scaling(confidence, calibration.parameters)
        elif calibration.calibration_type == "isotonic":
            return self._isotonic_scaling(confidence, calibration.parameters)
        else:
            return confidence
    
    def _platt_scaling(self, confidence: float, params: Dict[str, Any]) -> float:
        """Apply Platt scaling calibration."""
        A = params.get("A", 1.0)
        B = params.get("B", 0.0)
        
        # Platt scaling: P(y=1|x) = 1 / (1 + exp(A * f(x) + B))
        # For confidence calibration, we use: P_calibrated = 1 / (1 + exp(A * (1-confidence) + B))
        calibrated = 1 / (1 + np.exp(A * (1 - confidence) + B))
        return calibrated
    
    def _temperature_scaling(self, confidence: float, params: Dict[str, Any]) -> float:
        """Apply temperature scaling calibration."""
        temperature = params.get("temperature", 1.0)
        
        # Temperature scaling: P_calibrated = softmax(logits / T)
        # For confidence: P_calibrated = sigmoid(logit / T)
        logit = np.log(confidence / (1 - confidence + 1e-8))
        calibrated_logit = logit / temperature
        calibrated = 1 / (1 + np.exp(-calibrated_logit))
        return calibrated
    
    def _isotonic_scaling(self, confidence: float, params: Dict[str, Any]) -> float:
        """Apply isotonic regression calibration."""
        # This would require trained isotonic regression model
        # For now, use linear mapping based on calibration parameters
        min_conf = params.get("min_confidence", 0.0)
        max_conf = params.get("max_confidence", 1.0)
        min_calibrated = params.get("min_calibrated", 0.0)
        max_calibrated = params.get("max_calibrated", 1.0)
        
        # Linear interpolation
        if max_conf > min_conf:
            normalized = (confidence - min_conf) / (max_conf - min_conf)
            calibrated = min_calibrated + normalized * (max_calibrated - min_calibrated)
        else:
            calibrated = confidence
        
        return calibrated
    
    def _apply_context_adjustments(self, confidence: float, context: Dict[str, Any]) -> float:
        """Apply context-based confidence adjustments."""
        adjusted = confidence
        
        # Adjust based on text length
        text_length = context.get("text_length", 0)
        if text_length < 10:
            adjusted *= 0.7  # Reduce confidence for very short text
        elif text_length > 500:
            adjusted *= 1.1  # Slightly increase confidence for longer text
        adjusted = min(1.0, adjusted)
        
        # Adjust based on keyword density
        keyword_density = context.get("keyword_density", 0.0)
        if keyword_density > 0.1:  # High keyword density
            adjusted *= 1.05
        elif keyword_density < 0.01:  # Very low keyword density
            adjusted *= 0.9
        adjusted = min(1.0, adjusted)
        
        # Adjust based on source reliability
        source_reliability = context.get("source_reliability", 1.0)
        adjusted *= source_reliability
        adjusted = min(1.0, adjusted)
        
        # Adjust based on time of day (for context-aware scoring)
        hour = context.get("hour", 12)
        if 22 <= hour or hour <= 6:  # Night time
            adjusted *= 1.02  # Slightly higher confidence for night-time threats
        adjusted = min(1.0, adjusted)
        
        return adjusted
    
    def _final_normalization(self, confidence: float) -> float:
        """Apply final normalization and bounds checking."""
        # Ensure confidence is within valid range
        confidence = max(0.0, min(1.0, confidence))
        
        # Apply sigmoid normalization to prevent extreme values
        if confidence > 0.95:
            confidence = 0.95
        elif confidence < 0.05:
            confidence = 0.05
        
        return confidence
    
    def calibrate_model(
        self, 
        model_type: str, 
        true_labels: List[bool], 
        predicted_confidences: List[float],
        method: str = "platt"
    ) -> ConfidenceCalibration:
        """
        Calibrate a model's confidence scores.
        
        Args:
            model_type: Name/type of the model
            true_labels: True binary labels
            predicted_confidences: Predicted confidence scores
            method: Calibration method ('platt', 'temperature', 'isotonic')
            
        Returns:
            Calibration object with parameters
        """
        if method == "platt":
            params = self._fit_platt_scaling(true_labels, predicted_confidences)
        elif method == "temperature":
            params = self._fit_temperature_scaling(true_labels, predicted_confidences)
        elif method == "isotonic":
            params = self._fit_isotonic_scaling(true_labels, predicted_confidences)
        else:
            raise ValueError(f"Unknown calibration method: {method}")
        
        # Calculate accuracy
        accuracy = self._calculate_calibration_accuracy(true_labels, predicted_confidences)
        
        calibration = ConfidenceCalibration(
            model_name=model_type,
            calibration_type=method,
            parameters=params,
            training_samples=len(true_labels),
            accuracy=accuracy,
            created_at=datetime.now(timezone.utc)
        )
        
        # Store calibration
        self.calibrations[model_type] = calibration
        self._save_calibrations()
        
        return calibration
    
    def _fit_platt_scaling(self, true_labels: List[bool], confidences: List[float]) -> Dict[str, Any]:
        """Fit Platt scaling parameters."""
        from sklearn.linear_model import LogisticRegression
        
        # Convert to numpy arrays
        X = np.array([[1 - conf] for conf in confidences])  # Use (1 - confidence) as feature
        y = np.array(true_labels, dtype=int)
        
        # Fit logistic regression
        lr = LogisticRegression()
        lr.fit(X, y)
        
        # Extract parameters
        A = lr.coef_[0][0]
        B = lr.intercept_[0]
        
        return {"A": A, "B": B}
    
    def _fit_temperature_scaling(self, true_labels: List[bool], confidences: List[float]) -> Dict[str, Any]:
        """Fit temperature scaling parameters."""
        # Simple temperature scaling fit
        # This is a simplified version - in practice, you'd use more sophisticated methods
        
        # Calculate optimal temperature using cross-validation or grid search
        temperatures = np.logspace(-1, 1, 20)  # 0.1 to 10
        best_temp = 1.0
        best_score = -np.inf
        
        for temp in temperatures:
            calibrated_confidences = []
            for conf in confidences:
                logit = np.log(conf / (1 - conf + 1e-8))
                calibrated_logit = logit / temp
                calibrated = 1 / (1 + np.exp(-calibrated_logit))
                calibrated_confidences.append(calibrated)
            
            # Calculate Brier score (lower is better)
            brier_score = np.mean([(conf - label)**2 for conf, label in zip(calibrated_confidences, true_labels)])
            score = -brier_score  # Negative because we want to maximize
        
            if score > best_score:
                best_score = score
                best_temp = temp
        
        return {"temperature": best_temp}
    
    def _fit_isotonic_scaling(self, true_labels: List[bool], confidences: List[float]) -> Dict[str, Any]:
        """Fit isotonic regression calibration."""
        # Simplified isotonic scaling
        # In practice, you'd use sklearn.isotonic.IsotonicRegression
        
        # Calculate empirical calibration parameters
        min_conf = min(confidences)
        max_conf = max(confidences)
        
        # Calculate calibrated range based on true positive rates
        true_pos_rate = np.mean(true_labels)
        min_calibrated = max(0.0, true_pos_rate - 0.1)
        max_calibrated = min(1.0, true_pos_rate + 0.1)
        
        return {
            "min_confidence": min_conf,
            "max_confidence": max_conf,
            "min_calibrated": min_calibrated,
            "max_calibrated": max_calibrated
        }
    
    def _calculate_calibration_accuracy(self, true_labels: List[bool], confidences: List[float]) -> float:
        """Calculate calibration accuracy (reliability)."""
        # Group confidences into bins and calculate accuracy for each bin
        n_bins = 10
        bin_edges = np.linspace(0, 1, n_bins + 1)
        
        bin_accuracies = []
        bin_counts = []
        
        for i in range(n_bins):
            bin_start, bin_end = bin_edges[i], bin_edges[i + 1]
            
            # Find samples in this bin
            in_bin = [(conf, label) for conf, label in zip(confidences, true_labels) 
                     if bin_start <= conf < bin_end]
            
            if len(in_bin) > 0:
                bin_confidences, bin_labels = zip(*in_bin)
                bin_accuracy = np.mean(bin_labels)
                bin_accuracies.append(bin_accuracy)
                bin_counts.append(len(in_bin))
        
        if not bin_accuracies:
            return 0.0
        
        # Calculate weighted average accuracy
        total_samples = sum(bin_counts)
        weighted_accuracy = sum(acc * count for acc, count in zip(bin_accuracies, bin_counts)) / total_samples
        
        return weighted_accuracy
    
    def _load_calibrations(self):
        """Load calibrations from file."""
        if os.path.exists(self.calibration_file):
            try:
                with open(self.calibration_file, 'r') as f:
                    data = json.load(f)
                
                for model_name, calib_data in data.items():
                    calibration = ConfidenceCalibration(
                        model_name=calib_data["model_name"],
                        calibration_type=calib_data["calibration_type"],
                        parameters=calib_data["parameters"],
                        training_samples=calib_data["training_samples"],
                        accuracy=calib_data["accuracy"],
                        created_at=datetime.fromisoformat(calib_data["created_at"])
                    )
                    self.calibrations[model_name] = calibration
                    
            except Exception as e:
                print(f"Failed to load calibrations: {e}")
    
    def _save_calibrations(self):
        """Save calibrations to file."""
        try:
            data = {}
            for model_name, calibration in self.calibrations.items():
                data[model_name] = {
                    "model_name": calibration.model_name,
                    "calibration_type": calibration.calibration_type,
                    "parameters": calibration.parameters,
                    "training_samples": calibration.training_samples,
                    "accuracy": calibration.accuracy,
                    "created_at": calibration.created_at.isoformat()
                }
            
            with open(self.calibration_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            print(f"Failed to save calibrations: {e}")
    
    def get_calibration_info(self, model_type: str) -> Optional[Dict[str, Any]]:
        """Get calibration information for a model."""
        if model_type not in self.calibrations:
            return None
        
        calibration = self.calibrations[model_type]
        return {
            "model_name": calibration.model_name,
            "calibration_type": calibration.calibration_type,
            "training_samples": calibration.training_samples,
            "accuracy": calibration.accuracy,
            "created_at": calibration.created_at.isoformat(),
            "parameters": calibration.parameters
        }


# Global normalizer instance
_normalizer: Optional[ConfidenceNormalizer] = None


def get_confidence_normalizer() -> ConfidenceNormalizer:
    """Get or create global confidence normalizer."""
    global _normalizer
    if _normalizer is None:
        _normalizer = ConfidenceNormalizer()
    return _normalizer


def normalize_confidence(
    confidence: float, 
    model_type: str = "default",
    context: Optional[Dict[str, Any]] = None
) -> float:
    """Convenience function to normalize confidence scores."""
    normalizer = get_confidence_normalizer()
    return normalizer.normalize_confidence(confidence, model_type, context)
