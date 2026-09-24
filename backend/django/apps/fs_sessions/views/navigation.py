'''
NavigationSessionCreateView
NavigationSessionDetailView
NavigationSessionPauseView
NavigationSessionResumeView
NavigationSessionCompleteView
NavigationSessionCancelView
NavigationDestinationReachView
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


class NavigationSessionCreateView(APIView):
    """
    POST /api/v1/sessions/navigation
    Initializes a new navigation session for a route or multi-destination queue[cite: 1, 4].
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
                response_data = NavigationSessionSerializer(aggregated_data).data
                
                # Attach raw_token for the client to generate the QR code
                return Response({
                    "success": True, 
                    "data": response_data, 
                    "qr_token": raw_token
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"success": False, "error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class NavigationSessionDetailView(APIView):
    """
    GET /api/v1/sessions/navigation/{id}
    Retrieves the current status, instructions, and checklist of an active navigation session[cite: 1, 4].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def get(self, request, pk):
        session = get_object_or_404(NavigationSession, pk=pk)
        aggregated_data = services.aggregate_session_status(session)
        response_data = NavigationSessionSerializer(aggregated_data).data
        return Response({"success": True, "data": response_data}, status=status.HTTP_200_OK)


class NavigationSessionPauseView(APIView):
    """
    POST /api/v1/sessions/navigation/{id}/pause
    Pauses an active navigation session[cite: 1, 4].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk):
        session = get_object_or_404(NavigationSession, pk=pk)
        try:
            session = services.pause_navigation_session(session)
            aggregated_data = services.aggregate_session_status(session)
            return Response({"success": True, "data": NavigationSessionSerializer(aggregated_data).data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NavigationSessionResumeView(APIView):
    """
    POST /api/v1/sessions/navigation/{id}/resume
    Resumes a previously paused navigation session[cite: 1, 4].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk):
        session = get_object_or_404(NavigationSession, pk=pk)
        try:
            session = services.resume_navigation_session(session)
            aggregated_data = services.aggregate_session_status(session)
            return Response({"success": True, "data": NavigationSessionSerializer(aggregated_data).data}, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NavigationSessionCompleteView(APIView):
    """
    POST /api/v1/sessions/navigation/{id}/complete
    Marks a navigation session as successfully concluded[cite: 1, 4].
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


class NavigationSessionCancelView(APIView):
    """
    POST /api/v1/sessions/navigation/{id}/cancel
    Aborts a navigation session entirely[cite: 1, 4].
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


class NavigationDestinationReachView(APIView):
    """
    POST /api/v1/sessions/{id}/destinations/{destination_id}/reach
    Triggers a dynamic update confirming that a specific destination in the checklist has been reached[cite: 1, 4].
    """
    # Public: visitors' kiosks and phones call these without an admin
    # session. Kiosk device authentication is planned (QA-28).
    permission_classes = [AllowAny]

    def post(self, request, pk, destination_id):
        session = get_object_or_404(NavigationSession, pk=pk)
        try:
            result = services.confirm_destination_reached(session, destination_id)
            aggregated_data = services.aggregate_session_status(result['session'])
            return Response({
                "success": True, 
                "status": result['status'],
                "data": NavigationSessionSerializer(aggregated_data).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)