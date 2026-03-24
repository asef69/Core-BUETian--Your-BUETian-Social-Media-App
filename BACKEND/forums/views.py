from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager
from decimal import Decimal, InvalidOperation


def _validate_tuition_constraints(data):
    salary_min = data.get('salary_min')
    if salary_min not in (None, ''):
        try:
            salary_min_value = Decimal(str(salary_min))
        except (InvalidOperation, ValueError):
            return 'Min salary must be a valid number'
        if salary_min_value < Decimal('1000'):
            return 'Min salary must be at least 1000'

    days_per_week = data.get('days_per_week')
    if days_per_week not in (None, ''):
        try:
            days_value = int(days_per_week)
        except (ValueError, TypeError):
            return 'Days per week must be an integer between 1 and 7'
        if days_value < 1 or days_value > 7:
            return 'Days per week must be between 1 and 7'

    duration_hours = data.get('duration_hours')
    if duration_hours not in (None, ''):
        try:
            duration_value = Decimal(str(duration_hours))
        except (InvalidOperation, ValueError):
            return 'Hours per day must be a valid number'
        if duration_value <= 0 or duration_value > Decimal('24'):
            return 'Hours per day must be greater than 0 and at most 24'

    return None

class CreateBloodRequestView(APIView):
    """
    Create a new blood donation request.
    
    API Endpoint: POST /api/forums/blood/create/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "blood_group": str (required) - Blood type (A+, B+, O+, AB+, A-, B-, O-, AB-),
            "urgency": str (optional) - "low"|"moderate"|"urgent" (default: "moderate"),
            "patient_name": str (required) - Name of patient needing blood,
            "hospital_name": str (required) - Hospital name,
            "hospital_address": str (optional) - Full hospital address,
            "contact_number": str (required) - Contact phone number,
            "needed_date": date (optional) - Date blood is needed (YYYY-MM-DD),
            "description": str (optional) - Additional details about the request
        }
    
    Returns:
        201 Created:
            {
                "message": "Blood request created successfully",
                "request_id": 123
            }
    
    Database:
        Table: blood_donation_posts
        Includes: user_id (from JWT), all request fields, created_at timestamp
    
    Use Case:
        Post urgent blood donation needs to community
    """
    def post(self, request):
        data = request.data
        query = """
        INSERT INTO blood_donation_posts (
            user_id, blood_group, urgency, patient_name,
            hospital_name, hospital_address, contact_number,
            needed_date, description
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        
        request_id = DatabaseManager.execute_insert(
            query,
            (request.user.id, data['blood_group'], data.get('urgency', 'moderate'),
             data['patient_name'], data['hospital_name'], data.get('hospital_address'),
             data['contact_number'], data.get('needed_date'), data.get('description'))
        )
        
        return Response({
            'message': 'Blood request created successfully',
            'request_id': request_id
        }, status=status.HTTP_201_CREATED)

class BloodRequestDetailView(APIView):
    """
    Retrieve detailed information about a specific blood donation request.
    
    API Endpoint: GET /api/forums/blood/<request_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        request_id (int): ID of the blood donation request
    
    Returns:
        200 OK:
            {
                "request_id": 123,
                "blood_group": "A+",
                "urgency": "high",
                "patient_name": "John Doe",
                "hospital_name": "Dhaka Medical College Hospital",
                "hospital_address": "Dhaka, Bangladesh",
                "contact_number": "+8801234567890",
                "needed_date": "2025-12-30",
                "description": "Urgent need for surgery",
                "requester_name": "Jane Smith",
                "requester_picture": "media/profile_pictures/jane.jpg",
                "created_at": "2025-12-29T10:00:00"
            }
        
        404 Not Found:
            {
                "error": "Request not found"
            }
    
    Database:
        Function: get_blood_request_details(request_id)
    """
    def get(self, request, request_id):
        result = DatabaseManager.execute_function('get_blood_request_details', (request_id,))
        if not result:
            return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(result[0])

    def patch(self, request, request_id):
        check_query = "SELECT user_id FROM blood_donation_posts WHERE id = %s"
        result = DatabaseManager.execute_query(check_query, (request_id,))

        if not result or result[0]['user_id'] != request.user.id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        update_fields = []
        params = []

        for field in [
            'blood_group',
            'urgency',
            'patient_name',
            'hospital_name',
            'hospital_address',
            'contact_number',
            'needed_date',
            'description',
            'status'
        ]:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])

        if not update_fields:
            return Response({'error': 'No fields to update'}, status=status.HTTP_400_BAD_REQUEST)

        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        params.append(request_id)
        update_query = f"UPDATE blood_donation_posts SET {', '.join(update_fields)} WHERE id = %s"
        DatabaseManager.execute_update(update_query, tuple(params))

        return Response({'message': 'Blood request updated successfully'})

    def delete(self, request, request_id):
        check_query = "SELECT user_id FROM blood_donation_posts WHERE id = %s"
        result = DatabaseManager.execute_query(check_query, (request_id,))

        if not result or result[0]['user_id'] != request.user.id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        DatabaseManager.execute_update("DELETE FROM blood_donation_posts WHERE id = %s", (request_id,))
        return Response({'message': 'Blood request deleted successfully'})

class ActiveBloodRequestsView(APIView):
    """
    Get list of active blood donation requests with optional filters.
    
    API Endpoint: GET /api/forums/blood/
    Authentication: Required (JWT)
    
    Query Parameters:
        blood_group (str): Filter by blood type (A+, B+, O+, etc.)
        urgency (str): Filter by urgency level (low, moderate, urgent)
    
    Functionality:
        - Lists active (not fulfilled) blood donation requests
        - Supports filtering by blood group and urgency
        - Orders by urgency and creation time
        - Limits to 50 most relevant results
    
    Returns:
        List of blood request objects (from active_blood_requests view)
        [
            {
                "request_id": 123,
                "blood_group": "A+",
                "urgency": "critical",
                "patient_name": "...",
                "hospital_name": "...",
                "contact_number": "...",
                "needed_date": "...",
                "status": "active",
                "requester_name": "...",
                "created_at": "..."
            },
            ...
        ]
    
    Database:
        View/Query: active_blood_requests
        Filtered by status='active'
    
    Example Usage:
        GET /api/forums/blood/?blood_group=A%2B&urgency=high
    """
    def get(self, request):
        blood_group = request.query_params.get('blood_group')
        urgency = request.query_params.get('urgency')

        query = """
        SELECT
            bd.id,
            bd.id AS request_id,
            bd.blood_group,
            bd.urgency,
            bd.patient_name,
            bd.hospital_name,
            bd.hospital_address,
            bd.contact_number,
            bd.needed_date,
            bd.description,
            bd.status,
            bd.created_at,
            bd.user_id AS requester_id,
            u.name AS requester_name,
            u.profile_picture AS requester_picture
        FROM blood_donation_posts bd
        INNER JOIN users u ON bd.user_id = u.id
        WHERE bd.status = 'active'
        """
        params = []
        
        if blood_group:
            query += " AND bd.blood_group = %s"
            params.append(blood_group)
        
        if urgency:
            query += " AND bd.urgency = %s"
            params.append(urgency)

        query += """
        ORDER BY
            CASE bd.urgency
                WHEN 'urgent' THEN 1
                WHEN 'moderate' THEN 2
                ELSE 3
            END,
            bd.created_at DESC
        LIMIT 50
        """
        result = DatabaseManager.execute_query(query, tuple(params))
        return Response(result)

# Tuition Views
class CreateTuitionPostView(APIView):
    """
    Create a new tuition/tutoring post (available or wanted).
    
    API Endpoint: POST /api/forums/tuition/create/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "post_type": str (required) - "seeking_tutor"|"offering_tuition",
            "subjects": array (optional) - List of subject names ["Math", "Physics", ...],
            "class_level": str (optional) - e.g., "Class 10", "SSC", "HSC", "University",
            "preferred_gender": str (optional) - "male"|"female"|"any" (default: "any"),
            "location": str (optional) - Area/location for tutoring,
            "salary_min": decimal (optional) - Minimum expected salary,
            "salary_max": decimal (optional) - Maximum expected salary,
            "days_per_week": int (optional) - Number of teaching days per week,
            "duration_hours": decimal (optional) - Hours per day,
            "requirements": str (optional) - Additional requirements or details,
            "contact_number": str (required) - Contact phone number
        }
    
    Workflow:
        1. Creates tuition post in tution_posts table
        2. For each subject in subjects array, creates entry in tution_post_subjects table
    
    Returns:
        201 Created:
            {
                "message": "Tuition post created successfully",
                "tuition_id": 456
            }
    
    Database:
        Tables:
        - tution_posts: Main tuition post record
        - tution_post_subjects: Subject associations (many-to-many)
    
    Use Cases:
        - Tutors posting availability
        - Students/parents seeking tutors
    """
    def post(self, request):
        data = request.data
        validation_error = _validate_tuition_constraints(data)
        if validation_error:
            return Response({'error': validation_error}, status=status.HTTP_400_BAD_REQUEST)

        query = """
        INSERT INTO tution_posts (
            user_id, post_type, class_level, preferred_gender,
            location, salary_min, salary_max, days_per_week,
            duration_hours, requirements, contact_number
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        
        tuition_id = DatabaseManager.execute_insert(
            query,
            (request.user.id, data['post_type'], data.get('class_level'),
             data.get('preferred_gender', 'any'), data.get('location'),
             data.get('salary_min'), data.get('salary_max'),
             data.get('days_per_week'), data.get('duration_hours'),
             data.get('requirements'), data['contact_number'])
        )
        
        subjects = data.get('subjects', [])
        for subject in subjects:
            DatabaseManager.execute_insert(
                "INSERT INTO tution_post_subjects (tution_post_id, subject_name) VALUES (%s, %s)",
                (tuition_id, subject)
            )
        
        return Response({
            'message': 'Tuition post created successfully',
            'tuition_id': tuition_id
        }, status=status.HTTP_201_CREATED)

class TuitionPostDetailView(APIView):
    """
    Retrieve detailed information about a specific tuition post.
    
    API Endpoint: GET /api/forums/tuition/<post_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        post_id (int): ID of the tuition post
    
    Returns:
        200 OK:
            {
                "tuition_id": 456,
                "post_type": "tutor_wanted",
                "subjects": ["Mathematics", "Physics"],
                "class_level": "SSC",
                "preferred_gender": "any",
                "location": "Mohammadpur, Dhaka",
                "salary_min": 3000.00,
                "salary_max": 5000.00,
                "days_per_week": 5,
                "duration_hours": 2.0,
                "requirements": "Must have experience with SSC students",
                "contact_number": "+8801234567890",
                "status": "active",
                "poster_id": 10,
                "poster_name": "Ahmed Khan",
                "poster_picture": "media/profile_pictures/ahmed.jpg",
                "poster_department": "CSE",
                "created_at": "2025-12-29T11:00:00"
            }
        
        404 Not Found:
            {
                "error": "Post not found"
            }
    
    Database:
        Function: get_tuition_post_details(post_id)
    """
    def get(self, request, post_id):
        result = DatabaseManager.execute_function('get_tuition_post_details', (post_id,))
        if not result:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(result[0])

    def patch(self, request, post_id):
        check_query = "SELECT user_id FROM tution_posts WHERE id = %s"
        result = DatabaseManager.execute_query(check_query, (post_id,))

        if not result or result[0]['user_id'] != request.user.id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        validation_error = _validate_tuition_constraints(data)
        if validation_error:
            return Response({'error': validation_error}, status=status.HTTP_400_BAD_REQUEST)

        update_fields = []
        params = []

        for field in [
            'post_type',
            'class_level',
            'preferred_gender',
            'location',
            'salary_min',
            'salary_max',
            'days_per_week',
            'duration_hours',
            'requirements',
            'contact_number',
            'status'
        ]:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])

        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            params.append(post_id)
            update_query = f"UPDATE tution_posts SET {', '.join(update_fields)} WHERE id = %s"
            DatabaseManager.execute_update(update_query, tuple(params))

        subjects = data.get('subjects')
        if subjects is not None:
            DatabaseManager.execute_update(
                "DELETE FROM tution_post_subjects WHERE tution_post_id = %s",
                (post_id,)
            )
            for subject in subjects:
                DatabaseManager.execute_insert(
                    "INSERT INTO tution_post_subjects (tution_post_id, subject_name) VALUES (%s, %s)",
                    (post_id, subject)
                )

        if not update_fields and subjects is None:
            return Response({'error': 'No fields to update'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'message': 'Tuition post updated successfully'})

    def delete(self, request, post_id):
        check_query = "SELECT user_id FROM tution_posts WHERE id = %s"
        result = DatabaseManager.execute_query(check_query, (post_id,))

        if not result or result[0]['user_id'] != request.user.id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        DatabaseManager.execute_update("DELETE FROM tution_posts WHERE id = %s", (post_id,))
        return Response({'message': 'Tuition post deleted successfully'})

