package com.storeroom.backend.dto;

import java.util.UUID;

public class CreateFolderRequest {

    private String name;
    private UUID parentId;

    public CreateFolderRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public UUID getParentId() {
        return parentId;
    }

    public void setParentId(UUID parentId) {
        this.parentId = parentId;
    }
}