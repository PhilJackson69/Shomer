"""MFA rollout feature flags and controls."""
import hashlib
import os
from enum import Enum
from typing import List, Optional, Set
from sqlalchemy.orm import Session

from app.core.config import settings


class MFARolloutMode(Enum):
    """MFA rollout modes for staged deployment."""
    OFF = "off"           # Never block; log only
    DRYRUN = "dryrun"     # Log policy decisions; never block; emit would_block metric
    COHORTS = "cohorts"   # Enforce only for users in cohort
    PERCENT = "percent"   # Consistent hashing on user_id → enforce if hash_mod < MFA_PERCENT
    ON = "on"            # Enforce for all admin roles


class MFACohortSource(Enum):
    """Source for MFA cohort membership."""
    DB = "db"            # Database table
    ENV = "env"          # Environment variable fallback


class MFARolloutFlags:
    """MFA rollout feature flags and controls."""
    
    def __init__(self):
        self.mode = self._get_rollout_mode()
        self.percent = self._get_rollout_percent()
        self.cohort_source = self._get_cohort_source()
        self.cohort_user_ids = self._get_cohort_user_ids()
    
    def _get_rollout_mode(self) -> MFARolloutMode:
        """Get MFA rollout mode from environment."""
        mode_str = getattr(settings, 'MFA_ROLLOUT_MODE', 'off').lower()
        try:
            return MFARolloutMode(mode_str)
        except ValueError:
            # Default to OFF for safety
            return MFARolloutMode.OFF
    
    def _get_rollout_percent(self) -> int:
        """Get MFA rollout percentage (0-100)."""
        percent = getattr(settings, 'MFA_PERCENT', 0)
        return max(0, min(100, int(percent)))
    
    def _get_cohort_source(self) -> MFACohortSource:
        """Get cohort source from environment."""
        source_str = getattr(settings, 'MFA_COHORT_SOURCE', 'env').lower()
        try:
            return MFACohortSource(source_str)
        except ValueError:
            return MFACohortSource.ENV
    
    def _get_cohort_user_ids(self) -> Set[int]:
        """Get cohort user IDs from environment variable."""
        user_ids_str = getattr(settings, 'MFA_COHORT_USER_IDS', '')
        if not user_ids_str:
            return set()
        
        try:
            # Parse comma-separated user IDs
            user_ids = []
            for user_id_str in user_ids_str.split(','):
                user_id_str = user_id_str.strip()
                if user_id_str:
                    user_ids.append(int(user_id_str))
            return set(user_ids)
        except ValueError:
            # Invalid format, return empty set
            return set()
    
    def is_user_in_cohort(self, user_id: int, db: Session) -> bool:
        """Check if user is in MFA rollout cohort."""
        if self.cohort_source == MFACohortSource.DB:
            return self._is_user_in_db_cohort(user_id, db)
        else:
            return user_id in self.cohort_user_ids
    
    def _is_user_in_db_cohort(self, user_id: int, db: Session) -> bool:
        """Check if user is in database cohort."""
        try:
            from app.models.mfa import MFACohortMember
            return db.query(MFACohortMember).filter(
                MFACohortMember.user_id == user_id
            ).first() is not None
        except Exception:
            # If table doesn't exist or other error, fall back to env
            return user_id in self.cohort_user_ids
    
    def should_enforce_mfa(self, user_id: int, user_role: str, db: Session) -> tuple[bool, str]:
        """
        Determine if MFA should be enforced for a user.
        
        Returns:
            tuple[bool, str]: (should_enforce, reason)
        """
        # Only enforce for admin users
        if user_role != "admin":
            return False, "non_admin"
        
        # Check existing MFA enforcement setting
        if not getattr(settings, 'MFA_ENFORCE_ADMINS', True):
            return False, "enforcement_disabled"
        
        # Apply rollout logic based on mode
        if self.mode == MFARolloutMode.OFF:
            return False, "rollout_off"
        
        elif self.mode == MFARolloutMode.DRYRUN:
            # In dryrun mode, check what we would do but don't enforce
            would_enforce, reason = self._check_enforcement_logic(user_id, user_role, db)
            return False, f"dryrun_{reason}" if would_enforce else f"dryrun_{reason}"
        
        elif self.mode == MFARolloutMode.COHORTS:
            return self._check_cohort_enforcement(user_id, user_role, db)
        
        elif self.mode == MFARolloutMode.PERCENT:
            return self._check_percent_enforcement(user_id, user_role)
        
        elif self.mode == MFARolloutMode.ON:
            return True, "full_enforcement"
        
        else:
            return False, "unknown_mode"
    
    def _check_enforcement_logic(self, user_id: int, user_role: str, db: Session) -> tuple[bool, str]:
        """Check what enforcement logic would apply (for dryrun mode)."""
        if self.mode == MFARolloutMode.COHORTS:
            return self._check_cohort_enforcement(user_id, user_role, db)
        elif self.mode == MFARolloutMode.PERCENT:
            return self._check_percent_enforcement(user_id, user_role)
        elif self.mode == MFARolloutMode.ON:
            return True, "full_enforcement"
        else:
            return False, "no_enforcement"
    
    def _check_cohort_enforcement(self, user_id: int, user_role: str, db: Session) -> tuple[bool, str]:
        """Check cohort-based enforcement."""
        if self.is_user_in_cohort(user_id, db):
            return True, "cohort_member"
        else:
            return False, "not_in_cohort"
    
    def _check_percent_enforcement(self, user_id: int, user_role: str) -> tuple[bool, str]:
        """Check percentage-based enforcement using consistent hashing."""
        if self.percent == 0:
            return False, "percent_zero"
        elif self.percent == 100:
            return True, "percent_full"
        
        # Consistent hashing on user_id
        user_hash = hashlib.md5(str(user_id).encode()).hexdigest()
        hash_int = int(user_hash[:8], 16)  # Use first 8 hex chars
        hash_mod = hash_int % 100
        
        if hash_mod < self.percent:
            return True, f"percent_{hash_mod}"
        else:
            return False, f"percent_{hash_mod}"
    
    def get_metrics_labels(self, user_id: int, user_role: str, db: Session) -> dict:
        """Get metrics labels for MFA enforcement decisions."""
        should_enforce, reason = self.should_enforce_mfa(user_id, user_role, db)
        
        labels = {
            "mode": self.mode.value,
            "percent": str(self.percent),
            "cohort_source": self.cohort_source.value,
            "user_role": user_role,
            "reason": reason,
            "enforced": str(should_enforce).lower()
        }
        
        return labels


# Global instance for easy access
mfa_flags = MFARolloutFlags()


def get_mfa_flags() -> MFARolloutFlags:
    """Get MFA rollout flags instance."""
    return mfa_flags
