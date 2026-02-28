package com.hedgelab.api.dto.request;

import com.hedgelab.api.entity.AppRole;

public record UpdateUserRequest(
        String email,
        AppRole role,
        Boolean enabled
) {}
