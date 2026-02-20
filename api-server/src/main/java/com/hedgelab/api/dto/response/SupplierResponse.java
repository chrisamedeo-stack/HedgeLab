package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SupplierResponse {
    private Long id;
    private String code;
    private String name;
    private String country;
    private String contactEmail;
    private String contactPhone;
    private boolean active;
}
