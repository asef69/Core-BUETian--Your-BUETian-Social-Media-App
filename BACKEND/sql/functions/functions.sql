--mutual followers 
CREATE OR REPLACE FUNCTION get_mutual_followers(p_user_id INTEGER) RETURNS TABLE(
        user_id INTEGER,
        name VARCHAR(50),
        profile_picture VARCHAR(500),
        department_name VARCHAR(100)
    ) AS $$ BEGIN RETURN QUERY
SELECT DISTINCT u.id,
    u.name,
    u.profile_picture,
    u.department_name
FROM users u
WHERE u.id IN(
        SELECT following_id
        FROM follows
        WHERE follower_id = p_user_id
            AND status = 'accepted'
    )
    AND u.id IN(
        SELECT follower_id
        FROM follows
        WHERE following_id = p_user_id
            AND status = 'accepted'
    )
    AND u.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
--POST FUNCTIONS
--FAMOUS POST
--TRENDING POSTS (sorted by engagement score = likes*2 + comments, last 7 days)
--GROUP MEMBER CHECK
--ADMIN OR MODERATOR OR MEMBER IN GROUP
--GROUP DETAILS
--BLOOD DONATION DETAILS
--SEARCH USER
--POST SEARCH
CREATE OR REPLACE FUNCTION search_posts(
        p_search_term VARCHAR(255),
        p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
        post_id INTEGER,
        content TEXT,
        author_name VARCHAR(50),
        likes_count INTEGER,
        comments_count INTEGER,
        created_at TIMESTAMP,
        relevance REAL
    ) AS $$ BEGIN RETURN QUERY
SELECT p.id as post_id,
    p.content,
    u.name as author_name,
    p.likes_count,
    p.comments_count,
    p.created_at,
    ts_rank(
        to_tsvector('english', p.content),
        plainto_tsquery('english', p_search_term)
    ) as relevance
FROM posts p
    INNER JOIN users u ON p.user_id = u.id
WHERE to_tsvector('english', p.content) @@ plainto_tsquery('english', p_search_term)
    AND p.visibility = 'public'
    AND p.group_id IS NULL
ORDER BY relevance DESC,
    p.created_at DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
--NOTIFICATION COUNT
--MARK AS READ
--CHAT RELATED WORKS
CREATE OR REPLACE FUNCTION get_recent_conversations(p_user_id INTEGER) RETURNS TABLE(
        other_user_id INTEGER,
        other_user_name VARCHAR(50),
        other_user_picture VARCHAR(500),
        last_message TEXT,
        last_message_time TIMESTAMP,
        unread_count BIGINT
    ) AS $$ BEGIN RETURN QUERY WITH last_messages AS (
        SELECT DISTINCT ON (
                CASE
                    WHEN sender_id = p_user_id THEN receiver_id
                    ELSE sender_id
                END
            ) id,
            sender_id,
            receiver_id,
            content,
            created_at,
            CASE
                WHEN sender_id = p_user_id THEN receiver_id
                ELSE sender_id
            END as other_user
        FROM messages
        WHERE sender_id = p_user_id
            OR receiver_id = p_user_id
        ORDER BY CASE
                WHEN sender_id = p_user_id THEN receiver_id
                ELSE sender_id
            END,
            created_at DESC
    )
SELECT lm.other_user,
    u.name,
    u.profile_picture,
    lm.content,
    lm.created_at,
    (
        SELECT COUNT(*)
        FROM messages
        WHERE sender_id = lm.other_user
            AND receiver_id = p_user_id
            AND is_read = FALSE
    ) as unread_count
FROM last_messages lm
    INNER JOIN users u ON lm.other_user = u.id
ORDER BY lm.created_at DESC;
END;
$$ LANGUAGE plpgsql;
--CHAT SYSTEM( ONLY CAN BE DONE IF THEY FOLLOW EACH OTHER OR HAVE PREVIOUS CHAT)
--USER SUMMARY WORKS
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id INTEGER) RETURNS TABLE(
        posts_today INTEGER,
        posts_this_week INTEGER,
        posts_this_month INTEGER,
        likes_received_today INTEGER,
        comments_received_today INTEGER,
        new_followers_today INTEGER
    ) AS $$ BEGIN RETURN QUERY
