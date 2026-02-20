package com.hedgelab.api.repository;

import com.hedgelab.api.entity.SiteSupplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SiteSupplierRepository extends JpaRepository<SiteSupplier, Long> {
    List<SiteSupplier> findBySiteId(Long siteId);
    List<SiteSupplier> findBySupplierId(Long supplierId);
    void deleteBySiteIdAndSupplierId(Long siteId, Long supplierId);
    void deleteBySiteId(Long siteId);
}
