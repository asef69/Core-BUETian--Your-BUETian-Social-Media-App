DROP FUNCTION IF EXISTS get_user_groups(INTEGER);
CREATE OR REPLACE FUNCTION get_user_groups(p_user_id INTEGER) RETURNS TABLE(
    group_id INTEGER,
    name VARCHAR(100),
    description TEXT,
    cover_image VARCHAR(500),
    role VARCHAR(20),
    members_count BIGINT,
    is_private BOOLEAN,
    joined_at TIMESTAMP
    ) AS $$ BEGIN RETURN QUERY
SELECT g.id as group_id,
    g.name,
    g.description,
    g.cover_image,
    gm.role,
    (
    SELECT COUNT(*)
    FROM group_members gm2
    WHERE gm2.group_id = g.id
        AND gm2.status = 'accepted'
    ) as members_count,
    g.is_private,
    gm.joined_at
FROM groups g
    INNER JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = p_user_id
    AND gm.status = 'accepted'
ORDER BY gm.joined_at DESC;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_suggested_groups(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_suggested_groups(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 10
    ) RETURNS TABLE (
    group_id INTEGER,
    name VARCHAR(100),
    description TEXT,
    cover_image VARCHAR(500),
    members_count BIGINT,
    is_private BOOLEAN,
    common_members_count BIGINT,
    member_status VARCHAR(20)
    ) AS $$ BEGIN RETURN QUERY
SELECT g.id AS group_id,
    g.name,
    g.description,
    g.cover_image,
    (
    SELECT COUNT(*)
    FROM group_members gm
    WHERE gm.group_id = g.id
        AND gm.status = 'accepted'
    ) AS members_count,
    g.is_private,
    (
    SELECT COUNT(*)
    FROM group_members gm
    WHERE gm.group_id = g.id
        AND gm.user_id IN (
        SELECT f.following_id
        FROM follows f
        WHERE f.follower_id = p_user_id
        )
        AND gm.status = 'accepted'
    ) AS common_members_count,
    (
    SELECT gm.status
    FROM group_members gm
    WHERE gm.group_id = g.id
        AND gm.user_id = p_user_id
    ORDER BY gm.joined_at DESC NULLS LAST,
        gm.id DESC
    LIMIT 1
    ) AS member_status
FROM groups g
WHERE (
    g.is_private = FALSE
    OR EXISTS (
        SELECT 1
        FROM group_members gm
        WHERE gm.group_id = g.id
        AND gm.user_id = p_user_id
        AND gm.status = 'invited'
    )
    )
    AND NOT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = g.id
        AND gm.user_id = p_user_id
        AND gm.status = 'accepted'
    )
ORDER BY common_members_count DESC,
    g.created_at DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_group_activity(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_group_activity(
    p_group_id INTEGER,
    p_days INTEGER DEFAULT 30
    ) RETURNS TABLE (
    posts_count BIGINT,
    active_members_count BIGINT,
    new_members_count BIGINT,
    total_likes BIGINT,
    total_comments BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT (
    SELECT COUNT(*)
    FROM posts p
    WHERE p.group_id = p_group_id
        AND p.created_at >= NOW() - (p_days || ' days')::INTERVAL
    ) AS posts_count,
    (
    SELECT COUNT(DISTINCT p.user_id)
    FROM posts p
    WHERE p.group_id = p_group_id
        AND p.created_at >= NOW() - (p_days || ' days')::INTERVAL
    ) AS active_members_count,
    (
    SELECT COUNT(*)
    FROM group_members gm
    WHERE gm.group_id = p_group_id
        AND gm.status = 'accepted'
        AND gm.joined_at >= NOW() - (p_days || ' days')::INTERVAL
    ) AS new_members_count,
    (
    SELECT COUNT(*)
    FROM likes l
        JOIN posts p ON l.post_id = p.id
    WHERE p.group_id = p_group_id
        AND l.created_at >= NOW() - (p_days || ' days')::INTERVAL
    ) AS total_likes,
    (
    SELECT COUNT(*)
    FROM comments c
        JOIN posts p ON c.post_id = p.id
    WHERE p.group_id = p_group_id
        AND c.created_at >= NOW() - (p_days || ' days')::INTERVAL
    ) AS total_comments;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS promote_to_moderator(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION promote_to_moderator(
    p_group_id INTEGER,
    p_admin_id INTEGER,
    p_target_user_id INTEGER
    ) RETURNS TABLE (promote_to_moderator BOOLEAN) AS $$ BEGIN -- Check if requester is admin
    IF NOT EXISTS (
    SELECT 1
    FROM groups g
    WHERE g.id = p_group_id
        AND g.admin_id = p_admin_id
    ) THEN RETURN QUERY
SELECT FALSE;
RETURN;
END IF;
-- Check target is accepted member
IF NOT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = p_group_id
    AND gm.user_id = p_target_user_id
    AND gm.status = 'accepted'
) THEN RETURN QUERY
SELECT FALSE;
RETURN;
END IF;
-- Promote to moderator
UPDATE group_members
SET role = 'moderator'
WHERE group_id = p_group_id
    AND user_id = p_target_user_id;
RETURN QUERY
SELECT TRUE;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS demote_moderator(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION demote_moderator(
    p_group_id INTEGER,
    p_admin_id INTEGER,
    p_target_user_id INTEGER
    ) RETURNS TABLE (demote_moderator BOOLEAN) AS $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM groups g
    WHERE g.id = p_group_id
        AND g.admin_id = p_admin_id
    ) THEN RETURN QUERY
SELECT FALSE;
RETURN;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = p_group_id
    AND gm.user_id = p_target_user_id
    AND gm.role = 'moderator'
    AND gm.status = 'accepted'
) THEN RETURN QUERY
SELECT FALSE;
RETURN;
END IF;
UPDATE group_members
SET role = 'member'
WHERE group_id = p_group_id
    AND user_id = p_target_user_id;
RETURN QUERY
SELECT TRUE;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS transfer_group_admin(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION transfer_group_admin(
    p_group_id INTEGER,
    p_current_admin_id INTEGER,
    p_new_admin_id INTEGER
    ) RETURNS TABLE (transfer_group_admin BOOLEAN) AS $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM groups g
    WHERE g.id = p_group_id
        AND g.admin_id = p_current_admin_id
    ) THEN RETURN QUERY
SELECT FALSE;
RETURN;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = p_group_id
    AND gm.user_id = p_new_admin_id
    AND gm.status = 'accepted'
) THEN RETURN QUERY
SELECT FALSE;
RETURN;
END IF;
UPDATE groups
SET admin_id = p_new_admin_id
WHERE id = p_group_id;
UPDATE group_members
SET role = 'member'
WHERE group_id = p_group_id
    AND user_id = p_current_admin_id;
