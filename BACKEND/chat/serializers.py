from rest_framework import serializers
from django.contrib.auth.hashers import make_password,check_password
from utils.database import DatabaseManager

class RegisterSerializer(serializers.Serializer):
    """
    Serializer for user registration.
    
    Validates and processes new user registration data.
    
    Fields:
        student_id (int, required): Unique student identification number
        name (str, required): User's full name (max 50 chars)
        email (str, required): Valid email address (must be unique)
        password (str, required): Password (min 8 chars, write-only)
        profile_picture (image, optional): Profile picture file
        blood_group (str, optional): Blood group (e.g., A+, B-, O+)
        batch (int, optional): Student batch number
        hall_name (str, optional): Residence hall name
        hall_attachement (str, optional): "Resident" or "Attached"
        department_name (str, optional): Academic department name
        bio (str, optional): User biography/description
    
    Validation:
        - email: Must be unique in database
        - student_id: Must be unique in database
        - password: Minimum 8 characters
        - hall_attachement: Must be either "Resident" or "Attached"
    
    Password Security:
        - Password is hashed using Django's make_password before storage
        - Original password never stored in plain text
        - Uses strong hashing algorithm (PBKDF2 by default)
    
    Returns (on successful creation):
        {
            "id": 1,
            "student_id": 1805001,
            "name": "John Doe",
            "email": "john@example.com",
            "created_at": "2025-12-29T10:30:00"
        }
    
    Raises:
        ValidationError: If email or student_id already exists
    
    Note:
        This serializer is used in RegisterView (users/auth_views.py)
    """
    student_id=serializers.IntegerField()
    name=serializers.CharField(max_length=50)
    email=serializers.EmailField()
    password=serializers.CharField(write_only=True,min_length=8)
    profile_picture=serializers.ImageField(required=False)
    blood_group=serializers.CharField(required=False,allow_blank=True)
    batch=serializers.IntegerField(required=False)
    hall_name=serializers.CharField(required=False)
    hall_attachement=serializers.ChoiceField(
        choices=['Resident','Attached'],
        required=False
    )
    department_name=serializers.CharField(required=False)
    bio=serializers.CharField(required=False)


    def validate_email(self,value):
        """
        Validate that email is unique in the database.
        
        Args:
            value (str): Email address to validate
        
        Returns:
            str: The validated email value
        
        Raises:
            ValidationError: If email already exists in users table
        """
        query="SELECT COUNT(*) as count FROM users WHERE email = %s"
        result=DatabaseManager.execute_query(query,(value,))
        if result[0]['count']>0:
            raise serializers.ValidationError("This Student is already registered")
        
        return value
    
    def validate_student_id(self,value):
        """
        Validate that student_id is unique in the database.
        
        Args:
            value (int): Student ID to validate
        
        Returns:
            int: The validated student_id value
        
        Raises:
            ValidationError: If student_id already exists in users table
        """
        query="SELECT COUNT(*) as count FROM users WHERE student_id = %s"
        result=DatabaseManager.execute_query(query,(value,))
        if result[0]['count']>0:
            raise serializers.ValidationError("This student is already registered")
        return value
    
    def create(self,validated_data):
        """
        Create a new user record in the database.
        
        Process:
            1. Hash the password using make_password
            2. Convert profile_picture to string if present
            3. Insert all fields into users table
            4. Return created user data
        
        Args:
            validated_data (dict): Validated registration data
        
        Returns:
            dict: Created user object with id, student_id, name, email, created_at
            None: If insertion fails
        
        Database:
            Table: users
            Returns: id, student_id, name, email, created_at
        """
        validated_data['password']=make_password(validated_data['password'])

        if 'profile_picture' in validated_data and validated_data['profile_picture']:
            validated_data['profile_picture'] = str(validated_data['profile_picture'])

        query = """
        INSERT INTO users (student_id, name, email, password, profile_picture, blood_group, batch, hall_name, hall_attachement, department_name, bio) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id,student_id,name,email,created_at
        """
        values = (
            validated_data['student_id'],
            validated_data['name'],
            validated_data['email'],
            validated_data['password'],
            validated_data.get('profile_picture', ''),
            validated_data.get('blood_group', ''),
            validated_data.get('batch'),
            validated_data.get('hall_name', ''),
            validated_data.get('hall_attachement', ''),
            validated_data.get('department_name', ''),
            validated_data.get('bio', '')
        )
        result=DatabaseManager.execute_query(query, values)
        return result[0] if result else None
    

class LoginSerializer(serializers.Serializer):
    """
    Serializer for user authentication.
    
    Validates login credentials and returns user data if valid.
    
    Fields:
        email (str, required): User's email address
        password (str, required): User's password (write-only)
    
    Validation Process:
        1. Fetch user from database by email
        2. Check if user exists
        3. Check if account is active (is_active = TRUE)
        4. Verify password using check_password
    
    Returns (on successful validation):
        {
            "id": 1,
            "student_id": 1805001,
            "name": "John Doe",
            "email": "john@example.com",
            "password": "<hashed>",  # Used for verification only
            "is_active": True
        }
    
    Raises:
        ValidationError:
            - "Invalid Credentials": If email not found
            - "Account is inactive": If is_active = FALSE
            - "Invalid Credentials": If password doesn't match
    
    Security:
        - Password never returned in API response (used only for validation)
        - Uses Django's check_password for secure comparison
        - Doesn't reveal whether email or password is wrong (prevents enumeration)
    
    Note:
        This serializer is used in LoginView (users/auth_views.py)
        After validation, JWT tokens are generated using the returned user data
    """
    email=serializers.EmailField()
    password=serializers.CharField(write_only=True)

    def validate(self, data): # type: ignore
        """
        Validate user credentials.
        
        Args:
            data (dict): Dictionary containing email and password
        
        Returns:
            dict: User object if credentials are valid
        
        Raises:
            ValidationError: If credentials are invalid or account is inactive
        
        Process:
            1. Query database for user with provided email
            2. Verify user exists
            3. Verify account is active
            4. Verify password matches hashed password in database
        """
        query = """
            SELECT id,student_id,name,email,password,is_active
            FROM users WHERE email = %s
        """
        result = DatabaseManager.execute_query(query, (data['email'],))

        if not result:
            raise serializers.ValidationError("Invalid Credentials")
        
        user=result[0]
        if not user['is_active']:
            raise serializers.ValidationError("Account is inactive")
        
        if not check_password(data['password'],user['password']):
            raise serializers.ValidationError("Invalid Credentials")
        
        return user


        
        