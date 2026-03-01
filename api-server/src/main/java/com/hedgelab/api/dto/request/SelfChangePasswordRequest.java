package com.hedgelab.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SelfChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 6) String newPassword
) {}
