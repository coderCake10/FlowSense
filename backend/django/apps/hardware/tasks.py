from celery import shared_task

from hardware import services


@shared_task(name="hardware.mark_offline_devices")
def mark_offline_devices() -> int:
    """Registered devices that stopped reporting become offline and raise an alert."""
    return services.mark_offline_devices()
