package com.storeroom.backend.repository;

import com.storeroom.backend.entity.FileMetadata;
import com.storeroom.backend.entity.Folder;
import com.storeroom.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileMetadataRepository
        extends JpaRepository<FileMetadata, UUID> {

    List<FileMetadata> findByOwnerAndFolderAndTrashedFalseOrderByNameAsc(
            User owner,
            Folder folder
    );

    // Finds ALL files in a folder, including trashed files.
    // Used when checking whether a folder is safe to delete.
    List<FileMetadata> findByOwnerAndFolderOrderByNameAsc(
            User owner,
            Folder folder
    );

    List<FileMetadata> findByOwnerAndFolderIsNullAndTrashedFalseOrderByNameAsc(
            User owner
    );

    Optional<FileMetadata> findByIdAndOwner(
            UUID id,
            User owner
    );

    List<FileMetadata> findByOwnerAndStarredTrueAndTrashedFalseOrderByNameAsc(
            User owner
    );

    List<FileMetadata> findByOwnerAndTrashedTrueOrderByUpdatedAtDesc(
            User owner
    );

    List<FileMetadata> findByOwnerAndTrashedFalseOrderByNameAsc(
            User owner
    );


    // =========================================================
    // GLOBAL SEARCH
    // =========================================================

    @Query("""
            SELECT f
            FROM FileMetadata f
            WHERE f.owner = :owner
              AND f.trashed = false
              AND (
                  LOWER(f.name) LIKE LOWER(CONCAT('%', :query, '%'))
                  OR
                  LOWER(f.originalName) LIKE LOWER(CONCAT('%', :query, '%'))
              )
            ORDER BY f.name ASC
            """)
    List<FileMetadata> searchByOwnerAndQuery(
            @Param("owner") User owner,
            @Param("query") String query
    );
}