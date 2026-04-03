DROP PROCEDURE IF EXISTS update_blog_post_with_tags;
CREATE OR REPLACE PROCEDURE update_blog_post_with_tags(
    IN p_blog_id INTEGER,
    IN p_author_id INTEGER,
    IN p_title VARCHAR(250),
    IN p_content TEXT,
    IN p_excerpt TEXT,
    IN p_cover_image VARCHAR(500),
    IN p_category VARCHAR(100),
    IN p_is_published BOOLEAN,
    IN p_tags TEXT[],
    IN p_scheduled_publish_at TIMESTAMP,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_exists BOOLEAN;
    v_tag TEXT;
BEGIN
    out_success := FALSE;
    out_message := '';
    BEGIN
        SELECT EXISTS(SELECT 1 FROM blog_posts WHERE id = p_blog_id AND author_id = p_author_id) INTO v_exists;
        IF NOT v_exists THEN
            out_message := 'Blog post not found or permission denied';
            RETURN;
        END IF;
        UPDATE blog_posts SET
            title = COALESCE(p_title, title),
            content = COALESCE(p_content, content),
            excerpt = COALESCE(p_excerpt, excerpt),
            cover_image = COALESCE(p_cover_image, cover_image),
            category = COALESCE(p_category, category),
            is_published = COALESCE(p_is_published, is_published),
            scheduled_publish_at = COALESCE(p_scheduled_publish_at, scheduled_publish_at)
        WHERE id = p_blog_id;
        DELETE FROM blog_post_tags WHERE blog_post_id = p_blog_id;
        IF p_tags IS NOT NULL AND array_length(p_tags,1)>0 THEN
            FOREACH v_tag IN ARRAY p_tags LOOP
                INSERT INTO blog_post_tags(blog_post_id,tag_name) VALUES(p_blog_id,v_tag);
            END LOOP;
        END IF;
        out_success := TRUE;
        out_message := 'Blog Post Updated Successfully';
    EXCEPTION WHEN OTHERS THEN
        out_success := FALSE;
        out_message := SQLERRM;
        RETURN;
    END;
END;
$$;

DROP PROCEDURE IF EXISTS delete_blog_post;
CREATE OR REPLACE PROCEDURE delete_blog_post(
    IN p_blog_id INTEGER,
    IN p_author_id INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    out_success := FALSE;
    out_message := '';
    BEGIN
        SELECT EXISTS(SELECT 1 FROM blog_posts WHERE id = p_blog_id AND author_id = p_author_id) INTO v_exists;
        IF NOT v_exists THEN
            out_message := 'Blog post not found or permission denied';
            RETURN;
        END IF;
        DELETE FROM blog_posts WHERE id = p_blog_id;
        out_success := TRUE;
        out_message := 'Blog Post Deleted Successfully';
    EXCEPTION WHEN OTHERS THEN
        out_success := FALSE;
        out_message := SQLERRM;
        RETURN;
    END;
END;
$$;
DROP PROCEDURE IF EXISTS create_product_with_images;
CREATE OR REPLACE PROCEDURE create_product_with_images(
    IN p_seller_id INTEGER,
    IN p_title VARCHAR(250),
    IN p_description TEXT,
    IN p_price DECIMAL(10,2),
    IN p_category VARCHAR(100),
    IN p_condition VARCHAR(50),
    IN p_location VARCHAR(250),
    IN p_status VARCHAR(20),
    IN p_image_url TEXT[],
    OUT out_product_id INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_image_url VARCHAR(500);
BEGIN
    out_product_id := NULL;
    out_success := FALSE;
    out_message := '';

    BEGIN
        INSERT INTO marketplace_products(
            seller_id, title, description, price, category, condition, location, status
        ) VALUES (
            p_seller_id, p_title, p_description, p_price, p_category, p_condition, p_location, p_status
        ) RETURNING id INTO out_product_id;

        IF p_image_url IS NOT NULL AND array_length(p_image_url, 1) > 0 THEN
            FOREACH v_image_url IN ARRAY p_image_url LOOP
                INSERT INTO marketplace_product_images(product_id, image_url)
                VALUES (out_product_id, v_image_url);
            END LOOP;
        END IF;

        out_success := TRUE;
        out_message := 'Product Created Successfully With image';
    EXCEPTION WHEN OTHERS THEN
        out_success := FALSE;
        out_message := SQLERRM;
        RETURN;
    END;
END;
$$;

DROP PROCEDURE IF EXISTS create_blog_post_with_tags;
CREATE OR REPLACE PROCEDURE create_blog_post_with_tags(
    IN p_author_id INTEGER,
    IN p_title VARCHAR(250),
    IN p_content TEXT,
    IN p_excerpt TEXT,
    IN p_cover_image VARCHAR(500),
    IN p_category VARCHAR(100),
    IN p_is_published BOOLEAN,
    IN p_tags TEXT[],
    IN p_scheduled_publish_at TIMESTAMP,
    OUT out_blog_id INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE 
v_tag TEXT;
BEGIN
    out_blog_id:=NULL;
    out_success:=FALSE;
    out_message:='';

    BEGIN
        INSERT INTO blog_posts(
            author_id,title,content,excerpt,cover_image,category,is_published,scheduled_publish_at
        )VALUES(
            p_author_id,p_title,p_content,p_excerpt,p_cover_image,p_category,p_is_published,p_scheduled_publish_at
        )RETURNING id INTO out_blog_id;

        IF p_tags IS NOT NULL AND array_length(p_tags,1)>0 THEN
        FOREACH v_tag IN ARRAY p_tags LOOP
        INSERT INTO blog_post_tags(blog_post_id,tag_name)
        VALUES(out_blog_id,v_tag);
        END LOOP;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        out_success:=FALSE;
        out_message:=SQLERRM;
        RETURN;
    END;
    out_success:=TRUE;
    out_message:='Blog Post Created Successfully';
END;
$$;

DROP PROCEDURE IF EXISTS toggle_blog_like_with_notification;
CREATE OR REPLACE PROCEDURE toggle_blog_like_with_notification(
    IN p_user_id INTEGER,
    IN p_blog_id INTEGER,
    OUT out_liked BOOLEAN ,
    OUT out_likes_count INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE 
    v_author_id INTEGER;
    v_exists BOOLEAN;
BEGIN
    out_liked := FALSE;
    out_likes_count := 0;
    out_success := FALSE;
    out_message := '';

    BEGIN
        SELECT author_id INTO v_author_id FROM blog_posts WHERE id = p_blog_id;
        IF v_author_id IS NULL THEN
            out_message := 'Blog Post Not Found';
            RETURN;
        END IF;

        SELECT EXISTS(
            SELECT 1 FROM blog_likes WHERE user_id = p_user_id AND blog_id = p_blog_id
        ) INTO v_exists;

        IF v_exists THEN
            DELETE FROM blog_likes WHERE user_id = p_user_id AND blog_id = p_blog_id;
            out_liked := FALSE;
            out_message := 'Blog Unliked';
        ELSE
            INSERT INTO blog_likes(user_id, blog_id) VALUES(p_user_id, p_blog_id);
            out_liked := TRUE;
            out_message := 'Blog Liked';

            IF v_author_id <> p_user_id THEN
                IF NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = v_author_id
                      AND actor_id = p_user_id
                      AND notification_type = 'blog_like'
                      AND reference_id = p_blog_id
                ) THEN
                    INSERT INTO notifications(user_id, actor_id, notification_type, reference_id, content)
                    VALUES (v_author_id, p_user_id, 'blog_like', p_blog_id, 'liked your blog post');
                END IF;
            END IF;
        END IF;

        SELECT COUNT(*)::INTEGER INTO out_likes_count FROM blog_likes WHERE blog_id = p_blog_id;

    EXCEPTION WHEN OTHERS THEN
        out_success := FALSE;
        out_message := SQLERRM;                   
        RETURN;
    END;

    out_success := TRUE;
END;
$$;

DROP PROCEDURE IF EXISTS add_blog_comment_with_notification;
CREATE OR REPLACE PROCEDURE add_blog_comment_with_notification(
    IN p_user_id INTEGER,
    IN p_blog_id INTEGER,
    IN p_content TEXT,
    IN p_parent_comment_id INTEGER,
    OUT out_comment_id INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE 
v_parent_owner_id INTEGER;
BEGIN
    out_comment_id:=NULL;
    out_success:=FALSE;
    out_message:='';

    BEGIN
        IF p_parent_comment_id IS NOT NULL THEN
            SELECT user_id INTO v_parent_owner_id
            FROM blog_comments
            WHERE id=p_parent_comment_id AND blog_id=p_blog_id;

            IF  v_parent_owner_id IS NULL THEN
                out_message:='Parent Comment Not Found';
                RETURN;
            END IF;
        END IF;

        INSERT INTO blog_comments(user_id,blog_id,content,parent_comment_id)
        VALUES(p_user_id,p_blog_id,p_content,p_parent_comment_id)
        RETURNING id INTO out_comment_id;

    EXCEPTION WHEN OTHERS THEN
        out_success:=FALSE;
        out_message:=SQLERRM;
        RETURN;
    END;

    out_success:=TRUE;
    out_message:='Comment Added Successfully';
END;
$$;         

DROP PROCEDURE IF EXISTS toggle_blog_comment_like_with_notification;
CREATE OR REPLACE PROCEDURE toggle_blog_comment_like_with_notification(
    IN p_user_id INTEGER,
    IN p_comment_id INTEGER,
    OUT out_liked BOOLEAN,
    OUT out_likes_count INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
v_comment_owner_id INTEGER;
v_blog_id INTEGER;
v_exists BOOLEAN;
BEGIN
    out_liked:=FALSE;
    out_likes_count:=0;
    out_success:=FALSE;
    out_message:='';

    BEGIN
        SELECT user_id,blog_id INTO v_comment_owner_id,v_blog_id FROM blog_comments WHERE id=p_comment_id;
        IF v_comment_owner_id IS NULL THEN
            out_message:='Comment Not Found';
            RETURN;
        END IF;

        SELECT EXISTS(
            SELECT 1 FROM blog_comment_likes WHERE user_id=p_user_id AND comment_id=p_comment_id
        ) INTO v_exists;

        IF v_exists THEN
            DELETE FROM blog_comment_likes WHERE user_id=p_user_id AND comment_id=p_comment_id;
            out_liked:=FALSE;
            out_message:='Comment Unliked';
        ELSE
            INSERT INTO blog_comment_likes(user_id,comment_id) VALUES(p_user_id,p_comment_id);
            out_liked:=TRUE;
            out_message:='Comment Liked';

            IF v_comment_owner_id <> p_user_id THEN
                IF NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = v_comment_owner_id
                      AND actor_id = p_user_id
                      AND notification_type = 'comment_like'
                      AND reference_id = p_comment_id
                ) THEN
                    INSERT INTO notifications(user_id,actor_id,notification_type,reference_id,content)
                    VALUES(v_comment_owner_id,p_user_id,'comment_like',p_comment_id,'liked your comment');
                END IF;
            END IF;
        END IF;

        SELECT COUNT(*)::INTEGER INTO out_likes_count
        FROM blog_comment_likes
        WHERE comment_id=p_comment_id;

    EXCEPTION WHEN OTHERS THEN
        out_success:=FALSE;
        out_message:=SQLERRM;
        RETURN;
    END;

    out_success:=TRUE;
END;
$$;

DROP PROCEDURE IF EXISTS add_comment_with_notification;
CREATE OR REPLACE PROCEDURE add_comment_with_notification(
    IN p_user_id INTEGER,
    IN p_post_id INTEGER,
    IN p_content TEXT,
    IN p_parent_comment_id INTEGER,
    OUT out_comment_id INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE 
    v_post_owner_id INTEGER;
    v_parent_owner_id INTEGER;
BEGIN
    out_comment_id:=NULL;
    out_success:=FALSE;
    out_message:='';

    BEGIN
        SELECT user_id INTO v_post_owner_id FROM posts WHERE id=p_post_id;
        IF v_post_owner_id IS NULL THEN
            out_message:='Post Not Found';
            RETURN;
        END IF;

        IF p_parent_comment_id IS NOT NULL THEN
            SELECT user_id INTO v_parent_owner_id
            FROM comments
            WHERE id=p_parent_comment_id AND post_id=p_post_id;

            IF v_parent_owner_id IS NULL THEN
                out_message:='Parent Comment Not Found';
                RETURN;
            END IF;
        END IF;

        INSERT INTO comments(post_id, user_id, content, comment_id)
        VALUES(p_post_id, p_user_id, p_content, p_parent_comment_id)
        RETURNING id INTO out_comment_id;

    EXCEPTION WHEN OTHERS THEN
        out_success:=FALSE;
        out_message:=SQLERRM;
        RETURN;
    END;

    out_success:=TRUE;
    out_message:='Comment Added Successfully';
END;
$$;

DROP PROCEDURE IF EXISTS toggle_comment_like_with_notification;
CREATE OR REPLACE PROCEDURE toggle_comment_like_with_notification(
    IN p_user_id INTEGER,
    IN p_comment_id INTEGER,
    OUT out_liked BOOLEAN,
    OUT out_likes_count INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_comment_owner_id INTEGER;
    v_post_id INTEGER;
    v_exists BOOLEAN;
BEGIN
    out_liked:=FALSE;
    out_likes_count:=0;
    out_success:=FALSE;
    out_message:='';

    BEGIN
        SELECT user_id, post_id INTO v_comment_owner_id, v_post_id FROM comments WHERE id=p_comment_id;
        IF v_comment_owner_id IS NULL THEN
            out_message:='Comment Not Found';
            RETURN;
        END IF;

        SELECT EXISTS(
            SELECT 1 FROM comment_likes WHERE user_id=p_user_id AND comment_id=p_comment_id
        ) INTO v_exists;

        IF v_exists THEN
            DELETE FROM comment_likes WHERE user_id=p_user_id AND comment_id=p_comment_id;
            DELETE FROM notifications
            WHERE user_id = v_comment_owner_id
              AND actor_id = p_user_id
              AND notification_type = 'comment_like'
              AND reference_id = p_comment_id;
            out_liked:=FALSE;
            out_message:='Comment Unliked';
        ELSE
            INSERT INTO comment_likes(user_id, comment_id) VALUES(p_user_id, p_comment_id);
            out_liked:=TRUE;
            out_message:='Comment Liked';

            IF v_comment_owner_id <> p_user_id THEN
                IF NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = v_comment_owner_id
                      AND actor_id = p_user_id
                      AND notification_type = 'comment_like'
                      AND reference_id = p_comment_id
                ) THEN
                    INSERT INTO notifications(user_id,actor_id,notification_type,reference_id,content)
                    VALUES(v_comment_owner_id,p_user_id,'comment_like',p_comment_id,'liked your comment');
                END IF;
            END IF;
        END IF;

        SELECT COUNT(*)::INTEGER INTO out_likes_count
        FROM comment_likes
        WHERE comment_id=p_comment_id;

    EXCEPTION WHEN OTHERS THEN
        out_success:=FALSE;
        out_message:=SQLERRM;
        RETURN;
    END;

    out_success:=TRUE;
END;
$$;       

DROP PROCEDURE IF EXISTS create_tuition_post_with_subjects;
CREATE OR REPLACE PROCEDURE create_tuition_post_with_subjects(
    IN p_user_id INTEGER,
    IN p_post_type VARCHAR(20),
    IN p_class_level VARCHAR(50),
    IN p_preferred_gender VARCHAR(20), 
    IN p_location VARCHAR(250),
    IN p_salary_min DECIMAL(10,2),
    IN p_salary_max DECIMAL(10,2),
    IN p_days_per_week INTEGER,
    IN p_duration_hours DECIMAL(3,1),
    IN p_requirements TEXT,
    IN p_contact_number VARCHAR(15),
    IN p_subjects TEXT[],
    OUT out_tuition_id INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_subject TEXT;
BEGIN
    out_tuition_id := NULL;
    out_success := FALSE;
    out_message := '';
    BEGIN
        INSERT INTO tution_posts(
            user_id, post_type, class_level, preferred_gender, location, salary_min, salary_max, days_per_week, duration_hours, requirements, contact_number
        ) VALUES (
            p_user_id, p_post_type, p_class_level, p_preferred_gender, p_location, p_salary_min, p_salary_max, p_days_per_week, p_duration_hours, p_requirements, p_contact_number
        ) RETURNING id INTO out_tuition_id;
        IF p_subjects IS NOT NULL AND array_length(p_subjects, 1) > 0 THEN
            FOREACH v_subject IN ARRAY p_subjects LOOP
                INSERT INTO tution_post_subjects(tution_post_id, subject_name)
                VALUES (out_tuition_id, v_subject);
            END LOOP;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        out_success := FALSE;
        out_message := SQLERRM;
        RETURN;
    END;
    out_success := TRUE;
    out_message := 'Tuition Post Created Successfully';
END;
$$;
  

DROP PROCEDURE IF EXISTS update_tuition_post_with_subjects;
CREATE OR REPLACE PROCEDURE update_tuition_post_with_subjects(
    IN p_post_id INTEGER,
    IN p_user_id INTEGER,
    IN p_post_type VARCHAR(20),
    IN p_class_level VARCHAR(50),
    IN p_preferred_gender VARCHAR(20), 
    IN p_location VARCHAR(250),
    IN p_salary_min DECIMAL(10,2),
    IN p_salary_max DECIMAL(10,2),
    IN p_days_per_week INTEGER,
    IN p_duration_hours DECIMAL(3,1),
    IN p_requirements TEXT,
    IN p_contact_number VARCHAR(15),
    IN p_subjects TEXT[],
    OUT out_tuition_id INTEGER ,
    OUT out_success BOOLEAN ,
    OUT out_message TEXT 
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_subject TEXT;
BEGIN
    out_tuition_id := p_post_id;
    out_success := FALSE;
    out_message := '';

    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM tution_posts WHERE id = p_post_id AND user_id = p_user_id
        ) THEN
            out_message := 'Unauthorized';
            ROLLBACK;
            RETURN;
        END IF;

        UPDATE tution_posts
        SET post_type = COALESCE(p_post_type, post_type),
            class_level = COALESCE(p_class_level, class_level),
            preferred_gender = COALESCE(p_preferred_gender, preferred_gender),
            location = COALESCE(p_location, location),
            salary_min = COALESCE(p_salary_min, salary_min),
            salary_max = COALESCE(p_salary_max, salary_max),
            days_per_week = COALESCE(p_days_per_week, days_per_week),
            duration_hours = COALESCE(p_duration_hours, duration_hours),
            requirements = COALESCE(p_requirements, requirements),
            contact_number = COALESCE(p_contact_number, contact_number),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_post_id;

        IF p_subjects IS NOT NULL THEN
            DELETE FROM tution_post_subjects WHERE tution_post_id = p_post_id;
            IF array_length(p_subjects, 1) > 0 THEN
                FOREACH v_subject IN ARRAY p_subjects LOOP
                    INSERT INTO tution_post_subjects (tution_post_id, subject_name)
                    VALUES (p_post_id, v_subject);
                END LOOP;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        ROLLBACK;
        out_success := FALSE;
        out_message := SQLERRM;
        RETURN;
    END;

    COMMIT;
    out_success := TRUE;
    out_message := 'Tuition post updated successfully';
END;
$$;

DROP PROCEDURE IF EXISTS create_group_post_with_media;
CREATE OR REPLACE PROCEDURE create_group_post_with_media(
    IN p_user_id INTEGER,
    IN p_media_type VARCHAR(20),
    IN p_content TEXT,
    IN p_group_id INTEGER,
    IN p_visibility VARCHAR(20),
    IN p_media_urls TEXT[],

    OUT out_success BOOLEAN,
    OUT out_message TEXT,
    OUT post_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_url TEXT;
BEGIN
    post_id := NULL;
    out_success := FALSE;
    out_message := '';

    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = p_user_id
          AND status = 'accepted'
    ) THEN
        out_message := 'You must be a member to post in this group';
        RETURN;
    END IF;

    BEGIN
        INSERT INTO posts(user_id, media_type, content, group_id, visibility)
        VALUES (p_user_id, p_media_type, p_content, p_group_id, p_visibility)
        RETURNING id INTO post_id;

        IF p_media_urls IS NOT NULL AND array_length(p_media_urls, 1) > 0 THEN
            FOREACH v_url IN ARRAY p_media_urls LOOP
                INSERT INTO media_urls(post_id, media_url, media_type)
                VALUES (post_id, v_url, p_media_type);
            END LOOP;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        out_message := SQLERRM;
        RETURN;
    END;

    out_success := TRUE;
    out_message := 'Group Post With Media Created Successfully';
END;
$$;

DROP PROCEDURE IF EXISTS create_post_with_media;
CREATE OR REPLACE PROCEDURE create_post_with_media(
    IN p_user_id INTEGER,
    IN p_media_type VARCHAR(20),
    IN p_content TEXT,
    IN p_visibility VARCHAR(20),
    IN p_media_urls TEXT[],

    OUT out_success BOOLEAN,
    OUT out_message TEXT,
    OUT post_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_url TEXT;
BEGIN
    post_id := NULL;
    out_success := FALSE;
    out_message := '';

    BEGIN
        INSERT INTO posts(user_id, media_type, content, group_id, visibility)
        VALUES (p_user_id, p_media_type, p_content, NULL, p_visibility)
        RETURNING id INTO post_id;

        IF p_media_urls IS NOT NULL AND array_length(p_media_urls, 1) > 0 THEN
            FOREACH v_url IN ARRAY p_media_urls LOOP
                INSERT INTO media_urls(post_id, media_url, media_type)
                VALUES (post_id, v_url, p_media_type);
            END LOOP;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        out_message := SQLERRM;
        RETURN;
    END;

    out_success := TRUE;
    out_message := 'Post Created Successfully';
END;
$$;

DROP PROCEDURE IF EXISTS create_group_with_creator;
CREATE OR REPLACE PROCEDURE create_group_with_creator(
    IN g_admin_id INTEGER,
    IN g_name VARCHAR(100),
    IN g_desc TEXT,
    IN g_privacy BOOLEAN,
    IN g_cover_image VARCHAR(500),

    OUT out_success BOOLEAN,
    OUT out_message TEXT,
    OUT group_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cover_post_id INTEGER;
BEGIN
    group_id := NULL;
    out_success := FALSE;
    out_message := '';

    BEGIN
        INSERT INTO groups(name, description, admin_id, is_private, cover_image)
        VALUES (g_name, g_desc, g_admin_id, g_privacy, g_cover_image)
        RETURNING id INTO group_id;

        INSERT INTO group_members (group_id, user_id, role, status)
        VALUES (group_id, g_admin_id, 'admin', 'accepted');

        IF g_cover_image IS NOT NULL THEN
            INSERT INTO posts(user_id, content, group_id, visibility, media_type)
            VALUES (
                g_admin_id,
                'Set the group cover photo.',
                group_id,
                'public',
                'image'
            )
            RETURNING id INTO v_cover_post_id;

            INSERT INTO media_urls(post_id, media_url, media_type)
            VALUES (v_cover_post_id, g_cover_image, 'image');
        END IF;

    EXCEPTION WHEN OTHERS THEN
        out_message := SQLERRM;
        RETURN;
    END;

    out_success := TRUE;
    out_message := 'Group Created Successfully';
END;
$$;

DROP PROCEDURE IF EXISTS toggle_follow_request_with_cleanup;
CREATE OR REPLACE PROCEDURE toggle_follow_request_with_cleanup(
    IN p_user_id INTEGER,
    IN p_following_id INTEGER,

    OUT out_follow BOOLEAN,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE 
    f_status VARCHAR(20);
    v_follow_id INTEGER;
BEGIN
    out_follow := FALSE;
    out_success := FALSE;
    out_message := '';

    BEGIN
        IF EXISTS (
            SELECT 1 
            FROM follows 
            WHERE follower_id = p_user_id 
              AND following_id = p_following_id
        ) THEN

                        SELECT id, status INTO v_follow_id, f_status
            FROM follows
            WHERE follower_id = p_user_id 
              AND following_id = p_following_id;

            IF f_status = 'accepted' THEN

                DELETE FROM follows
                WHERE follower_id = p_user_id 
                  AND following_id = p_following_id;

                                DELETE FROM notifications
                                WHERE notification_type = 'follow_request'
                                    AND reference_id = v_follow_id;

                out_success := TRUE;
                out_follow := FALSE;
                out_message := 'Unfollowed Successfully!';

            ELSIF f_status = 'pending' THEN

                DELETE FROM follows
                WHERE follower_id = p_user_id 
                  AND following_id = p_following_id;

                                DELETE FROM notifications
                                WHERE notification_type = 'follow_request'
                                    AND reference_id = v_follow_id;

                out_success := TRUE;
                out_follow := FALSE;
                out_message := 'Follow Request Cancelled Successfully!';

                        ELSE
                                out_success := FALSE;
                                out_follow := FALSE;
                                out_message := 'Invalid follow status';
                                RETURN;

            END IF;

        ELSE
            INSERT INTO follows(follower_id, following_id, status)
            VALUES(p_user_id, p_following_id, 'pending');

            out_success := TRUE;
            out_follow := TRUE;
            out_message := 'Follow Request Sent Successfully!';
        END IF;

    EXCEPTION WHEN OTHERS THEN
        out_follow := FALSE;
        out_success := FALSE;
        out_message := SQLERRM;
        RETURN;
    END;
END;
$$;

DROP PROCEDURE IF EXISTS create_or_update_review;
CREATE OR REPLACE PROCEDURE create_or_update_review(
    IN p_product_id INTEGER,
    IN p_buyer_id INTEGER,
    IN p_seller_id INTEGER,
    IN p_rating INTEGER,
    IN p_rev_text TEXT,

    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
BEGIN
    out_success := FALSE;
    out_message := '';

    IF p_buyer_id = p_seller_id THEN
        out_message := 'You cannot review your own product';
        RETURN;
    END IF;

    SELECT status INTO v_status
    FROM marketplace_products
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        out_message := 'Product not found';
        RETURN;
    END IF;

    IF v_status <> 'sold' THEN
        out_message := 'Product must be sold to review it';
        RETURN;
    END IF;

    INSERT INTO product_reviews (product_id, buyer_id, seller_id, rating, review_text)
    VALUES (p_product_id, p_buyer_id, p_seller_id, p_rating, p_rev_text)
    ON CONFLICT (product_id, buyer_id)
    DO UPDATE SET
        rating = EXCLUDED.rating,
        review_text = EXCLUDED.review_text,
        updated_at = CURRENT_TIMESTAMP;

    WITH avg_rating AS (
        SELECT AVG(rating) AS avg_r, COUNT(*) AS total_r
        FROM product_reviews
        WHERE seller_id = p_seller_id
    )
    INSERT INTO seller_reputation (seller_id, average_rating, total_reviews)
    SELECT p_seller_id, COALESCE(avg_r, 0), COALESCE(total_r, 0)
    FROM avg_rating
    ON CONFLICT (seller_id) DO UPDATE SET
        average_rating = EXCLUDED.average_rating,
        total_reviews = EXCLUDED.total_reviews,
        last_updated = CURRENT_TIMESTAMP;

    out_success := TRUE;
    out_message := 'Review created successfully';

EXCEPTION WHEN OTHERS THEN
    out_success := FALSE;
    out_message := SQLERRM;
    RETURN;

END;
$$;


DROP PROCEDURE IF EXISTS confirm_marketplace_transaction;
CREATE OR REPLACE PROCEDURE confirm_marketplace_transaction(
    IN p_product_id INTEGER,
    IN p_buyer_id INTEGER,
    IN p_seller_id INTEGER,
    IN p_role TEXT,

    OUT out_buyer_confirmed BOOLEAN,
    OUT out_seller_confirmed BOOLEAN,
    OUT out_confirmed_at TIMESTAMP,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    out_success := FALSE;
    out_message := '';
    out_buyer_confirmed := FALSE;
    out_seller_confirmed := FALSE;
    out_confirmed_at := NULL;

    IF NOT EXISTS (
        SELECT 1 
        FROM marketplace_products 
        WHERE id = p_product_id 
          AND status = 'sold'
    ) THEN
        out_message := 'Product not found or not marked as sold';
        RETURN;
    END IF;

    IF p_role = 'seller' THEN
    
        INSERT INTO buyer_seller_transactions (
            product_id, buyer_id, seller_id, seller_confirmed, confirmed_at
        )
        VALUES (
            p_product_id, p_buyer_id, p_seller_id, TRUE, CURRENT_TIMESTAMP
        )
        ON CONFLICT (product_id, buyer_id, seller_id)
        DO UPDATE SET 
            seller_confirmed = TRUE,
            confirmed_at = CASE 
                WHEN buyer_seller_transactions.buyer_confirmed THEN CURRENT_TIMESTAMP 
                ELSE buyer_seller_transactions.confirmed_at 
            END
        RETURNING 
            buyer_confirmed, 
            seller_confirmed, 
            confirmed_at
        INTO out_buyer_confirmed, out_seller_confirmed, out_confirmed_at;

    ELSE
    
        INSERT INTO buyer_seller_transactions (
            product_id, buyer_id, seller_id, buyer_confirmed, confirmed_at
        )
        VALUES (
            p_product_id, p_buyer_id, p_seller_id, TRUE, NULL
        )
        ON CONFLICT (product_id, buyer_id, seller_id)
        DO UPDATE SET 
            buyer_confirmed = TRUE,
            confirmed_at = CASE 
                WHEN buyer_seller_transactions.seller_confirmed THEN CURRENT_TIMESTAMP 
                ELSE buyer_seller_transactions.confirmed_at 
            END
        RETURNING 
            buyer_confirmed, 
            seller_confirmed, 
            confirmed_at
        INTO out_buyer_confirmed, out_seller_confirmed, out_confirmed_at;

    END IF;

    out_success := TRUE;
    out_message := 'Transaction updated successfully';

EXCEPTION WHEN OTHERS THEN
    out_success := FALSE;
    out_message := SQLERRM;
END;
$$;
