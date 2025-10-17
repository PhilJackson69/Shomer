# ADR-005: Role-Based Access Control (RBAC) Model

## Status

Accepted

Date: 2025-01-14

## Context

We need an access control model for Shomer that:

- Provides appropriate access levels for different user types
- Is simple to understand and maintain
- Scales as the system grows
- Supports audit requirements
- Prevents unauthorized access
- Allows for future expansion

## Decision

We will implement a hierarchical **Role-Based Access Control (RBAC)** model with three initial roles:

1. **Viewer** (Level 0): Read-only access to assigned resources
2. **Moderator** (Level 1): Read/write access + user management + audit log access
3. **Admin** (Level 2): Full system access + configuration management

Role hierarchy: Admin > Moderator > Viewer

Higher roles automatically inherit permissions of lower roles.

## Permission Implementation

### Database Level
- Role stored as string enum in `users.role` column
- Foreign key constraints ensure data integrity
- Future: Row-level security (RLS) policies for fine-grained control

### API Level
- FastAPI dependency injection with `require_role()` function
- JWT tokens include user ID (lookup role on each request)
- All protected endpoints require authentication
- Role check happens before business logic

### Frontend Level
- Conditional rendering based on current user role
- API calls will fail anyway if unauthorized (defense in depth)
- Role-based route protection

## Consequences

### Positive

- **Simplicity**: Three roles are easy to understand and explain
- **Hierarchical**: Higher roles inherit lower permissions automatically
- **Scalable**: Can add more roles or permissions later
- **Auditable**: All role-based decisions logged in audit trail
- **Secure**: Role checks enforced at API level
- **Flexible**: Can add attribute-based rules later without major refactor

### Negative

- **Granularity**: May need more fine-grained permissions in the future
- **Role Explosion**: Could end up with too many roles as system grows
- **User Management**: Changing roles requires admin intervention
- **No Self-Service**: Users can't request elevated access automatically

### Neutral

- **JWT Overhead**: Need to fetch role on each request (mitigated with caching)
- **Migration Path**: If we need ABAC later, will require refactoring

## Permission Matrix

| Resource / Action | Viewer | Moderator | Admin |
|-------------------|--------|-----------|-------|
| **Users** |
| View own profile | ✓ | ✓ | ✓ |
| View other users | ✗ | ✓ | ✓ |
| List all users | ✗ | ✓ | ✓ |
| Create users | ✗ | ✓ | ✓ |
| Update users | ✗ | ✗ | ✓ |
| Delete users | ✗ | ✗ | ✓ |
| Change user roles | ✗ | ✗ | ✓ |
| **Audit Logs** |
| View audit logs | ✗ | ✓ | ✓ |
| Export audit logs | ✗ | ✓ | ✓ |
| Delete audit logs | ✗ | ✗ | ✗ (never) |
| **System** |
| View system status | ✗ | ✓ | ✓ |
| Modify settings | ✗ | ✗ | ✓ |
| Access admin panel | ✗ | ✗ | ✓ |

## Future Enhancements

### Attribute-Based Access Control (ABAC)
- Add attributes to users (e.g., department, team)
- Permission rules based on attributes
- More flexible but more complex

### Permission Groups
- Define permission sets separately from roles
- Assign multiple permission groups to roles
- More granular control

### Delegated Administration
- Allow moderators to manage users in their team/department
- Reduces admin burden
- Requires additional access control logic

### Temporary Elevated Access
- Time-limited role elevation
- Break-glass access for emergencies
- Requires approval workflow

## Alternatives Considered

### Alternative 1: Attribute-Based Access Control (ABAC)

**Pros**: Very flexible, fine-grained control, attribute-based rules

**Cons**: Complex to implement and understand, harder to audit, performance overhead

**Why not chosen**: RBAC is sufficient for initial requirements. Can migrate to ABAC later if needed.

### Alternative 2: Access Control Lists (ACLs)

**Pros**: Per-resource permissions, very granular

**Cons**: Hard to manage at scale, permission explosion, complex to audit

**Why not chosen**: Too complex for our use case. RBAC provides sufficient control.

### Alternative 3: Single Admin Role

**Pros**: Simple, no role hierarchy needed

**Cons**: All-or-nothing access, no moderator role for daily operations

**Why not chosen**: Need moderator role for user management without full admin access.

## Implementation Example

```python
# Role hierarchy
class UserRole(str, Enum):
    VIEWER = "viewer"
    MODERATOR = "moderator"
    ADMIN = "admin"

# Dependency for role requirement
def require_role(required_role: UserRole) -> Callable:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        role_hierarchy = {
            UserRole.VIEWER: 0,
            UserRole.MODERATOR: 1,
            UserRole.ADMIN: 2,
        }
        
        user_level = role_hierarchy.get(UserRole(current_user.role), -1)
        required_level = role_hierarchy.get(required_role, 999)
        
        if user_level < required_level:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return current_user
    
    return role_checker

# Usage in endpoint
@router.get("/users/")
def list_users(current_user: User = Depends(require_role(UserRole.MODERATOR))):
    # Only moderators and admins can access this
    ...
```

## References

- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [NIST RBAC Model](https://csrc.nist.gov/projects/role-based-access-control)

