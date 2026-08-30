from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


# --- Article Models ---

class ArticleBase(BaseModel):
    source_name: str
    source_url: str
    title: str
    content: Optional[str] = None
    published_at: Optional[datetime] = None
    category: Optional[str] = None
    language: str = "en"


class ArticleCreate(ArticleBase):
    cluster_id: Optional[str] = None
    bias_label: Optional[str] = None
    bias_explanation: Optional[str] = None


class ArticleResponse(ArticleBase):
    id: str
    cluster_id: Optional[str] = None
    bias_label: Optional[str] = None
    bias_explanation: Optional[str] = None
    created_at: datetime


# --- Cluster Models ---

class SourceInfo(BaseModel):
    name: str
    url: str
    bias_label: Optional[str] = None


class BiasAnalysis(BaseModel):
    neutral: int = 0
    pro_government: int = 0
    critical: int = 0
    sensationalist: int = 0


class ClusterResponse(BaseModel):
    id: str
    title: Optional[str] = None
    summary: Optional[str] = None
    source_count: int = 0
    category: str
    is_breaking: bool = False
    confidence_score: float = 0.0
    trend_score: float = 0.0
    official_source_data: Optional[dict] = None
    bias_analysis: Optional[dict] = None
    sources: List[SourceInfo] = []
    image_url: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime


class ClusterListItem(BaseModel):
    id: str
    title: Optional[str] = None
    summary: Optional[str] = None
    source_count: int = 0
    category: str
    is_breaking: bool = False
    confidence_score: float = 0.0
    trend_score: float = 0.0
    top_sources: List[str] = []
    like_count: int = 0
    comment_count: int = 0
    image_url: Optional[str] = None
    published_at: Optional[datetime] = None


# --- Pagination ---

class PaginatedResponse(BaseModel):
    data: List[ClusterListItem]
    pagination: dict


# --- RAG Query ---

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class QuerySource(BaseModel):
    name: str
    title: str
    url: str


class QueryResponse(BaseModel):
    question: str
    answer: str
    sources: List[QuerySource] = []
    official_data: Optional[dict] = None


# --- User Models ---

class UserPreferencesUpdate(BaseModel):
    categories: List[str] = []
    notification_enabled: bool = True


class UserPreferencesResponse(BaseModel):
    user_id: str
    categories: List[str] = []
    notification_enabled: bool = True
