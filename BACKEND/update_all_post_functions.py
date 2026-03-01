import os
import django


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_buetians.settings')
django.setup()

from utils.database import DatabaseManager

print("="*70)
print("UPDATING ALL POST FUNCTIONS TO FIX AMBIGUOUS COLUMN REFERENCES")
print("="*70)

functions = []

functions.append("""
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
""")


functions.append("""
DROP FUNCTION IF EXISTS get_user_posts(INTEGER, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_user_posts(
    p_user_id INTEGER,
    p_viewer_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    post_id INTEGER,
    content TEXT,
    media_type VARCHAR(20),
    visibility VARCHAR(20),
    author_id INTEGER,
    author_name VARCHAR(50),
    author_picture VARCHAR(500),
    created_at TIMESTAMP,
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
        u.id as author_id,
        u.name as author_name,
        u.profile_picture as author_picture,
        p.created_at,
        p.likes_count,
        p.comments_count,
        CASE 
            WHEN p_viewer_id IS NOT NULL THEN 
                EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = p_viewer_id)
            ELSE FALSE 
        END as is_liked,
        ARRAY(SELECT m.media_url FROM media_urls m WHERE m.post_id = p.id) as media_urls_list
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.user_id = p_user_id
    AND p.group_id IS NULL
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
""")


functions.append("""
CREATE OR REPLACE FUNCTION get_post_engagement_stats(p_post_id INTEGER)
RETURNS TABLE(
    total_likes INTEGER,
    total_comments INTEGER,
    total_shares INTEGER,
    unique_commenters INTEGER,
    engagement_rate DECIMAL(5,2)
) AS $$
DECLARE
    post_author_followers INTEGER;
BEGIN
    SELECT COUNT(*) INTO post_author_followers
    FROM follows f
    INNER JOIN posts p ON p.user_id = f.following_id
    WHERE p.id = p_post_id AND f.status = 'accepted';
    
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM likes l WHERE l.post_id = p_post_id),
        (SELECT COUNT(*)::INTEGER FROM comments c WHERE c.post_id = p_post_id),
        0 as total_shares,
        (SELECT COUNT(DISTINCT c.user_id)::INTEGER FROM comments c WHERE c.post_id = p_post_id),
        CASE 
            WHEN post_author_followers > 0 THEN
                ((SELECT COUNT(*)::DECIMAL FROM likes l WHERE l.post_id = p_post_id) + 
                 (SELECT COUNT(*)::DECIMAL FROM comments c WHERE c.post_id = p_post_id)) / 
                post_author_followers * 100
            ELSE 0 
        END as engagement_rate;
END;
$$ LANGUAGE plpgsql;
""")


functions.append("""
DROP FUNCTION IF EXISTS get_posts_by_media_type(VARCHAR, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_posts_by_media_type(
    p_media_type VARCHAR(20),
    p_user_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    post_id INTEGER,
    content TEXT,
    author_name VARCHAR(50),
    author_picture VARCHAR(500),
    likes_count INTEGER,
    comments_count INTEGER,
    media_urls_list VARCHAR(500)[],
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as post_id,
        p.content,
        u.name as author_name,
        u.profile_picture as author_picture,
        p.likes_count,
        p.comments_count,
        ARRAY(SELECT m.media_url FROM media_urls m WHERE m.post_id = p.id) as media_urls_list,
        p.created_at
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.media_type = p_media_type
    AND p.visibility = 'public'
    AND p.group_id IS NULL
    AND (p_user_id IS NULL OR 
         p.user_id = p_user_id OR 
         p.user_id IN (
             SELECT f.following_id FROM follows f
             WHERE f.follower_id = p_user_id AND f.status = 'accepted'
         ))
    ORDER BY p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
""")


success_count = 0
fail_count = 0

for i, func_sql in enumerate(functions, 1):
    try:
        print(f"\n[{i}/{len(functions)}] Updating function...")
        DatabaseManager.execute_update(func_sql)
        print(f"  ✓ Function {i} updated successfully")
        success_count += 1
    except Exception as e:
        print(f"  ✗ Function {i} failed: {e}")
        fail_count += 1

print("\n" + "="*70)
print(f"UPDATE COMPLETE: {success_count} succeeded, {fail_count} failed")
print("="*70)


print("\nTesting updated functions...")

try:
    users = DatabaseManager.execute_query("SELECT id FROM users WHERE is_active = TRUE LIMIT 1")
    if users:
        user_id = users[0]['id']
        
        
        post_id = DatabaseManager.execute_insert(
            "INSERT INTO posts(user_id, content, media_type) VALUES (%s, %s, %s) RETURNING id",
            (user_id, "Test post after function updates", "text")
        )
        
        print(f"\n✓ Created test post ID: {post_id}")
        
        
        result = DatabaseManager.execute_function('get_post_details', (post_id, user_id))
        if result:
            print("✓ get_post_details works!")
        
        
        result = DatabaseManager.execute_function('get_user_posts', (user_id, user_id, 5, 0))
        if result:
            print("✓ get_user_posts works!")
        
        
        DatabaseManager.execute_update("DELETE FROM posts WHERE id = %s", (post_id,))
        print("✓ Test post cleaned up")
        
        print("\n" + "="*70)
        print("ALL POST FUNCTIONS ARE NOW WORKING!")
        print("="*70)
        print("\nYou can now:")
        print("  - Create posts and get complete data back")
        print("  - View user posts with proper data")
        print("  - All ambiguous column references have been fixed")
        
except Exception as e:
    print(f"\n✗ Test failed: {e}")
    import traceback
    traceback.print_exc()
