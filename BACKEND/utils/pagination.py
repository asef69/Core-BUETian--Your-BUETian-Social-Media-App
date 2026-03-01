from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

class CustomPagination(PageNumberPagination):
    """
    Custom pagination class for standardized paginated API responses.
    
    Configuration:
        - Default page size: 20 items per page
        - Query parameter: 'page_size' (client can customize)
        - Maximum page size: 100 items per page
    
    Usage:
        class MyListView(APIView):
            pagination_class = CustomPagination
            
            def get(self, request):
                queryset = MyModel.objects.all()
                paginator = self.pagination_class()
                paginated_data = paginator.paginate_queryset(queryset, request)
                return paginator.get_paginated_response(paginated_data)
    
    Query Parameters:
        - page (int): Page number to retrieve (e.g., ?page=2)
        - page_size (int): Items per page (e.g., ?page_size=50, max 100)
    
    Response Format:
        {
            "count": 150,  # Total number of items
            "next": "http://api.example.com/items/?page=3",  # URL to next page or null
            "previous": "http://api.example.com/items/?page=1",  # URL to previous page or null
            "results": [...]  # Array of items for current page
        }
    
    Methods:
        get_paginated_response(data):
            Wraps paginated data in standardized response format.
            
            Args:
                data (list): Paginated items for current page
            
            Returns:
                Response: DRF Response with count, next, previous, and results
    """
    page_size=20

    page_size_query_param='page_size'
    max_page_size=100


    def get_paginated_response(self, data):
        return Response({
            'count':self.page.paginator.count,
            'next':self.get_next_link(),
            'previous':self.get_previous_link(),
            'results':data
        })