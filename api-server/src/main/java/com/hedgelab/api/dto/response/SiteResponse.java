package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SiteResponse {
    private Long id;
    private String code;
    private String name;
    private String country;
    private String province;
}
