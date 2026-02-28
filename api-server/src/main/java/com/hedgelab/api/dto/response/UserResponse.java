package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.AppRole;

public record UserResponse(
        Long id,
        String username,
        String email,
        AppRole role,
        boolean enabled
) {}
