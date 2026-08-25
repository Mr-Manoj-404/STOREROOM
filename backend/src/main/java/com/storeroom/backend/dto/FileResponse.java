package com.storeroom.backend.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record FileResponse(

        UUID id,

        String name,

        String originalName,

        String contentType,

        Long size,

        boolean starred,

        boolean trashed,

        String storagePath,

        UUID folderId,

        LocalDateTime createdAt,

        LocalDateTime updatedAt

) {
}