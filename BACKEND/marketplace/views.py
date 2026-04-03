from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework import status # type: ignore
from rest_framework.permissions import IsAuthenticated, AllowAny # type: ignore
from django.db.utils import ProgrammingError # type: ignore
from utils.database import DatabaseManager
from utils.file_upload import FileUploadHandler


VALID_PRODUCT_STATUSES = {'available', 'sold', 'reserved'}


def _normalize_media_url(url):
    if not url:
        return url
    if isinstance(url, str) and (url.startswith('http://') or url.startswith('https://') or url.startswith('/')):
        return url
    return f"/{str(url).lstrip('/')}"

class CreateProductView(APIView):
    """
    Create a new marketplace product listing.
    
    API Endpoint: POST /api/marketplace/products/create/
    Authentication: Required (JWT Token)
    
    Request Body:
        {
            "title": "iPhone 13 Pro Max",
            "description": "Excellent condition, 256GB",
            "price": 85000.00,
            "category": "Electronics",
            "condition": "like_new",
            "location": "Sher-e-Bangla Hall",
            "images": ["path/to/image1.jpg", "path/to/image2.jpg"]
        }
    
    Response (201 Created):
        {
            "message": "Product created successfully",
            "product_id": 1
        }
    
    Database Operations:
        - Inserts product into marketplace_products table
        - Inserts image URLs into marketplace_product_images table
        - Seller ID automatically set to current user
    
    Notes:
        - Condition options: new, like_new, good, fair, poor
        - Status defaults to 'available'
        - Multiple images supported
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        import logging
        logger = logging.getLogger("marketplace.create_product")
        data = request.data

        try:
            title = data.get('title')
            price = data.get('price')
            logger.info(f"Received data: {data}")

            if not title or price in (None, ''):
                logger.error(f"Missing title or price. Title: {title}, Price: {price}")
                return Response(
                    {'error': 'title and price are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                price = float(price)
            except (TypeError, ValueError):
                logger.error(f"Invalid price value: {price}")
                return Response({'error': 'Invalid price value'}, status=status.HTTP_400_BAD_REQUEST)

            raw_status = (data.get('status') or 'available')
            normalized_status = str(raw_status).strip().lower()
            if normalized_status not in VALID_PRODUCT_STATUSES:
                normalized_status = 'available'

            # Handle image uploads and URLs
            image_urls = []
            for image_file in request.FILES.getlist('images'):
                try:
                    FileUploadHandler.validate_file(image_file, file_type='image')
                except ValueError as e:
                    logger.error(f"Image validation error: {e}")
                    return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
                url = FileUploadHandler.upload_file(image_file, folder='marketplace_images')
                logger.info(f"Uploaded image file, got URL: {url}")
                image_urls.append(url)

            if hasattr(data, 'getlist'):
                raw_images = data.getlist('images')
            else:
                raw_images = data.get('images', [])

            if not isinstance(raw_images, list):
                raw_images = [raw_images] if raw_images else []

            for img in raw_images:
                if isinstance(img, str) and img.strip():
                    logger.info(f"Appending raw image URL: {img.strip()}")
                    image_urls.append(img.strip())

            logger.info(f"Final image_urls array: {image_urls}")

            # Prepare parameters for the procedure
            params = (
                request.user.id,
                title,
                data.get('description'),
                price,
                data.get('category'),
                data.get('condition', 'good'),
                data.get('location'),
                normalized_status,
                image_urls if image_urls else None,  # Pass as array or None
                None,  # out_product_id (OUT)
                None,  # out_success (OUT)
                None   # out_message (OUT)
            )

            logger.info(f"Calling procedure with params: {params}")
            # Call the stored procedure
            result = DatabaseManager.execute_procedure('create_product_with_images', params)
            logger.info(f"Procedure result: {result}")

            # The result should be a list with one dict containing the OUT params
            if result and isinstance(result, list) and len(result) > 0:
                proc_out = result[0]
                if proc_out.get('out_success'):
                    logger.info(f"Product created successfully: {proc_out}")
                    return Response({
                        'message': proc_out.get('out_message', 'Product created successfully'),
                        'product_id': proc_out.get('out_product_id')
                    }, status=status.HTTP_201_CREATED)
                else:
                    logger.error(f"Procedure failed: {proc_out}")
                    return Response({
                        'error': proc_out.get('out_message', 'Product creation failed'),
                        'debug': proc_out
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                logger.error(f"Procedure returned no result: {result}")
                return Response({'error': 'Product creation failed', 'debug': str(result)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            logger.exception(f"Exception in CreateProductView.post: {ex}")
            return Response({'error': 'Internal server error', 'exception': str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ProductDetailView(APIView):
    """
    Get, update, or delete a specific product listing.
    
    API Endpoint:
        GET /api/marketplace/products/<product_id>/
        PATCH /api/marketplace/products/<product_id>/
        DELETE /api/marketplace/products/<product_id>/
    
    Authentication: Required for PATCH and DELETE
    
    GET Response (200 OK):
        {
            "product_id": 1,
            "title": "iPhone 13 Pro Max",
            "description": "Excellent condition",
            "price": 85000.00,
            "category": "Electronics",
            "condition": "like_new",
            "location": "Sher-e-Bangla Hall",
            "status": "available",
            "seller_id": 5,
            "seller_name": "John Doe",
            "seller_picture": "path/to/profile.jpg",
            "seller_department": "CSE",
            "images": ["path/to/image1.jpg"],
            "created_at": "2025-12-20T10:30:00"
        }
    
    PATCH Request Body:
        {
            "status": "sold",
            "price": 80000.00,
            "title": "Updated title"
        }
    
    Response (403 Forbidden):
        {"error": "Unauthorized"}
    
    Database Operations:
        - GET: Calls get_product_details() function
        - PATCH: Updates product fields (seller only)
        - DELETE: Removes product (seller only)
    
    Notes:
        - Only seller can update or delete
        - Status options: available, sold, reserved
    """
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [permission() for permission in self.permission_classes]
    
    def get(self, request, product_id):
        try:
            result = DatabaseManager.execute_function('get_product_details', (product_id,))
        except ProgrammingError:
            result = DatabaseManager.execute_query(
                """
                SELECT
                    p.id as product_id,
                    p.title,
                    p.description,
                    p.price,
                    p.category,
                    p.condition,
                    p.location,
                    p.status,
                    u.id as seller_id,
                    u.name as seller_name,
                    u.profile_picture as seller_picture,
                    u.department_name as seller_department,
                    ARRAY(SELECT image_url FROM marketplace_product_images WHERE product_id = p.id) as images,
                    p.created_at
                FROM marketplace_products p
                INNER JOIN users u ON p.seller_id = u.id
                WHERE p.id = %s
                """,
                (product_id,)
            )
        if not result:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        product = result[0]
        if 'id' not in product and 'product_id' in product:
            product['id'] = product['product_id']
        images = product.get('images') or []
        product['images'] = [_normalize_media_url(image) for image in images if image]
        product['seller_picture'] = _normalize_media_url(product.get('seller_picture'))
        return Response(product)
    
    def patch(self, request, product_id):
        check_query = "SELECT seller_id FROM marketplace_products WHERE id = %s"
        result = DatabaseManager.execute_query(check_query, (product_id,))
        
        if not result or result[0]['seller_id'] != request.user.id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        data = request.data
        update_fields = []
        params = []
        
        if 'status' in data:
            update_fields.append("status = %s")
            params.append(data['status'])
        if 'price' in data:
            update_fields.append("price = %s")
            params.append(data['price'])
        if 'title' in data:
            update_fields.append("title = %s")
            params.append(data['title'])
        if 'description' in data:
            update_fields.append("description = %s")
            params.append(data['description'])
        if 'condition' in data:
            update_fields.append("condition = %s")
            params.append(data['condition'])
        if 'location' in data:
            update_fields.append("location = %s")
            params.append(data['location'])
        if 'category' in data:
            update_fields.append("category = %s")
            params.append(data['category'])
        
        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            params.append(product_id)
            query = f"UPDATE marketplace_products SET {', '.join(update_fields)} WHERE id = %s"
            DatabaseManager.execute_update(query, tuple(params))
        
        return Response({'message': 'Product updated successfully'})
    
    def delete(self, request, product_id):
        check_query = "SELECT seller_id FROM marketplace_products WHERE id = %s"
        result = DatabaseManager.execute_query(check_query, (product_id,))
        
        if not result or result[0]['seller_id'] != request.user.id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        DatabaseManager.execute_update(
            "DELETE FROM marketplace_products WHERE id = %s",
            (product_id,)
        )
        return Response({'message': 'Product deleted successfully'})

class ProductListView(APIView):
    """
    Get paginated list of marketplace products with filters.
    
    API Endpoint: GET /api/marketplace/products/
    Authentication: Optional
    
    Query Parameters:
        - category (str): Filter by category (e.g., "Electronics")
        - status (str, default="available"): available, sold, reserved
        - condition (str): Filter by condition (new, like_new, good, fair, poor)
        - min_price (float): Minimum price filter
        - max_price (float): Maximum price filter
        - search (str): Search in title and description
        - page (int, default=1): Page number
        - limit (int, default=20): Items per page
    
    Response (200 OK):
        {
            "products": [
                {
                    "id": 1,
                    "title": "iPhone 13 Pro Max",
                    "price": 85000.00,
                    "category": "Electronics",
                    "condition": "like_new",
                    "location": "Sher-e-Bangla Hall",
                    "status": "available",
                    "seller_name": "John Doe",
                    "images": ["path/to/image1.jpg"],
                    "created_at": "2025-12-20T10:30:00"
                }
            ],
            "total": 45,
            "page": 1,
            "limit": 20
        }
    
    Database Operations:
        - Queries marketplace_products with filters
        - Joins with users for seller info
        - Supports pagination and search
    
    Notes:
        - Ordered by created_at DESC (newest first)
        - Includes seller information
        - Images aggregated from marketplace_product_images
    """
    permission_classes = [AllowAny]

    def get(self, request):
        category = request.query_params.get('category')
        raw_status_filter = request.query_params.get('status', 'available')
        status_filter = str(raw_status_filter).strip().lower()
        if status_filter != 'all' and status_filter not in VALID_PRODUCT_STATUSES:
            status_filter = 'available'
        condition = request.query_params.get('condition')
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        search = request.query_params.get('search')
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        offset = (page - 1) * limit
        
        query = """
        SELECT 
            p.id,
            p.title,
            p.description,
            p.price,
            p.category,
            p.condition,
            p.location,
            p.status,
            p.created_at,
            u.id as seller_id,
            u.name as seller_name,
            u.profile_picture as seller_picture,
            u.department_name as seller_department,
            ARRAY(SELECT image_url FROM marketplace_product_images WHERE product_id = p.id) as images
        FROM marketplace_products p
        INNER JOIN users u ON p.seller_id = u.id
        WHERE u.is_active = TRUE
        """

        params = []

        if status_filter in VALID_PRODUCT_STATUSES:
            query += " AND p.status = %s"
            params.append(status_filter)
        
        if category:
            query += " AND p.category = %s"
            params.append(category)
        
        if condition:
            query += " AND p.condition = %s"
            params.append(condition)
        
        if min_price:
            query += " AND p.price >= %s"
            params.append(float(min_price)) # type: ignore
        
        if max_price:
            query += " AND p.price <= %s"
            params.append(float(max_price)) # type: ignore
        
        if search:
            query += " AND (p.title ILIKE %s OR p.description ILIKE %s)"
            search_pattern = f"%{search}%"
            params.extend([search_pattern, search_pattern])
        
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as count_subquery"
        count_result = DatabaseManager.execute_query(count_query, tuple(params))
        total = count_result[0]['total'] if count_result else 0
        
        query += " ORDER BY p.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset]) # type: ignore
        
        result = DatabaseManager.execute_query(query, tuple(params))
        for product in result:
            images = product.get('images') or []
            normalized_images = [_normalize_media_url(image) for image in images if image]
            product['images'] = normalized_images
            product['image'] = normalized_images[0] if normalized_images else None
        return Response({
            'results': result,
            'products': result,
            'total': total,
            'page': page,
            'limit': limit
        })

class UserProductsView(APIView):
    """
    Get all products listed by a specific user.
    
    API Endpoint: GET /api/marketplace/users/<user_id>/products/
    Authentication: Optional
    
    Query Parameters:
        - status (str): Filter by status (default: all statuses)
        - page (int, default=1): Page number
        - limit (int, default=20): Items per page
    
    Response (200 OK):
        {
            "products": [...],
            "total": 15,
            "page": 1,
            "limit": 20
        }
    
    Database Operations:
        - Queries marketplace_products filtered by seller_id
        - Includes product images
        - Supports pagination
    
    Notes:
        - Shows all user's products (available, sold, reserved)
        - Useful for viewing seller's inventory
    """
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        status_filter = request.query_params.get('status')
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        offset = (page - 1) * limit
        
        query = """
        SELECT 
            p.id,
            p.title,
            p.description,
            p.price,
            p.category,
            p.condition,
            p.location,
            p.status,
            p.created_at,
            ARRAY(SELECT image_url FROM marketplace_product_images WHERE product_id = p.id) as images
        FROM marketplace_products p
        WHERE p.seller_id = %s
        """
        params = [user_id]
        
        if status_filter:
            query += " AND p.status = %s"
            params.append(status_filter)
        
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as count_subquery"
        count_result = DatabaseManager.execute_query(count_query, tuple(params))
        total = count_result[0]['total'] if count_result else 0
        
        query += " ORDER BY p.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        result = DatabaseManager.execute_query(query, tuple(params))
        return Response({
            'products': result,
            'total': total,
            'page': page,
            'limit': limit
        })

class MyProductsView(APIView):
    """
    Get all products listed by the current authenticated user.
    
    API Endpoint: GET /api/marketplace/my-products/
    Authentication: Required (JWT Token)
    
    Query Parameters:
        - status (str): Filter by status
        - page (int, default=1): Page number
        - limit (int, default=20): Items per page
    
    Response (200 OK):
        {
            "products": [...],
            "total": 8,
            "page": 1,
            "limit": 20
        }
    
    Database Operations:
        - Queries current user's products
        - Includes all statuses
        - Supports pagination
    
    Notes:
        - Shows user's own inventory
        - Useful for managing listings
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        status_filter = request.query_params.get('status')
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        offset = (page - 1) * limit
        
        query = """
        SELECT 
            p.id,
            p.title,
            p.description,
            p.price,
            p.category,
            p.condition,
            p.location,
            p.status,
            p.created_at,
            p.updated_at,
            ARRAY(SELECT image_url FROM marketplace_product_images WHERE product_id = p.id) as images
        FROM marketplace_products p
        WHERE p.seller_id = %s
        """
        params = [request.user.id]
        
        if status_filter:
            query += " AND p.status = %s"
            params.append(status_filter)
        
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as count_subquery"
        count_result = DatabaseManager.execute_query(count_query, tuple(params))
        total = count_result[0]['total'] if count_result else 0
        
        query += " ORDER BY p.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        result = DatabaseManager.execute_query(query, tuple(params))
        return Response({
            'products': result,
            'total': total,
            'page': page,
            'limit': limit
        })

