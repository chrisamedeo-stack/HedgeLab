package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateCommodityRequest;
import com.hedgelab.api.dto.response.CommodityResponse;
import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.CommodityCategory;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.CommodityRepository;
import com.hedgelab.api.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CommodityService {

    private final CommodityRepository commodityRepo;
    private final TradeRepository tradeRepo;

    @Transactional
    public CommodityResponse create(CreateCommodityRequest req) {
        if (commodityRepo.existsByCode(req.code())) {
            throw new InvalidStateException("Commodity code already exists: " + req.code());
        }
        Commodity c = Commodity.builder()
            .code(req.code().toUpperCase())
            .name(req.name())
            .category(req.category())
            .unitOfMeasure(req.unitOfMeasure())
            .currency(req.currency().toUpperCase())
            .hedgeable(req.hedgeable())
            .description(req.description())
            .icisCode(req.icisCode())
            .build();
        return CommodityResponse.from(commodityRepo.save(c));
    }

    @Transactional(readOnly = true)
    public CommodityResponse getById(Long id) {
        return CommodityResponse.from(findById(id));
    }

    @Transactional(readOnly = true)
    public CommodityResponse getByCode(String code) {
        return CommodityResponse.from(findByCode(code));
    }

    @Transactional(readOnly = true)
    public List<CommodityResponse> getAll(Boolean active, CommodityCategory category) {
        List<Commodity> results;
        if (category != null && active != null) {
            results = commodityRepo.findByCategoryAndActive(category, active);
        } else if (active != null) {
            results = commodityRepo.findByActive(active);
        } else {
            results = commodityRepo.findAll();
        }
        return results.stream().map(CommodityResponse::from).toList();
    }

    @Transactional
    public CommodityResponse update(Long id, CreateCommodityRequest req) {
        Commodity c = findById(id);
        if (!c.getCode().equals(req.code().toUpperCase()) && commodityRepo.existsByCode(req.code().toUpperCase())) {
            throw new InvalidStateException("Commodity code already in use: " + req.code());
        }
        c.setCode(req.code().toUpperCase());
        c.setName(req.name());
        c.setCategory(req.category());
        c.setUnitOfMeasure(req.unitOfMeasure());
        c.setCurrency(req.currency().toUpperCase());
        c.setHedgeable(req.hedgeable());
        c.setDescription(req.description());
        c.setIcisCode(req.icisCode());
        return CommodityResponse.from(commodityRepo.save(c));
    }

    @Transactional
    public void deactivate(Long id) {
        Commodity c = findById(id);
        if (tradeRepo.countOpenTradesByCommodity(id) > 0) {
            throw new InvalidStateException("Cannot deactivate commodity with open trades");
        }
        c.setActive(false);
        commodityRepo.save(c);
    }

    public Commodity findById(Long id) {
        return commodityRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Commodity", id));
    }

    public Commodity findByCode(String code) {
        return commodityRepo.findByCode(code.toUpperCase())
            .orElseThrow(() -> new ResourceNotFoundException("Commodity", code));
    }
}
