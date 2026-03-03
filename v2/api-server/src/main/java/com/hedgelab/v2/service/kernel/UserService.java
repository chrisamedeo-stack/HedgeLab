package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.AppUser;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.kernel.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AppUserRepository userRepository;
    private final AuditService auditService;

    public List<AppUser> listByOrg(UUID orgId) {
        return userRepository.findByOrgId(orgId);
    }

    public AppUser getById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    public AppUser create(AppUser user) {
        AppUser saved = userRepository.save(user);
        auditService.log(user.getOrgId(), null, "kernel", "user",
                saved.getId().toString(), "create", null, null, "api", null);
        return saved;
    }

    public AppUser update(UUID id, String name, String roleId, Boolean isActive) {
        AppUser existing = getById(id);
        if (name != null) existing.setName(name);
        if (roleId != null) existing.setRoleId(roleId);
        if (isActive != null) existing.setIsActive(isActive);
        auditService.log(existing.getOrgId(), null, "kernel", "user",
                id.toString(), "update", null, null, "api", null);
        return userRepository.save(existing);
    }
}
