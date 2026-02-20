package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.PriceIndex;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PriceIndexRepository extends JpaRepository<PriceIndex, Long> {
    Optional<PriceIndex> findByIndexCode(String indexCode);
    boolean existsByIndexCode(String indexCode);
    List<PriceIndex> findByCommodity(Commodity commodity);
    List<PriceIndex> findByActive(boolean active);
    List<PriceIndex> findByCommodityAndActive(Commodity commodity, boolean active);
}
