package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.AppUser;
import com.hedgelab.v2.entity.kernel.Permission;
import com.hedgelab.v2.entity.kernel.Role;
import com.hedgelab.v2.repository.kernel.AppUserRepository;
import com.hedgelab.v2.repository.kernel.PermissionRepository;
import com.hedgelab.v2.repository.kernel.RolePermissionRepository;
import com.hedgelab.v2.repository.kernel.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class PermissionService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final AppUserRepository userRepository;

    public boolean checkPermission(UUID userId, String permissionId) {
        AppUser user = userRepository.findById(userId).orElse(null);
        if (user == null) return false;
        List<String> perms = rolePermissionRepository.findPermissionIdsByRoleId(user.getRoleId());
        return perms.contains(permissionId);
    }

    public List<String> getUserPermissions(UUID userId) {
        AppUser user = userRepository.findById(userId).orElse(null);
        if (user == null) return List.of();
        return rolePermissionRepository.findPermissionIdsByRoleId(user.getRoleId());
    }

    public List<Role> listRoles() {
        return roleRepository.findAll();
    }

    public List<Permission> listPermissions() {
        return permissionRepository.findAll();
    }

    public Map<String, Object> getRolesWithPermissions() {
        List<Role> roles = roleRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Role role : roles) {
            List<String> perms = rolePermissionRepository.findPermissionIdsByRoleId(role.getId());
            Map<String, Object> roleMap = new LinkedHashMap<>();
            roleMap.put("id", role.getId());
            roleMap.put("name", role.getName());
            roleMap.put("description", role.getDescription());
            roleMap.put("is_system", role.getIsSystem());
            roleMap.put("permissions", perms);
            result.add(roleMap);
        }
        return Map.of("roles", result);
    }
}
