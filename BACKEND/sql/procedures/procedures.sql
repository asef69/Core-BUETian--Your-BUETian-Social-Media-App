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
            author_id,title,content,excerpt,cover_image,category,is_published
        )VALUES(
            p_author_id,p_title,p_content,p_excerpt,p_cover_image,p_category,p_is_published
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