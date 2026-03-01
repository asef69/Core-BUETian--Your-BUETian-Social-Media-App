import os
import django


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_buetians.settings')
django.setup()

from utils.database import DatabaseManager

print("="*60)
print("FIXING get_post_details FUNCTION")
print("="*60)

sql = """
CREATE OR REPLACE FUNCTION get_post_details(p_post_id INTEGER, p_current_user_id INTEGER DEFAULT NULL)
RETURNS TABLE(
    post_id INTEGER,
    content TEXT,
    media_type VARCHAR(20),
    visibility VARCHAR(20),
    created_at TIMESTAMP,
    author_id INTEGER,
    author_name VARCHAR(50),
    author_picture VARCHAR(500),
    likes_count INTEGER,
    comments_count INTEGER,
    is_liked BOOLEAN,
    media_urls_list VARCHAR(500)[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as post_id,
        p.content,
        p.media_type,
        p.visibility,
        p.created_at,
        u.id as author_id,
        u.name as author_name,
        u.profile_picture as author_picture,
        p.likes_count,
        p.comments_count,
        CASE 
            WHEN p_current_user_id IS NOT NULL THEN 
                EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = p_current_user_id)
            ELSE FALSE 
        END as is_liked,
        ARRAY(SELECT m.media_url FROM media_urls m WHERE m.post_id = p.id) as media_urls_list
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.id = p_post_id;
END;
$$ LANGUAGE plpgsql;
"""

try:
    print("\nExecuting SQL to fix function...")
    DatabaseManager.execute_update(sql)
    print("✓ Function fixed successfully!")
    
    print("\nTesting the fixed function...")
    users = DatabaseManager.execute_query("SELECT id FROM users WHERE is_active = TRUE LIMIT 1")
    if users:
        user_id = users[0]['id']
        
        post_id = DatabaseManager.execute_insert(
            "INSERT INTO posts(user_id, content) VALUES (%s, %s) RETURNING id",
            (user_id, "Test post for function fix")
        )
        
        print(f"  Created test post ID: {post_id}")
        
        result = DatabaseManager.execute_function('get_post_details', (post_id, user_id))
        
        if result:
            print("  ✓ Function works!")
            print(f"  Post data: {result[0]}")
            
            DatabaseManager.execute_update("DELETE FROM posts WHERE id = %s", (post_id,))
            print("  ✓ Test post cleaned up")
        else:
            print("  ✗ Function returned no results")
    else:
        print("  No test user found")
    
    print("\n" + "="*60)
    print("FIX COMPLETE!")
    print("="*60)
    print("\nYou can now create posts and they will return complete data.")
    
except Exception as e:
    print(f"\n✗ Error: {e}")
    import traceback
    traceback.print_exc()
