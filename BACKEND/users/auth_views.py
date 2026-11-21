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
from rest_framework.exceptions import ValidationError
from rest_framework.throttling import ScopedRateThrottle
from django.core.cache import cache
import hashlib
from utils.validators import (
    BLOOD_GROUPS, HALL_ATTACHMENTS, clean_choice, clean_email, clean_int,
    clean_password, clean_str,
)


def _json_object(request):
    """The request body must be a JSON object / form; a bare string or list is a 400, not a crash."""
    data = request.data
    if not hasattr(data, 'get'):
        raise ValidationError({'error': 'Request body must be a JSON object.'})
    return data


# --- login lockout: repeated failures for ONE account are blocked whatever IP they come from.
LOGIN_MAX_FAILURES = getattr(settings, 'LOGIN_MAX_FAILURES', 8)
LOGIN_LOCKOUT_SECONDS = getattr(settings, 'LOGIN_LOCKOUT_SECONDS', 900)


def _lockout_key(email):
    return 'login_fail:' + hashlib.sha256(email.strip().lower().encode('utf-8')).hexdigest()


def _is_locked(email):
    return (cache.get(_lockout_key(email)) or 0) >= LOGIN_MAX_FAILURES


def _record_failure(email):
    key = _lockout_key(email)
    cache.add(key, 0, LOGIN_LOCKOUT_SECONDS)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, LOGIN_LOCKOUT_SECONDS)


_DUMMY_HASH = None


def _burn_password_check(password):
    """Spend about as long as a real password check for unknown emails, so response time
    does not reveal whether an account exists."""
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = make_password('not-a-real-password')
    check_password(password, _DUMMY_HASH)


def _issue_tokens(user):
    refresh = RefreshToken()
    refresh['user_id'] = user['id']
    refresh['email'] = user['email']
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


def _revoke_refresh_token(refresh):
    """Remember a refresh token's jti so it can never be used again."""
    DatabaseManager.execute_update(
        "DELETE FROM revoked_tokens WHERE expires_at < (NOW() AT TIME ZONE 'UTC')"
    )
    DatabaseManager.execute_update(
        "INSERT INTO revoked_tokens (jti, user_id, expires_at) "
        "VALUES (%s, %s, to_timestamp(%s) AT TIME ZONE 'UTC') ON CONFLICT (jti) DO NOTHING",
        (str(refresh['jti']), refresh.get('user_id'), int(refresh['exp']))
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
        data = _json_object(request)

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
            # Sign the new user straight in: saves a second, equally slow, login round trip.
            return Response({
                'message': 'User registered successfully',
                'user': result[0],
                'tokens': _issue_tokens(result[0]),
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
        data = _json_object(request)
        email = data.get('email')
        password = data.get('password')

        if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
            return Response(
                {'error': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if '\x00' in email or '\x00' in password:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if _is_locked(email):
            response = Response(
                {'error': 'Too many failed login attempts. Please try again in a few minutes.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
            response['Retry-After'] = str(LOGIN_LOCKOUT_SECONDS)
            return response

        query = "SELECT id, student_id, name, email, password, is_active FROM users WHERE LOWER(email) = %s"
        result = DatabaseManager.execute_query(query, (email.strip().lower(),))
        
        if not result:
            _burn_password_check(password)
            _record_failure(email)
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user = result[0]
        
        def _upgrade_hash(raw_password):
            # Called only after a correct password when the stored hash uses an older / weaker
            # scheme (PBKDF2): move the account to Argon2 so later logins are fast.
            DatabaseManager.execute_update(
                "UPDATE users SET password = %s WHERE id = %s",
                (make_password(raw_password), user['id'])
            )

        if not check_password(password, user['password'], setter=_upgrade_hash):
            _record_failure(email)
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        cache.delete(_lockout_key(email))

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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    # A refresh token that was rotated a moment ago is still accepted for this long, so
    # several parallel requests that all got a 401 can refresh at once without logging the user out.
    ROTATION_GRACE_SECONDS = 30

    def post(self, request):
        data = _json_object(request)
        refresh_token = data.get('refresh')

        if not refresh_token or not isinstance(refresh_token, str):
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

            revoked = DatabaseManager.execute_query(
                "SELECT EXTRACT(EPOCH FROM (NOW() - revoked_at)) AS age FROM revoked_tokens WHERE jti = %s",
                (str(refresh['jti']),)
            )
            if revoked:
                if float(revoked[0]['age'] or 0) > self.ROTATION_GRACE_SECONDS:
                    return Response(
                        {'error': 'Invalid or expired refresh token'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                # Just rotated by a parallel request: hand out an access token only.
                return Response({'access': str(refresh.access_token)}, status=status.HTTP_200_OK)

            # Rotate: the used refresh token is retired and a fresh one is issued.
            new_refresh = RefreshToken()
            new_refresh['user_id'] = refresh.get('user_id')
            if refresh.get('email'):
                new_refresh['email'] = refresh.get('email')
            _revoke_refresh_token(refresh)

            return Response({
                'access': str(new_refresh.access_token),
                'refresh': str(new_refresh),
            }, status=status.HTTP_200_OK)

        except (TokenError, InvalidToken):
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )


class LogoutView(APIView):
    """
    Log out: revoke the refresh token so it can no longer mint access tokens.

    API Endpoint: POST /api/users/logout/
    Request Body: {"refresh": "<refresh token>"}
    Always answers 200 (idempotent, does not reveal whether the token was valid).
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        data = _json_object(request)
        token = data.get('refresh')
        if token and isinstance(token, str):
            try:
                _revoke_refresh_token(RefreshToken(token))
            except (TokenError, InvalidToken):
                pass
        return Response({'message': 'Logged out'}, status=status.HTTP_200_OK)
