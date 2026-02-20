package com.hedgelab.api.dto.request;

import com.hedgelab.api.entity.AppRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RegisterRequest(
        @NotBlank String username,
        @NotBlank String password,
        String email,
        @NotNull AppRole role
) {}
