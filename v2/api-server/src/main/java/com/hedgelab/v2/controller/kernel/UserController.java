package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.AppUser;
import com.hedgelab.v2.service.kernel.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/kernel/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public List<AppUser> list(@RequestParam UUID orgId) {
        return userService.listByOrg(orgId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AppUser create(@RequestBody AppUser user) {
        return userService.create(user);
    }

    @PatchMapping
    public AppUser update(@RequestBody Map<String, Object> body) {
        UUID id = UUID.fromString((String) body.get("id"));
        String name = (String) body.get("name");
        String roleId = (String) body.get("roleId");
        Boolean isActive = body.containsKey("isActive") ? (Boolean) body.get("isActive") : null;
        return userService.update(id, name, roleId, isActive);
    }
}
