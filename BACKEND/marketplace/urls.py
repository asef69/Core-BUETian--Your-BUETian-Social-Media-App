from django.urls import path
from .views import (
    CreateProductView, ProductDetailView, ProductListView,
    UserProductsView, MyProductsView, CategoryListView,
    UploadProductImageView, SearchProductsView, SimilarProductsView,
    TrendingProductsView, UserMarketplaceStatsView, MyMarketplaceStatsView,
    PriceRangeStatsView, DepartmentProductsView, MarkProductSoldView,
    ReserveProductView, ConfirmTransactionView, CreateReviewView,
    SellerReviewsView, SellerReputationView
)

urlpatterns = [
    # Product management
    path('products/create/', CreateProductView.as_view(), name='create-product'),
    path('products/<int:product_id>/', ProductDetailView.as_view(), name='product-detail'),
    path('products/', ProductListView.as_view(), name='product-list'),
    
    # Product actions
    path('products/<int:product_id>/mark-sold/', MarkProductSoldView.as_view(), name='mark-sold'),
    path('products/<int:product_id>/reserve/', ReserveProductView.as_view(), name='reserve-product'),
    path('products/<int:product_id>/similar/', SimilarProductsView.as_view(), name='similar-products'),
    
    # Reviews and ratings
    path('products/<int:product_id>/reviews/', CreateReviewView.as_view(), name='create-review'),
    path('sellers/<int:seller_id>/reviews/', SellerReviewsView.as_view(), name='seller-reviews'),
    path('sellers/<int:seller_id>/reputation/', SellerReputationView.as_view(), name='seller-reputation'),
    
    # Transaction management
    path('transactions/<int:product_id>/confirm/', ConfirmTransactionView.as_view(), name='confirm-transaction'),
    
    # User products
    path('users/<int:user_id>/products/', UserProductsView.as_view(), name='user-products'),
    path('users/<int:user_id>/stats/', UserMarketplaceStatsView.as_view(), name='user-stats'),
    path('my-products/', MyProductsView.as_view(), name='my-products'),
    path('my-stats/', MyMarketplaceStatsView.as_view(), name='my-stats'),
    
    # Discovery
    path('trending/', TrendingProductsView.as_view(), name='trending-products'),
    path('department-products/', DepartmentProductsView.as_view(), name='department-products'),
    
    # Categories and search
    path('categories/', CategoryListView.as_view(), name='categories'),
    path('price-ranges/', PriceRangeStatsView.as_view(), name='price-ranges'),
    path('search/', SearchProductsView.as_view(), name='search-products'),
    
    # Image upload
    path('upload-image/', UploadProductImageView.as_view(), name='upload-image'),
]