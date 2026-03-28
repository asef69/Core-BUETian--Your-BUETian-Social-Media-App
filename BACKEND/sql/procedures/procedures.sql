-- Update blog post procedure
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

-- Delete blog post procedure
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
                -- Only insert notification if it doesn't already exist
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
v_blog_owner_id INTEGER;
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

        SELECT author_id INTO v_blog_owner_id FROM blog_posts WHERE id=p_blog_id;

        IF p_parent_comment_id IS NULL THEN
            IF v_blog_owner_id IS NOT NULL AND v_blog_owner_id <> p_user_id THEN
                -- Only insert notification if it doesn't already exist
                IF NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = v_blog_owner_id
                      AND actor_id = p_user_id
                      AND notification_type = 'blog_comment'
                      AND reference_id = p_blog_id
                ) THEN
                    INSERT INTO notifications(user_id,actor_id,notification_type,reference_id,content)
                    VALUES(v_blog_owner_id,p_user_id,'blog_comment',p_blog_id,'commented on your blog post');
                END IF;
            END IF;   
        ELSE
            IF v_parent_owner_id IS NOT NULL AND v_parent_owner_id <> p_user_id THEN
                -- Only insert notification if it doesn't already exist
                IF NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = v_parent_owner_id
                      AND actor_id = p_user_id
                      AND notification_type = 'blog_reply'
                      AND reference_id = p_blog_id
                ) THEN
                    INSERT INTO notifications(user_id,actor_id,notification_type,reference_id,content)
                    VALUES(v_parent_owner_id,p_user_id,'blog_reply',p_blog_id,'replied to your blog comment');
                END IF;
            END IF;
        END IF;   

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
                -- Only insert notification if it doesn't already exist
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

    OUT out_tuition_id INTEGER,
    OUT out_success BOOLEAN,
    OUT out_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_subject TEXT;
BEGIN
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
            status = COALESCE(p_status, status),
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