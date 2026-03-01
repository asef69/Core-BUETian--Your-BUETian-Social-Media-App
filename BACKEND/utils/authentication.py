

import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from utils.database import DatabaseManager

logger = logging.getLogger(__name__)


class CustomUser:
    """
    Simple user object to hold user data from database.
    
    This replaces Django's User model since we're using raw SQL.
    The request.user object will be an instance of this class.
    """
    def __init__(self, user_data):
        self.id = user_data['id']
        self.student_id = user_data.get('student_id')
        self.name = user_data.get('name')
        self.email = user_data.get('email')
        self.is_authenticated = True
        self.is_active = user_data.get('is_active', True)
        self.pk = user_data['id']  
    
    def __str__(self):
        return f"{self.name} ({self.email})"
    
    def get(self, key, default=None):
        """
        Provide dictionary-like .get() method for DRF compatibility.
        Some parts of DRF expect user object to support .get()
        """
        return getattr(self, key, default)
    
    def __getitem__(self, key):
        """Allow dictionary-style access for compatibility"""
        return getattr(self, key)


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that fetches user from raw SQL database.
    
    This extends rest_framework_simplejwt's JWTAuthentication to work
    with our raw SQL implementation instead of Django ORM.
    
    Usage:
        Set in settings.py REST_FRAMEWORK configuration:
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'utils.authentication.CustomJWTAuthentication',
        )
    
    Token Flow:
        1. Client sends request with Authorization: Bearer <token>
        2. authenticate() validates JWT token
        3. get_user() fetches user from database using user_id from token
        4. Returns (CustomUser object, validated_token)
        5. request.user is populated with CustomUser object
    
    Methods:
        authenticate(request): Main method that validates JWT and fetches user
        get_user(validated_token): Fetches user from database using token payload
    """
    
    def authenticate(self, request): # type: ignore
        """
        Override authenticate to handle both JWT validation and user fetching.
        
        Returns None if no Authorization header is present (allows AllowAny endpoints).
        Raises AuthenticationFailed if token is invalid.
        Returns (user, token) tuple if valid.
        """
        try:
            # Get the raw Authorization header for debugging
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header:
                token_preview = auth_header[:50] + '...' if len(auth_header) > 50 else auth_header
                logger.debug(f'Authorization header received: {token_preview}')
           
            result = super().authenticate(request)
            
            
            if result is None:
                logger.debug('No Authorization header provided')
                return None
            
            logger.debug(f'Authentication successful for user: {result[0].id}')
            return result
            
        except AuthenticationFailed as e:
            logger.warning(f'Authentication failed: {str(e)}')
            raise
        except InvalidToken as e: # type: ignore
            logger.warning(f'Invalid token: {str(e)}')
            raise AuthenticationFailed(f'Invalid token: {str(e)}')
        except Exception as e:
            logger.error(f'Unexpected error during authentication: {str(e)}')
            raise AuthenticationFailed(f'Authentication error: {str(e)}')
    
    def get_user(self, validated_token): # type: ignore
        """
        Fetch user from database using user_id from JWT token payload.
        
        Args:
            validated_token: The validated JWT token containing user_id
        
        Returns:
            CustomUser: User object populated with database data
        
        Raises:
            InvalidToken: If user_id not in token
            AuthenticationFailed: If user not found or inactive
        """
        try:
            user_id = validated_token.get('user_id')
            if not user_id:
                logger.warning('Token contained no recognizable user identification')
                raise InvalidToken('Token contained no recognizable user identification')
            
            # Fetch user from database
            query = """
                SELECT id, student_id, name, email, is_active
                FROM users
                WHERE id = %s
            """
            result = DatabaseManager.execute_query(query, (user_id,))
            
            if not result:
                logger.warning(f'User not found for user_id: {user_id}')
                raise AuthenticationFailed('User not found')
            
            user_data = result[0]
            
            if not user_data.get('is_active'):
                logger.warning(f'User account is disabled for user_id: {user_id}')
                raise AuthenticationFailed('User account is disabled')
            
            logger.debug(f'Successfully authenticated user: {user_id}')
            return CustomUser(user_data)
            
        except (InvalidToken, AuthenticationFailed):
            raise
        except Exception as e:
            logger.error(f'Authentication failed: {str(e)}')
            raise AuthenticationFailed(f'Authentication failed: {str(e)}')
