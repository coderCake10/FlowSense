from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task
def test_background_task(x, y):
    logger.info(f"Executing test background calculation: {x} + {y}")
    return x + y

@shared_task(name="analytics.clear_expired_informational_alerts")
def clear_expired_informational_alerts() -> int:
    """Clear informational alerts older than the informational_alert_clear_time setting."""
    from analytics.alerts import clear_expired_informational_alerts as clear

    return clear()


@shared_task(name="analytics.evaluate_trends")
def evaluate_trends() -> list:
    """Raise the Alert Panel's trend alerts (failed-search rate, kiosk usage)."""
    from analytics.alerts import evaluate_trends as evaluate

    return evaluate()
