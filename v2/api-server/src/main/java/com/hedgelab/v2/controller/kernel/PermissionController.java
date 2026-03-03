package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.service.kernel.PermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/kernel/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final PermissionService permissionService;

    @GetMapping
    public Object list(@RequestParam(required = false) String userId) {
        if (userId != null) {
            List<String> perms = permissionService.getUserPermissions(UUID.fromString(userId));
            return Map.of("userId", userId, "permissions", perms);
        }
        return permissionService.getRolesWithPermissions();
    }
}
