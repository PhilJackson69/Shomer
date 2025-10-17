"""Demo script for Shomer NLP module.

This script demonstrates the basic functionality of the text classifier
and risk scorer.
"""

from datetime import datetime

from shomer_nlp import TextClassifier, RiskScorer, score_text


def demo_basic_classification():
    """Demonstrate basic text classification."""
    print("=" * 60)
    print("BASIC TEXT CLASSIFICATION")
    print("=" * 60)

    examples = [
        "I love going to school and learning new things",
        "I hate them and they should all die",
        "I will bring my gun to school tomorrow",
        "There will be a bomb at the synagogue tonight",
    ]

    for text in examples:
        result = score_text(text)
        print(f"\nText: {text}")
        print(f"Threat Prob: {result['threat_prob']:.3f}")
        print(f"Hate Prob: {result['hate_prob']:.3f}")
        print(f"Risk Factors: {result['risk_factors']}")


def demo_risk_scoring():
    """Demonstrate comprehensive risk scoring."""
    print("\n" + "=" * 60)
    print("COMPREHENSIVE RISK SCORING")
    print("=" * 60)

    classifier = TextClassifier()
    scorer = RiskScorer()

    # High-risk scenario
    text = "I will kill everyone at the school tonight with my gun"

    print(f"\nText: {text}")

    # Classify
    classification = classifier.score_text(text)
    print(f"\nClassification:")
    print(f"  Threat Prob: {classification['threat_prob']:.3f}")
    print(f"  Hate Prob: {classification['hate_prob']:.3f}")
    print(f"  Risk Factors: {classification['risk_factors']}")

    # Score risk with night time
    night_time = datetime(2025, 1, 1, 23, 0, 0)  # 11 PM
    risk = scorer.calculate_risk_score(
        text=text,
        threat_prob=classification["threat_prob"],
        hate_prob=classification["hate_prob"],
        risk_factors=classification["risk_factors"],
        timestamp=night_time,
        user_id="user123",
        previous_warnings=2,
    )

    print(f"\nRisk Assessment:")
    print(f"  Risk Score: {risk['risk_score']:.2f}/100")
    print(f"  Risk Level: {risk['risk_level']}")
    print(f"  Breakdown:")
    print(f"    Content: {risk['breakdown']['content_score']:.2f}")
    print(f"    Time: {risk['breakdown']['time_score']:.2f}")
    print(f"    Proximity: {risk['breakdown']['proximity_score']:.2f}")
    print(f"    History: {risk['breakdown']['history_score']:.2f}")


def demo_time_comparison():
    """Demonstrate time-based risk boosting."""
    print("\n" + "=" * 60)
    print("TIME-BASED RISK BOOSTING")
    print("=" * 60)

    classifier = TextClassifier()
    scorer = RiskScorer()

    text = "I will attack the mall"

    classification = classifier.score_text(text)

    # Night time
    night_time = datetime(2025, 1, 1, 2, 0, 0)  # 2 AM
    risk_night = scorer.calculate_risk_score(
        text=text,
        threat_prob=classification["threat_prob"],
        hate_prob=classification["hate_prob"],
        risk_factors=classification["risk_factors"],
        timestamp=night_time,
    )

    # Day time
    day_time = datetime(2025, 1, 1, 14, 0, 0)  # 2 PM
    risk_day = scorer.calculate_risk_score(
        text=text,
        threat_prob=classification["threat_prob"],
        hate_prob=classification["hate_prob"],
        risk_factors=classification["risk_factors"],
        timestamp=day_time,
    )

    print(f"\nText: {text}")
    print(f"\nNight time (2 AM):")
    print(f"  Risk Score: {risk_night['risk_score']:.2f}/100")
    print(f"  Time Score: {risk_night['breakdown']['time_score']:.2f}")

    print(f"\nDay time (2 PM):")
    print(f"  Risk Score: {risk_day['risk_score']:.2f}/100")
    print(f"  Time Score: {risk_day['breakdown']['time_score']:.2f}")


def demo_user_history():
    """Demonstrate user history impact on risk scores."""
    print("\n" + "=" * 60)
    print("USER HISTORY IMPACT")
    print("=" * 60)

    classifier = TextClassifier()
    scorer = RiskScorer()

    text = "I'm going to get revenge"

    classification = classifier.score_text(text)

    # No history
    risk_no_history = scorer.calculate_risk_score(
        text=text,
        threat_prob=classification["threat_prob"],
        hate_prob=classification["hate_prob"],
        risk_factors=classification["risk_factors"],
    )

    # With warnings
    risk_with_history = scorer.calculate_risk_score(
        text=text,
        threat_prob=classification["threat_prob"],
        hate_prob=classification["hate_prob"],
        risk_factors=classification["risk_factors"],
        user_id="user123",
        previous_warnings=3,
        previous_incidents=1,
    )

    print(f"\nText: {text}")
    print(f"\nNo user history:")
    print(f"  Risk Score: {risk_no_history['risk_score']:.2f}/100")
    print(f"  History Score: {risk_no_history['breakdown']['history_score']:.2f}")

    print(f"\nWith history (3 warnings, 1 incident):")
    print(f"  Risk Score: {risk_with_history['risk_score']:.2f}/100")
    print(f"  History Score: {risk_with_history['breakdown']['history_score']:.2f}")


def demo_configurable_weights():
    """Demonstrate configurable weights."""
    print("\n" + "=" * 60)
    print("CONFIGURABLE WEIGHTS")
    print("=" * 60)

    from shomer_nlp.classifier import ClassifierConfig

    text = "I will kill them"

    # Default weights
    classifier_default = TextClassifier()
    result_default = classifier_default.score_text(text)

    # Custom weights
    config = ClassifierConfig()
    config.THREAT_WEIGHT = 0.8  # Increase threat weight
    classifier_custom = TextClassifier(config)
    result_custom = classifier_custom.score_text(text)

    print(f"\nText: {text}")
    print(f"\nDefault weights:")
    print(f"  Threat Prob: {result_default['threat_prob']:.3f}")

    print(f"\nCustom weights (THREAT_WEIGHT=0.8):")
    print(f"  Threat Prob: {result_custom['threat_prob']:.3f}")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("SHOMER NLP MODULE DEMO")
    print("=" * 60)

    demo_basic_classification()
    demo_risk_scoring()
    demo_time_comparison()
    demo_user_history()
    demo_configurable_weights()

    print("\n" + "=" * 60)
    print("DEMO COMPLETE")
    print("=" * 60)
    print("\nFor more information, see shomer_nlp/README.md")

