"""Pagination from the OpenAPI contract: ?page= (from 1), ?page_size= (default 25, max 100), and a `meta` block."""
import math

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from common.renderers import PaginatedData


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        size = self.get_page_size(self.request) or self.page_size
        total = self.page.paginator.count
        return Response(PaginatedData(
            results=data,
            meta={
                "page": self.page.number,
                "page_size": size,
                "total_count": total,
                "total_pages": max(1, math.ceil(total / size)),
            },
        ))
