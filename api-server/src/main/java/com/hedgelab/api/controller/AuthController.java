package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.LoginRequest;
import com.hedgelab.api.dto.request.RegisterRequest;
import com.hedgelab.api.dto.response.AuthResponse;
import com.hedgelab.api.entity.AppUser;
import com.hedgelab.api.repository.AppUserRepository;
import com.hedgelab.api.security.JwtTokenProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Login, register, and user info endpoints")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    @Operation(summary = "Login and obtain JWT token")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        AppUser user = (AppUser) auth.getPrincipal();
        String token = tokenProvider.generateToken(auth);
        return ResponseEntity.ok(new AuthResponse(
                token,
                user.getUsername(),
                user.getRole(),
                tokenProvider.getExpirationFromToken(token)));
    }

    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Register a new user (ADMIN only)")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        AppUser user = AppUser.builder()
                .username(request.username())
                .passwordHash(passwordEncoder.encode(request.password()))
                .email(request.email())
                .role(request.role())
                .enabled(true)
                .build();
        userRepository.save(user);
        String token = tokenProvider.generateToken(user.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(
                token,
                user.getUsername(),
                user.getRole(),
                tokenProvider.getExpirationFromToken(token)));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user info")
    public ResponseEntity<AuthResponse> me(@AuthenticationPrincipal AppUser user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String token = tokenProvider.generateToken(user.getUsername());
        return ResponseEntity.ok(new AuthResponse(
                token,
                user.getUsername(),
                user.getRole(),
                tokenProvider.getExpirationFromToken(token)));
    }
}
