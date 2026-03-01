package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.SelfChangePasswordRequest;
import com.hedgelab.api.entity.AppUser;
import com.hedgelab.api.repository.AppUserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
@Tag(name = "Profile", description = "Self-service profile endpoints")
public class ProfileController {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PutMapping("/password")
    @Operation(summary = "Change own password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal AppUser user,
            @Valid @RequestBody SelfChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }
}
