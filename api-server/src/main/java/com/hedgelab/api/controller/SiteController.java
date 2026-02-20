package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateSiteRequest;
import com.hedgelab.api.dto.response.CommodityResponse;
import com.hedgelab.api.dto.response.SiteResponse;
import com.hedgelab.api.dto.response.SupplierResponse;
import com.hedgelab.api.service.SiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/sites")
@RequiredArgsConstructor
public class SiteController {
    private final SiteService siteService;

    @GetMapping
    public List<SiteResponse> getSites() {
        return siteService.getAllSites();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SiteResponse create(@Valid @RequestBody CreateSiteRequest req) {
        return siteService.create(req);
    }

    @PutMapping("/{id}")
    public SiteResponse update(@PathVariable Long id, @Valid @RequestBody CreateSiteRequest req) {
        return siteService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        siteService.delete(id);
    }

    // ─── Site → Supplier linking ────────────────────────────────────────────────

    @GetMapping("/{id}/suppliers")
    public List<SupplierResponse> getSiteSuppliers(@PathVariable Long id) {
        return siteService.getSiteSuppliers(id);
    }

    @PutMapping("/{id}/suppliers")
    public List<SupplierResponse> setSiteSuppliers(@PathVariable Long id, @RequestBody List<Long> supplierIds) {
        return siteService.setSiteSuppliers(id, supplierIds);
    }

    // ─── Site → Commodity linking ───────────────────────────────────────────────

    @GetMapping("/{id}/commodities")
    public List<CommodityResponse> getSiteCommodities(@PathVariable Long id) {
        return siteService.getSiteCommodities(id);
    }

    @PutMapping("/{id}/commodities")
    public List<CommodityResponse> setSiteCommodities(@PathVariable Long id, @RequestBody List<Long> commodityIds) {
        return siteService.setSiteCommodities(id, commodityIds);
    }
}
