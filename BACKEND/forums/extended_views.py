from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager
from rest_framework.permissions import IsAuthenticated

class UpdateBloodRequestStatusView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Update the status of a blood donation request.
    
    API Endpoint: PATCH /api/forums/blood/<request_id>/status/
    Authentication: Required (JWT)
    
    URL Parameters:
        request_id (int): ID of the blood request to update
    
    Request Body:
        {
            "status": str (required) - "active"|"fulfilled"|"cancelled"
        }
    
    Note:
        Urgency values are: "low", "moderate", "urgent"
    
    Authorization:
        - Only the request creator can update status
    
    Returns:
        200 OK:
            {
                "message": "Blood request status updated successfully"
            }
        
        403 Forbidden:
            {
                "error": "Unauthorized"
            }
    
    Database:
        Function: update_blood_request_status(request_id, new_status)
    """
    def patch(self, request, request_id):
        new_status = request.data.get('status')
        
        if not new_status:
            return Response(
                {'error': 'Status is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = "SELECT user_id FROM blood_donation_posts WHERE id = %s"
        result = DatabaseManager.execute_query(query, (request_id,))
        
        if not result or result[0]['user_id'] != request.user.id:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        DatabaseManager.execute_function(
            'update_blood_request_status',
            (request_id, new_status)
        )
        
        return Response({'message': 'Blood request status updated successfully'})


class SearchBloodRequestsByLocationView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Search blood donation requests by location.
    
    API Endpoint: GET /api/forums/blood/search/location/
    Authentication: Required (JWT)
    
    Query Parameters:
        location (str): Location to search (partial match on hospital name/address)
        blood_group (str): Optional blood group filter
        limit (int): Number of results (default: 20)
    
    Returns:
        List of blood requests matching location criteria
    
    Database:
        Function: search_blood_requests_by_location(location, blood_group, limit)
    """
    def get(self, request):
        location = request.query_params.get('location', '')
        blood_group = request.query_params.get('blood_group')
        limit = int(request.query_params.get('limit', 20))
        
        if not location:
            return Response(
                {'error': 'Location parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = DatabaseManager.execute_function(
            'search_blood_requests_by_location',
            (location, blood_group, limit)
        )
        return Response(result or [])


class UserBloodRequestsView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Get blood donation requests created by authenticated user.
    
    API Endpoint: GET /api/forums/blood/my-requests/
    Authentication: Required (JWT)
    
    Returns:
        List of user's blood donation requests with status
    
    Database:
        Function: get_user_blood_requests(user_id)
    """
    def get(self, request):
        result = DatabaseManager.execute_function(
            'get_user_blood_requests',
            (request.user.id,)
        )
        return Response(result or [])


class UpdateTuitionPostStatusView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Update the status of a tuition post.
    
    API Endpoint: PATCH /api/forums/tuition/<post_id>/status/
    Authentication: Required (JWT)
    
    URL Parameters:
        post_id (int): ID of the tuition post to update
    
    Request Body:
        {
            "status": str (required) - "active"|"closed"|"cancelled"
        }
    
    Authorization:
        - Only the post creator can update status
    
    Returns:
        200 OK:
            {
                "message": "Tuition post status updated successfully"
            }
        
        403 Forbidden:
            {
                "error": "Unauthorized"
            }
    
    Database:
        Function: update_tuition_post_status(post_id, new_status)
    """
    def patch(self, request, post_id):
        new_status = request.data.get('status')
        
        if not new_status:
            return Response(
                {'error': 'Status is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = "SELECT user_id FROM tution_posts WHERE id = %s"
        result = DatabaseManager.execute_query(query, (post_id,))
        
        if not result or result[0]['user_id'] != request.user.id:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        DatabaseManager.execute_function(
            'update_tuition_post_status',
            (post_id, new_status)
        )
        
        return Response({'message': 'Tuition post status updated successfully'})


class SearchTuitionPostsView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Search tuition posts with multiple filters.
    
    API Endpoint: GET /api/forums/tuition/search/
    Authentication: Required (JWT)
    
    Query Parameters:
        location (str): Location to search
        min_salary (decimal): Minimum salary filter
        max_salary (decimal): Maximum salary filter
        post_type (str): "seeking_tutor" or "offering_tuition"
        limit (int): Number of results (default: 20)
    
    Returns:
        List of tuition posts matching search criteria
    
    Database:
        Function: search_tuition_posts(location, min_salary, max_salary, post_type, limit)
    """
    def get(self, request):
        location = request.query_params.get('location')
        min_salary = request.query_params.get('min_salary')
        max_salary = request.query_params.get('max_salary')
        post_type = request.query_params.get('post_type')
        limit = int(request.query_params.get('limit', 20))
        
        result = DatabaseManager.execute_function(
            'search_tuition_posts',
            (location, min_salary, max_salary, post_type, limit)
        )
        return Response(result or [])


class UserTuitionPostsView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Get tuition posts created by authenticated user.
    
    API Endpoint: GET /api/forums/tuition/my-posts/
    Authentication: Required (JWT)
    
    Returns:
        List of user's tuition posts with status
    
    Database:
        Function: get_user_tuition_posts(user_id)
    """
    def get(self, request):
        result = DatabaseManager.execute_function(
            'get_user_tuition_posts',
            (request.user.id,)
        )
        return Response(result or [])


class TuitionStatsBySubjectView(APIView):
    """
    Get tuition statistics grouped by subject.
    
    API Endpoint: GET /api/forums/tuition/stats/subjects/
    Authentication: Required (JWT)
    
    Returns:
        Statistics for each subject:
        [
            {
                "subject_name": "Mathematics",
                "total_posts": 45,
                "offering_tuition_count": 20,
                "seeking_tutor_count": 25,
                "avg_salary": 4500.00
            },
            ...
        ]
    
    Database:
        Function: get_tuition_stats_by_subject()
    """
    def get(self, request):
        result = DatabaseManager.execute_function('get_tuition_stats_by_subject', ())
        return Response(result or [])
