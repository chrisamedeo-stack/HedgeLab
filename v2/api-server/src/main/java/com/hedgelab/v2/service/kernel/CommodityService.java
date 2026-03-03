package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.Commodity;
import com.hedgelab.v2.repository.kernel.CommodityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CommodityService {

    private final CommodityRepository commodityRepository;

    public List<Commodity> listActive() {
        return commodityRepository.findByIsActiveTrue();
    }

    public Commodity getById(String id) {
        return commodityRepository.findById(id).orElse(null);
    }
}
