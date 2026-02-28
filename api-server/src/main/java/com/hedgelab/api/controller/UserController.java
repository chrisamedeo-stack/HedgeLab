package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.ChangePasswordRequest;
import com.hedgelab.api.dto.request.UpdateUserRequest;
import com.hedgelab.api.dto.response.UserResponse;
import com.hedgelab.api.entity.AppRole;
import com.hedgelab.api.entity.AppUser;
import com.hedgelab.api.repository.AppUserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "Admin-only user CRUD endpoints")
public class UserController {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    @Operation(summary = "List all users")
    public List<UserResponse> list() {
        return userRepository.findAll().stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID")
    public ResponseEntity<UserResponse> get(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(u -> ResponseEntity.ok(toResponse(u)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update user email, role, or enabled status")
    public ResponseEntity<UserResponse> update(
            @PathVariable Long id,
            @RequestBody UpdateUserRequest request) {
        return userRepository.findById(id).map(user -> {
            boolean isLastAdmin = user.getRole() == AppRole.ADMIN
                    && userRepository.countByRole(AppRole.ADMIN) <= 1;

            // Prevent demoting the last admin
            if (request.role() != null
                    && isLastAdmin
                    && request.role() != AppRole.ADMIN) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot demote the last admin user");
            }

            // Prevent disabling the last admin
            if (request.enabled() != null
                    && !request.enabled()
                    && isLastAdmin) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot disable the last admin user");
            }
            if (request.email() != null) user.setEmail(request.email());
            if (request.role() != null) user.setRole(request.role());
            if (request.enabled() != null) user.setEnabled(request.enabled());
            userRepository.save(user);
            return ResponseEntity.ok(toResponse(user));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/password")
    @Operation(summary = "Change user password")
    public ResponseEntity<Void> changePassword(
            @PathVariable Long id,
            @Valid @RequestBody ChangePasswordRequest request) {
        return userRepository.findById(id).map(user -> {
            user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
            userRepository.save(user);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal AppUser currentUser) {
        // Can't delete yourself
        if (currentUser.getId().equals(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot delete your own account");
        }
        return userRepository.findById(id).map(user -> {
            // Can't delete the last admin
            if (user.getRole() == AppRole.ADMIN
                    && userRepository.countByRole(AppRole.ADMIN) <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot delete the last admin user");
            }
            userRepository.delete(user);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private UserResponse toResponse(AppUser u) {
        return new UserResponse(u.getId(), u.getUsername(), u.getEmail(), u.getRole(), u.isEnabled());
    }
}
