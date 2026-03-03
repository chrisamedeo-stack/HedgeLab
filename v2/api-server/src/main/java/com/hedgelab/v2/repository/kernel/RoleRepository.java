package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, String> {
}
