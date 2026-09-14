from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task
def test_background_task(x, y):
    logger.info(f"Executing test background calculation: {x} + {y}")
    return x + y