"""Tests for MFA rollout logic."""
import os
import pytest
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session

from app.flags.mfa import MFARolloutFlags, MFARolloutMode, MFACohortSource
from app.models.mfa import MFACohortMember
from app.models.user import User


@pytest.fixture
def mock_db():
    """Mock database session."""
    return Mock(spec=Session)


@pytest.fixture
def test_user():
    """Test user object."""
    user = Mock(spec=User)
    user.id = 123
    user.role = "admin"
    return user


@pytest.fixture
def test_non_admin_user():
    """Test non-admin user object."""
    user = Mock(spec=User)
    user.id = 456
    user.role = "moderator"
    return user


class TestMFARolloutFlags:
    """Test MFA rollout flags functionality."""

    def test_rollout_mode_off(self, mock_db, test_user):
        """Test OFF mode - never enforce."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'off',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert not should_enforce
            assert reason == "rollout_off"

    def test_rollout_mode_dryrun(self, mock_db, test_user):
        """Test DRYRUN mode - log decisions but don't enforce."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'dryrun',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert not should_enforce
            assert reason.startswith("dryrun_")

    def test_rollout_mode_cohorts_env(self, mock_db, test_user):
        """Test COHORTS mode with environment variable."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'cohorts',
            'MFA_COHORT_SOURCE': 'env',
            'MFA_COHORT_USER_IDS': '123,456,789',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            
            # User in cohort
            should_enforce, reason = flags.should_enforce_mfa(
                123, "admin", mock_db
            )
            assert should_enforce
            assert reason == "cohort_member"
            
            # User not in cohort
            should_enforce, reason = flags.should_enforce_mfa(
                999, "admin", mock_db
            )
            assert not should_enforce
            assert reason == "not_in_cohort"

    def test_rollout_mode_cohorts_db(self, mock_db, test_user):
        """Test COHORTS mode with database."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'cohorts',
            'MFA_COHORT_SOURCE': 'db',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            
            # Mock database query for cohort member
            mock_cohort_member = Mock(spec=MFACohortMember)
            mock_db.query.return_value.filter.return_value.first.return_value = mock_cohort_member
            
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert should_enforce
            assert reason == "cohort_member"

    def test_rollout_mode_percent(self, mock_db, test_user):
        """Test PERCENT mode with consistent hashing."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'percent',
            'MFA_PERCENT': '50',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            
            # Test with user ID that should be in 50% rollout
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            
            # The result depends on the hash of the user ID
            # We'll test that the reason contains the hash mod
            assert reason.startswith("percent_")
            assert reason.replace("percent_", "").isdigit()

    def test_rollout_mode_percent_boundaries(self, mock_db, test_user):
        """Test PERCENT mode boundary conditions."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'percent',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            # Test 0% - should never enforce
            flags = MFARolloutFlags()
            flags.percent = 0
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert not should_enforce
            assert reason == "percent_zero"
            
            # Test 100% - should always enforce
            flags.percent = 100
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert should_enforce
            assert reason == "percent_full"

    def test_rollout_mode_on(self, mock_db, test_user):
        """Test ON mode - enforce for all admins."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'on',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert should_enforce
            assert reason == "full_enforcement"

    def test_non_admin_user(self, mock_db, test_non_admin_user):
        """Test that non-admin users are never enforced."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'on',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                test_non_admin_user.id, test_non_admin_user.role, mock_db
            )
            assert not should_enforce
            assert reason == "non_admin"

    def test_enforcement_disabled(self, mock_db, test_user):
        """Test when MFA enforcement is disabled."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'on',
            'MFA_ENFORCE_ADMINS': 'false'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert not should_enforce
            assert reason == "enforcement_disabled"

    def test_cohort_user_ids_parsing(self):
        """Test parsing of cohort user IDs from environment."""
        with patch.dict(os.environ, {
            'MFA_COHORT_USER_IDS': '123, 456, 789'
        }):
            flags = MFARolloutFlags()
            assert flags.cohort_user_ids == {123, 456, 789}

    def test_cohort_user_ids_invalid(self):
        """Test handling of invalid cohort user IDs."""
        with patch.dict(os.environ, {
            'MFA_COHORT_USER_IDS': '123, invalid, 789'
        }):
            flags = MFARolloutFlags()
            assert flags.cohort_user_ids == set()

    def test_cohort_user_ids_empty(self):
        """Test handling of empty cohort user IDs."""
        with patch.dict(os.environ, {
            'MFA_COHORT_USER_IDS': ''
        }):
            flags = MFARolloutFlags()
            assert flags.cohort_user_ids == set()

    def test_metrics_labels(self, mock_db, test_user):
        """Test metrics labels generation."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'cohorts',
            'MFA_PERCENT': '50',
            'MFA_COHORT_SOURCE': 'env',
            'MFA_COHORT_USER_IDS': '123'
        }):
            flags = MFARolloutFlags()
            labels = flags.get_metrics_labels(
                test_user.id, test_user.role, mock_db
            )
            
            assert labels['mode'] == 'cohorts'
            assert labels['percent'] == '50'
            assert labels['cohort_source'] == 'env'
            assert labels['user_role'] == 'admin'
            assert 'reason' in labels
            assert 'enforced' in labels

    def test_dryrun_would_block_logic(self, mock_db, test_user):
        """Test dryrun mode would-block logic."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'dryrun',
            'MFA_COHORT_SOURCE': 'env',
            'MFA_COHORT_USER_IDS': '123',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            
            # User in cohort - should would-block
            should_enforce, reason = flags.should_enforce_mfa(
                123, "admin", mock_db
            )
            assert not should_enforce
            assert reason == "dryrun_cohort_member"
            
            # User not in cohort - should not would-block
            should_enforce, reason = flags.should_enforce_mfa(
                999, "admin", mock_db
            )
            assert not should_enforce
            assert reason == "dryrun_not_in_cohort"

    def test_consistent_hashing(self, mock_db, test_user):
        """Test that consistent hashing produces stable results."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'percent',
            'MFA_PERCENT': '50',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            
            # Same user ID should always produce same result
            result1 = flags._check_percent_enforcement(123, "admin")
            result2 = flags._check_percent_enforcement(123, "admin")
            assert result1 == result2
            
            # Different user IDs may produce different results
            result3 = flags._check_percent_enforcement(456, "admin")
            # We can't predict the exact result, but it should be consistent
            assert isinstance(result3[0], bool)
            assert result3[1].startswith("percent_")

    def test_database_cohort_fallback(self, mock_db, test_user):
        """Test database cohort fallback to environment."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'cohorts',
            'MFA_COHORT_SOURCE': 'db',
            'MFA_COHORT_USER_IDS': '123',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            
            # Mock database error (table doesn't exist)
            mock_db.query.side_effect = Exception("Table doesn't exist")
            
            # Should fall back to environment variable
            should_enforce, reason = flags.should_enforce_mfa(
                123, "admin", mock_db
            )
            assert should_enforce
            assert reason == "cohort_member"

    def test_invalid_rollout_mode(self, mock_db, test_user):
        """Test handling of invalid rollout mode."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'invalid',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                test_user.id, test_user.role, mock_db
            )
            assert not should_enforce
            assert reason == "unknown_mode"

    def test_invalid_cohort_source(self, mock_db, test_user):
        """Test handling of invalid cohort source."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'cohorts',
            'MFA_COHORT_SOURCE': 'invalid',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            # Should default to ENV source
            assert flags.cohort_source == MFACohortSource.ENV


class TestMFARolloutIntegration:
    """Integration tests for MFA rollout."""

    @pytest.fixture
    def cohort_test_user(self):
        """Test user for cohort testing."""
        user = Mock(spec=User)
        user.id = 1
        user.role = "admin"
        return user

    def test_rollout_mode_transitions(self, mock_db, cohort_test_user):
        """Test transitioning between rollout modes."""
        # Start with OFF mode
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'off',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                cohort_test_user.id, cohort_test_user.role, mock_db
            )
            assert not should_enforce
            assert reason == "rollout_off"

        # Transition to DRYRUN mode
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'dryrun',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                cohort_test_user.id, cohort_test_user.role, mock_db
            )
            assert not should_enforce
            assert reason.startswith("dryrun_")

        # Transition to COHORTS mode
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'cohorts',
            'MFA_COHORT_SOURCE': 'env',
            'MFA_COHORT_USER_IDS': '1',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                cohort_test_user.id, cohort_test_user.role, mock_db
            )
            assert should_enforce
            assert reason == "cohort_member"

        # Transition to PERCENT mode
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'percent',
            'MFA_PERCENT': '100',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                cohort_test_user.id, cohort_test_user.role, mock_db
            )
            assert should_enforce
            assert reason == "percent_full"

        # Transition to ON mode
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'on',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                cohort_test_user.id, cohort_test_user.role, mock_db
            )
            assert should_enforce
            assert reason == "full_enforcement"

    def test_rollout_with_test_mode(self, mock_db, cohort_test_user):
        """Test rollout behavior with MFA_TEST_MODE enabled."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'on',
            'MFA_TEST_MODE': 'true',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            should_enforce, reason = flags.should_enforce_mfa(
                cohort_test_user.id, cohort_test_user.role, mock_db
            )
            # Test mode doesn't affect rollout logic, only MFA verification
            assert should_enforce
            assert reason == "full_enforcement"

    def test_rollout_percentage_ramp(self, mock_db, cohort_test_user):
        """Test percentage ramp-up scenario."""
        percentages = [0, 25, 50, 75, 100]
        
        for percent in percentages:
            with patch.dict(os.environ, {
                'MFA_ROLLOUT_MODE': 'percent',
                'MFA_PERCENT': str(percent),
                'MFA_ENFORCE_ADMINS': 'true'
            }):
                flags = MFARolloutFlags()
                should_enforce, reason = flags.should_enforce_mfa(
                    cohort_test_user.id, cohort_test_user.role, mock_db
                )
                
                if percent == 0:
                    assert not should_enforce
                    assert reason == "percent_zero"
                elif percent == 100:
                    assert should_enforce
                    assert reason == "percent_full"
                else:
                    # Result depends on hash, but reason should contain hash mod
                    assert reason.startswith("percent_")
                    assert reason.replace("percent_", "").isdigit()

    def test_cohort_membership_edge_cases(self, mock_db):
        """Test edge cases for cohort membership."""
        with patch.dict(os.environ, {
            'MFA_ROLLOUT_MODE': 'cohorts',
            'MFA_COHORT_SOURCE': 'env',
            'MFA_COHORT_USER_IDS': '1,2,3',
            'MFA_ENFORCE_ADMINS': 'true'
        }):
            flags = MFARolloutFlags()
            
            # Test user in cohort
            should_enforce, reason = flags.should_enforce_mfa(1, "admin", mock_db)
            assert should_enforce
            assert reason == "cohort_member"
            
            # Test user not in cohort
            should_enforce, reason = flags.should_enforce_mfa(999, "admin", mock_db)
            assert not should_enforce
            assert reason == "not_in_cohort"
            
            # Test non-admin user (should not be enforced regardless of cohort)
            should_enforce, reason = flags.should_enforce_mfa(1, "moderator", mock_db)
            assert not should_enforce
            assert reason == "non_admin"


