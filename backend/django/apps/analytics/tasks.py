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


@shared_task(name="analytics.generate_report")
def generate_report(report_id: int) -> str:
    """Take the snapshot for one requested report (analytics/reports.py)."""
    from django.utils import timezone

    from analytics import reports
    from analytics.models import Report

    report = Report.objects.select_related("generated_by").filter(pk=report_id).first()
    if report is None:
        return "missing"
    report.status = Report.STATUS_GENERATING
    report.save(update_fields=["status"])
    try:
        report.data = reports.build(
            report.sections, report.period_start, report.period_end, report.title,
            report.generated_by.full_name if report.generated_by else None,
        )
        report.status = Report.STATUS_COMPLETED
        report.error = None
    except Exception as error:  # noqa: BLE001 - recorded on the report, never lost
        logger.exception("Report %s failed", report_id)
        report.status = Report.STATUS_FAILED
        report.error = str(error)[:500]
    report.completed_at = timezone.now()
    report.save(update_fields=["data", "status", "error", "completed_at"])
    return report.status
