package com.storeroom.backend.service;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
public class SupabaseStorageService {

    private final RestTemplate restTemplate = new RestTemplate();

    private final String supabaseUrl;
    private final String supabaseSecretKey;
    private final String bucket;

    public SupabaseStorageService() {
        this.supabaseUrl = getRequiredEnv("SUPABASE_URL");
        this.supabaseSecretKey = getRequiredEnv("SUPABASE_SECRET_KEY");
        this.bucket = getRequiredEnv("SUPABASE_STORAGE_BUCKET");
    }


    // =========================================================
    // UPLOAD FILE
    // =========================================================

    public String uploadFile(
            String storagePath,
            MultipartFile file
    ) throws IOException {

        String url =
                supabaseUrl
                        + "/storage/v1/object/"
                        + bucket
                        + "/"
                        + storagePath;

        HttpHeaders headers = new HttpHeaders();

        headers.set(
                "Authorization",
                "Bearer " + supabaseSecretKey
        );

        headers.set(
                "apikey",
                supabaseSecretKey
        );

        String contentType = file.getContentType();

        headers.setContentType(
                MediaType.parseMediaType(
                        contentType != null
                                ? contentType
                                : MediaType.APPLICATION_OCTET_STREAM_VALUE
                )
        );

        HttpEntity<byte[]> request =
                new HttpEntity<>(
                        file.getBytes(),
                        headers
                );

        ResponseEntity<String> response =
                restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        request,
                        String.class
                );

        if (!response.getStatusCode().is2xxSuccessful()) {

            throw new RuntimeException(
                    "Supabase upload failed: "
                            + response.getBody()
            );
        }

        return storagePath;
    }


    // =========================================================
    // DOWNLOAD FILE
    // =========================================================

    public byte[] downloadFile(
            String storagePath
    ) {

        String url =
                supabaseUrl
                        + "/storage/v1/object/"
                        + bucket
                        + "/"
                        + storagePath;

        HttpHeaders headers = new HttpHeaders();

        headers.set(
                "Authorization",
                "Bearer " + supabaseSecretKey
        );

        headers.set(
                "apikey",
                supabaseSecretKey
        );

        HttpEntity<Void> request =
                new HttpEntity<>(headers);

        ResponseEntity<byte[]> response =
                restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        request,
                        byte[].class
                );

        if (!response.getStatusCode().is2xxSuccessful()) {

            throw new RuntimeException(
                    "Supabase download failed: "
                            + response.getStatusCode()
            );
        }

        if (response.getBody() == null) {

            throw new RuntimeException(
                    "Supabase returned an empty file"
            );
        }

        return response.getBody();
    }


    // =========================================================
    // DELETE FILE
    // =========================================================

    public void deleteFile(
            String storagePath
    ) {

        String url =
                supabaseUrl
                        + "/storage/v1/object/"
                        + bucket
                        + "/"
                        + storagePath;

        HttpHeaders headers = new HttpHeaders();

        headers.set(
                "Authorization",
                "Bearer " + supabaseSecretKey
        );

        headers.set(
                "apikey",
                supabaseSecretKey
        );

        HttpEntity<Void> request =
                new HttpEntity<>(headers);

        ResponseEntity<String> response =
                restTemplate.exchange(
                        url,
                        HttpMethod.DELETE,
                        request,
                        String.class
                );

        if (!response.getStatusCode().is2xxSuccessful()) {

            throw new RuntimeException(
                    "Supabase delete failed: "
                            + response.getStatusCode()
                            + " "
                            + response.getBody()
            );
        }
    }


    // =========================================================
    // ENVIRONMENT VARIABLE
    // =========================================================

    private String getRequiredEnv(String name) {

        String value = System.getenv(name);

        if (value == null || value.isBlank()) {

            throw new IllegalStateException(
                    "Missing environment variable: "
                            + name
            );
        }

        return value;
    }
}