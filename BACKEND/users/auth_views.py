from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from utils.database import DatabaseManager
from utils.file_upload import FileUploadHandler
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.db import IntegrityError
from rest_framework.throttling import ScopedRateThrottle
from utils.validators import (
    BLOOD_GROUPS, HALL_ATTACHMENTS, clean_choice, clean_email, clean_int,
    clean_password, clean_str,
)


class RegisterView(APIView):
    """
    Register a new user account.
    
    API Endpoint: POST /api/users/register/
    Authentication: Not required (AllowAny)
    
    Request Body:
        {
            "student_id": int (required) - Unique student ID,
            "name": str (required) - Full name,
            "email": str (required) - Email address (must be unique),
            "password": str (required) - Plain text password (will be hashed),
            "batch": int (optional) - Batch number,
            "department_name": str (optional) - Department name,
            "blood_group": str (optional) - Blood group (A+, B-, etc.),
            "hall_name": str (optional) - Hall/dormitory name,
            "hall_attachement": str (optional) - "Resident" or "Attached",
            "profile_picture": file (optional) - Profile picture file
        }
    
    Validation:
        - All required fields must be present
        - Email must be unique
        - Student ID must be unique
    
    Security:
        - Password is hashed using Django's make_password before storage
        - Plain text password never stored in database
    
    Returns:
        201 Created:
            {
                "message": "User registered successfully",
                "user": {
                    "id": 1,
                    "student_id": 1805001,
                    "name": "John Doe",
                    "email": "john@example.com"
                }
            }
        
        400 Bad Request:
            {
                "error": "<field> is required"
            }
            or
            {
                "error": "Email or Student ID already registered"
            }
        
        500 Internal Server Error:
            {
                "error": "Registration failed"
            }
    
    Database:
        Table: users
        Sets: is_active=TRUE by default
    
    Next Step:
        After registration, user should login via POST /api/users/login/
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        data = request.data

        student_id = clean_int(data.get('student_id'), 'student_id', required=True, minimum=1, maximum=2147483647)
        name = clean_str(data.get('name'), 'name', 50, required=True, allow_blank=False)
        email = clean_email(data.get('email'))
        password = clean_password(data.get('password'))
        batch = clean_int(data.get('batch'), 'batch', minimum=1, maximum=2147483647)
        department_name = clean_str(data.get('department_name'), 'department_name', 100) or None
        blood_group = clean_choice(data.get('blood_group') or None, 'blood_group', BLOOD_GROUPS)
        hall_name = clean_str(data.get('hall_name'), 'hall_name', 100) or None
        hall_attachement = clean_choice(
            data.get('hall_attachement') or 'Resident', 'hall_attachement', HALL_ATTACHMENTS
        )

        # Emails are matched case-insensitively so "A@x.com" and "a@x.com" are one account.
        existing = DatabaseManager.execute_query(
            "SELECT id FROM users WHERE LOWER(email) = %s OR student_id = %s",
            (email, student_id)
        )
        if existing:
            return Response(
                {'error': 'Email or Student ID already registered'},
                status=status.HTTP_400_BAD_REQUEST
            )

        hashed_password = make_password(password)

        # None -> NULL; the frontend falls back to its bundled default avatar.
        profile_picture_url = settings.DEFAULT_PROFILE_PICTURE_URL or None
        if 'profile_picture' in request.FILES:
            try:
                profile_file = request.FILES['profile_picture']
                FileUploadHandler.validate_file(profile_file, file_type='image')
                profile_picture_url = FileUploadHandler.upload_file(profile_file, folder='profile_pictures')
            except ValueError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )

        query = """
        INSERT INTO users (student_id, name, email, password, batch, department_name, blood_group, hall_name, hall_attachement, profile_picture, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
        RETURNING id, student_id, name, email
        """
        
        try:
            result = DatabaseManager.execute_query(
                query,
                (
                    student_id,
                    name,
                    email,
                    hashed_password,
                    batch,
                    department_name,
                    blood_group,
                    hall_name,
                    hall_attachement,
                    profile_picture_url
                )
            )
        except IntegrityError:
            # Lost a race with a concurrent registration for the same email / student id.
            return Response(
                {'error': 'Email or Student ID already registered'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if result:
            return Response({
                'message': 'User registered successfully',
                'user': result[0]
            }, status=status.HTTP_201_CREATED)
        
        return Response(
            {'error': 'Registration failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class LoginView(APIView):
    """
    Authenticate user and issue JWT tokens.
    
    API Endpoint: POST /api/users/login/
    Authentication: Not required (AllowAny)
    
    Request Body:
        {
            "email": str (required) - User's email address,
            "password": str (required) - User's password
        }
    
    Authentication Process:
        1. Validate email and password are provided
        2. Fetch user from database by email
        3. Verify password using Django's check_password
        4. Generate JWT tokens (access and refresh)
        5. Return user info and tokens
    
    Returns:
        200 OK:
            {
                "message": "Login successful",
                "user": {
                    "id": 1,
                    "student_id": 1805001,
                    "name": "John Doe",
                    "email": "john@example.com"
                },
                "tokens": {
                    "refresh": "<refresh_token>",
                    "access": "<access_token>"
                }
            }
        
        400 Bad Request:
            {
                "error": "Email and password are required"
            }
        
        401 Unauthorized:
            {
                "error": "Invalid credentials"
            }
    
    Token Usage:
        - access token: Used for API authentication (short-lived, 1 day)
        - refresh token: Used to get new access tokens (long-lived, 7 days)
    
    Headers for Authenticated Requests:
        Authorization: Bearer <access_token>
    
    Token Payload:
        {
            "user_id": 1,
            "email": "john@example.com",
            "exp": <expiration_timestamp>
        }
    
    Security:
        - Passwords compared using secure hashing
        - Tokens are signed and cannot be tampered with
        - Access token expires after 1 day
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        data = request.data
        email = data.get('email')
        password = data.get('password')

        if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
            return Response(
                {'error': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = "SELECT id, student_id, name, email, password, is_active FROM users WHERE LOWER(email) = %s"
        result = DatabaseManager.execute_query(query, (email.strip().lower(),))
        
        if not result:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user = result[0]
        
        if not check_password(password, user['password']):
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.get('is_active'):
            return Response(
                {'error': 'This account has been deactivated'},
                status=status.HTTP_403_FORBIDDEN
            )

        refresh = RefreshToken()
        refresh['user_id'] = user['id']
        refresh['email'] = user['email']
        
        return Response({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'student_id': user['student_id'],
                'name': user['name'],
                'email': user['email']
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            }
        })


class TokenRefreshView(APIView):
    """
    Refresh access token using refresh token.
    
    API Endpoint: POST /api/users/token/refresh/
    Authentication: Not required (AllowAny)
    
    Request Body:
        {
            "refresh": str (required) - Valid refresh token
        }
    
    Process:
        1. Validate refresh token
        2. Extract user_id from token payload
        3. Generate new access token
        4. Return new access token
    
    Returns:
        200 OK:
            {
                "access": "<new_access_token>"
            }
        
        400 Bad Request:
            {
                "error": "Refresh token is required"
            }
        
        401 Unauthorized:
            {
                "error": "Invalid or expired refresh token"
            }
    
    Usage:
        When access token expires, use this endpoint to get a new one
        without requiring the user to log in again.
    
    Token Lifetime:
        - Access token: 1 day
        - Refresh token: 7 days
    
    Security:
        - Refresh tokens are not rotated or blacklisted (ROTATE_REFRESH_TOKENS is off)
        - A refresh token stops working once the account is deactivated
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            refresh = RefreshToken(refresh_token)

            active = DatabaseManager.execute_query(
                "SELECT 1 FROM users WHERE id = %s AND is_active = TRUE",
                (refresh.get('user_id'),)
            )
            if not active:
                return Response(
                    {'error': 'Invalid or expired refresh token'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            access_token = str(refresh.access_token)
            
            return Response({
                'access': access_token
            }, status=status.HTTP_200_OK)
            
        except (TokenError, InvalidToken):
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )

