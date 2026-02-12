-- user_id = 'a6c44094-11d8-4a15-a63f-d682eb35a91f' 가 올린 비디오 목록을 조회
SELECT *
FROM videos
WHERE user_id = 'a6c44094-11d8-4a15-a63f-d682eb35a91f'
ORDER BY updated_at DESC;


-- user_id = 'a6c44094-11d8-4a15-a63f-d682eb35a91f' 가 올린 비디오 목록 + user(업로더) 정보 조회
SELECT v.*,
       u.id          AS user_id,
       u.clerk_id    AS user_clerk_id,
       u.name        AS user_name,
       u.banner_url  AS user_banner_url,
       u.banner_key  AS user_banner_key,
       u.image_url   AS user_image_url,
       u.created_at  AS user_created_at,
       u.updated_at  AS user_updated_at
FROM videos v
INNER JOIN users u ON v.user_id = u.id
WHERE v.user_id = 'a6c44094-11d8-4a15-a63f-d682eb35a91f'
ORDER BY v.updated_at DESC;

-- users 테이블 조회
SELECT *
FROM users;

-- users 테이블 조회 (컬럼 지정)
SELECT id, clerk_id, name, banner_url, banner_key, image_url, created_at, updated_at
FROM users;


-- subscriptions 테이블 조회 (구독자, 크리에이터 정보 포함)
SELECT s.viewer_id,
       s.creator_id,
       s.created_at,
       s.updated_at,
       viewer.name  AS viewer_name,
       creator.name AS creator_name
FROM subscriptions s
INNER JOIN users viewer  ON s.viewer_id  = viewer.id
INNER JOIN users creator ON s.creator_id = creator.id
ORDER BY s.created_at DESC;


-- categories 테이블 조회 (카테고리 목록 조회, 이름 순서대로)
SELECT *
FROM categories
ORDER BY name;


-- videos 테이블 조회 (카테고리 별 비디오 목록 조회)
SELECT v.*
FROM videos v
WHERE v.category_id = '2d35c458-c0ee-4f91-8aa3-64e9b41db9f5'
  AND v.visibility = 'public'
ORDER BY v.updated_at DESC;

-- categories 테이블 조회 (카테고리별 비디오 개수 조회)
SELECT c.id, c.name, COUNT(v.id) AS video_count
FROM categories c
LEFT JOIN videos v ON v.category_id = c.id AND v.visibility = 'public'
GROUP BY c.id, c.name
ORDER BY c.name;

-- 특정 videos 테이블 조회 (비디오 정보 + 작성자(업로더) 정보 + 좋아요 수 조회)
SELECT v.id,
       v.title,
       v.description,
       v.thumbnail_url,
       v.duration,
       v.visibility,
       v.user_id,
       v.category_id,
       v.created_at,
       v.updated_at,
       -- 작성자(업로더) 정보
       u.id          AS author_id,
       u.clerk_id    AS author_clerk_id,
       u.name       AS author_name,
       u.image_url   AS author_image_url,
       u.banner_url  AS author_banner_url,
       -- 좋아요 수
       (SELECT COUNT(*)::int
        FROM video_reactions vr
        WHERE vr.video_id = v.id
          AND vr.type = 'like') AS like_count
FROM videos v
INNER JOIN users u ON v.user_id = u.id
WHERE v.id = '72eae257-86f4-4632-8cc0-8b77b18b4cf5';