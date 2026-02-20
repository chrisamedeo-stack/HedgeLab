package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateSiteRequest;
import com.hedgelab.api.dto.response.SiteResponse;
import com.hedgelab.api.entity.Site;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.CornBudgetLineRepository;
import com.hedgelab.api.repository.PhysicalContractRepository;
import com.hedgelab.api.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SiteService {
    private final SiteRepository siteRepository;
    private final CornBudgetLineRepository budgetLineRepository;
    private final PhysicalContractRepository contractRepository;

    @Transactional(readOnly = true)
    public List<SiteResponse> getAllSites() {
        return siteRepository.findAll().stream().map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public SiteResponse create(CreateSiteRequest req) {
        if (siteRepository.findByCode(req.code().toUpperCase()).isPresent()) {
            throw new InvalidStateException("Site code already exists: " + req.code());
        }
        Site site = Site.builder()
                .code(req.code().toUpperCase())
                .name(req.name())
                .country(req.country())
                .province(req.province())
                .build();
        return toResponse(siteRepository.save(site));
    }

    @Transactional
    public SiteResponse update(Long id, CreateSiteRequest req) {
        Site site = siteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Site", id));
        if (!site.getCode().equals(req.code().toUpperCase())
                && siteRepository.findByCode(req.code().toUpperCase()).isPresent()) {
            throw new InvalidStateException("Site code already in use: " + req.code());
        }
        site.setCode(req.code().toUpperCase());
        site.setName(req.name());
        site.setCountry(req.country());
        site.setProvince(req.province());
        return toResponse(siteRepository.save(site));
    }

    @Transactional
    public void delete(Long id) {
        Site site = siteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Site", id));
        boolean hasBudgetLines = !budgetLineRepository.findBySiteCodeOrderByBudgetMonthAsc(site.getCode()).isEmpty();
        boolean hasContracts = !contractRepository.findBySiteCodeOrderByContractDateDesc(site.getCode()).isEmpty();
        if (hasBudgetLines || hasContracts) {
            throw new InvalidStateException("Cannot delete site '" + site.getCode() + "' — it is referenced by existing budget lines or contracts");
        }
        siteRepository.delete(site);
    }

    private SiteResponse toResponse(Site s) {
        return SiteResponse.builder()
                .id(s.getId()).code(s.getCode()).name(s.getName())
                .country(s.getCountry()).province(s.getProvince()).build();
    }
}
