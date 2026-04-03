DROP FUNCTION IF EXISTS get_user_posts;
CREATE OR REPLACE FUNCTION get_user_posts(
    p_user_id INTEGER,
    p_viewer_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
    ) RETURNS TABLE(
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
    media_urls JSON
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id as post_id,
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
    WHEN p_viewer_id IS NOT NULL THEN EXISTS(
        SELECT 1
        FROM likes l
        WHERE l.post_id = p.id
        AND l.user_id = p_viewer_id
    )
    ELSE FALSE
    END as is_liked,
    COALESCE(
    JSON_AGG(
        JSON_BUILD_OBJECT(
        'media_url',
        m.media_url,
        'media_type',
        m.media_type
        )
    ) FILTER (
        WHERE m.id IS NOT NULL
    ),
    '[]'::JSON
    ) as media_urls
FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    LEFT JOIN media_urls m ON p.id = m.post_id
WHERE p.user_id = p_user_id
    AND (
    p.group_id IS NULL
    OR p.group_id = 0
    )
    AND (
    p.user_id = p_viewer_id
    OR p.visibility = 'public'
    OR (
        p.visibility = 'followers'
        AND EXISTS (
        SELECT 1
        FROM follows f
        WHERE f.follower_id = p_viewer_id
            AND f.following_id = p.user_id
            AND f.status = 'accepted'
        )
    )
    )
GROUP BY p.id,
    u.id,
    u.name,
    u.profile_picture
ORDER BY p.created_at DESC
LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_posts_by_hashtag;
CREATE OR REPLACE FUNCTION get_posts_by_hashtag(
    p_hashtag VARCHAR(100),
    p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
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
    media_urls JSON
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id AS post_id,
    p.content,
    p.media_type,
    p.visibility,
    u.id AS author_id,
    u.name AS author_name,
    u.profile_picture AS author_picture,
    p.created_at,
    p.likes_count,
    p.comments_count,
    COALESCE(
    JSON_AGG(
        JSON_BUILD_OBJECT(
        'media_url',
        m.media_url,
        'media_type',
        m.media_type
        )
    ) FILTER (
        WHERE m.id IS NOT NULL
    ),
    '[]'::JSON
    ) AS media_urls
FROM posts p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN media_urls m ON m.post_id = p.id
WHERE p.content ~* (
    '(^|[^a-zA-Z0-9_])#' || p_hashtag || '([^a-zA-Z0-9_]|$)'
    )
    AND p.visibility = 'public'
    AND (
    p.group_id IS NULL
    OR p.group_id = 0
    )
GROUP BY p.id,
    u.id,
    u.name,
    u.profile_picture
ORDER BY p.created_at DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_user_liked_posts;
CREATE OR REPLACE FUNCTION get_user_liked_posts(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
    post_id INTEGER,
    content TEXT,
    media_type VARCHAR(20),
    author_id INTEGER,
    author_name VARCHAR(50),
    author_picture VARCHAR(500),
    created_at TIMESTAMP,
    likes_count INTEGER,
    comments_count INTEGER,
    media_urls JSON
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id AS post_id,
    p.content,
    p.media_type,
    u.id AS author_id,
    u.name AS author_name,
    u.profile_picture AS author_picture,
    p.created_at,
    p.likes_count,
    p.comments_count,
    COALESCE(
    JSON_AGG(
        JSON_BUILD_OBJECT(
        'media_url',
        m.media_url,
        'media_type',
        m.media_type
        )
    ) FILTER (
        WHERE m.id IS NOT NULL
    ),
    '[]'::JSON
    ) AS media_urls
FROM likes l
    INNER JOIN posts p ON p.id = l.post_id
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN media_urls m ON m.post_id = p.id
WHERE l.user_id = p_user_id
GROUP BY p.id,
    u.id,
    u.name,
    u.profile_picture,
    l.created_at
ORDER BY l.created_at DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_post_engagement_stats;
CREATE OR REPLACE FUNCTION get_post_engagement_stats(p_post_id INTEGER) RETURNS TABLE(
    post_id INTEGER,
    likes_count INTEGER,
    comments_count INTEGER,
    total_engagement INTEGER,
    engagement_rate NUMERIC
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id AS post_id,
    p.likes_count,
    p.comments_count,
    (p.likes_count + p.comments_count) AS total_engagement,
    ROUND(
    (p.likes_count + p.comments_count)::NUMERIC / GREATEST(
        EXTRACT(
        EPOCH
        FROM (CURRENT_TIMESTAMP - p.created_at)
        ) / 3600,
        1
    ),
    4
    ) AS engagement_rate
FROM posts p
WHERE p.id = p_post_id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_posts_by_media_type;
CREATE OR REPLACE FUNCTION get_posts_by_media_type(
    p_media_type VARCHAR(20),
    p_user_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
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
    media_urls JSON
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id AS post_id,
    p.content,
    p.media_type,
    p.visibility,
    u.id AS author_id,
    u.name AS author_name,
    u.profile_picture AS author_picture,
    p.created_at,
    p.likes_count,
    p.comments_count,
    CASE
    WHEN p_user_id IS NOT NULL THEN EXISTS(
        SELECT 1
        FROM likes l
        WHERE l.post_id = p.id
        AND l.user_id = p_user_id
    )
    ELSE FALSE
    END AS is_liked,
    COALESCE(
    JSON_AGG(
        JSON_BUILD_OBJECT(
        'media_url',
        m.media_url,
        'media_type',
        m.media_type
        )
    ) FILTER (
        WHERE m.id IS NOT NULL
    ),
    '[]'::JSON
    ) AS media_urls
FROM posts p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN media_urls m ON m.post_id = p.id
WHERE p.media_type = p_media_type
    AND p.visibility = 'public'
    AND (
    p.group_id IS NULL
    OR p.group_id = 0
    )
GROUP BY p.id,
    u.id,
    u.name,
    u.profile_picture
ORDER BY p.created_at DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_user_feed;
CREATE OR REPLACE FUNCTION get_user_feed(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
    ) RETURNS TABLE(
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
    media_urls JSON
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id AS post_id,
    p.content,
    p.media_type,
    p.visibility,
    u.id AS author_id,
    u.name AS author_name,
    u.profile_picture AS author_picture,
    p.created_at,
    p.likes_count,
    p.comments_count,
    EXISTS(
    SELECT 1
    FROM likes l
    WHERE l.post_id = p.id
        AND l.user_id = p_user_id
    ) AS is_liked,
    COALESCE(
    JSON_AGG(
        JSON_BUILD_OBJECT(
        'media_url',
        m.media_url,
        'media_type',
        m.media_type
        )
    ) FILTER (
        WHERE m.id IS NOT NULL
    ),
    '[]'::JSON
    ) AS media_urls
FROM posts p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN media_urls m ON m.post_id = p.id
WHERE p.user_id IN (
    -- only posts from people the current user mutually follows (accepted)
    SELECT following_id
    FROM follows
    WHERE follower_id = p_user_id
        AND status = 'accepted'
    )
    AND (
    p.group_id IS NULL
    OR p.group_id = 0
    ) -- exclude group posts
    AND p.visibility IN ('public', 'followers') -- exclude private posts
GROUP BY p.id,
    u.id,
    u.name,
    u.profile_picture
ORDER BY p.created_at DESC
LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_post_details;
CREATE OR REPLACE FUNCTION get_post_details(
    p_post_id INTEGER,
    p_current_user_id INTEGER DEFAULT NULL
    ) RETURNS TABLE(
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
    media_urls_list VARCHAR(500) []
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id as post_id,
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
    WHEN p_current_user_id IS NOT NULL THEN EXISTS(
        SELECT 1
        FROM likes l
        WHERE l.post_id = p.id
        AND l.user_id = p_current_user_id
    )
    ELSE FALSE
    END as is_liked,
    ARRAY(
    SELECT m.media_url
    FROM media_urls m
    WHERE m.post_id = p.id
    ) as media_urls_list
FROM posts p
    INNER JOIN users u ON p.user_id = u.id
WHERE p.id = p_post_id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_trending_hashtags;
CREATE OR REPLACE FUNCTION get_trending_hashtags(p_limit INTEGER DEFAULT 10) RETURNS TABLE(
    hashtag TEXT,
    post_count BIGINT,
    total_engagement BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT lower(regexp_replace(bpt.tag_name, '^#', '')) AS hashtag,
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
ORDER BY total_engagement DESC,
    post_count DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_post_comments;
CREATE OR REPLACE FUNCTION get_post_comments(
    p_post_id INTEGER,
    p_current_user_id INTEGER DEFAULT NULL
    ) RETURNS TABLE(
    comment_id INTEGER,
    user_id INTEGER,
    user_name VARCHAR(50),
    user_picture VARCHAR(500),
    content TEXT,
    parent_comment_id INTEGER,
    likes_count INTEGER,
    liked BOOLEAN,
    created_at TIMESTAMP
    ) AS $$ BEGIN RETURN QUERY
SELECT c.id AS comment_id,
    u.id AS user_id,
    u.name AS user_name,
    u.profile_picture AS user_picture,
    c.content,
    c.comment_id AS parent_comment_id,
    CAST(COUNT(cl.id) AS INTEGER) AS likes_count,
    CASE
    WHEN p_current_user_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM comment_likes cl2
        WHERE cl2.comment_id = c.id
        AND cl2.user_id = p_current_user_id
    ) THEN TRUE
    ELSE FALSE
    END AS liked,
    c.created_at
FROM comments c
    INNER JOIN users u ON c.user_id = u.id
    LEFT JOIN comment_likes cl ON c.id = cl.comment_id
WHERE c.post_id = p_post_id
GROUP BY c.id,
    u.id,
    u.name,
    u.profile_picture,
    c.content,
    c.comment_id,
    c.created_at
ORDER BY c.created_at ASC;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_trending_posts;
CREATE OR REPLACE FUNCTION get_trending_posts(p_limit INTEGER DEFAULT 10) RETURNS TABLE(
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
    views_count INTEGER,
    has_liked BOOLEAN,
    media_urls JSON
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id AS post_id,
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
    0 AS views_count,
    FALSE AS has_liked,
    COALESCE(
    JSON_AGG(
        JSON_BUILD_OBJECT(
        'media_url',
        m.media_url,
        'media_type',
        m.media_type
        )
    ) FILTER (
        WHERE m.id IS NOT NULL
    ),
    '[]'::JSON
    ) AS media_urls
FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    LEFT JOIN media_urls m ON p.id = m.post_id
WHERE p.visibility = 'public'
    AND p.group_id IS NULL
    AND p.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY p.id,
    u.id
ORDER BY (p.likes_count * 2 + p.comments_count) DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


DROP FUNCTION IF EXISTS get_group_posts;
CREATE OR REPLACE FUNCTION get_group_posts(
    p_group_id INTEGER,
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE(
    post_id INTEGER,
    user_id INTEGER,
    user_name VARCHAR(50),
    profile_picture VARCHAR(500),
    content TEXT,
    media_urls JSON,
    likes_count INTEGER,
    comments_count INTEGER,
    created_at TIMESTAMP,
    is_liked BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS post_id,
        p.user_id,
        u.name AS user_name,
        u.profile_picture,
        p.content,
        COALESCE(
            (
                SELECT json_agg(m.media_url)
                FROM media_urls m
                WHERE m.post_id = p.id
            ),
            '[]'::JSON
        ) AS media_urls,
        p.likes_count,
        p.comments_count,
        p.created_at,
        EXISTS (
            SELECT 1
            FROM likes pl
            WHERE pl.post_id = p.id
              AND pl.user_id = p_user_id
        ) AS is_liked
    FROM posts p
    INNER JOIN users u ON u.id = p.user_id
    WHERE p.group_id = p_group_id
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;