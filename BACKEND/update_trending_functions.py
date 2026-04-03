"""
Run this script once to apply the updated trending SQL functions to the database.

    cd BACKEND
    python update_trending_functions.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_buetians.settings')
django.setup()

from utils.database import DatabaseManager

SQL_GET_TRENDING_POSTS = """
CREATE OR REPLACE FUNCTION get_trending_posts(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
    post_id INTEGER,
    id INTEGER,
    content TEXT,
    media_type VARCHAR(20),
    visibility VARCHAR(20),
    user_id INTEGER,
    user_name VARCHAR(50),
    profile_picture VARCHAR(500),
    author_id INTEGER,
    author_name VARCHAR(50),
    author_picture VARCHAR(500),
    created_at TIMESTAMP,
    likes_count INTEGER,
    comments_count INTEGER,
    has_liked BOOLEAN,
    media_urls JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS post_id,
        p.id AS id,
        p.content,
        p.media_type,
        p.visibility,
        u.id AS user_id,
        u.name AS user_name,
        u.profile_picture AS profile_picture,
        u.id AS author_id,
        u.name AS author_name,
        u.profile_picture AS author_picture,
        p.created_at,
        p.likes_count,
        p.comments_count,
        FALSE AS has_liked,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT('media_url', m.media_url, 'media_type', m.media_type)
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'::JSON
        ) AS media_urls
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    LEFT JOIN media_urls m ON p.id = m.post_id
    WHERE p.visibility = 'public'
      AND p.group_id IS NULL
      AND p.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
    GROUP BY p.id, u.id
    ORDER BY (p.likes_count * 2 + p.comments_count) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
"""

SQL_GET_TRENDING_HASHTAGS = """
CREATE OR REPLACE FUNCTION get_trending_hashtags(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
    hashtag TEXT,
    post_count BIGINT,
    total_engagement BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lower(regexp_replace(bpt.tag_name, '^#', '')) AS hashtag,
        COUNT(DISTINCT b.id) AS post_count,
        COALESCE(SUM(b.likes_count + b.views_count + COALESCE(bc.comments_count, 0)), 0)::BIGINT AS total_engagement
    FROM blog_posts b
    INNER JOIN blog_post_tags bpt ON bpt.blog_post_id = b.id
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS comments_count
        FROM blog_comments c
        WHERE c.blog_id = b.id
    ) AS bc ON TRUE
    WHERE b.is_published = TRUE
      AND (b.scheduled_publish_at IS NULL OR b.scheduled_publish_at <= NOW())
      AND COALESCE(b.published_at, b.created_at) > CURRENT_TIMESTAMP - INTERVAL '30 days'
      AND NULLIF(TRIM(regexp_replace(bpt.tag_name, '^#', '')), '') IS NOT NULL
    GROUP BY lower(regexp_replace(bpt.tag_name, '^#', ''))
    ORDER BY total_engagement DESC, post_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
"""

steps = [
    ("get_trending_posts",    SQL_GET_TRENDING_POSTS),
    ("get_trending_hashtags", SQL_GET_TRENDING_HASHTAGS),
]

print("=" * 60)
print("Applying trending SQL functions")
print("=" * 60)

for name, sql in steps:
    try:
        DatabaseManager.execute_update(sql, []) # type: ignore
        print(f"  OK  {name}")
    except Exception as e:
        print(f"  FAIL {name}: {e}")

print("=" * 60)
print("Done.")
