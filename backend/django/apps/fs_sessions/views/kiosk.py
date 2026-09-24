'''
KioskSessionCreateView
KioskSessionDetailView
KioskSessionHeartbeatView
KioskSessionEndView
'''

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from fs_sessions.models import KioskSession
from fs_sessions.serializers import (
    KioskSessionCreateSerializer,
    KioskSessionSerializer,
    KioskSessionEndSerializer,
)
from fs_sessions import services


class KioskSessionCreateView(APIView):
    """
    POST /api/v1/sessions/kiosk
    Initializes a new active interaction session when a user begins interacting with the kiosk[cite: 1, 3].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = KioskSessionCreateSerializer(data=request.data)
        if serializer.is_valid():
            kiosk_id = serializer.validated_data['kiosk'].device_id
            try:
                session = services.initialize_kiosk_session(kiosk_id)
                response_data = KioskSessionSerializer(session).data
                return Response({"success": True, "data": response_data}, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"success": False, "error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class KioskSessionDetailView(APIView):
    """
    GET /api/v1/sessions/kiosk/{id}
    Retrieves details about a specific active kiosk interaction session[cite: 1, 3].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def get(self, request, pk):
        session = get_object_or_404(KioskSession, pk=pk)
        response_data = KioskSessionSerializer(session).data
        return Response({"success": True, "data": response_data}, status=status.HTTP_200_OK)


class KioskSessionHeartbeatView(APIView):
    """
    POST /api/v1/sessions/kiosk/{id}/heartbeat
    Receives periodic pings from the kiosk to keep the session alive[cite: 1, 3].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk):
        session = get_object_or_404(KioskSession, pk=pk)
        try:
            session = services.process_kiosk_heartbeat(session)
            response_data = KioskSessionSerializer(session).data
            return Response({"success": True, "data": response_data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class KioskSessionEndView(APIView):
    """
    POST /api/v1/sessions/kiosk/{id}/end
    Terminates the session due to a timeout or user action[cite: 1, 3].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk):
        session = get_object_or_404(KioskSession, pk=pk)
        serializer = KioskSessionEndSerializer(data=request.data)
        
        if serializer.is_valid():
            end_reason = serializer.validated_data.get('end_reason', KioskSession.END_MANUAL_EXIT)
            try:
                session = services.terminate_kiosk_session(session, end_reason)
                response_data = KioskSessionSerializer(session).data
                return Response({"success": True, "data": response_data}, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"success": False, "error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)