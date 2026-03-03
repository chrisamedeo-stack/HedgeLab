package com.hedgelab.api.service;

import com.hedgelab.api.dto.CommoditySpec;
import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.CommodityRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caches commodity contract specs for fast lookup by code, slug, or futures prefix.
 * Loaded at startup and refreshable on demand.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommoditySpecService {

    private final CommodityRepository commodityRepository;

    private final ConcurrentHashMap<String, CommoditySpec> byCode = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CommoditySpec> bySlug = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CommoditySpec> byPrefix = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadSpecs() {
        List<Commodity> all = commodityRepository.findAll();
        for (Commodity c : all) {
            if (c.getFuturesPrefix() == null) continue; // skip non-futures commodities
            CommoditySpec spec = CommoditySpec.from(c);
            byCode.put(c.getCode().toUpperCase(), spec);
            if (c.getSlug() != null) {
                bySlug.put(c.getSlug().toLowerCase(), spec);
            }
            byPrefix.put(c.getFuturesPrefix().toUpperCase(), spec);
        }
        log.info("Loaded {} commodity specs: {}", byCode.size(), byCode.keySet());
    }

    /** Look up spec by commodity code (e.g. "CORN", "SOYBEAN"). */
    public CommoditySpec getSpec(String code) {
        CommoditySpec spec = byCode.get(code.toUpperCase());
        if (spec == null) throw new ResourceNotFoundException("CommoditySpec", code);
        return spec;
    }

    /** Look up spec by futures prefix (e.g. "ZC", "ZS"). */
    public CommoditySpec getSpecByFuturesPrefix(String futuresMonth) {
        if (futuresMonth == null || futuresMonth.length() < 2) {
            throw new ResourceNotFoundException("CommoditySpec", "null");
        }
        // Extract prefix: first 2 chars (ZC, ZS, etc.)
        String prefix = futuresMonth.substring(0, 2).toUpperCase();
        CommoditySpec spec = byPrefix.get(prefix);
        if (spec == null) throw new ResourceNotFoundException("CommoditySpec for prefix", prefix);
        return spec;
    }

    /**
     * Resolve a URL slug (e.g. "corn", "soybeans") to a commodity code.
     * Returns the commodity code (e.g. "CORN", "SOYBEAN").
     * Throws ResourceNotFoundException if the slug is unknown.
     */
    public String resolveSlug(String slug) {
        CommoditySpec spec = bySlug.get(slug.toLowerCase());
        if (spec == null) throw new ResourceNotFoundException("Commodity", slug);
        return spec.code();
    }

    /** Resolve slug to full CommoditySpec. */
    public CommoditySpec resolveSlugToSpec(String slug) {
        CommoditySpec spec = bySlug.get(slug.toLowerCase());
        if (spec == null) throw new ResourceNotFoundException("Commodity", slug);
        return spec;
    }

    /** Refresh the cache (e.g., after adding a new commodity). */
    public void refresh() {
        byCode.clear();
        bySlug.clear();
        byPrefix.clear();
        loadSpecs();
    }
}
