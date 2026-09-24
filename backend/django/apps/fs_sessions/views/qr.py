'''
QRSessionCreateView
QRSessionDetailView
QRSessionScanView
QRSessionCompleteView
QRSessionCancelView
'''

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from fs_sessions.models import NavigationSession
from fs_sessions.serializers import (
    NavigationSessionCreateSerializer,
    NavigationSessionSerializer,
)
from fs_sessions import services


class QRSessionCreateView(APIView):
    """
    POST /api/v1/sessions
    Generates a new temporary session tied to a QR code for mobile handoff[cite: 1, 4].
    Structurally identical resource operation as NavigationSessionCreateView.
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = NavigationSessionCreateSerializer(data=request.data)
        if serializer.is_valid():
            nav_request = serializer.validated_data['navigation_request']
            kiosk_session_id = serializer.validated_data.get('kiosk_session_id')
            
            try:
                session, raw_token = services.create_navigation_session(nav_request, kiosk_session_id)
                aggregated_data = services.aggregate_session_status(session)
                
                return Response({
                    "success": True, 
                    "data": NavigationSessionSerializer(aggregated_data).data, 
                    "qr_token": raw_token
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"success": False, "error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class QRSessionDetailView(APIView):
    """
    GET /api/v1/sessions/{id}
    Retrieves the details of a specific QR handoff session[cite: 1, 4].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def get(self, request, pk):
        session = get_object_or_404(NavigationSession, pk=pk)
        aggregated_data = services.aggregate_session_status(session)
        response_data = NavigationSessionSerializer(aggregated_data).data
        return Response({"success": True, "data": response_data}, status=status.HTTP_200_OK)


class QRSessionScanView(APIView):
    """
    POST /api/v1/sessions/{id}/scan
    Registers that a mobile device has scanned the QR code, officially initiating the handoff[cite: 1, 4].
    Requires the raw `qr_token` to be provided in the request body.
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk):
        session = get_object_or_404(NavigationSession, pk=pk)
        provided_token = request.data.get('qr_token')
        
        if not provided_token:
            return Response({"success": False, "error": "qr_token is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            session = services.initiate_qr_handoff(session, provided_token)
            aggregated_data = services.aggregate_session_status(session)
            return Response({"success": True, "data": NavigationSessionSerializer(aggregated_data).data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class QRSessionCompleteView(APIView):
    """
    POST /api/v1/sessions/{id}/complete
    Marks the QR handoff process as fully completed[cite: 1, 4].
    Delegates to the exact same logic as Navigation session completion.
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk):
        session = get_object_or_404(NavigationSession, pk=pk)
        try:
            session = services.complete_navigation_session(session)
            aggregated_data = services.aggregate_session_status(session)
            return Response({"success": True, "data": NavigationSessionSerializer(aggregated_data).data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class QRSessionCancelView(APIView):
    """
    POST /api/v1/sessions/{id}/cancel
    Cancels an unfulfilled QR session (due to idle timeout or manual user exit)[cite: 1, 4].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk):
        session = get_object_or_404(NavigationSession, pk=pk)
        try:
            session = services.cancel_navigation_session(session)
            aggregated_data = services.aggregate_session_status(session)
            return Response({"success": True, "data": NavigationSessionSerializer(aggregated_data).data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)