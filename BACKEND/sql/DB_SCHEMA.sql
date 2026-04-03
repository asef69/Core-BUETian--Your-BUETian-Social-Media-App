--MANUALLY CREATED IN POSTGRESQL(PGADMIN) 

--users table
CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    student_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(500),
    blood_group VARCHAR(5),
    batch INTEGER,
    hall_name VARCHAR(100),
    hall_attachement VARCHAR(20) CHECK (hall_attachement IN ('Resident', 'Attached')),
    department_name VARCHAR(100),
    bio TEXT,
    is_active BOOLEAN ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);

--table of posts
CREATE TABLE posts(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_type VARCHAR(20) CHECK (media_type IN ('image', 'video','text')) DEFAULT 'text',
    visibility VARCHAR(20) CHECK (visibility IN ('public', 'private', 'followers')) DEFAULT 'public',
    group_id INTEGER,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for media associated with posts
CREATE TABLE media_urls(
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    media_url VARCHAR(500) NOT NULL,
    media_type VARCHAR(20) CHECK (media_type IN ('image', 'video','text')) NOT NULL
);


--table of comments
CREATE TABLE comments(
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table of likes
CREATE TABLE likes(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

--table of follows
CREATE TABLE follows(
    id SERIAL PRIMARY KEY,
    follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('pending','accepted','rejected')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id),
    CHECK(follower_id <> following_id)
);

--table of groups
CREATE TABLE groups(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_private BOOLEAN DEFAULT FALSE,
    cover_image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for group members
CREATE TABLE group_members(
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('member', 'admin','moderator')) DEFAULT 'member',
    status VARCHAR(20) CHECK (status IN ('pending','accepted','rejected', 'invited')) DEFAULT 'pending',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

--table for marketplace sells
CREATE TABLE marketplace_products(
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(250) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    condition VARCHAR(50) CHECK (condition IN ('new','like_new','good','fair','poor')) DEFAULT 'good',
    location VARCHAR(250),
    status VARCHAR(20) CHECK (status IN ('available','sold','reserved')) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--table for marketplace product images
CREATE TABLE marketplace_product_images(
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES marketplace_products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL
);

--table for blood donation requests
CREATE TABLE blood_donation_posts(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    blood_group VARCHAR(5) NOT NULL,
    urgency VARCHAR(20) CHECK (urgency IN ('low','moderate','urgent')) DEFAULT 'moderate',
    patient_name VARCHAR(100) NOT NULL,
    hospital_name VARCHAR(250) NOT NULL,
    hospital_address TEXT,
    contact_number VARCHAR(15) NOT NULL,
    needed_date DATE,
    description TEXT,
    status VARCHAR(20) CHECK (status IN ('active','fulfilled','cancelled')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for tution related posts
CREATE TABLE tution_posts(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_type VARCHAR(20) CHECK (post_type IN ('seeking_tutor', 'offering_tuition')),
    class_level VARCHAR(50),
    preferred_gender VARCHAR(20) CHECK (preferred_gender IN ('male','female','any')) DEFAULT 'any',
    location VARCHAR(250),
    salary_min DECIMAL(10,2),
    salary_max DECIMAL(10,2),
    days_per_week INTEGER,
    duration_hours DECIMAL(3,1),
    requirements TEXT,
    contact_number VARCHAR(15),
    status VARCHAR(20) CHECK (status IN ('active','completed','cancelled')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for tution post subjects
CREATE TABLE tution_post_subjects(
    id SERIAL PRIMARY KEY,
    tution_post_id INTEGER REFERENCES tution_posts(id) ON DELETE CASCADE,
    subject_name VARCHAR(100) NOT NULL,
    UNIQUE(tution_post_id, subject_name)
);


--table for blog posts
CREATE TABLE blog_posts(
    id SERIAL PRIMARY KEY,
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(250) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    cover_image VARCHAR(500),
    category VARCHAR(100),
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE blog_posts
ADD COLUMN scheduled_publish_at TIMESTAMP;

UPDATE blog_posts
SET is_published = TRUE
WHERE scheduled_publish_at IS NOT NULL
  AND scheduled_publish_at <= NOW();

--table for blog post tags
CREATE TABLE blog_post_tags(
    id SERIAL PRIMARY KEY,
    blog_post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    UNIQUE(blog_post_id, tag_name)
);

--table for blog post comments
CREATE TABLE blog_comments(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    blog_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES blog_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for blog post likes
CREATE TABLE blog_likes(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    blog_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, blog_id)
);

--table for blog comment likes
CREATE TABLE blog_comment_likes(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES blog_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, comment_id)
);

--table for messaging chat app (extended for product-specific conversations)
CREATE TABLE messages(
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES marketplace_products(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    media_url VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for buyer-seller transaction confirmations
CREATE TABLE buyer_seller_transactions(
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES marketplace_products(id) ON DELETE CASCADE,
    buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    buyer_confirmed BOOLEAN DEFAULT FALSE,
    seller_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, buyer_id, seller_id)
);

--table for product reviews and ratings
CREATE TABLE product_reviews(
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES marketplace_products(id) ON DELETE CASCADE,
    buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, buyer_id)
);

--table for seller reputation scores (cached for performance)
CREATE TABLE seller_reputation(
    id SERIAL PRIMARY KEY,
    seller_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    average_rating DECIMAL(2,1) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for notifications
CREATE TABLE notifications(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    reference_id INTEGER,
    content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--table for notification preferences
CREATE TABLE notification_preferences(
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--Comment Likes
CREATE TABLE comment_likes (
    id SERIAL PRIMARY KEY,
    comment_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_comment_user UNIQUE(comment_id, user_id)
);

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES marketplace_products(id) ON DELETE SET NULL;

--table for contextual chat permissions
DROP TABLE IF EXISTS contextual_chat_permission;
CREATE TABLE contextual_chat_permission(
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    context_type VARCHAR(32) NOT NULL,
    context_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CHECK (user1_id <> user2_id),
    UNIQUE(user1_id, user2_id, context_type, context_id)
);

