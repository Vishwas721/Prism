import logging

from fastapi import APIRouter, HTTPException

from services import policy_service

router = APIRouter(prefix="/api", tags=["policies"])
logger = logging.getLogger("prism.policies")


@router.get("/policies")
async def list_policies():
    """Get all available policies."""
    try:
        policies = policy_service.get_all_policies()
        # Return lightweight list for dropdown
        return [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "description": p.get("description"),
            }
            for p in policies
        ]
    except Exception as exc:
        logger.exception("Failed to list policies")
        raise HTTPException(status_code=500, detail="Failed to retrieve policies") from exc


@router.get("/policies/{policy_id}")
async def get_policy(policy_id: str):
    """Get a specific policy by ID."""
    try:
        policy = policy_service.get_policy_by_id(policy_id)
        if not policy:
            raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found")
        return policy
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to retrieve policy {policy_id}")
        raise HTTPException(status_code=500, detail="Failed to retrieve policy") from exc
