package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.AppRole;

import java.time.Instant;

public record AuthResponse(
        String token,
        String username,
        AppRole role,
        Instant expiresAt
) {}
