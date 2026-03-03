package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    List<AppUser> findByOrgId(UUID orgId);
    Optional<AppUser> findByEmail(String email);
}
