package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.CommodityCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface CommodityRepository extends JpaRepository<Commodity, Long>, JpaSpecificationExecutor<Commodity> {
    Optional<Commodity> findByCode(String code);
    boolean existsByCode(String code);
    List<Commodity> findByCategoryAndActive(CommodityCategory category, boolean active);
    List<Commodity> findByActive(boolean active);
}
