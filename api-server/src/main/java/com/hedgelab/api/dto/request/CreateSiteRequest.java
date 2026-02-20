package com.hedgelab.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSiteRequest(
    @NotBlank @Size(max = 10) String code,
    @NotBlank @Size(max = 100) String name,
    @NotBlank String country,
    String province
) {}
