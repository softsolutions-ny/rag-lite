from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
import requests
import os
from dotenv import load_dotenv
from typing import Optional, Dict, Any
from functools import lru_cache

load_dotenv()

security = HTTPBearer()
CLERK_ISSUER = os.getenv("CLERK_ISSUER")  # e.g., "https://clerk.your-domain.com"
CLERK_PEM_KEYS: Dict[str, Any] = {}

@lru_cache()
def get_clerk_jwks() -> Dict[str, Any]:
    """Fetch and cache Clerk's public keys"""
    if not CLERK_ISSUER:
        raise ValueError("CLERK_ISSUER environment variable is not set")
        
    jwks_url = f"{CLERK_ISSUER}/.well-known/jwks.json"
    response = requests.get(jwks_url)
    response.raise_for_status()
    return response.json()

def get_public_key(kid: str) -> Optional[str]:
    """Get the public key for a given key ID"""
    if kid not in CLERK_PEM_KEYS:
        jwks = get_clerk_jwks()
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                CLERK_PEM_KEYS[kid] = key
                break
    return CLERK_PEM_KEYS.get(kid)

async def validate_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Validate the JWT token from Clerk"""
    try:
        token = credentials.credentials
        # Extract the key ID from the token header
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        
        if not kid:
            raise HTTPException(status_code=401, detail="Invalid token header")
            
        # Get the public key
        public_key = get_public_key(kid)
        if not public_key:
            raise HTTPException(status_code=401, detail="Invalid key ID")
            
        # Verify the token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False}  # Skip audience verification
        )
        
        # Extract user information
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in token")
            
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "name": payload.get("name")
        }
        
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Dependency to get the current authenticated user"""
    return await validate_token(credentials) 