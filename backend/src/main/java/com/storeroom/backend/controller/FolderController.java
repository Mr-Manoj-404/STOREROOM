package com.storeroom.backend.controller;

import com.storeroom.backend.dto.CreateFolderRequest;
import com.storeroom.backend.entity.FileMetadata;
import com.storeroom.backend.entity.Folder;
import com.storeroom.backend.entity.User;
import com.storeroom.backend.repository.FileMetadataRepository;
import com.storeroom.backend.repository.FolderRepository;
import com.storeroom.backend.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/folders")
public class FolderController {

    private final FolderRepository folderRepository;
    private final FileMetadataRepository fileMetadataRepository;
    private final UserRepository userRepository;

    public FolderController(
            FolderRepository folderRepository,
            FileMetadataRepository fileMetadataRepository,
            UserRepository userRepository
    ) {
        this.folderRepository = folderRepository;
        this.fileMetadataRepository = fileMetadataRepository;
        this.userRepository = userRepository;
    }

    // =========================================================
    // CREATE FOLDER
    // POST /api/folders
    // =========================================================

    @PostMapping
    public ResponseEntity<?> createFolder(
            @RequestBody CreateFolderRequest request,
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

            if (request == null ||
                    request.getName() == null) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Folder name is required"
                        ));
            }

            String name =
                    request.getName().trim();

            if (name.isBlank()) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Folder name cannot be empty"
                        ));
            }

            if (name.length() > 255) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Folder name cannot exceed 255 characters"
                        ));
            }

            Folder parent = null;

            if (request.getParentId() != null) {

                parent =
                        folderRepository.findById(
                                request.getParentId()
                        ).orElseThrow(() ->
                                new RuntimeException(
                                        "Parent folder not found"
                                )
                        );

                if (!parent.getOwner()
                        .getId()
                        .equals(userId)) {

                    return ResponseEntity
                            .status(HttpStatus.FORBIDDEN)
                            .body(Map.of(
                                    "message",
                                    "You do not have access to this parent folder"
                            ));
                }
            }

            if (folderRepository
                    .existsByOwnerAndParentAndName(
                            user,
                            parent,
                            name
                    )) {

                return ResponseEntity
                        .status(HttpStatus.CONFLICT)
                        .body(Map.of(
                                "message",
                                "A folder with this name already exists here"
                        ));
            }

            Folder folder =
                    new Folder();

            folder.setName(name);
            folder.setOwner(user);
            folder.setParent(parent);

            folder =
                    folderRepository.save(folder);

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(folderResponse(folder));

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "message",
                            "Invalid authentication"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to create folder",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // GET ROOT FOLDERS
    // GET /api/folders
    // =========================================================

    @GetMapping
    public ResponseEntity<?> getRootFolders(
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user =
                    userRepository.findById(userId)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "User not found"
                                    )
                            );

            List<Folder> folders =
                    folderRepository
                            .findByOwnerAndParentIsNullOrderByNameAsc(
                                    user
                            );

            return ResponseEntity.ok(
                    folders.stream()
                            .map(this::folderResponse)
                            .toList()
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
                            "Unable to load folders",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // GET SUBFOLDERS
    // GET /api/folders/{folderId}/children
    // =========================================================

    @GetMapping("/{folderId}/children")
    public ResponseEntity<?> getSubFolders(
            @PathVariable UUID folderId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user =
                    userRepository.findById(userId)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "User not found"
                                    )
                            );

            Folder parent =
                    folderRepository.findById(folderId)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "Folder not found"
                                    )
                            );

            if (!parent.getOwner()
                    .getId()
                    .equals(userId)) {

                return ResponseEntity
                        .status(HttpStatus.FORBIDDEN)
                        .body(Map.of(
                                "message",
                                "You do not have access to this folder"
                        ));
            }

            List<Folder> folders =
                    folderRepository
                            .findByOwnerAndParentOrderByNameAsc(
                                    user,
                                    parent
                            );

            return ResponseEntity.ok(
                    folders.stream()
                            .map(this::folderResponse)
                            .toList()
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "message",
                            "Invalid folder or authentication ID"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to load subfolders",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // GET SINGLE FOLDER
    // GET /api/folders/{folderId}
    // =========================================================

    @GetMapping("/{folderId}")
    public ResponseEntity<?> getFolder(
            @PathVariable UUID folderId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

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

            return ResponseEntity.ok(
                    folderResponse(folder)
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "message",
                            "Invalid folder or authentication ID"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to load folder",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // RENAME FOLDER
    // PUT /api/folders/{folderId}
    // =========================================================

    @PutMapping("/{folderId}")
    public ResponseEntity<?> renameFolder(
            @PathVariable UUID folderId,
            @RequestBody CreateFolderRequest request,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

            User user =
                    userRepository.findById(userId)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "User not found"
                                    )
                            );

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

            if (request == null ||
                    request.getName() == null) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Folder name is required"
                        ));
            }

            String newName =
                    request.getName().trim();

            if (newName.isBlank()) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Folder name cannot be empty"
                        ));
            }

            if (newName.length() > 255) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "message",
                                "Folder name cannot exceed 255 characters"
                        ));
            }

            if (!folder.getName()
                    .equals(newName)) {

                if (folderRepository
                        .existsByOwnerAndParentAndName(
                                user,
                                folder.getParent(),
                                newName
                        )) {

                    return ResponseEntity
                            .status(HttpStatus.CONFLICT)
                            .body(Map.of(
                                    "message",
                                    "A folder with this name already exists here"
                            ));
                }
            }

            folder.setName(newName);

            folder =
                    folderRepository.save(folder);

            return ResponseEntity.ok(
                    folderResponse(folder)
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "message",
                            "Invalid folder or authentication ID"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to rename folder",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // DELETE FOLDER
    // =========================================================

    @DeleteMapping("/{folderId}")
    public ResponseEntity<?> deleteFolder(
            @PathVariable UUID folderId,
            org.springframework.security.core.Authentication authentication
    ) {

        try {

            UUID userId = UUID.fromString(
                    authentication.getPrincipal().toString()
            );

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

            List<Folder> children =
                    folderRepository
                            .findByOwnerAndParentOrderByNameAsc(
                                    folder.getOwner(),
                                    folder
                            );

            if (!children.isEmpty()) {

                return ResponseEntity
                        .badRequest()
                        .body(Map.of(
                                "message",
                                "Cannot delete a folder containing subfolders"
                        ));
            }

            List<FileMetadata> files =
                    fileMetadataRepository
                            .findByOwnerAndFolderOrderByNameAsc(
                                    folder.getOwner(),
                                    folder
                            );

            if (!files.isEmpty()) {

                return ResponseEntity
                        .badRequest()
                        .body(Map.of(
                                "message",
                                "Cannot delete a folder containing files. Empty the folder first."
                        ));
            }

            folderRepository.delete(folder);

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "Folder deleted successfully",
                            "folderId",
                            folderId
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "message",
                            "Invalid folder or authentication ID"
                    ));

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "message",
                            "Unable to delete folder",
                            "error",
                            e.getMessage()
                    ));
        }
    }


    // =========================================================
    // FOLDER RESPONSE
    // =========================================================

    private Map<String, Object> folderResponse(
            Folder folder
    ) {

        Map<String, Object> response =
                new HashMap<>();

        response.put(
                "id",
                folder.getId()
        );

        response.put(
                "name",
                folder.getName()
        );

        response.put(
                "parentId",
                folder.getParent() == null
                        ? null
                        : folder.getParent().getId()
        );

        response.put(
                "createdAt",
                folder.getCreatedAt()
        );

        response.put(
                "updatedAt",
                folder.getUpdatedAt()
        );

        return response;
    }
}