class CategoryListView(APIView):
    """
    Get list of all categories with statistics.
    
    API Endpoint: GET /api/marketplace/categories/
    Authentication: Optional
    
    Response (200 OK):
        [
            {
                "category": "Electronics",
                "total_items": 45,
                "available_items": 38,
                "sold_items": 7,
                "avg_price": 42500.00,
                "min_price": 5000.00,
                "max_price": 120000.00
            }
        ]
    
    Database Operations:
        - Queries marketplace_category_stats view
        - Aggregates statistics by category
    
    Notes:
        - Shows price ranges per category
        - Useful for category browsing
        - Includes sold vs available counts
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query = """
        SELECT * FROM marketplace_category_stats
        ORDER BY total_items DESC
        """
        result = DatabaseManager.execute_query(query, ())
        return Response(result)

class UploadProductImageView(APIView):
    """
    Upload product images before creating product listing.
    
    API Endpoint: POST /api/marketplace/upload-image/
    Authentication: Required (JWT Token)
    
    Request: multipart/form-data
        - image: Image file (max 5MB, jpg/jpeg/png)
    
    Response (200 OK):
        {
            "image_url": "media/marketplace_images/uuid-filename.jpg"
        }
    
    Response (400 Bad Request):
        {
            "error": "File validation error message"
        }
    
    File Validation:
        - Allowed types: image/jpeg, image/jpg, image/png
        - Max size: 5MB
        - Stored in media/marketplace_images/
    
    Notes:
        - Upload images first, then create product with URLs
        - Returns URL to include in product creation
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        image_file = request.FILES['image']
        
        try:
            FileUploadHandler.validate_file(image_file, file_type='image')
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        file_url = FileUploadHandler.upload_file(image_file, folder='marketplace_images')
        return Response({'image_url': file_url})

