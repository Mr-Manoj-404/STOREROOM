package com.storeroom.backend.repository;

import com.storeroom.backend.entity.Folder;
import com.storeroom.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface FolderRepository extends JpaRepository<Folder, UUID> {

    List<Folder> findByOwnerAndParentIsNullOrderByNameAsc(
            User owner
    );

    List<Folder> findByOwnerAndParentOrderByNameAsc(
            User owner,
            Folder parent
    );

    boolean existsByOwnerAndParentAndName(
            User owner,
            Folder parent,
            String name
    );

    // =========================================================
    // GLOBAL SEARCH
    // =========================================================

    @Query("""
            SELECT f
            FROM Folder f
            WHERE f.owner = :owner
              AND LOWER(f.name) LIKE LOWER(CONCAT('%', :query, '%'))
            ORDER BY f.name ASC
            """)
    List<Folder> searchByOwnerAndName(
            @Param("owner") User owner,
            @Param("query") String query
    );
}