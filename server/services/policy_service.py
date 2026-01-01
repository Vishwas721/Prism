import json
import os
from pathlib import Path
from typing import Dict, List, Optional

POLICIES_FILE = Path(__file__).parent.parent / "data" / "policies.json"


def get_all_policies() -> List[Dict[str, str]]:
    """Read and return all policies from the JSON data store."""
    if not POLICIES_FILE.exists():
        return []
    
    with open(POLICIES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_policy_by_id(policy_id: str) -> Optional[Dict[str, str]]:
    """Get a specific policy by ID."""
    policies = get_all_policies()
    for policy in policies:
        if policy.get("id") == policy_id:
            return policy
    return None


def get_policy_text(policy_id: str) -> str:
    """Get the policy text for AI evaluation."""
    policy = get_policy_by_id(policy_id)
    if not policy:
        raise ValueError(f"Policy with ID '{policy_id}' not found")
    return policy.get("text", "")


def upload_policy(policy_data: Dict[str, str]) -> Dict[str, str]:
    """Add a new policy to the data store."""
    policies = get_all_policies()
    
    # Generate ID from name if not provided
    if "id" not in policy_data:
        policy_data["id"] = policy_data["name"].lower().replace(" ", "-")
    
    # Check for duplicate ID
    if any(p.get("id") == policy_data["id"] for p in policies):
        raise ValueError(f"Policy with ID '{policy_data['id']}' already exists")
    
    policies.append(policy_data)
    
    # Write back to file
    with open(POLICIES_FILE, "w", encoding="utf-8") as f:
        json.dump(policies, f, indent=2, ensure_ascii=False)
    
    return policy_data