SELECT (
        SELECT COUNT(*)::INTEGER
        FROM posts
        WHERE user_id = p_user_id
            AND created_at > CURRENT_DATE
    ) as posts_today,
    (
        SELECT COUNT(*)::INTEGER
        FROM posts
        WHERE user_id = p_user_id
            AND created_at > CURRENT_DATE - INTERVAL '7 days'
    ) as posts_this_week,
    (
        SELECT COUNT(*)::INTEGER
        FROM posts
        WHERE user_id = p_user_id
            AND created_at > CURRENT_DATE - INTERVAL '30 days'
    ) as posts_this_month,
    (
        SELECT COUNT(*)::INTEGER
        FROM likes l
            INNER JOIN posts p ON l.post_id = p.id
        WHERE p.user_id = p_user_id
            AND l.created_at > CURRENT_DATE
    ) as likes_received_today,
    (
        SELECT COUNT(*)::INTEGER
        FROM comments c
            INNER JOIN posts p ON c.post_id = p.id
        WHERE p.user_id = p_user_id
            AND c.created_at > CURRENT_DATE
    ) as comments_received_today,
    (
        SELECT COUNT(*)::INTEGER
        FROM follows
        WHERE following_id = p_user_id
            AND status = 'accepted'
            AND created_at > CURRENT_DATE
    ) as new_followers_today;
