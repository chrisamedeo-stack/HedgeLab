package com.hedgelab.api.repository;

import com.hedgelab.api.entity.AppRole;
import com.hedgelab.api.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsername(String username);
    boolean existsByUsername(String username);
    long countByRole(AppRole role);
}
