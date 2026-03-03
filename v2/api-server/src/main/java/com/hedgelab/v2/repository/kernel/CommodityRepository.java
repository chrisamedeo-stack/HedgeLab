package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.Commodity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommodityRepository extends JpaRepository<Commodity, String> {
    List<Commodity> findByIsActiveTrue();
}
