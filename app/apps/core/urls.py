from django.urls import path

from core.views import *


urlpatterns = [
    path('', Home.as_view(), name='home'),
    path('documents/', DocumentsList.as_view(), name='documents-list'),
    path('document/<int:pk>/', DocumentDetail.as_view(), name='document-detail'),
    path('document/create/', CreateDocument.as_view(), name='document-create'),
    path('document/update/<int:pk>/', UpdateDocument.as_view(), name='document-update'),
    path('document/publish/<int:pk>/', PublishDocument.as_view(), name='document-publish'),
    path('document/share/<int:pk>/', ShareDocument.as_view(), name='document-share'),
    path('document/update/<int:pk>/upload-image/', UploadImageAjax.as_view(), name='document-upload-image'),
    path('document/update/<int:pk>/part/<int:part_pk>/', UpdateDocumentPart.as_view(), name='document-part-update'),
]
