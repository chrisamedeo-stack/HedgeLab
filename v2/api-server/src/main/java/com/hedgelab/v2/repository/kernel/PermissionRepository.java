package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionRepository extends JpaRepository<Permission, String> {
}
