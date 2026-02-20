package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateSiteRequest;
import com.hedgelab.api.dto.response.CommodityResponse;
import com.hedgelab.api.dto.response.SiteResponse;
import com.hedgelab.api.dto.response.SupplierResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SiteService {
    private final SiteRepository siteRepository;
    private final CornBudgetLineRepository budgetLineRepository;
    private final PhysicalContractRepository contractRepository;
    private final SiteSupplierRepository siteSupplierRepository;
    private final SiteCommodityRepository siteCommodityRepository;
    private final SupplierRepository supplierRepository;
    private final CommodityRepository commodityRepository;

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

    // ─── Site → Supplier linking ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SupplierResponse> getSiteSuppliers(Long siteId) {
        siteRepository.findById(siteId)
                .orElseThrow(() -> new ResourceNotFoundException("Site", siteId));
        return siteSupplierRepository.findBySiteId(siteId).stream()
                .map(ss -> toSupplierResponse(ss.getSupplier()))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<SupplierResponse> setSiteSuppliers(Long siteId, List<Long> supplierIds) {
        Site site = siteRepository.findById(siteId)
                .orElseThrow(() -> new ResourceNotFoundException("Site", siteId));
        siteSupplierRepository.deleteBySiteId(siteId);
        siteSupplierRepository.flush();
        Set<Long> uniqueIds = Set.copyOf(supplierIds);
        for (Long supplierId : uniqueIds) {
            Supplier supplier = supplierRepository.findById(supplierId)
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier", supplierId));
            siteSupplierRepository.save(SiteSupplier.builder().site(site).supplier(supplier).build());
        }
        return getSiteSuppliers(siteId);
    }

    // ─── Site → Commodity linking ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommodityResponse> getSiteCommodities(Long siteId) {
        siteRepository.findById(siteId)
                .orElseThrow(() -> new ResourceNotFoundException("Site", siteId));
        return siteCommodityRepository.findBySiteId(siteId).stream()
                .map(sc -> CommodityResponse.from(sc.getCommodity()))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<CommodityResponse> setSiteCommodities(Long siteId, List<Long> commodityIds) {
        Site site = siteRepository.findById(siteId)
                .orElseThrow(() -> new ResourceNotFoundException("Site", siteId));
        siteCommodityRepository.deleteBySiteId(siteId);
        siteCommodityRepository.flush();
        Set<Long> uniqueIds = Set.copyOf(commodityIds);
        for (Long commodityId : uniqueIds) {
            Commodity commodity = commodityRepository.findById(commodityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Commodity", commodityId));
            siteCommodityRepository.save(SiteCommodity.builder().site(site).commodity(commodity).build());
        }
        return getSiteCommodities(siteId);
    }

    // ─── Mappers ─────────────────────────────────────────────────────────────────

    private SiteResponse toResponse(Site s) {
        return SiteResponse.builder()
                .id(s.getId()).code(s.getCode()).name(s.getName())
                .country(s.getCountry()).province(s.getProvince()).build();
    }

    private SupplierResponse toSupplierResponse(Supplier s) {
        return SupplierResponse.builder()
                .id(s.getId()).code(s.getCode()).name(s.getName())
                .country(s.getCountry()).contactEmail(s.getContactEmail())
                .contactPhone(s.getContactPhone()).active(s.isActive()).build();
    }
}
