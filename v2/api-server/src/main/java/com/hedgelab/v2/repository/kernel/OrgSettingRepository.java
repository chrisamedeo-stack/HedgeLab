package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.OrgSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OrgSettingRepository extends JpaRepository<OrgSetting, UUID> {
}