END;
$$ LANGUAGE plpgsql;
--PERSONAL HISTORY(WITHOUT CHAT)
CREATE OR REPLACE FUNCTION get_platform_statistics() RETURNS TABLE(
        total_users BIGINT,
        active_users_today BIGINT,
        total_posts BIGINT,
        posts_today BIGINT,
        total_groups BIGINT,
        total_marketplace_items BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT (
        SELECT COUNT(*)
        FROM users
        WHERE is_active = TRUE
    ),
    (
        SELECT COUNT(DISTINCT user_id)
        FROM posts
        WHERE created_at > CURRENT_DATE
    ),
    (
        SELECT COUNT(*)
        FROM posts
    ),
    (
        SELECT COUNT(*)
        FROM posts
        WHERE created_at > CURRENT_DATE
    ),
    (
        SELECT COUNT(*)
        FROM groups
    ),
    (
        SELECT COUNT(*)
        FROM marketplace_products
        WHERE status = 'available'
    );
END;
$$ LANGUAGE plpgsql;
--CLEAN PREVIOUS NOTIFICATION
-- =====================================================================
-- USER FUNCTIONS
-- =====================================================================
-- Suggested users (same department or batch, not already followed)
CREATE OR REPLACE FUNCTION get_suggested_users(
        p_user_id INTEGER,
        p_limit INTEGER DEFAULT 10
    ) RETURNS TABLE(
        user_id INTEGER,
        name VARCHAR(50),
        profile_picture VARCHAR(500),
        department_name VARCHAR(100),
        batch INTEGER,
        mutual_count BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT DISTINCT u.id AS user_id,
    u.name,
    u.profile_picture,
    u.department_name,
    u.batch,
    (
        SELECT COUNT(*)
        FROM follows f1
            INNER JOIN follows f2 ON f1.following_id = f2.follower_id
        WHERE f1.follower_id = p_user_id
            AND f2.following_id = u.id
            AND f1.status = 'accepted'
            AND f2.status = 'accepted'
    ) AS mutual_count
FROM users u
WHERE u.id != p_user_id
    AND u.is_active = TRUE
    AND u.id NOT IN (
        SELECT following_id
        FROM follows
        WHERE follower_id = p_user_id
    )
    AND (
        u.department_name = (
            SELECT department_name
            FROM users
            WHERE id = p_user_id
        )
        OR u.batch = (
            SELECT batch
            FROM users
            WHERE id = p_user_id
        )
    )
ORDER BY mutual_count DESC,
    u.name
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- Incoming pending follow requests for a user
CREATE OR REPLACE FUNCTION get_pending_follow_requests(p_user_id INTEGER) RETURNS TABLE(
        follow_id INTEGER,
        requester_id INTEGER,
        requester_name VARCHAR(50),
        requester_picture VARCHAR(500),
        department_name VARCHAR(100),
        batch INTEGER,
        requested_at TIMESTAMP
    ) AS $$ BEGIN RETURN QUERY
SELECT f.id AS follow_id,
    u.id AS requester_id,
    u.name AS requester_name,
    u.profile_picture AS requester_picture,
    u.department_name,
    u.batch,
    f.created_at AS requested_at
FROM follows f
    INNER JOIN users u ON u.id = f.follower_id
WHERE f.following_id = p_user_id
    AND f.status = 'pending'
ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;
-- Advanced user search with optional department, batch, blood group filters
CREATE OR REPLACE FUNCTION search_users_advanced(
        p_search_term VARCHAR(255),
        p_department VARCHAR(100) DEFAULT NULL,
        p_batch INTEGER DEFAULT NULL,
        p_blood_group VARCHAR(5) DEFAULT NULL,
        p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
        user_id INTEGER,
        name VARCHAR(50),
        profile_picture VARCHAR(500),
        department_name VARCHAR(100),
        batch INTEGER,
        blood_group VARCHAR(5)
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id AS user_id,
    u.name,
    u.profile_picture,
    u.department_name,
    u.batch,
    u.blood_group
FROM users u
WHERE u.is_active = TRUE
    AND (
        p_search_term IS NULL
        OR p_search_term = ''
        OR u.name ILIKE '%' || p_search_term || '%'
        OR u.student_id::TEXT ILIKE '%' || p_search_term || '%'
    )
    AND (
        p_department IS NULL
        OR u.department_name = p_department
    )
    AND (
        p_batch IS NULL
        OR u.batch = p_batch
    )
    AND (
        p_blood_group IS NULL
        OR u.blood_group = p_blood_group
    )
ORDER BY u.name
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- Users in a given department, optionally filtered by batch
CREATE OR REPLACE FUNCTION get_users_by_department(
        p_department_name VARCHAR(100),
        p_batch INTEGER DEFAULT NULL,
        p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
        user_id INTEGER,
        name VARCHAR(50),
        profile_picture VARCHAR(500),
        batch INTEGER,
        blood_group VARCHAR(5)
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id AS user_id,
    u.name,
    u.profile_picture,
    u.batch,
    u.blood_group
FROM users u
WHERE u.department_name = p_department_name
    AND u.is_active = TRUE
    AND (
        p_batch IS NULL
        OR u.batch = p_batch
    )
ORDER BY u.batch DESC,
    u.name
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- Users with a specific blood group
CREATE OR REPLACE FUNCTION get_users_by_blood_group(
        p_blood_group VARCHAR(5),
        p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
        user_id INTEGER,
        name VARCHAR(50),
        profile_picture VARCHAR(500),
        department_name VARCHAR(100),
        batch INTEGER,
        hall_name VARCHAR(100),
        bio TEXT
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id AS user_id,
    u.name,
    u.profile_picture,
    u.department_name,
    u.batch,
    u.hall_name,
    u.bio
FROM users u
WHERE u.blood_group = p_blood_group
    AND u.is_active = TRUE
ORDER BY u.name
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- Engagement metrics for a specific user
CREATE OR REPLACE FUNCTION get_user_engagement_metrics(p_user_id INTEGER) RETURNS TABLE(
        user_id INTEGER,
        name VARCHAR(50),
        department_name VARCHAR(100),
        batch INTEGER,
        posts_count BIGINT,
        comments_count BIGINT,
        likes_given BIGINT,
        likes_received BIGINT,
        following_count BIGINT,
        followers_count BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id AS user_id,
    u.name,
    u.department_name,
    u.batch,
    (
        SELECT COUNT(*)
        FROM posts
        WHERE user_id = u.id
    ) AS posts_count,
    (
        SELECT COUNT(*)
        FROM comments
        WHERE user_id = u.id
    ) AS comments_count,
    (
        SELECT COUNT(*)
        FROM likes
        WHERE user_id = u.id
    ) AS likes_given,
    (
        SELECT COALESCE(SUM(p.likes_count), 0)
        FROM posts p
        WHERE p.user_id = u.id
    ) AS likes_received,
    (
        SELECT COUNT(*)
        FROM follows
        WHERE follower_id = u.id
            AND status = 'accepted'
    ) AS following_count,
    (
        SELECT COUNT(*)
        FROM follows
        WHERE following_id = u.id
            AND status = 'accepted'
    ) AS followers_count
FROM users u
WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;
-- =====================================================================
-- NOTIFICATION FUNCTIONS
-- =====================================================================
-- Total unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id INTEGER) RETURNS TABLE(unread_count BIGINT) AS $$ BEGIN RETURN QUERY
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE user_id = p_user_id
    AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql;
-- Mark all notifications as read for a user; returns affected row count
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id INTEGER) RETURNS TABLE(updated_count INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
UPDATE notifications
SET is_read = TRUE
WHERE user_id = p_user_id
    AND is_read = FALSE;
GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN QUERY
SELECT v_count;
END;
$$ LANGUAGE plpgsql;
-- Notification summary counts for a single user
CREATE OR REPLACE FUNCTION get_notification_summary(p_user_id INTEGER) RETURNS TABLE(
        total_notifications BIGINT,
        unread_count BIGINT,
        likes_count BIGINT,
        comments_count BIGINT,
        follow_requests_count BIGINT,
        last_notification_at TIMESTAMP
    ) AS $$ BEGIN RETURN QUERY
SELECT COUNT(*) AS total_notifications,
    COUNT(*) FILTER (
        WHERE is_read = FALSE
    ) AS unread_count,
    COUNT(*) FILTER (
        WHERE notification_type = 'like'
    ) AS likes_count,
    COUNT(*) FILTER (
        WHERE notification_type = 'comment'
    ) AS comments_count,
    COUNT(*) FILTER (
        WHERE notification_type = 'follow_request'
    ) AS follow_requests_count,
    MAX(created_at) AS last_notification_at
FROM notifications
WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
-- Mark all notifications of a given type as read for a user
CREATE OR REPLACE FUNCTION mark_notifications_read_by_type(
        p_user_id INTEGER,
        p_notification_type VARCHAR(50)
    ) RETURNS TABLE(updated_count INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
UPDATE notifications
SET is_read = TRUE
WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND is_read = FALSE;
GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN QUERY
SELECT v_count;
END;
$$ LANGUAGE plpgsql;
-- Recent activity notifications for a user (with actor info)
CREATE OR REPLACE FUNCTION get_activity_notifications(
        p_user_id INTEGER,
        p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
        notification_id INTEGER,
        notification_type VARCHAR(50),
        reference_id INTEGER,
        content TEXT,
        is_read BOOLEAN,
        created_at TIMESTAMP,
        actor_id INTEGER,
        actor_name VARCHAR(50),
        actor_picture VARCHAR(500)
    ) AS $$ BEGIN RETURN QUERY
SELECT n.id AS notification_id,
    n.notification_type,
    n.reference_id,
    n.content,
    n.is_read,
    n.created_at,
    u.id AS actor_id,
    u.name AS actor_name,
    u.profile_picture AS actor_picture
FROM notifications n
    INNER JOIN users u ON u.id = n.actor_id
WHERE n.user_id = p_user_id
ORDER BY n.created_at DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- =====================================================================
-- CHAT / MESSAGING FUNCTIONS
-- =====================================================================
-- Check if sender is allowed to message receiver
-- (must follow each other, or have an existing conversation)
CREATE OR REPLACE FUNCTION can_user_message(
        p_sender_id INTEGER,
        p_receiver_id INTEGER
    ) RETURNS TABLE(can_message BOOLEAN) AS $$ BEGIN RETURN QUERY
SELECT (
        EXISTS(
            SELECT 1
            FROM follows
            WHERE follower_id = p_sender_id
                AND following_id = p_receiver_id
                AND status = 'accepted'
        )
        OR EXISTS(
            SELECT 1
            FROM messages
            WHERE (
                    sender_id = p_sender_id
                    AND receiver_id = p_receiver_id
                )
                OR (
                    sender_id = p_receiver_id
                    AND receiver_id = p_sender_id
                )
        )
    ) AS can_message;
END;
$$ LANGUAGE plpgsql;
-- Unread message count per conversation partner (inbox overview)
CREATE OR REPLACE FUNCTION get_unread_messages_count(p_user_id INTEGER) RETURNS TABLE(
        sender_id INTEGER,
        sender_name VARCHAR(50),
        sender_picture VARCHAR(500),
        unread_count BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id AS sender_id,
    u.name AS sender_name,
    u.profile_picture AS sender_picture,
    COUNT(*) AS unread_count
FROM messages m
    INNER JOIN users u ON u.id = m.sender_id
WHERE m.receiver_id = p_user_id
    AND m.is_read = FALSE
GROUP BY u.id,
    u.name,
    u.profile_picture
ORDER BY unread_count DESC;
END;
$$ LANGUAGE plpgsql;
-- Total number of unread messages for a user across all conversations
CREATE OR REPLACE FUNCTION get_total_unread_messages(p_user_id INTEGER) RETURNS TABLE(total_unread BIGINT) AS $$ BEGIN RETURN QUERY
SELECT COUNT(*) AS total_unread
FROM messages
WHERE receiver_id = p_user_id
    AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql;
-- Full-text search within a user's conversations
CREATE OR REPLACE FUNCTION search_messages(
        p_user_id INTEGER,
        p_search_term VARCHAR(255),
        p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
        message_id INTEGER,
        sender_id INTEGER,
        sender_name VARCHAR(50),
        receiver_id INTEGER,
        receiver_name VARCHAR(50),
        content TEXT,
        created_at TIMESTAMP
    ) AS $$ BEGIN RETURN QUERY
SELECT m.id AS message_id,
    m.sender_id,
    s.name AS sender_name,
    m.receiver_id,
    r.name AS receiver_name,
    m.content,
    m.created_at
FROM messages m
    INNER JOIN users s ON s.id = m.sender_id
    INNER JOIN users r ON r.id = m.receiver_id
WHERE (
        m.sender_id = p_user_id
        OR m.receiver_id = p_user_id
    )
    AND m.content ILIKE '%' || p_search_term || '%'
ORDER BY m.created_at DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
-- Delete all messages between two users
CREATE OR REPLACE FUNCTION delete_conversation(
        p_user_id INTEGER,
        p_other_user_id INTEGER
    ) RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
DELETE FROM messages
WHERE (
        sender_id = p_user_id
        AND receiver_id = p_other_user_id
    )
    OR (
        sender_id = p_other_user_id
        AND receiver_id = p_user_id
    );
GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN QUERY
SELECT v_count;
END;
$$ LANGUAGE plpgsql;
-- Mark all messages from a specific sender as read
CREATE OR REPLACE FUNCTION mark_conversation_read(
        p_user_id INTEGER,
        p_other_user_id INTEGER
    ) RETURNS TABLE(updated_count INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
UPDATE messages
SET is_read = TRUE
WHERE sender_id = p_other_user_id
    AND receiver_id = p_user_id
    AND is_read = FALSE;
GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN QUERY
SELECT v_count;
END;
$$ LANGUAGE plpgsql;
-- Messaging statistics for a user
CREATE OR REPLACE FUNCTION get_user_message_stats(p_user_id INTEGER) RETURNS TABLE(
        total_sent BIGINT,
        total_received BIGINT,
        total_unread BIGINT,
        conversations_count BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT (
        SELECT COUNT(*)
        FROM messages
        WHERE sender_id = p_user_id
    ) AS total_sent,
    (
        SELECT COUNT(*)
        FROM messages
        WHERE receiver_id = p_user_id
    ) AS total_received,
    (
        SELECT COUNT(*)
        FROM messages
        WHERE receiver_id = p_user_id
            AND is_read = FALSE
    ) AS total_unread,
    (
        SELECT COUNT(
                DISTINCT LEAST(sender_id, receiver_id)::TEXT || '-' || GREATEST(sender_id, receiver_id)::TEXT
            )
        FROM messages
        WHERE sender_id = p_user_id
            OR receiver_id = p_user_id
    ) AS conversations_count;
END;
$$ LANGUAGE plpgsql;
-- Profile info for both participants in a conversation
CREATE OR REPLACE FUNCTION get_conversation_participants(
        p_user_id INTEGER,
        p_other_user_id INTEGER
    ) RETURNS TABLE(
        user_id INTEGER,
        name VARCHAR(50),
        profile_picture VARCHAR(500),
        department_name VARCHAR(100),
        batch INTEGER,
        is_self BOOLEAN
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id AS user_id,
    u.name,
    u.profile_picture,
    u.department_name,
    u.batch,
    (u.id = p_user_id) AS is_self
FROM users u
WHERE u.id IN (p_user_id, p_other_user_id);
END;
$$ LANGUAGE plpgsql;
--Tajrian's Function
--USER FUNCTIONS
--GET USER PROFILE
DROP FUNCTION IF EXISTS get_user_profile(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_user_profile(
        p_user_id INTEGER,
        p_viewer_id INTEGER DEFAULT NULL
    ) RETURNS TABLE(
        id INTEGER,
        student_id INTEGER,
        name VARCHAR(50),
        email VARCHAR(100),
        profile_picture VARCHAR(500),
        blood_group VARCHAR(10),
        batch INTEGER,
        hall_name VARCHAR(100),
        hall_attachement VARCHAR(20),
        department_name VARCHAR(100),
        bio TEXT,
        posts_count INTEGER,
        followers_count BIGINT,
        following_count BIGINT,
        mutual_friends_count INTEGER,
        follow_id INTEGER,
        follow_status VARCHAR(20),
        incoming_follow_request_id INTEGER,
        follows_you BOOLEAN,
        relationship_status TEXT,
        is_following BOOLEAN,
        created_at TIMESTAMP
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id,
    u.student_id,
    u.name,
    u.email,
    u.profile_picture,
    u.blood_group,
    u.batch,
    u.hall_name,
    u.hall_attachement,
    u.department_name,
    u.bio,
    (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.user_id = u.id
            AND p.group_id IS NULL
    )::INTEGER AS posts_count,
    (
        SELECT COUNT(*)
        FROM follows f
        WHERE f.following_id = u.id
            AND f.status = 'accepted'
    ) AS followers_count,
    (
        SELECT COUNT(*)
        FROM follows f
        WHERE f.follower_id = u.id
            AND f.status = 'accepted'
    ) AS following_count,
    CASE
        WHEN p_viewer_id IS NOT NULL
        AND p_viewer_id <> u.id THEN (
            WITH viewer_friends AS (
                SELECT f1.following_id AS friend_id
                FROM follows f1
                    INNER JOIN follows f2 ON f2.follower_id = f1.following_id
                    AND f2.following_id = p_viewer_id
                    AND f2.status = 'accepted'
                WHERE f1.follower_id = p_viewer_id
                    AND f1.status = 'accepted'
            ),
            target_friends AS (
                SELECT f1.following_id AS friend_id
                FROM follows f1
                    INNER JOIN follows f2 ON f2.follower_id = f1.following_id
                    AND f2.following_id = u.id
                    AND f2.status = 'accepted'
                WHERE f1.follower_id = u.id
                    AND f1.status = 'accepted'
            )
            SELECT COUNT(*)::INTEGER
            FROM viewer_friends vf
                INNER JOIN target_friends tf ON tf.friend_id = vf.friend_id
        )
        ELSE 0
    END AS mutual_friends_count,
    CASE
        WHEN p_viewer_id IS NOT NULL
        AND p_viewer_id <> u.id THEN (
            SELECT f.id
            FROM follows f
            WHERE f.follower_id = p_viewer_id
                AND f.following_id = u.id
            LIMIT 1
        )
        ELSE NULL
    END AS follow_id,
    CASE
        WHEN p_viewer_id IS NOT NULL
        AND p_viewer_id <> u.id THEN (
            SELECT f.status
            FROM follows f
            WHERE f.follower_id = p_viewer_id
                AND f.following_id = u.id
            LIMIT 1
        )
        ELSE NULL
    END AS follow_status,
    CASE
        WHEN p_viewer_id IS NOT NULL
        AND p_viewer_id <> u.id THEN (
            SELECT f.id
            FROM follows f
            WHERE f.follower_id = u.id
                AND f.following_id = p_viewer_id
                AND f.status = 'pending'
            LIMIT 1
        )
        ELSE NULL
    END AS incoming_follow_request_id,
    CASE
        WHEN p_viewer_id IS NOT NULL
        AND p_viewer_id <> u.id THEN EXISTS(
            SELECT 1
            FROM follows f
            WHERE f.follower_id = u.id
                AND f.following_id = p_viewer_id
                AND f.status = 'accepted'
        )
        ELSE FALSE
    END AS follows_you,
    CASE
        WHEN p_viewer_id IS NULL
        OR p_viewer_id = u.id THEN 'self'
        WHEN EXISTS(
            SELECT 1
            FROM follows f
            WHERE f.follower_id = p_viewer_id
                AND f.following_id = u.id
                AND f.status = 'accepted'
        ) THEN 'accepted'
        WHEN EXISTS(
            SELECT 1
            FROM follows f
            WHERE f.follower_id = p_viewer_id
                AND f.following_id = u.id
                AND f.status = 'pending'
        ) THEN 'pending_sent'
        WHEN EXISTS(
            SELECT 1
            FROM follows f
            WHERE f.follower_id = u.id
                AND f.following_id = p_viewer_id
                AND f.status = 'pending'
        ) THEN 'pending_received'
        ELSE 'none'
    END AS relationship_status,
    CASE
        WHEN p_viewer_id IS NOT NULL
        AND p_viewer_id <> u.id THEN EXISTS(
            SELECT 1
            FROM follows f
            WHERE f.follower_id = p_viewer_id
                AND f.following_id = u.id
                AND f.status = 'accepted'
        )
        ELSE FALSE
    END AS is_following,
    u.created_at
FROM users u
WHERE u.id = p_user_id
    AND u.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
--REJECT FOLLOW REQUEST
CREATE OR REPLACE FUNCTION reject_follow_request(p_follow_id INTEGER, p_user_id INTEGER) RETURNS TABLE(reject_follow_request BOOLEAN) AS $$ BEGIN
DELETE FROM follows
WHERE id = p_follow_id
    AND following_id = p_user_id
    AND status = 'pending';
RETURN QUERY
SELECT FOUND;
END;
$$ LANGUAGE plpgsql;
--ACCEPT FOLLOW REQUEST
CREATE OR REPLACE FUNCTION accept_follow_request(
        p_follow_id INTEGER,
        p_user_id INTEGER
    ) RETURNS TABLE(
        follow_id INTEGER,
        follower_id INTEGER,
        following_id INTEGER,
        accepted_at TIMESTAMP
    ) AS $$ BEGIN
UPDATE follows
SET status = 'accepted',
    updated_at = CURRENT_TIMESTAMP
WHERE id = p_follow_id
    AND following_id = p_user_id
    AND status = 'pending'
RETURNING id,
    follower_id,
    following_id,
    updated_at AS accepted_at;
END;
$$ LANGUAGE plpgsql;