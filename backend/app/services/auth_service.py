import os
from fastapi import Header, HTTPException, Request
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client | None = None

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_current_user_id(request: Request, authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    token = authorization.replace("Bearer ", "")

    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid user")

        user_id = user_response.user.id

        # O limitador de requisições lê o usuário daqui, e esta dependência roda antes dele
        request.state.user_id = user_id

        return user_id

    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")