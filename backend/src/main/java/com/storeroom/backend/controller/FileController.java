package com.storeroom.backend.controller;

import com.storeroom.backend.dto.FileResponse;
import com.storeroom.backend.entity.FileMetadata;
import com.storeroom.backend.entity.Folder;
import com.storeroom.backend.entity.User;
import com.storeroom.backend.repository.FileMetadataRepository;
import com.storeroom.backend.repository.FolderRepository;
import com.storeroom.backend.repository.UserRepository;
import com.storeroom.backend.service.SupabaseStorageService;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final UserRepository userRepository;
    private final FolderRepository folderRepository;
    private final FileMetadataRepository fileMetadataRepository;
    private final SupabaseStorageService storageService;

    public FileController(
            UserRepository userRepository,
            FolderRepository folderRepository,
            FileMetadataRepository fileMetadataRepository,
            SupabaseStorageService storageService
    ) {
        this.userRepository = userRepository;
        this.folderRepository = folderRepository;
        this.fileMetadataRepository = fileMetadataRepository;
        this.storageService = storageService;
    }


    // =========================================================
    // UPLOAD FILE
    // POST /api/files/upload
    // =========================================================

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folderId", required = false) UUID folderId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            if (file == null || file.isEmpty()) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File cannot be empty"
                        ));
            }

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            long fileSize = file.getSize();

            if (user.getStorageUsed() + fileSize
                    > user.getStorageQuota()) {

                return ResponseEntity
                        .status(HttpStatus.INSUFFICIENT_STORAGE)
                        .body(Map.of(
                                "message",
                                "Storage quota exceeded",
                                "storageQuota",
                                user.getStorageQuota(),
                                "storageUsed",
                                user.getStorageUsed()
                        ));
            }

            Folder folder = null;

            if (folderId != null) {

                folder = folderRepository.findById(folderId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Folder not found"
                                )
                        );

                if (!folder.getOwner()
                        .getId()
                        .equals(userId)) {

                    return ResponseEntity
                            .status(HttpStatus.FORBIDDEN)
                            .body(Map.of(
                                    "message",
                                    "You do not have access to this folder"
                            ));
                }
            }

            String originalName =
                    file.getOriginalFilename();

            if (originalName == null ||
                    originalName.isBlank()) {

                originalName = "unnamed-file";
            }

            String safeFileName =
                    originalName.replaceAll(
                            "[^a-zA-Z0-9._-]",
                            "_"
                    );

            UUID fileId = UUID.randomUUID();

            String storagePath;

            if (folder != null) {

                storagePath =
                        userId
                        + "/"
                        + folder.getId()
                        + "/"
                        + fileId
                        + "-"
                        + safeFileName;

            } else {

                storagePath =
                        userId
                        + "/"
                        + fileId
                        + "-"
                        + safeFileName;
            }

            storageService.uploadFile(
                    storagePath,
                    file
            );

            FileMetadata metadata =
                    new FileMetadata();

            metadata.setId(fileId);
            metadata.setName(safeFileName);
            metadata.setOriginalName(originalName);
            metadata.setStoragePath(storagePath);
            metadata.setContentType(file.getContentType());
            metadata.setSize(fileSize);
            metadata.setOwner(user);
            metadata.setFolder(folder);

            fileMetadataRepository.save(metadata);

            user.setStorageUsed(
                    user.getStorageUsed()
                    + fileSize
            );

            userRepository.save(user);

            Map<String, Object> response =
                    new HashMap<>();

            response.put(
                    "message",
                    "File uploaded successfully"
            );

            response.put(
                    "fileId",
                    fileId
            );

            response.put(
                    "fileName",
                    originalName
            );

            response.put(
                    "size",
                    fileSize
            );

            response.put(
                    "storageUsed",
                    user.getStorageUsed()
            );

            response.put(
                    "storageQuota",
                    user.getStorageQuota()
            );

            response.put(
                    "storagePath",
                    storagePath
            );

            response.put(
                    "folderId",
                    folder != null
                            ? folder.getId()
                            : null
            );

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "File upload failed",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // GET FILES
    //
    // GET /api/files
    //       → root files
    //
    // GET /api/files?folderId=<UUID>
    //       → files inside folder
    // =========================================================

    @GetMapping
    public ResponseEntity<?> getFiles(
            @RequestParam(
                    value = "folderId",
                    required = false
            ) UUID folderId,

            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            List<FileMetadata> files;

            if (folderId == null) {

                files =
                        fileMetadataRepository
                                .findByOwnerAndFolderIsNullAndTrashedFalseOrderByNameAsc(
                                        user
                                );

            } else {

                Folder folder =
                        folderRepository.findById(folderId)
                                .orElseThrow(() ->
                                        new RuntimeException(
                                                "Folder not found"
                                        )
                                );

                if (!folder.getOwner()
                        .getId()
                        .equals(userId)) {

                    return ResponseEntity
                            .status(HttpStatus.FORBIDDEN)
                            .body(Map.of(
                                    "message",
                                    "You do not have access to this folder"
                            ));
                }

                files =
                        fileMetadataRepository
                                .findByOwnerAndFolderAndTrashedFalseOrderByNameAsc(
                                        user,
                                        folder
                                );
            }

            return ResponseEntity.ok(
                    convertToResponse(files)
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to retrieve files",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // GLOBAL SEARCH
    //
    // GET /api/files/search?q=test
    //
    // Searches ALL files and folders belonging to the
    // authenticated user.
    //
    // Files inside nested folders are also searchable.
    // Trashed files are excluded.
    // =========================================================

    // =========================================================
    // STORAGE USAGE
    // GET /api/files/storage
    // =========================================================

    @GetMapping("/storage")
    public ResponseEntity<?> getStorageUsage(
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            List<FileMetadata> activeFiles =
                    fileMetadataRepository
                            .findByOwnerAndTrashedFalseOrderByNameAsc(user);

            List<FileMetadata> trashedFiles =
                    fileMetadataRepository
                            .findByOwnerAndTrashedTrueOrderByUpdatedAtDesc(user);

            long storageUsed = 0L;
            int fileCount = 0;

            for (FileMetadata file : activeFiles) {
                storageUsed +=
                        file.getSize() != null
                                ? file.getSize()
                                : 0L;
                fileCount++;
            }

            for (FileMetadata file : trashedFiles) {
                storageUsed +=
                        file.getSize() != null
                                ? file.getSize()
                                : 0L;
                fileCount++;
            }

            long storageQuota =
                    15L * 1024L * 1024L * 1024L;

            long storageRemaining =
                    Math.max(
                            storageQuota - storageUsed,
                            0L
                    );

            double usagePercentage =
                    storageQuota == 0
                            ? 0.0
                            : (storageUsed * 100.0)
                                    / storageQuota;

            Map<String, Object> response =
                    new HashMap<>();

            response.put("storageUsed", storageUsed);
            response.put("storageQuota", storageQuota);
            response.put("storageRemaining", storageRemaining);
            response.put("usagePercentage", usagePercentage);
            response.put("fileCount", fileCount);

            return ResponseEntity.ok(response);

        } catch (Exception e) {

            return ResponseEntity.status(
                    HttpStatus.INTERNAL_SERVER_ERROR
            ).body(
                    Map.of(
                            "message",
                            "Unable to load storage usage."
                    )
            );
        }
    }


    // =========================================================
    // SEARCH FILES
    // GET /api/files/search?q=
    // =========================================================

    @GetMapping("/search")
    public ResponseEntity<?> searchFilesAndFolders(
            @RequestParam("q") String query,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            String searchQuery =
                    query == null
                            ? ""
                            : query.trim();

            // -------------------------------------------------
            // EMPTY SEARCH
            // -------------------------------------------------

            if (searchQuery.isEmpty()) {

                Map<String, Object> emptyResponse =
                        new HashMap<>();

                emptyResponse.put(
                        "files",
                        List.of()
                );

                emptyResponse.put(
                        "folders",
                        List.of()
                );

                emptyResponse.put(
                        "query",
                        ""
                );

                emptyResponse.put(
                        "totalResults",
                        0
                );

                return ResponseEntity.ok(
                        emptyResponse
                );
            }

            // -------------------------------------------------
            // SEARCH FILES
            // -------------------------------------------------

            List<FileMetadata> files =
                    fileMetadataRepository
                            .searchByOwnerAndQuery(
                                    user,
                                    searchQuery
                            );

            // -------------------------------------------------
            // SEARCH FOLDERS
            // -------------------------------------------------

            List<Folder> folders =
                    folderRepository
                            .searchByOwnerAndName(
                                    user,
                                    searchQuery
                            );

            // -------------------------------------------------
            // CONVERT FILES
            // -------------------------------------------------

            List<FileResponse> fileResponses =
                    convertToResponse(files);

            // -------------------------------------------------
            // CONVERT FOLDERS
            //
            // HashMap is used instead of Map.of because
            // root folders have parentId = null.
            // -------------------------------------------------

            List<Map<String, Object>>
                    folderResponses =
                    new ArrayList<>();

            for (Folder folder : folders) {

                Map<String, Object>
                        folderResponse =
                        new HashMap<>();

                folderResponse.put(
                        "id",
                        folder.getId()
                );

                folderResponse.put(
                        "name",
                        folder.getName()
                );

                folderResponse.put(
                        "parentId",
                        folder.getParent() != null
                                ? folder.getParent().getId()
                                : null
                );

                folderResponse.put(
                        "createdAt",
                        folder.getCreatedAt()
                );

                folderResponse.put(
                        "updatedAt",
                        folder.getUpdatedAt()
                );

                folderResponses.add(
                        folderResponse
                );
            }

            // -------------------------------------------------
            // FINAL RESPONSE
            // -------------------------------------------------

            Map<String, Object> response =
                    new HashMap<>();

            response.put(
                    "query",
                    searchQuery
            );

            response.put(
                    "files",
                    fileResponses
            );

            response.put(
                    "folders",
                    folderResponses
            );

            response.put(
                    "totalResults",
                    fileResponses.size()
                            + folderResponses.size()
            );

            return ResponseEntity.ok(
                    response
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Search failed",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // GET STARRED FILES
    // GET /api/files/starred
    // =========================================================

    @GetMapping("/starred")
    public ResponseEntity<?> getStarredFiles(
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            List<FileMetadata> files =
                    fileMetadataRepository
                            .findByOwnerAndStarredTrueAndTrashedFalseOrderByNameAsc(
                                    user
                            );

            return ResponseEntity.ok(
                    convertToResponse(files)
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to retrieve starred files",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // GET TRASHED FILES
    // GET /api/files/trash
    // =========================================================

    @GetMapping("/trash")
    public ResponseEntity<?> getTrash(
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            List<FileMetadata> files =
                    fileMetadataRepository
                            .findByOwnerAndTrashedTrueOrderByUpdatedAtDesc(
                                    user
                            );

            return ResponseEntity.ok(
                    convertToResponse(files)
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to retrieve trash",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // STAR / UNSTAR FILE
    // PUT /api/files/{fileId}/star
    // =========================================================

    @PutMapping("/{fileId}/star")
    public ResponseEntity<?> toggleStar(
            @PathVariable UUID fileId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            FileMetadata metadata =
                    fileMetadataRepository
                            .findByIdAndOwner(
                                    fileId,
                                    user
                            )
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "File not found"
                                    )
                            );

            if (Boolean.TRUE.equals(
                    metadata.getTrashed()
            )) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Cannot star a file in Trash"
                        ));
            }

            boolean newStarredStatus =
                    !Boolean.TRUE.equals(
                            metadata.getStarred()
                    );

            metadata.setStarred(
                    newStarredStatus
            );

            fileMetadataRepository.save(
                    metadata
            );

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            newStarredStatus
                                    ? "File starred successfully"
                                    : "File unstarred successfully",

                            "fileId",
                            fileId,

                            "starred",
                            newStarredStatus
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to update star status",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // RENAME FILE
    // PUT /api/files/{fileId}/rename
    // =========================================================

    @PutMapping("/{fileId}/rename")
    public ResponseEntity<?> renameFile(
            @PathVariable UUID fileId,
            @RequestBody Map<String, String> request,
            org.springframework.security.core.Authentication authentication
    ) {

        try {
            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException("User not found")
                    );

            FileMetadata metadata =
                    fileMetadataRepository.findByIdAndOwner(
                            fileId,
                            user
                    ).orElseThrow(() ->
                            new RuntimeException("File not found")
                    );

            if (Boolean.TRUE.equals(metadata.getTrashed())) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Cannot rename a file in Trash"
                        ));
            }

            String requestedName = request.get("name");

            if (requestedName == null ||
                    requestedName.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File name cannot be empty"
                        ));
            }

            String newName = requestedName.trim();

            if (newName.length() > 255) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File name cannot exceed 255 characters"
                        ));
            }

            if (newName.matches(".*[\\\\/:*?\"<>|].*")) {
                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File name contains invalid characters"
                        ));
            }

            String oldName = metadata.getName();
            String extension = "";

            int dotIndex = oldName.lastIndexOf('.');
            if (dotIndex > 0 && dotIndex < oldName.length() - 1) {
                extension = oldName.substring(dotIndex);
            }

            // Preserve the existing extension when the user does not
            // explicitly provide one.
            if (!extension.isEmpty()) {
                int newDotIndex = newName.lastIndexOf('.');
                if (newDotIndex <= 0) {
                    newName += extension;
                }
            }

            if (newName.equals(oldName)) {
                return ResponseEntity.ok(
                        Map.of(
                                "message", "File name unchanged",
                                "fileId", fileId,
                                "name", newName,
                                "originalName", metadata.getOriginalName()
                        )
                );
            }

            // Prevent duplicate names in the same folder.
            List<FileMetadata> existingFiles;

            if (metadata.getFolder() == null) {
                existingFiles =
                        fileMetadataRepository
                                .findByOwnerAndFolderIsNullAndTrashedFalseOrderByNameAsc(
                                        user
                                );
            } else {
                existingFiles =
                        fileMetadataRepository
                                .findByOwnerAndFolderAndTrashedFalseOrderByNameAsc(
                                        user,
                                        metadata.getFolder()
                                );
            }

            final String finalNewName = newName;
            boolean duplicate = existingFiles.stream()
                    .anyMatch(existing ->
                            !existing.getId().equals(fileId) &&
                            existing.getName().equalsIgnoreCase(finalNewName)
                    );

            if (duplicate) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of(
                                "message",
                                "A file with this name already exists in this folder"
                        ));
            }

            metadata.setName(newName);
            metadata.setOriginalName(newName);

            fileMetadataRepository.save(metadata);

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "File renamed successfully",
                            "fileId",
                            fileId,
                            "name",
                            metadata.getName(),
                            "originalName",
                            metadata.getOriginalName(),
                            "updatedAt",
                            metadata.getUpdatedAt()
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to rename file",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // DOWNLOAD FILE
    // GET /api/files/{fileId}/download
    // =========================================================

    @GetMapping("/{fileId}/download")
    public ResponseEntity<?> downloadFile(
            @PathVariable UUID fileId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            FileMetadata metadata =
                    fileMetadataRepository.findById(fileId)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "File not found"
                                    )
                            );

            if (metadata.getOwner() == null ||
                    metadata.getOwner().getId() == null ||
                    !metadata.getOwner()
                            .getId()
                            .equals(userId)) {

                return ResponseEntity
                        .status(HttpStatus.FORBIDDEN)
                        .body(Map.of(
                                "message",
                                "You do not have access to this file"
                        ));
            }

            if (metadata.getStoragePath() == null ||
                    metadata.getStoragePath().isBlank()) {

                return ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body(Map.of(
                                "message",
                                "File storage path not found"
                        ));
            }

            byte[] fileBytes =
                    storageService.downloadFile(
                            metadata.getStoragePath()
                    );

            MediaType mediaType =
                    MediaType.APPLICATION_OCTET_STREAM;

            if (metadata.getContentType() != null &&
                    !metadata.getContentType().isBlank()) {

                try {

                    mediaType =
                            MediaType.parseMediaType(
                                    metadata.getContentType()
                            );

                } catch (Exception ignored) {
                    // Use default binary type.
                }
            }

            String downloadName =
                    metadata.getOriginalName();

            if (downloadName == null ||
                    downloadName.isBlank()) {

                downloadName =
                        metadata.getName();
            }

            if (downloadName == null ||
                    downloadName.isBlank()) {

                downloadName = "download";
            }

            ContentDisposition contentDisposition =
                    ContentDisposition
                            .attachment()
                            .filename(
                                    downloadName,
                                    StandardCharsets.UTF_8
                            )
                            .build();

            HttpHeaders headers =
                    new HttpHeaders();

            headers.setContentType(
                    mediaType
            );

            headers.setContentLength(
                    fileBytes.length
            );

            headers.setContentDisposition(
                    contentDisposition
            );

            return new ResponseEntity<>(
                    fileBytes,
                    headers,
                    HttpStatus.OK
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "File download failed",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // MOVE FILE TO TRASH
    // DELETE /api/files/{fileId}
    // =========================================================

    @DeleteMapping("/{fileId}")
    public ResponseEntity<?> deleteFile(
            @PathVariable UUID fileId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            FileMetadata metadata =
                    fileMetadataRepository.findById(fileId)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "File not found"
                                    )
                            );

            if (metadata.getOwner() == null ||
                    metadata.getOwner().getId() == null ||
                    !metadata.getOwner()
                            .getId()
                            .equals(userId)) {

                return ResponseEntity
                        .status(HttpStatus.FORBIDDEN)
                        .body(Map.of(
                                "message",
                                "You do not have access to this file"
                        ));
            }

            if (Boolean.TRUE.equals(
                    metadata.getTrashed()
            )) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File is already in Trash"
                        ));
            }

            metadata.setTrashed(true);

            fileMetadataRepository.save(metadata);

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "File moved to Trash",
                            "fileId",
                            fileId,
                            "trashed",
                            true
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to move file to Trash",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // RESTORE FILE FROM TRASH
    // PUT /api/files/{fileId}/restore
    // =========================================================

    @PutMapping("/{fileId}/restore")
    public ResponseEntity<?> restoreFile(
            @PathVariable UUID fileId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user = userRepository.findById(userId)
                    .orElseThrow(() ->
                            new RuntimeException(
                                    "User not found"
                            )
                    );

            FileMetadata metadata =
                    fileMetadataRepository
                            .findByIdAndOwner(
                                    fileId,
                                    user
                            )
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "File not found"
                                    )
                            );

            if (!Boolean.TRUE.equals(
                    metadata.getTrashed()
            )) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File is not in Trash"
                        ));
            }

            metadata.setTrashed(false);

            fileMetadataRepository.save(metadata);

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "File restored successfully",

                            "fileId",
                            fileId,

                            "trashed",
                            false
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to restore file",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // DELETE FILE FOREVER
    // DELETE /api/files/{fileId}/permanent
    // =========================================================

    @DeleteMapping("/{fileId}/permanent")
    public ResponseEntity<?> permanentlyDeleteFile(
            @PathVariable UUID fileId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            FileMetadata metadata =
                    fileMetadataRepository.findById(fileId)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "File not found"
                                    )
                            );

            if (metadata.getOwner() == null ||
                    metadata.getOwner().getId() == null ||
                    !metadata.getOwner()
                            .getId()
                            .equals(userId)) {

                return ResponseEntity
                        .status(HttpStatus.FORBIDDEN)
                        .body(Map.of(
                                "message",
                                "You do not have access to this file"
                        ));
            }

            if (!Boolean.TRUE.equals(
                    metadata.getTrashed()
            )) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "File must be in Trash before permanent deletion"
                        ));
            }

            long fileSize =
                    metadata.getSize();

            String storagePath =
                    metadata.getStoragePath();

            if (storagePath != null &&
                    !storagePath.isBlank()) {

                storageService.deleteFile(
                        storagePath
                );
            }

            fileMetadataRepository.delete(
                    metadata
            );

            User user =
                    metadata.getOwner();

            long currentStorage =
                    user.getStorageUsed();

            long newStorage =
                    Math.max(
                            0,
                            currentStorage - fileSize
                    );

            user.setStorageUsed(
                    newStorage
            );

            userRepository.save(user);

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "File permanently deleted",

                            "fileId",
                            fileId,

                            "storageFreed",
                            fileSize,

                            "storageUsed",
                            newStorage
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Permanent file deletion failed",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // CONVERT ENTITY → RESPONSE
    // =========================================================

    private List<FileResponse> convertToResponse(
            List<FileMetadata> files
    ) {

        return files.stream()
                .map(file -> new FileResponse(

                        file.getId(),

                        file.getName(),

                        file.getOriginalName(),

                        file.getContentType(),

                        file.getSize(),

                        Boolean.TRUE.equals(
                                file.getStarred()
                        ),

                        Boolean.TRUE.equals(
                                file.getTrashed()
                        ),

                        file.getStoragePath(),

                        file.getFolder() != null
                                ? file.getFolder().getId()
                                : null,

                        file.getCreatedAt(),

                        file.getUpdatedAt()

                ))
                .toList();
    }
}