class SearchProductsView(APIView):
    """
    Advanced search for marketplace products.
    
    API Endpoint: GET /api/marketplace/search/
    Authentication: Optional
    
    Query Parameters:
        - q (str, required): Search term for title and description
        - category (str): Filter by category
        - condition (str): Filter by condition
        - min_price (float): Minimum price
        - max_price (float): Maximum price
        - location (str): Filter by location (partial match)
        - page (int, default=1): Page number
        - limit (int, default=20): Items per page
    
    Response (200 OK):
        {
            "products": [...],
            "total": 12,
            "page": 1,
            "limit": 20
        }
    
    Response (400 Bad Request):
        {"error": "Search term is required"}
    
    Database Operations:
        - Full-text search on title and description (case-insensitive)
        - Supports multiple filters
        - Ordered by relevance then date
    
    Notes:
        - Search term required (minimum length handled by client)
        - Combines text search with filters
        - Results ranked by match quality
    """
    permission_classes = [AllowAny]

    def get(self, request):
        search_term = (
            request.query_params.get('q')
            or request.query_params.get('query')
            or request.query_params.get('search')
            or ''
        ).strip()
        if not search_term:
            return Response({'error': 'Search term is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        category = request.query_params.get('category')
        condition = request.query_params.get('condition')
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        location = request.query_params.get('location')
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        offset = (page - 1) * limit
        
        # Build a shared FROM/WHERE clause once, then derive SELECT and COUNT queries.
        search_pattern = f"%{search_term}%"
        exact_pattern = search_term

        base_where = (
            "FROM marketplace_products p "
            "INNER JOIN users u ON p.seller_id = u.id "
            "WHERE p.status = 'available' "
            "AND u.is_active = TRUE "
            "AND (p.title ILIKE %s OR p.description ILIKE %s)"
        )

        # Parameters shared by both queries (those in WHERE only)
        where_params = [search_pattern, search_pattern]

        # Optional filters extend the WHERE and params equally for both queries
        if category:
            base_where += " AND p.category = %s"
            where_params.append(category)

        if condition:
            base_where += " AND p.condition = %s"
            where_params.append(condition)

        if min_price:
            base_where += " AND p.price >= %s"
            where_params.append(float(min_price)) # type: ignore

        if max_price:
            base_where += " AND p.price <= %s"
            where_params.append(float(max_price)) # type: ignore

        if location:
            base_where += " AND p.location ILIKE %s"
            where_params.append(f"%{location}%")

        # Count query uses only WHERE params
        count_query = f"SELECT COUNT(*) as total {base_where}"
        count_result = DatabaseManager.execute_query(count_query, tuple(where_params))
        total = count_result[0]['total'] if count_result else 0

        # Data query adds the relevance CASE (with two extra params) and pagination
        select_prefix = (
            "SELECT p.id, p.title, p.description, p.price, p.category, p.condition, "
            "p.location, p.status, p.created_at, u.id as seller_id, u.name as seller_name, "
            "u.profile_picture as seller_picture, "
            "ARRAY(SELECT image_url FROM marketplace_product_images WHERE product_id = p.id) as images, "
            "CASE WHEN p.title ILIKE %s THEN 1 WHEN p.title ILIKE %s THEN 2 ELSE 3 END as relevance "
        )

        data_query = f"{select_prefix}{base_where} ORDER BY relevance, p.created_at DESC LIMIT %s OFFSET %s"

        # params: CASE two params + WHERE params + pagination
        data_params = [exact_pattern, search_pattern] + where_params + [limit, offset]

        result = DatabaseManager.execute_query(data_query, tuple(data_params))
        for product in result:
            images = product.get('images') or []
            normalized_images = [_normalize_media_url(image) for image in images if image]
            product['images'] = normalized_images
            product['image'] = normalized_images[0] if normalized_images else None
            product['seller_picture'] = _normalize_media_url(product.get('seller_picture'))
        return Response({
            'results': result,
            'products': result,
            'total': total,
            'page': page,
            'limit': limit
        })

class SimilarProductsView(APIView):
    """
    Get similar products based on category and price range.
    
    API Endpoint: GET /api/marketplace/products/<product_id>/similar/
    Authentication: Optional
    
    Query Parameters:
        - limit (int, default=5): Number of similar products to return
    
    Response (200 OK):
        [
            {
                "product_id": 5,
                "title": "iPhone 12 Pro",
                "price": 75000.00,
                "category": "Electronics",
                "condition": "good",
                "seller_name": "Jane Doe",
                "images": ["path/to/image.jpg"],
                "created_at": "2025-12-15T12:00:00"
            }
        ]
    
    Database Operations:
        - Calls get_similar_products() function
        - Matches same category
        - Price within 70%-130% of original
    
    Notes:
        - Useful for product detail page
        - Helps users find alternatives
        - Ordered by price similarity
    """
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        limit = int(request.query_params.get('limit', 5))
        result = DatabaseManager.execute_function('get_similar_products', (product_id, limit))
        return Response(result)

class TrendingProductsView(APIView):
    """
    Get trending products (recently listed in popular categories).
    
    API Endpoint: GET /api/marketplace/trending/
    Authentication: Optional
    
    Query Parameters:
        - limit (int, default=10): Number of products to return
    
    Response (200 OK):
        [
            {
                "product_id": 8,
                "title": "MacBook Pro M1",
                "price": 125000.00,
                "category": "Electronics",
                "condition": "like_new",
                "location": "Attached Hall",
                "seller_id": 12,
                "seller_name": "John Smith",
                "seller_picture": "path/to/profile.jpg",
                "images": ["path/to/image.jpg"],
                "created_at": "2025-12-28T09:00:00"
            }
        ]
    
    Database Operations:
        - Calls get_trending_products() function
        - Gets products from last 7 days
        - Ordered by newest first
    
    Notes:
        - Shows recently added items
        - Helps discover new listings
        - Updates daily
    """
    permission_classes = [AllowAny]

    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        result = DatabaseManager.execute_function('get_trending_products', (limit,))
        return Response(result)

class UserMarketplaceStatsView(APIView):
    """
    Get marketplace statistics for a specific user.
    
    API Endpoint: GET /api/marketplace/users/<user_id>/stats/
    Authentication: Optional
    
    Response (200 OK):
        {
            "total_products": 15,
            "available_products": 8,
            "sold_products": 7,
            "total_revenue": 350000.00,
            "avg_product_price": 23333.33
        }
    
    Database Operations:
        - Calls get_user_marketplace_stats() function
        - Aggregates seller statistics
    
    Notes:
        - Shows seller performance
        - Revenue from sold items
        - Useful for seller profiles
    """
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        result = DatabaseManager.execute_function('get_user_marketplace_stats', (user_id,))
        return Response(result[0] if result else {})

class MyMarketplaceStatsView(APIView):
    """
    Get marketplace statistics for current authenticated user.
    
    API Endpoint: GET /api/marketplace/my-stats/
    Authentication: Required (JWT Token)
    
    Response (200 OK):
        {
            "total_products": 12,
            "available_products": 5,
            "sold_products": 7,
            "total_revenue": 280000.00,
            "avg_product_price": 23333.33
        }
    
    Database Operations:
        - Calls get_user_marketplace_stats() function
        - Returns current user's statistics
    
    Notes:
        - Shows personal selling performance
        - Useful for seller dashboard
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        result = DatabaseManager.execute_function('get_user_marketplace_stats', (request.user.id,))
        return Response(result[0] if result else {})

class PriceRangeStatsView(APIView):
    """
    Get product distribution across price ranges.
    
    API Endpoint: GET /api/marketplace/price-ranges/
    Authentication: Optional
    
    Response (200 OK):
        [
            {
                "price_range": "1,000 - 5,000",
                "product_count": 25,
                "avg_price": 3200.00
            },
            {
                "price_range": "5,000 - 10,000",
                "product_count": 18,
                "avg_price": 7500.00
            }
        ]
    
    Database Operations:
        - Calls get_price_range_stats() function
        - Groups products by price brackets
    
    Notes:
        - Useful for filtering UI
        - Shows market distribution
        - Helps users understand pricing
    """
    permission_classes = [AllowAny]

    def get(self, request):
        result = DatabaseManager.execute_function('get_price_range_stats', ())
        return Response(result)

class DepartmentProductsView(APIView):
    """
    Get products from users in same department.
    
    API Endpoint: GET /api/marketplace/department-products/
    Authentication: Required (JWT Token)
    
    Query Parameters:
        - limit (int, default=20): Number of products to return
    
    Response (200 OK):
        [
            {
                "product_id": 15,
                "title": "Engineering Textbooks",
                "price": 2500.00,
                "category": "Books",
                "condition": "good",
                "seller_id": 8,
                "seller_name": "Alice Wang",
                "seller_picture": "path/to/profile.jpg",
                "images": ["path/to/image.jpg"],
                "created_at": "2025-12-25T14:00:00"
            }
        ]
    
    Database Operations:
        - Calls get_department_products() function
        - Filters by user's department
        - Excludes current user's products
    
    Notes:
        - Shows items from department peers
        - Useful for targeted browsing
        - Encourages department community trading
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        result = DatabaseManager.execute_function('get_department_products', (request.user.id, limit))
        return Response(result)

class MarkProductSoldView(APIView):
    """
    Mark a product as sold (Seller only).
    
    API Endpoint: POST /api/marketplace/products/<product_id>/mark-sold/
    Authentication: Required (JWT Token)
    Authorization: Product seller only
    
    Response (200 OK):
        {"message": "Product marked as sold"}
    
    Response (403 Forbidden):
        {"error": "Unauthorized"}
    
    Database Operations:
        - Calls mark_product_sold() function
        - Verifies seller ownership
        - Updates status to 'sold'
    
    Notes:
        - Only seller can mark as sold
        - Changes status permanently
        - Removes from available listings
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, product_id):
        result = DatabaseManager.execute_function(
            'mark_product_sold',
            (product_id, request.user.id)
        )
        
        if result and result[0].get('mark_product_sold'):
            return Response({'message': 'Product marked as sold'})
        return Response({'error': 'Unauthorized or product not found'}, status=status.HTTP_403_FORBIDDEN)


class ConfirmTransactionView(APIView):
    """
    Confirm a buyer-seller transaction for a product.
    
    API Endpoint: POST /api/marketplace/transactions/<product_id>/confirm/
    Authentication: Required (JWT Token)
    
    Request Body:
        {
            "buyer_id": 5,  (required for seller)
            "role": "buyer" or "seller"
        }
    
    Response (200 OK):
        {
            "message": "Transaction confirmed",
            "buyer_confirmed": true,
            "seller_confirmed": true,
            "transaction_complete": true
        }
    
    Notes:
        - Both buyer and seller must confirm
        - Seller confirms with specific buyer_id
        - Buyer confirms without specifying seller
        - Once both confirm, transaction is complete
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, product_id):
        data = request.data
        role = str(data.get('role', 'buyer')).lower()
        if role not in {'buyer', 'seller'}:
            return Response({'error': 'Invalid role. Use buyer or seller'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get product and verify it's sold
        product_query = "SELECT seller_id FROM marketplace_products WHERE id = %s AND status = 'sold'"
        product_result = DatabaseManager.execute_query(product_query, (product_id,))
        
        if not product_result:
            return Response({'error': 'Product not found or not marked as sold'}, status=status.HTTP_404_NOT_FOUND)
        
        seller_id = product_result[0]['seller_id']
        
        if role == 'seller':
            if request.user.id != seller_id:
                return Response({'error': 'Only seller can confirm as seller'}, status=status.HTTP_403_FORBIDDEN)
            
            buyer_id = data.get('buyer_id')
            if not buyer_id:
                return Response({'error': 'buyer_id required for seller confirmation'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                buyer_id = int(buyer_id)
            except (TypeError, ValueError):
                return Response({'error': 'buyer_id must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

            proc_result = DatabaseManager.execute_procedure(
                'confirm_marketplace_transaction',
                (
                    product_id,
                    buyer_id,
                    seller_id,
                    'seller',
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            )
        else:
            buyer_id = request.user.id
            proc_result = DatabaseManager.execute_procedure(
                'confirm_marketplace_transaction',
                (
                    product_id,
                    buyer_id,
                    seller_id,
                    'buyer',
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            )

        if proc_result and isinstance(proc_result, list) and len(proc_result) > 0:
            proc_out = proc_result[0]
            if not proc_out.get('out_success'):
                return Response(
                    {'error': proc_out.get('out_message', 'Failed to confirm transaction')},
                    status=status.HTTP_400_BAD_REQUEST
                )

            buyer_confirmed = bool(proc_out.get('out_buyer_confirmed', False))
            seller_confirmed = bool(proc_out.get('out_seller_confirmed', False))
            return Response({
                'message': 'Transaction confirmed',
                'buyer_confirmed': buyer_confirmed,
                'seller_confirmed': seller_confirmed,
                'transaction_complete': buyer_confirmed and seller_confirmed
            })
        
        return Response({'error': 'Failed to confirm transaction'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CreateReviewView(APIView):
    """
    Create a review for a product (Buyer only).
    
    API Endpoint: POST /api/marketplace/products/<product_id>/reviews/
    Authentication: Required (JWT Token)
    Authorization: Buyer only (after confirming transaction)
    
    Request Body:
        {
            "rating": 4,
            "review_text": "Great product, fast delivery!"
        }
    
    Response (201 Created):
        {
            "message": "Review created successfully",
            "review_id": 1
        }
    
    Response (400 Bad Request):
        {"error": "Rating must be between 1 and 5"}
    
    Response (403 Forbidden):
        {"error": "Transaction not confirmed by both parties"}
    
    Validation:
        - Only create if transaction confirmed by both parties
        - Only buyers can create reviews
        - One review per product per buyer
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, product_id):
        data = request.data
        buyer_id = request.user.id
        
        # Check rating validity
        rating = data.get('rating')
        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return Response({'error': 'Rating must be between 1 and 5'}, status=status.HTTP_400_BAD_REQUEST)

        if not (1 <= rating <= 5):
            return Response({'error': 'Rating must be between 1 and 5'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check product status
        product_query = "SELECT status, seller_id FROM marketplace_products WHERE id = %s"
        product_result = DatabaseManager.execute_query(product_query, (product_id,))
        
        if not product_result:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        
        product_status = product_result[0]['status']
        seller_id = product_result[0]['seller_id']
        
        # Prevent seller from reviewing own product
        if buyer_id == seller_id:
            return Response(
                {'error': 'You cannot review your own product'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if product_status != 'sold':
            return Response(
                {'error': f'Product must be marked as sold before reviewing. Current status: {product_status}'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        review_text = data.get('review_text', '').strip()
        proc_result = DatabaseManager.execute_procedure(
            'create_or_update_review',
            (
                product_id,
                buyer_id,
                seller_id,
                rating,
                review_text,
                None,
                None,
            )
        )

        if not proc_result or not isinstance(proc_result, list) or len(proc_result) == 0:
            return Response({'error': 'Failed to submit review'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        proc_out = proc_result[0]
        if not proc_out.get('out_success'):
            message = proc_out.get('out_message', 'Failed to submit review')
            status_code = status.HTTP_400_BAD_REQUEST
            lowered = str(message).lower()
            if 'not found' in lowered:
                status_code = status.HTTP_404_NOT_FOUND
            elif 'cannot review your own product' in lowered or 'must be sold' in lowered:
                status_code = status.HTTP_403_FORBIDDEN
            return Response({'error': message}, status=status_code)
        
        return Response({
            'message': proc_out.get('out_message', 'Review created successfully')
        }, status=status.HTTP_201_CREATED)


class SellerReviewsView(APIView):
    """
    Get all reviews for a seller.
    
    API Endpoint: GET /api/marketplace/sellers/<seller_id>/reviews/
    Authentication: Optional
    
    Query Parameters:
        - page (int, default=1): Page number
        - limit (int, default=10): Reviews per page
    
    Response (200 OK):
        {
            "reviews": [
                {
                    "id": 1,
                    "product_id": 5,
                    "product_title": "iPhone 13",
                    "buyer_id": 3,
                    "buyer_name": "John Doe",
                    "buyer_picture": "path/to/profile.jpg",
                    "rating": 5,
                    "review_text": "Excellent product!",
                    "created_at": "2025-12-30T10:00:00"
                }
            ],
            "total": 15,
            "page": 1,
            "limit": 10
        }
    """
    permission_classes = [AllowAny]
    
    def get(self, request, seller_id):
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 10))
        product_id = request.query_params.get('product_id')
        offset = (page - 1) * limit
        filter_by_product = product_id is not None and str(product_id).strip() != ''
        
        query = """
        SELECT 
            r.id,
            r.product_id,
            p.title as product_title,
            r.buyer_id,
            u.name as buyer_name,
            u.profile_picture as buyer_picture,
            r.rating,
            r.review_text,
            r.created_at
        FROM product_reviews r
        JOIN marketplace_products p ON r.product_id = p.id
        JOIN users u ON r.buyer_id = u.id
        WHERE r.seller_id = %s
        """

        count_query = "SELECT COUNT(*) as total FROM product_reviews WHERE seller_id = %s"
        params = [seller_id]
        count_params = [seller_id]

        if filter_by_product:
            query += " AND r.product_id = %s"
            count_query += " AND product_id = %s"
            params.append(product_id)
            count_params.append(product_id)

        query += """
        ORDER BY COALESCE(r.updated_at, r.created_at) DESC
        LIMIT %s OFFSET %s
        """

        params.extend([limit, offset])

        result = DatabaseManager.execute_query(query, tuple(params))
        count_result = DatabaseManager.execute_query(count_query, tuple(count_params))
        total = count_result[0]['total'] if count_result else 0
        
        return Response({
            'reviews': result,
            'total': total,
            'page': page,
            'limit': limit
        })


class SellerReputationView(APIView):
    """
    Get seller reputation score and statistics.
    
    API Endpoint: GET /api/marketplace/sellers/<seller_id>/reputation/
    Authentication: Optional
    
    Response (200 OK):
        {
            "seller_id": 5,
            "seller_name": "John Doe",
            "average_rating": 4.5,
            "total_reviews": 12,
            "total_products_sold": 45,
            "response_rate": 95
        }
    """
    permission_classes = [AllowAny]
    
    def get(self, request, seller_id):
        rep_query = """
        SELECT 
            r.seller_id,
            r.average_rating,
            r.total_reviews,
            u.name as seller_name
        FROM seller_reputation r
        JOIN users u ON r.seller_id = u.id
        WHERE r.seller_id = %s
        """
        
        result = DatabaseManager.execute_query(rep_query, (seller_id,))
        
        if not result:
            return Response({
                'seller_id': seller_id,
                'average_rating': 0,
                'total_reviews': 0
            })
        
        rep = result[0]
        
        # Get total products sold
        sold_query = "SELECT COUNT(*) as total_sold FROM marketplace_products WHERE seller_id = %s AND status = 'sold'"
        sold_result = DatabaseManager.execute_query(sold_query, (seller_id,))
        total_sold = sold_result[0]['total_sold'] if sold_result else 0
        
        return Response({
            'seller_id': rep.get('seller_id'),
            'seller_name': rep.get('seller_name'),
            'average_rating': rep.get('average_rating', 0),
            'total_reviews': rep.get('total_reviews', 0),
            'total_products_sold': total_sold
        })

class ReserveProductView(APIView):
    """
    Mark a product as reserved (Seller only).
    
    API Endpoint: POST /api/marketplace/products/<product_id>/reserve/
    Authentication: Required (JWT Token)
    Authorization: Product seller only
    
    Response (200 OK):
        {"message": "Product marked as reserved"}
    
    Response (403 Forbidden):
        {"error": "Unauthorized"}
    
    Database Operations:
        - Calls reserve_product() function
        - Verifies seller ownership
        - Updates status to 'reserved'
    
    Notes:
        - Only seller can reserve
        - Indicates pending transaction
        - Can be changed back to available
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, product_id):
        try:
            result = DatabaseManager.execute_function(
                'reserve_product',
                (product_id, request.user.id)
            )
            if result and result[0].get('reserve_product'):
                return Response({'message': 'Product reserved successfully'})
        except ProgrammingError:
            pass

        updated = DatabaseManager.execute_update(
            """
            UPDATE marketplace_products
            SET status = 'reserved', updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
              AND status = 'available'
                            AND seller_id = %s
            """,
            (product_id, request.user.id)
        )

        if updated:
            return Response({'message': 'Product reserved successfully'})

        return Response(
            {'error': 'Product is not available for reservation'},
            status=status.HTTP_400_BAD_REQUEST
        )