@pytest.mark.parametrize("mode,expected_mode", [
    ("off", MFARolloutMode.OFF),
    ("dryrun", MFARolloutMode.DRYRUN),
    ("cohorts", MFARolloutMode.COHORTS),
    ("percent", MFARolloutMode.PERCENT),
    ("on", MFARolloutMode.ON),
])
def test_rollout_mode_enum_parsing(mode, expected_mode):
    """Test parsing of rollout mode from string."""
    with patch.dict(os.environ, {'MFA_ROLLOUT_MODE': mode}):
        flags = MFARolloutFlags()
        assert flags.mode == expected_mode


@pytest.mark.parametrize("source,expected_source", [
    ("db", MFACohortSource.DB),
    ("env", MFACohortSource.ENV),
])
def test_cohort_source_enum_parsing(source, expected_source):
    """Test parsing of cohort source from string."""
    with patch.dict(os.environ, {'MFA_COHORT_SOURCE': source}):
        flags = MFARolloutFlags()
        assert flags.cohort_source == expected_source


@pytest.mark.parametrize("percent,expected", [
    (0, 0),
    (25, 25),
    (50, 50),
    (75, 75),
    (100, 100),
    (-10, 0),  # Clamped to 0
    (150, 100),  # Clamped to 100
])
def test_percent_clamping(percent, expected):
    """Test that percentage is properly clamped to 0-100 range."""
    with patch.dict(os.environ, {'MFA_PERCENT': str(percent)}):
        flags = MFARolloutFlags()
        assert flags.percent == expected
