package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SiteRepository extends JpaRepository<Site, Long> {
    Optional<Site> findByCode(String code);
}
