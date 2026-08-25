package com.storeroom.backend.controller;

import com.storeroom.backend.dto.LoginRequest;
import com.storeroom.backend.dto.SignupRequest;
import com.storeroom.backend.entity.User;
import com.storeroom.backend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(
            @Valid @RequestBody SignupRequest request
    ) {
        try {
            User user = authService.signup(request);

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(Map.of(
                            "message", "Account created successfully",
                            "userId", user.getId(),
                            "email", user.getEmail(),
                            "fullName", user.getFullName()
                    ));

        } catch (RuntimeException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "message", e.getMessage()
                    ));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request
    ) {
        try {

            AuthService.LoginResult result =
                    authService.login(request);

            User user = result.user();

            return ResponseEntity.ok(
                    Map.of(
                            "message", "Login successful",
                            "accessToken", result.accessToken(),
                            "userId", user.getId(),
                            "email", user.getEmail(),
                            "fullName", user.getFullName()
                    )
            );

        } catch (RuntimeException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message", e.getMessage()
                    ));
        }
    }
}