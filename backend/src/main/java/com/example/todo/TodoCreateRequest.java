package com.example.todo;

import jakarta.validation.constraints.NotBlank;

public record TodoCreateRequest(
    @NotBlank(message = "Title is required")
    String title,
    String description,
    TodoStatus status
) {
}
