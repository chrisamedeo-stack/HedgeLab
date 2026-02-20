package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreatePriceIndexRequest;
import com.hedgelab.api.dto.response.PriceIndexResponse;
import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.PriceIndex;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.PriceIndexRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PriceIndexService {

    private final PriceIndexRepository priceIndexRepo;
    private final CommodityService commodityService;

    @Transactional
    public PriceIndexResponse create(CreatePriceIndexRequest req) {
        if (priceIndexRepo.existsByIndexCode(req.indexCode())) {
            throw new InvalidStateException("Index code already exists: " + req.indexCode());
        }
        Commodity commodity = commodityService.findById(req.commodityId());
        PriceIndex pi = PriceIndex.builder()
            .indexCode(req.indexCode().toUpperCase())
            .displayName(req.displayName())
            .commodity(commodity)
            .provider(req.provider())
            .currency(req.currency().toUpperCase())
            .unit(req.unit())
            .description(req.description())
            .build();
        return PriceIndexResponse.from(priceIndexRepo.save(pi));
    }

    @Transactional(readOnly = true)
    public PriceIndexResponse getById(Long id) {
        return PriceIndexResponse.from(findById(id));
    }

    @Transactional(readOnly = true)
    public PriceIndexResponse getByCode(String code) {
        return PriceIndexResponse.from(priceIndexRepo.findByIndexCode(code.toUpperCase())
            .orElseThrow(() -> new ResourceNotFoundException("PriceIndex", code)));
    }

    @Transactional(readOnly = true)
    public List<PriceIndexResponse> getAll() {
        return priceIndexRepo.findByActive(true).stream().map(PriceIndexResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PriceIndexResponse> getByCommodity(Long commodityId) {
        Commodity commodity = commodityService.findById(commodityId);
        return priceIndexRepo.findByCommodityAndActive(commodity, true)
            .stream().map(PriceIndexResponse::from).toList();
    }

    @Transactional
    public void deactivate(Long id) {
        PriceIndex pi = findById(id);
        pi.setActive(false);
        priceIndexRepo.save(pi);
    }

    public PriceIndex findById(Long id) {
        return priceIndexRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("PriceIndex", id));
    }
}