class ActiveTuitionPostsView(APIView):
    """
    Get list of active tuition posts with optional filters.
    
    API Endpoint: GET /api/forums/tuition/
    Authentication: Required (JWT)
    
    Query Parameters:
        type (str): Filter by post type ("seeking_tutor" or "offering_tuition")
        subject (str): Filter by subject name (matches any in subjects array)
        min_salary (decimal): Filter posts with salary_max >= this value
        max_salary (decimal): Filter posts with salary_min <= this value
    
    Functionality:
        - Lists active tuition posts (not closed/fulfilled)
        - Supports filtering by type, subject, salary range
        - Limits to 50 most recent results
    
    Returns:
        List of tuition post objects (from active_tuition_posts view)
        [
            {
                "tuition_id": 456,
                "post_type": "tutor_wanted",
                "subjects": ["Math", "Physics"],
                "class_level": "SSC",
                "location": "Dhaka",
                "salary_min": 3000.00,
                "salary_max": 5000.00,
                "days_per_week": 5,
                "status": "active",
                "poster_name": "...",
                "poster_department": "...",
                "created_at": "..."
            },
            ...
        ]
    
    Database:
        View/Query: active_tuition_posts
        Filtered by status='active'
    
    Example Usage:
        GET /api/forums/tuition/?type=tutor_wanted&subject=Math&min_salary=2000
    """
    def get(self, request):
        post_type = request.query_params.get('type')
        subject = request.query_params.get('subject')
        min_salary = request.query_params.get('min_salary')
        max_salary = request.query_params.get('max_salary')

        query = """
        SELECT
            t.id,
            t.id AS tuition_id,
            t.post_type,
            ARRAY(
                SELECT subject_name
                FROM tution_post_subjects
                WHERE tution_post_id = t.id
            ) AS subjects,
            t.class_level,
            t.preferred_gender,
            t.location,
            t.salary_min,
            t.salary_max,
            t.days_per_week,
            t.duration_hours,
            t.requirements,
            t.contact_number,
            t.status,
            t.created_at,
            u.id AS poster_id,
            u.name AS poster_name,
            u.profile_picture AS poster_picture,
            u.department_name AS poster_department
        FROM tution_posts t
        INNER JOIN users u ON t.user_id = u.id
        WHERE t.status = 'active'
        """
        params = []
        
        if post_type:
            query += " AND t.post_type = %s"
            params.append(post_type)
        
        if subject:
            query += " AND EXISTS (SELECT 1 FROM tution_post_subjects tps WHERE tps.tution_post_id = t.id AND tps.subject_name = %s)"
            params.append(subject)
        
        if min_salary:
            query += " AND t.salary_max >= %s"
            params.append(min_salary)
        
        if max_salary:
            query += " AND t.salary_min <= %s"
            params.append(max_salary)

        query += " ORDER BY t.created_at DESC LIMIT 50"
        result = DatabaseManager.execute_query(query, tuple(params))
        return Response(result)
