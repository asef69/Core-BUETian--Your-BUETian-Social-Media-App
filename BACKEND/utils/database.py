from django.db import connection
from typing import List,Dict,Any,Optional

class DatabaseManager:
    """
    Utility class for executing PostgreSQL database operations.
    
    Provides static methods for common database operations:
    - execute_query: Execute SELECT queries
    - execute_function: Call PostgreSQL functions
    - execute_insert: Execute INSERT statements
    - execute_update: Execute UPDATE/DELETE statements
    
    Features:
    - Returns query results as list of dictionaries
    - Automatic connection management
    - Parameter binding for SQL injection prevention
    - Type hints for better IDE support
    
    Usage:
        # Query
        users = DatabaseManager.execute_query(
            "SELECT * FROM users WHERE id = %s",
            (user_id,)
        )
        
        # Function
        feed = DatabaseManager.execute_function(
            'get_user_feed',
            (user_id, limit, offset)
        )
        
        # Insert
        post_id = DatabaseManager.execute_insert(
            "INSERT INTO posts (user_id, content) VALUES (%s, %s) RETURNING id",
            (user_id, content)
        )
        
        # Update
        rows_affected = DatabaseManager.execute_update(
            "UPDATE users SET name = %s WHERE id = %s",
            (name, user_id)
        )
    
    Note:
        Uses Django's database connection from settings.py
        Requires PostgreSQL database configuration
    """

    @staticmethod
    def execute_query(query:str,params:tuple=None) -> List[Dict[str,Any]]: # type: ignore
        """
        Execute a SELECT query and return results as list of dictionaries.
        
        Args:
            query (str): SQL SELECT query with %s placeholders
            params (tuple, optional): Values to bind to query placeholders
        
        Returns:
            List[Dict[str, Any]]: List of rows as dictionaries
                Keys are column names, values are row data
                Empty list if no results
        
        Example:
            # Simple query
            result = DatabaseManager.execute_query(
                "SELECT * FROM users WHERE email = %s",
                ('john@example.com',)
            )
            # Result: [{'id': 1, 'name': 'John', 'email': 'john@example.com'}]
            
            # Multiple conditions
            result = DatabaseManager.execute_query(
                "SELECT * FROM posts WHERE user_id = %s AND visibility = %s",
                (user_id, 'public')
            )
            
            # Complex query
            result = DatabaseManager.execute_query(
                '''SELECT p.*, u.name as author_name 
                   FROM posts p 
                   JOIN users u ON u.id = p.user_id 
                   WHERE p.id = %s''',
                (post_id,)
            )
        
        Note:
            - Always use parameterized queries (never string interpolation)
            - Automatically converts results to dictionaries for easy access
            - Returns empty list if query returns no rows
        """
        with connection.cursor() as cursor:
            cursor.execute(query,params or ())
            columns=[col[0] for col in cursor.description] if cursor.description else []
            return [dict(zip(columns,row)) for row in cursor.fetchall()]
        

    @staticmethod
    def execute_function(func_name:str,params:tuple=()) -> List[Dict[str,Any]]:
        """
        Execute a PostgreSQL function and return results.
        
        Calls stored procedures/functions defined in sql/ folder.
        
        Args:
            func_name (str): Name of PostgreSQL function to call
            params (tuple): Parameters to pass to function (default: empty)
        
        Returns:
            List[Dict[str, Any]]: Function results as list of dictionaries
        
        PostgreSQL Function Format:
            CREATE OR REPLACE FUNCTION get_user_feed(
                p_user_id INTEGER,
                p_limit INTEGER,
                p_offset INTEGER
            )
            RETURNS TABLE (...) AS $$
            BEGIN
                RETURN QUERY ...
            END;
            $$ LANGUAGE plpgsql;
        
        Example:
            # Call function with parameters
            feed = DatabaseManager.execute_function(
                'get_user_feed',
                (user_id, 20, 0)
            )
            
            # Call function without parameters
            stats = DatabaseManager.execute_function('get_platform_statistics')
            
            # Call function with single parameter
            profile = DatabaseManager.execute_function(
                'get_user_profile',
                (user_id,)
            )
        
        
        Note:
            - Functions must be created in PostgreSQL before calling
            - Functions should return TABLE or SETOF for multiple rows
            - Single values should be wrapped in a row
        """    
        
        if params and len(params) > 0:
            placeholders = ','.join(['%s'] * len(params))
            query = f"SELECT * FROM {func_name}({placeholders})"
        else:
            query = f"SELECT * FROM {func_name}()"
        return DatabaseManager.execute_query(query,params)

    @staticmethod
    def execute_procedure(proc_name: str, params: tuple=()) -> List[Dict[str, Any]]:
        """
        Execute a PostgreSQL procedure using CALL.

        Supports procedures with IN / INOUT arguments. If the procedure
        yields a result row (e.g., INOUT values), it is returned as a list
        of dictionaries, similar to execute_query/execute_function.
        """
        with connection.cursor() as cursor:
            if params and len(params) > 0:
                placeholders = ','.join(['%s'] * len(params))
                query = f"CALL {proc_name}({placeholders})"
                cursor.execute(query, params)
            else:
                query = f"CALL {proc_name}()"
                cursor.execute(query)

            if cursor.description:
                columns = [col[0] for col in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
            return []
    
    @staticmethod
    def execute_insert(query:str,params:tuple=None) ->Optional[int]: # type: ignore
        """
        Execute INSERT query and return the inserted record's ID.
        
        Args:
            query (str): SQL INSERT query with RETURNING clause
            params (tuple, optional): Values to bind to query placeholders
        
        Returns:
            Optional[int]: ID of inserted record, or None if no ID returned
        
        Example:
            # Insert and get ID
            post_id = DatabaseManager.execute_insert(
                "INSERT INTO posts (user_id, content, visibility) VALUES (%s, %s, %s) RETURNING id",
                (user_id, 'Hello World', 'public')
            )
            # post_id = 123
            
            # Insert with multiple values
            comment_id = DatabaseManager.execute_insert(
                '''INSERT INTO comments (post_id, user_id, content, comment_id) 
                   VALUES (%s, %s, %s, %s) RETURNING id''',
                (post_id, user_id, 'Nice post!', None)
            )
            
            # Insert without RETURNING (returns None)
            DatabaseManager.execute_insert(
                "INSERT INTO likes (user_id, post_id) VALUES (%s, %s)",
                (user_id, post_id)
            )
        
        Important:
            - Use RETURNING clause to get inserted ID
            - Without RETURNING, method returns None
            - Perfect for getting auto-generated primary keys
        
        Common Pattern:
            1. Insert parent record
            2. Get returned ID
            3. Use ID for child records
            
            post_id = DatabaseManager.execute_insert(...)
            for url in media_urls:
                DatabaseManager.execute_insert(
                    "INSERT INTO media_urls (post_id, media_url) VALUES (%s, %s)",
                    (post_id, url)
                )
        """
        with connection.cursor() as cursor:
            cursor.execute(query,params or ())
            if cursor.description:
                result=cursor.fetchone()
                return result[0] if result else None
            return None
        
    @staticmethod
    def execute_update(query: str, params: tuple=None) -> int: # type: ignore
        """
        Execute UPDATE or DELETE query and return number of affected rows.
        
        Args:
            query (str): SQL UPDATE or DELETE query with %s placeholders
            params (tuple, optional): Values to bind to query placeholders
        
        Returns:
            int: Number of rows affected by the operation
                0 if no rows were modified
        
        Example:
            # Update single field
            rows_updated = DatabaseManager.execute_update(
                "UPDATE users SET name = %s WHERE id = %s",
                ('John Doe', user_id)
            )
            # rows_updated = 1
            
            # Update multiple fields
            rows_updated = DatabaseManager.execute_update(
                '''UPDATE users 
                   SET name = %s, bio = %s, updated_at = CURRENT_TIMESTAMP 
                   WHERE id = %s''',
                (name, bio, user_id)
            )
            
            # Delete with condition
            rows_deleted = DatabaseManager.execute_update(
                "DELETE FROM follows WHERE follower_id = %s AND following_id = %s",
                (follower_id, following_id)
            )
            # rows_deleted = 1 if deleted, 0 if not found
            
            # Conditional update
            rows_updated = DatabaseManager.execute_update(
                "UPDATE messages SET is_read = TRUE WHERE sender_id = %s AND receiver_id = %s AND is_read = FALSE",
                (sender_id, receiver_id)
            )
            # Returns count of messages that were marked as read
        
        Use Cases:
            - Update user profile fields
            - Mark messages as read
            - Delete posts, comments, likes
            - Update post visibility
            - Accept/reject follow requests
        
        Return Value Usage:
            if rows_updated > 0:
                # Operation successful
            else:
                # Nothing was updated (record not found or already in desired state)
        """
        with connection.cursor() as cursor:
            cursor.execute(query, params or ())
            return cursor.rowcount   


        
