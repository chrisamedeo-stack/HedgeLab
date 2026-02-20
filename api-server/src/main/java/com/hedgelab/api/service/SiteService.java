package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.SiteResponse;
import com.hedgelab.api.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SiteService {
    private final SiteRepository siteRepository;

    public List<SiteResponse> getAllSites() {
        return siteRepository.findAll().stream().map(s -> SiteResponse.builder()
                .id(s.getId()).code(s.getCode()).name(s.getName())
                .country(s.getCountry()).province(s.getProvince()).build())
                .collect(Collectors.toList());
    }
}
