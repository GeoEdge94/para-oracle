"""
Pydantic schemas — Auth (mock)
"""
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str  # ignored in mock


class LoginResponse(BaseModel):
    token: str
    email: str
    pseudo: str
