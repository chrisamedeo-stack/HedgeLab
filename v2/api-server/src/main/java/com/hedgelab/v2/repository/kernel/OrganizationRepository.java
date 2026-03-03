package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
}