UPDATE group_members
SET role = 'admin'
WHERE group_id = p_group_id
    AND user_id = p_new_admin_id;
RETURN QUERY
SELECT TRUE;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS search_groups(VARCHAR, INTEGER);
CREATE OR REPLACE FUNCTION search_groups(
    p_search_term VARCHAR(200),
    p_limit INTEGER DEFAULT 20
    ) RETURNS TABLE(
    group_id INTEGER,
    name VARCHAR(100),
    description TEXT,
    cover_image VARCHAR(500),
    members_count BIGINT,
    is_private BOOLEAN,
    admin_name VARCHAR(50)
    ) AS $$ BEGIN RETURN QUERY
SELECT g.id as group_id,
    g.name,
    g.description,
    g.cover_image,
    (
    SELECT COUNT(*)
    FROM group_members gm2
    WHERE gm2.group_id = g.id
        AND gm2.status = 'accepted'
    ) as members_count,
    g.is_private,
    u.name as admin_name
FROM groups g
    INNER JOIN users u ON g.admin_id = u.id
WHERE (
    g.name ILIKE '%' || p_search_term || '%'
    OR g.description ILIKE '%' || p_search_term || '%'
    )
ORDER BY CASE
    WHEN g.name ILIKE p_search_term || '%' THEN 1
    WHEN g.name ILIKE '%' || p_search_term || '%' THEN 2
    ELSE 3
    END,
    (
    SELECT COUNT(*)
    FROM group_members gm2
    WHERE gm2.group_id = g.id
        AND gm2.status = 'accepted'
    ) DESC
LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_group_details(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_group_details(
    p_group_id INTEGER,
    p_user_id INTEGER DEFAULT NULL
    ) RETURNS TABLE(
    group_id INTEGER,
    name VARCHAR(100),
    description TEXT,
    is_private BOOLEAN,
    cover_image VARCHAR(500),
    created_at TIMESTAMP,
    admin_id INTEGER,
    admin_name VARCHAR(50),
    members_count BIGINT,
    posts_count BIGINT,
    user_role VARCHAR(20),
    membership_status VARCHAR(20)
    ) AS $$ BEGIN RETURN QUERY
SELECT g.id AS group_id,
    g.name,
    g.description,
    g.is_private,
    g.cover_image,
    g.created_at,
    u.id AS admin_id,
    u.name AS admin_name,
    (
    SELECT COUNT(*)
    FROM group_members gm2
    WHERE gm2.group_id = g.id
        AND gm2.status = 'accepted'
    ) AS members_count,
    (
    SELECT COUNT(*)
    FROM posts
    WHERE group_id = g.id
    ) AS posts_count,
    (
    SELECT gm3.role
    FROM group_members gm3
    WHERE gm3.group_id = g.id
        AND gm3.user_id = p_user_id
        AND gm3.status = 'accepted'
    ) AS user_role,
    (
    SELECT gm4.status
    FROM group_members gm4
    WHERE gm4.group_id = g.id
        AND gm4.user_id = p_user_id
    ) AS membership_status
FROM groups g
    INNER JOIN users u ON u.id = g.admin_id
WHERE g.id = p_group_id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_group_members_list(INTEGER);
CREATE OR REPLACE FUNCTION get_group_members_list(p_group_id INTEGER) RETURNS TABLE(
    user_id INTEGER,
    name VARCHAR(50),
    profile_picture VARCHAR(500),
    role VARCHAR(20),
    joined_at TIMESTAMP
    ) AS $$ BEGIN RETURN QUERY
SELECT u.id,
    u.name,
    u.profile_picture,
    gm.role,
    gm.joined_at
FROM group_members gm
    INNER JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = p_group_id
    AND gm.status = 'accepted'
ORDER BY CASE
    gm.role
    WHEN 'admin' THEN 1
    WHEN 'moderator' THEN 2
    ELSE 3
    END,
    gm.joined_at;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS is_group_member(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION is_group_member(
    p_user_id INTEGER,
    p_group_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    is_member BOOLEAN := FALSE;
BEGIN
    SELECT TRUE INTO is_member
    FROM group_members
    WHERE user_id = p_user_id AND group_id = p_group_id
    LIMIT 1;

    RETURN is_member;
END;
$$ LANGUAGE plpgsql;