package com.hedgelab.api.dto.request;

import lombok.Data;

@Data
public class AssignSiteRequest {
    private String siteCode;
    private Integer lots;
}
