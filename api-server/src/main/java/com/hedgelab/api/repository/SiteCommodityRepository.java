package com.hedgelab.api.repository;

import com.hedgelab.api.entity.SiteCommodity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SiteCommodityRepository extends JpaRepository<SiteCommodity, Long> {
    List<SiteCommodity> findBySiteId(Long siteId);
    List<SiteCommodity> findByCommodityId(Long commodityId);
    void deleteBySiteIdAndCommodityId(Long siteId, Long commodityId);
    void deleteBySiteId(Long siteId);
}
