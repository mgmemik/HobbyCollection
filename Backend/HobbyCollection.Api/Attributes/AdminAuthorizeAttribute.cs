using Microsoft.AspNetCore.Authorization;

namespace HobbyCollection.Api.Attributes;

/// <summary>
/// Admin-only endpoint'ler için authorization attribute
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AdminAuthorizeAttribute : AuthorizeAttribute
{
    public AdminAuthorizeAttribute()
    {
        Policy = "AdminOnly";
    }
}

